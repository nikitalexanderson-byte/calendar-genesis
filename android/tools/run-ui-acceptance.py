"""Synthetic emulator checks; no release credentials, publishing, or real accounts."""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

PACKAGE = "ru.genesis.calendar.g1qa.debug"
TEST = PACKAGE + ".test/androidx.test.runner.AndroidJUnitRunner"
ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial")
    parser.add_argument("--output", type=Path, default=Path("output/native-ui-acceptance"))
    parser.add_argument("--suite", choices=["all", "welcome", "restoration", "habits"], default="all")
    args = parser.parse_args()
    adb = shutil.which("adb")
    if not adb:
        sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
        assert sdk, "Android SDK is required"
        adb = str(Path(sdk) / "platform-tools" / ("adb.exe" if os.name == "nt" else "adb"))
    devices = subprocess.check_output([adb, "devices"], text=True).splitlines()[1:]
    emulators = [row.split()[0] for row in devices if len(row.split()) == 2 and row.split()[1] == "device" and row.startswith("emulator-")]
    serial = args.serial or (emulators[0] if len(emulators) == 1 else None)
    assert serial in emulators, "Choose one connected emulator; physical phones are excluded"
    output = (ROOT / args.output).resolve()
    output.relative_to(ROOT / "output")
    output.mkdir(parents=True, exist_ok=True)

    def command(*values, timeout=60):
        result = subprocess.run([adb, "-s", serial, *map(str, values)], capture_output=True,
            text=True, encoding="utf8", timeout=timeout)
        assert result.returncode == 0, result.stdout + result.stderr
        return result.stdout + result.stderr

    sdk = Path(os.environ.get("ANDROID_HOME") or os.environ["ANDROID_SDK_ROOT"])
    aapt = sdk / "build-tools/37.0.0" / ("aapt.exe" if os.name == "nt" else "aapt")
    apks = [(ROOT / "android/app/build/outputs/apk/debug/app-debug.apk", PACKAGE),
        (ROOT / "android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk", PACKAGE + ".test")]
    hashes = {}
    for path, expected in apks:
        # aapt's Windows argv handling rejects non-ASCII absolute checkout paths.
        metadata = subprocess.check_output([str(aapt), "dump", "badging", str(path.relative_to(ROOT))],
            cwd=ROOT, text=True, encoding="utf8")
        assert re.search(r"package: name='" + re.escape(expected) + r"'", metadata), "Only the isolated QA APK may be installed"
        if expected.endswith(".test"):
            manifest = subprocess.check_output([str(aapt), "dump", "xmltree", str(path.relative_to(ROOT)), "AndroidManifest.xml"],
                cwd=ROOT, text=True, encoding="utf8")
            assert any("android:targetPackage(" in line and f'"{PACKAGE}"' in line for line in manifest.splitlines()), \
                "Instrumentation must target the isolated QA app"
        hashes[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
        assert "Success" in command("install", "-r", "-t", path, timeout=120)

    original = {key: command("shell", "settings", "get", "system", key).strip()
        for key in ["font_scale", "accelerometer_rotation", "user_rotation"]}
    original["size"] = command("shell", "wm", "size")
    original["density"] = command("shell", "wm", "density")
    receipt = {"serial": serial, "sdk": command("shell", "getprop", "ro.build.version.sdk").strip(),
        "avd": command("emu", "avd", "name").splitlines()[0], "apks": hashes, "originalDisplay": original,
        "checks": [], "deploymentPerformed": False, "physicalPhoneUsed": False}
    (output / "receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf8")

    def display(width, scale):
        height = {360: 800, 390: 844, 768: 1024, 1440: 2000}[width]
        factor = 1 if width == 1440 else 2
        command("shell", "wm", "size", f"{width * factor}x{height * factor}")
        command("shell", "wm", "density", 160 * factor)
        command("shell", "settings", "put", "system", "font_scale", scale)
        command("shell", "settings", "put", "system", "accelerometer_rotation", 0)
        command("shell", "settings", "put", "system", "user_rotation", 0)

    def check(case, test_class, captures=(), **flags):
        values = ["shell", "am", "instrument", "-w", "-r", "-e", "class", test_class]
        for key, value in flags.items():
            values += ["-e", key, str(value).lower() if isinstance(value, bool) else str(value)]
        try:
            log = command(*values, TEST, timeout=420)
        except (AssertionError, subprocess.TimeoutExpired) as error:
            log = str(error)
        (output / (case + ".log")).write_text(log, encoding="utf8")
        passed = "OK (1 test)" in log and not any(error in log for error in
            ["FAILURES!!!", "Process crashed", "INSTRUMENTATION_STATUS_CODE: -2", "INSTRUMENTATION_STATUS_CODE: -3", "INSTRUMENTATION_STATUS_CODE: -4"])
        result = {"case": case, "instrumentationPassed": passed, "passed": False}
        receipt["checks"].append(result)
        (output / "receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf8")
        # Keep any frames drawn before a failure; a passing run must supply all evidence.
        for name, folder in captures:
            try:
                pull(case, name, folder)
            except (AssertionError, subprocess.TimeoutExpired):
                if passed:
                    raise
        if test_class == "ru.genesis.calendar.HabitReportCaptureTest":
            # Retain failed physical frames too; they are diagnostics, never accepted evidence.
            try:
                names = command("shell", "ls", f"/sdcard/Android/data/{PACKAGE}/files/ef-captures").splitlines()
                stems = {Path(name).stem for name, _ in captures if name.endswith(".png")}
                for name in names:
                    if any(name in {f"{stem}.rejected-{attempt}.png" for attempt in range(1, 4)} for stem in stems):
                        pull(case, name, "ef-captures")
            except (AssertionError, subprocess.TimeoutExpired):
                if passed:
                    raise
            if passed:
                result["paintedFrames"] = []
                for name, _ in captures:
                    if not name.endswith(".metrics.json"):
                        continue
                    metrics = json.loads((output / case / name).read_text(encoding="utf8"))
                    assert metrics["surfaceFraction"] >= .15, f"{case}: missing app Surface"
                    assert 1 <= metrics["captureAttempts"] <= 3, f"{case}: invalid capture attempts"
                    assert metrics["frameSync"] in ["render-thread-commit", "animation-fallback"]
                    png = name.removesuffix(".metrics.json") + ".png"
                    result["paintedFrames"].append({"png": png,
                        "sha256": hashlib.sha256((output / case / png).read_bytes()).hexdigest(),
                        **{key: metrics[key] for key in ["surfaceFraction", "captureAttempts", "frameSync"]}})
        assert passed, log[-5000:]
        result["passed"] = True
        (output / "receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf8")
        print(f"API{receipt['sdk']} {case}: PASS", flush=True)

    def pull(case, name, folder=""):
        target = output / case / name
        target.parent.mkdir(parents=True, exist_ok=True)
        command("pull", f"/sdcard/Android/data/{PACKAGE}/files/{folder + '/' if folder else ''}{name}", target)

    try:
        if args.suite in ["all", "welcome"]:
            for width, scale in [(360, 1.0), (390, 1.0), (768, 1.0), (1440, 1.0), (390, 1.3), (768, 1.3)]:
                display(width, scale)
                for language in ["ru", "en"]:
                    for dark in [False, True]:
                        stem = f"after-{width}-{language}-{'dark' if dark else 'light'}-font{round(scale * 100)}"
                        case = "welcome-" + stem
                        captures = [(f"{stem}-{scene}.png", "welcome-recovery")
                            for scene in ["waiting", "canceled", "network", "cloud-retry"]]
                        captures.append((stem + ".json", "welcome-recovery"))
                        check(case, "ru.genesis.calendar.WelcomeRecoveryUiTest", captures, genesisLanguage=language,
                            genesisDark=dark, genesisExpectedWidth=width, genesisExpectedFontScale=scale)
        if args.suite in ["all", "restoration"]:
            for width in [390, 768]:
                display(width, 1.3)
                for scheme, method in [("light", "lightJourneyKeepsTheDrawAndTurnsActionIntoOneTetractysPoint"),
                        ("dark", "darkJourneyKeepsTheDrawAndTurnsActionIntoOneTetractysPoint")]:
                    case = f"restoration-{width}-{scheme}-font130"
                    captures = [(f"restoration-{scheme}-{scene}{extension}", "")
                        for scene in ["meaning", "myth", "arithmetic", "practice", "cycle"]
                        for extension in [".png", ".metrics.json"]]
                    check(case, "ru.genesis.calendar.StoicheionRestorationFlowTest#" + method, captures)
            check("catalog-14-locales", "ru.genesis.calendar.StoicheionRestorationFlowTest#sharedCatalogRetainsAllNineFieldsFiveSupportsAndFourteenUiLocalesOffline")
        if args.suite in ["all", "habits"]:
            for width, scale in [(768, 1.3), (1440, 1.0)]:
                display(width, scale)
                for dark in [False, True]:
                    case = f"habits-{width}-{'dark' if dark else 'light'}-font{round(scale * 100)}"
                    captures = [(f"ef-{width}-ru-{'dark' if dark else 'light'}-font{round(scale * 100)}-{scene}{extension}", "ef-captures")
                        for scene in ["restore", "source"] for extension in [".png", ".metrics.json"]]
                    check(case, "ru.genesis.calendar.HabitReportCaptureTest", captures, genesisEFCapture=True,
                        genesisEFSystemCapture=True, genesisWidth=width, genesisLanguage="ru",
                        genesisDark=dark, genesisFontScale=scale, genesisEFCompact=True)
    finally:
        restored = False
        try:
            for key, pattern in [("size", r"Override size: (\d+x\d+)"), ("density", r"Override density: (\d+)")]:
                override = re.search(pattern, original[key])
                command("shell", "wm", key, override.group(1) if override else "reset")
            for key in ["font_scale", "accelerometer_rotation", "user_rotation"]:
                if original[key] == "null":
                    command("shell", "settings", "delete", "system", key)
                else:
                    command("shell", "settings", "put", "system", key, original[key])
            restored = True
        finally:
            receipt["displayRestored"] = restored
            (output / "receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf8")


if __name__ == "__main__":
    main()
