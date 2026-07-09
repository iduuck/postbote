import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");
const packages = readdirSync(join(root, "packages")).filter((p) =>
  existsSync(join(root, "packages", p, "package.json")),
);

let exitCode = 0;

// Pack each package into a fresh temp dir
const tmp = mkdtempSync(join(tmpdir(), "postbote-smoke-"));
console.log(`Packing into ${tmp}\n`);

const tarballs = [];
for (const pkg of packages) {
  const dir = join(root, "packages", pkg);
  const { name } = JSON.parse(
    execSync("node -p \"JSON.stringify(require('./package.json'))\"", {
      cwd: dir,
      encoding: "utf-8",
    }),
  );
  execSync(`pnpm pack --pack-destination ${tmp} 2>/dev/null`, {
    cwd: dir,
    stdio: "pipe",
  });
  const scopedName = name.replace("@", "").replace("/", "-");
  const tgz = join(
    tmp,
    ...readdirSync(tmp).filter((f) => f.startsWith(scopedName)),
  );
  tarballs.push({ name, tgz, pkg });
}

// Smoke: ESM import via dynamic import of the packed tarball
console.log("--- ESM import ---\n");
for (const { name, tgz } of tarballs) {
  console.log(`  Testing ${name} (ESM import)...`);
  try {
    execSync(
      `node --input-type=module -e "import pkg from '${tgz}'; console.log('  ✓', Object.keys(pkg).join(', '))"`,
      { cwd: tmp, stdio: "pipe", timeout: 15000 },
    );
  } catch {
    console.error(`  ✗ ${name} ESM import failed`);
    exitCode = 1;
  }
}

// Smoke: CJS require(esm) — the key bet of our ESM-only decision
console.log("\n--- CJS require(esm) ---\n");
for (const { name, tgz } of tarballs) {
  console.log(`  Testing ${name} (CJS require)...`);
  try {
    execSync(
      `node -e "const pkg = require('${tgz}'); console.log('  ✓', Object.keys(pkg).join(', '))"`,
      { cwd: tmp, stdio: "pipe", timeout: 15000 },
    );
  } catch {
    console.error(`  ✗ ${name} CJS require failed`);
    exitCode = 1;
  }
}

process.exit(exitCode);
