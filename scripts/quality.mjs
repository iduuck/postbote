import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");
const node = process.execPath;
const npx = join(dirname(node), "npx");

const packages = readdirSync(join(root, "packages")).filter((p) =>
  existsSync(join(root, "packages", p, "package.json")),
);

let exitCode = 0;

// Pack everything into a fresh temp directory
const tmp = mkdtempSync(join(tmpdir(), "postbote-quality-"));
console.log("Packing into", tmp, "\n");

const tarballs = [];
for (const pkg of packages) {
  const dir = join(root, "packages", pkg);
  const { name } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  execSync(`pnpm pack --pack-destination ${tmp} 2>/dev/null`, {
    cwd: dir,
    stdio: "pipe",
  });
  const scopedName = name.replace("@", "").replace("/", "-");
  const tgz = join(
    tmp,
    readdirSync(tmp).filter(
      (f) => f.startsWith(scopedName) && f.endsWith(".tgz"),
    )[0],
  );
  tarballs.push({ name, tgz, pkg });
}

// ---------------------------------------------------------------------------
// 1. publint — over the packed tarball (catches missing files, wrong exports)
// ---------------------------------------------------------------------------
console.log("=== publint (packed tarball) ===\n");
for (const { name, tgz } of tarballs) {
  try {
    execSync(`"${npx}" publint ${tgz}`, { cwd: root, stdio: "inherit" });
    console.log("  ✓", name);
  } catch {
    console.error("  ✗", name);
    exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// 2. arethetypeswrong — check each package via packed tarball
// ---------------------------------------------------------------------------
console.log("\n=== arethetypeswrong ===\n");
for (const { name, tgz } of tarballs) {
  try {
    execSync(`"${npx}" attw --pack ${tgz} --profile esm-only`, {
      cwd: root,
      stdio: "inherit",
    });
    console.log("  ✓", name);
  } catch {
    console.error("  ✗", name);
    exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// 3. size-limit — check each package bundle size
// ---------------------------------------------------------------------------
console.log("\n=== size-limit ===\n");
try {
  execSync(`"${npx}" size-limit`, { cwd: root, stdio: "inherit" });
} catch {
  exitCode = 1;
}

process.exit(exitCode);
