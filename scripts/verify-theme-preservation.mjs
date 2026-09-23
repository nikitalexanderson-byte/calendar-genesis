import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const baselinePath = path.join(root, "reports", "assets-baseline.json");
const manifestPath = path.join(root, "reports", "preservation-manifest.json");
const outputPath = path.join(root, "reports", "preservation-verification.json");
const baselineAssets = JSON.parse(await readFile(baselinePath, "utf8"));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const baselineCommit = manifest.baselineCommit;

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const currentFiles = {};
const walk = async (directory) => {
  for (const name of await readdir(directory)) {
    const absolute = path.join(directory, name);
    const details = await stat(absolute);
    if (details.isDirectory()) await walk(absolute);
    else {
      const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
      if (baselineAssets.files[relative]) {
        const bytes = await readFile(absolute);
        currentFiles[relative] = { sha256: sha256(bytes), bytes: bytes.length };
      }
    }
  }
};
await walk(path.join(root, "public"));

const expectedPaths = Object.keys(baselineAssets.files).sort();
const currentPaths = Object.keys(currentFiles).sort();
const removed = expectedPaths.filter((file) => !currentFiles[file]);
const changed = expectedPaths.filter((file) => currentFiles[file]
  && JSON.stringify(currentFiles[file]) !== JSON.stringify(baselineAssets.files[file]));

const sourceFiles = execFileSync("git", ["ls-tree", "-r", "--name-only", baselineCommit, "app"], {
  cwd: root,
  encoding: "utf8",
}).split(/\r?\n/u).filter((file) => /\.(?:ts|tsx|css)$/u.test(file));

const count = (source, expression) => [...source.matchAll(expression)].length;
const references = (source) => [...source.matchAll(/(?:["'`])(\/[^"'`\s)]+\.(?:png|jpe?g|svg|webp|gif|avif|ico)(?:\?[^"'`]*)?)(?:["'`])/giu)]
  .map((match) => match[1])
  .sort();
const sourceSignature = (source) => ({
  references: references(source),
  img: count(source, /<img\b/gu),
  svgImage: count(source, /<image\b/gu),
  inlineSvg: count(source, /<svg\b/gu),
  src: count(source, /\bsrc=/gu),
  srcSet: count(source, /\bsrcSet=/gu),
  backgroundImage: count(source, /\bbackgroundImage\b/gu),
  cssMediaUrl: count(source, /url\([^)]*\.(?:png|jpe?g|svg|webp|gif|avif|ico)[^)]*\)/giu),
  dynamicMediaTemplates: count(source, /\.(?:png|jpe?g|svg|webp|gif|avif|ico)\b/giu),
  iconSymbols: count(source, /\bsymbol\s*:/gu),
});

const slotChanges = [];
for (const file of sourceFiles) {
  const before = execFileSync("git", ["show", `${baselineCommit}:${file}`], { cwd: root, encoding: "utf8" });
  const after = await readFile(path.join(root, file), "utf8");
  const beforeSignature = sourceSignature(before);
  const afterSignature = sourceSignature(after);
  if (JSON.stringify(beforeSignature) !== JSON.stringify(afterSignature)) {
    slotChanges.push({ file, before: beforeSignature, after: afterSignature });
  }
}

const result = {
  schema: 1,
  baselineCommit,
  assets: {
    checked: expectedPaths.length,
    current: currentPaths.length,
    removed,
    changed,
    pass: removed.length === 0 && changed.length === 0 && expectedPaths.length === currentPaths.length,
  },
  sourceSlots: {
    filesChecked: sourceFiles.length,
    changedSignatures: slotChanges,
    pass: slotChanges.length === 0,
    coverage: "Static/dynamic media path literals, img/image/svg/src/srcSet/background-image counts and navigation symbol declarations in app source",
  },
};

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!result.assets.pass || !result.sourceSlots.pass) process.exitCode = 1;
