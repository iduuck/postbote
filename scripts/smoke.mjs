import { execSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");
const node = process.execPath;

// Packages that bundle vitest (test suites) — can't be imported outside vitest context
const VITEST_PACKAGES = new Set(["@postbote/adapter-contract"]);

const packages = readdirSync(join(root, "packages"))
  .filter((p) => existsSync(join(root, "packages", p, "package.json")))
  .sort();

const tmpRoot = mkdtempSync(join(tmpdir(), "postbote-smoke-"));
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
    JSON.stringify({ name: "postbote-smoke", private: true, type: "module" }),
  );
  execSync("npm install " + tarballs.map((t) => t.tgz).join(" "), {
    cwd: projDir,
    stdio: "pipe",
    timeout: 120_000,
  });

  // 3. ESM import — test each package individually
  console.log("--- ESM import ---\n");
  for (const { name } of tarballs) {
    if (VITEST_PACKAGES.has(name)) {
      console.log("  ~ " + name + " (requires vitest context, skipping)");
      continue;
    }
    const ns = name.replace(/^@postbote\//, "").replace(/[-/]/g, "_");
    const testSrc = `import * as ${ns} from ${JSON.stringify(name)};\nconsole.log("  ✓ ${name}:", Object.keys(${ns}).join(", "));\n`;
    writeFileSync(join(projDir, "test.mjs"), testSrc);
    try {
      execSync(`"${node}" test.mjs`, {
        cwd: projDir,
        stdio: "pipe",
        timeout: 15_000,
      });
      console.log("  ✓ " + name);
    } catch (e) {
      const stderr = (e.stderr || "").toString();
      console.error("  ✗ " + name);
      if (stderr)
        console.error(
          "    " + stderr.trim().split("\n").slice(-3).join("\n    "),
        );
      exitCode = 1;
    }
  }

  // 4. CJS require(esm)
  console.log("\n--- CJS require(esm) ---\n");
  const nodeMajor = parseInt(process.versions.node, 10);

  for (const { name } of tarballs) {
    if (VITEST_PACKAGES.has(name)) {
      console.log("  ~ " + name + " (requires vitest context, skipping)");
      continue;
    }
    const ns = name.replace(/^@postbote\//, "").replace(/[-/]/g, "_");
    const testSrc = `const ${ns} = require(${JSON.stringify(name)});\nconsole.log("  ✓ ${name}:", Object.keys(${ns}).join(", "));\n`;
    writeFileSync(join(projDir, "test.cjs"), testSrc);

    try {
      if (nodeMajor >= 23) {
        execSync(`"${node}" test.cjs`, {
          cwd: projDir,
          stdio: "pipe",
          timeout: 15_000,
        });
      } else if (nodeMajor >= 22) {
        execSync(`"${node}" --experimental-require-module test.cjs`, {
          cwd: projDir,
          stdio: "pipe",
          timeout: 15_000,
        });
      } else {
        console.log(
          "  ~ " +
            name +
            " (require(esm) unsupported on Node " +
            nodeMajor +
            ")",
        );
        continue;
      }
      console.log("  ✓ " + name);
    } catch (e) {
      const stderr = (e.stderr || "").toString();
      if (stderr.includes("ERR_REQUIRE_ESM")) {
        console.log(
          "  ~ " +
            name +
            " (require(esm) unsupported on Node " +
            nodeMajor +
            ")",
        );
      } else {
        console.error("  ✗ " + name);
        if (stderr)
          console.error(
            "    " + stderr.trim().split("\n").slice(-3).join("\n    "),
          );
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
