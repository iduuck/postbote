import { execSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");
const node = process.execPath;
const npx = join(dirname(node), "npx");

// Packages excluded from ts-compat:
//   - adapter-contract: bundles vitest + uses generic Uint8Array<ArrayBuffer> (TS ≥5.7 feature)
const EXCLUDED = new Set(["adapter-contract"]);

const packages = readdirSync(join(root, "packages"))
  .filter(
    (p) =>
      existsSync(join(root, "packages", p, "package.json")) && !EXCLUDED.has(p),
  )
  .sort();

const tmpRoot = mkdtempSync(join(tmpdir(), "postbote-tsc-"));
const distDir = join(tmpRoot, "dist");
const projDir = join(tmpRoot, "project");
let exitCode = 0;

try {
  execSync(`mkdir -p ${distDir} ${projDir}`, { stdio: "pipe" });

  // 1. Pack each package into distDir
  const tarballs = [];
  for (const pkg of packages) {
    const pkgDir = join(root, "packages", pkg);
    const { name } = JSON.parse(
      readFileSync(join(pkgDir, "package.json"), "utf8"),
    );
    execSync(`pnpm pack --pack-destination ${distDir}`, {
      cwd: pkgDir,
      stdio: "pipe",
    });
    const safeName = name.replace("@", "").replace("/", "-");
    const [tgz] = readdirSync(distDir).filter(
      (f) => f.endsWith(".tgz") && f.startsWith(safeName),
    );
    if (!tgz) throw new Error("No tarball found for " + name);
    tarballs.push({ name, tgz: join(distDir, tgz) });
  }

  // 2. Fresh consumer-style project — install from tarballs
  writeFileSync(
    join(projDir, "package.json"),
    JSON.stringify({ name: "postbote-tsc", private: true, type: "module" }),
  );
  execSync("npm install " + tarballs.map((t) => t.tgz).join(" "), {
    cwd: projDir,
    stdio: "pipe",
    timeout: 120_000,
  });

  // 3. Write main.ts — imports every package by name.
  //    `import * as ns` exercises ALL public exports simultaneously.
  let source =
    "// Smoke type-check: all public exports of every @postbote package\n";
  for (const { name } of tarballs) {
    const ns = name.replace(/^@postbote\//, "").replace(/[-/]/g, "_");
    source += `import * as ${ns} from ${JSON.stringify(name)};\n`;
  }
  writeFileSync(join(projDir, "main.ts"), source);

  // 4. Test matrix: TS version × moduleResolution
  const tsVersions = ["~5.5.0", "latest"];
  const resolutions = [
    { module: "ESNext", resolution: "bundler", label: "bundler" },
    { module: "NodeNext", resolution: "NodeNext", label: "nodenext" },
  ];

  for (const tsVer of tsVersions) {
    const verLabel = tsVer === "latest" ? "latest" : tsVer;
    for (const { module: mod, resolution, label } of resolutions) {
      console.log(`\n=== TS ${verLabel}, moduleResolution: ${label} ===\n`);

      writeFileSync(
        join(projDir, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            target: "ES2022",
            module: mod,
            moduleResolution: resolution,
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            types: [],
          },
          include: ["main.ts"],
        }),
      );

      const tsPkg = tsVer === "latest" ? "typescript" : `typescript@${tsVer}`;
      try {
        execSync(`"${npx}" -p ${tsPkg} tsc --project tsconfig.json --noEmit`, {
          cwd: projDir,
          stdio: "pipe",
          timeout: 120_000,
        });
        console.log("  ✓ All packages type-check correctly");
      } catch (e) {
        const msg = (e.stderr || "") + (e.stdout || "") + String(e);
        const lines = msg.split("\n").filter(Boolean);
        console.error("  ✗ Type check failed");
        console.error("    " + lines.slice(-10).join("\n    "));
        exitCode = 1;
      }
    }
  }
} catch (e) {
  console.error("Fatal:", e.message);
  exitCode = 1;
} finally {
  execSync(`rm -rf ${tmpRoot}`, { stdio: "pipe" });
}

process.exit(exitCode);
