// Bump the product version by one minor step (X.Y.Z -> X.(Y+1).0), resetting the
// patch digit to zero. Used by the "Prepare Next Version" workflow after an
// official GitHub Release is published, so the next development cycle starts on
// a fresh minor version (e.g. after releasing v1.1.1 the repo moves to 1.2.0).
//
// The base version comes from --base <version> (or the BASE_VERSION env var),
// which is normally the tag of the release that was just published. When no base
// is given it falls back to the root package.json version.
//
// Edits are textual (only the version number changes) so the original file
// formatting is preserved and `prettier --check` keeps passing. The independent
// package (packages/merge-engine) and the package-lock.json are intentionally
// left untouched.

import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`bump-minor-version: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base") {
      args.base = argv[i + 1];
      i += 1;
    } else if (arg.startsWith("--base=")) {
      args.base = arg.slice("--base=".length);
    }
  }
  return args;
}

function normalizeBase(raw) {
  if (!raw) return null;
  return raw.trim().replace(/^v/i, "");
}

const args = parseArgs(process.argv.slice(2));
const rootPackagePath = resolve(repoRoot, "package.json");

let baseVersion = normalizeBase(args.base ?? process.env.BASE_VERSION);
if (!baseVersion) {
  const rootPackage = JSON.parse(readFileSync(rootPackagePath, "utf8"));
  baseVersion = normalizeBase(rootPackage.version);
  console.log(`No --base given, falling back to package.json version ${baseVersion}.`);
}

const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(baseVersion);
if (!match) {
  fail(
    `base version "${baseVersion}" must be a clean X.Y.Z (no pre-release suffix) to compute a minor bump.`,
  );
}

const [, major, minor] = match;
const newVersion = `${major}.${Number(minor) + 1}.0`;
console.log(`Bumping product version: ${baseVersion} -> ${newVersion}`);

// Each edit reports whether it actually changed the file, so a re-run (or an
// already-aligned file) is a warning instead of a hard failure.
function editFile(relPath, transform) {
  const filePath = resolve(repoRoot, relPath);
  const original = readFileSync(filePath, "utf8");
  const updated = transform(original);
  if (updated === original) {
    console.warn(`  ~ ${relPath}: no change (version pattern not found or already ${newVersion})`);
    return;
  }
  writeFileSync(filePath, updated, "utf8");
  console.log(`  ✓ ${relPath}`);
}

// JSON files: replace only the top-level "version" value, leaving formatting intact.
function replaceJsonVersion(content) {
  return content.replace(/("version"\s*:\s*")[^"]*(")/, `$1${newVersion}$2`);
}

editFile("package.json", replaceJsonVersion);
editFile("apps/desktop/package.json", replaceJsonVersion);
editFile("apps/desktop/src-tauri/tauri.conf.json", replaceJsonVersion);

// Cargo.toml: only the [package] version line starts at column 0.
editFile("apps/desktop/src-tauri/Cargo.toml", (content) =>
  content.replace(/(^version\s*=\s*")[^"]*(")/m, `$1${newVersion}$2`),
);

// Cargo.lock: the version line right after the mergescope package entry.
editFile("apps/desktop/src-tauri/Cargo.lock", (content) =>
  content.replace(/(name\s*=\s*"mergescope"\s*\r?\nversion\s*=\s*")[^"]*(")/, `$1${newVersion}$2`),
);

const branch = `chore/bump-v${newVersion}`;

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `new_version=${newVersion}\nbase_version=${baseVersion}\nbranch=${branch}\n`,
  );
}

console.log(`Done. New version ${newVersion} (branch ${branch}).`);
