#!/usr/bin/env bash
set -euo pipefail

apk="${1:?APK path required}"
mapping="${2:?R8 mapping path required}"
label="${3:-native-release}"
[[ "$label" =~ ^[a-z0-9-]+$ ]] || { echo 'Invalid verification label' >&2; exit 1; }
test -s "$apk"
test -s "$mapping"
sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:?Android SDK required}}"
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
remote_apk="/data/local/tmp/genesis-${label}-verify.apk"
remote_dex="/data/local/tmp/genesis-${label}-verifier.dex"
trap 'adb shell rm -f "$remote_apk" "$remote_dex" >/dev/null 2>&1 || true; rm -rf -- "$work"' EXIT
mkdir -p "$work/classes" "$work/dex"
platform="$(find "$sdk/platforms" -name android.jar | sort -V | tail -1)"
build_tools="$(find "$sdk/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
javac --release 17 -cp "$platform" -d "$work/classes" "$root/scripts/android/GenesisDexVerifier.java"
"$build_tools/d8" --lib "$platform" --min-api 26 --output "$work/dex" "$work/classes/GenesisDexVerifier.class"

classes=()
for source in GenesisAppKt SharedProjectsScreenKt ProjectsScreenKt CalendarScreenKt HabitsScreenKt HabitMeasurementControlsKt TodayHabitsContentKt; do
  renamed="$(awk -v source="ru.genesis.calendar.ui.$source" '$1 == source && $2 == "->" { sub(/:$/, "", $3); print $3 }' "$mapping")"
  [[ "$renamed" =~ ^[A-Za-z_][A-Za-z0-9_.]*$ ]] || { echo "Missing release screen mapping: $source" >&2; exit 1; }
  classes+=("$renamed")
done
adb push "$apk" "$remote_apk" >/dev/null
adb push "$work/dex/classes.dex" "$remote_dex" >/dev/null
adb shell "CLASSPATH=$remote_dex app_process /system/bin GenesisDexVerifier $remote_apk ${classes[*]}"
