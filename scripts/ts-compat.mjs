import { execSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");
const packages = readdirSync(join(root, "packages")).filter((p) =>
  existsSync(join(root, "packages", p, "package.json")),
);

// The oldest TS version we support (must parse our .d.ts output)
const TS_VERSIONS = ["5.5", "latest"];
let exitCode = 0;

for (const tsVer of TS_VERSIONS) {
  const label = tsVer === "latest" ? "latest" : `~${tsVer}.0`;
  console.log(`\n=== TypeScript ${label} ===\n`);

  for (const pkg of packages) {
    const dist = join(root, "packages", pkg, "dist");
    if (!existsSync(dist)) {
      console.log(`  - ${pkg}: no dist/, skipping`);
      continue;
    }

    // Create a temp project that imports every public export
    const tmp = join(root, "scripts", `.ts-compat-${pkg}-${tsVer}`);
    const main = join(tmp, "main.ts");
    const tsconfig = join(tmp, "tsconfig.json");
    const indexDts = join(dist, "index.d.ts");
    if (!existsSync(indexDts)) {
      console.log(`  - ${pkg}: no index.d.ts, skipping`);
      continue;
    }

    // Extract export names from the .d.ts to generate a smoke import
    const dts = execSync(`cat ${indexDts}`, { cwd: root, encoding: "utf-8" });
    const exports_ =
      dts.match(
        /export\s+(?:declare\s+)?(?:function|const|class|type|interface)\s+(\w+)/g,
      ) || [];
    const names = exports_.map((e) =>
      e.replace(
        /^export\s+(?:declare\s+)?(?:function|const|class|type|interface)\s+/,
        "",
      ),
    );

    execSync(`mkdir -p ${tmp}`, { cwd: root, stdio: "pipe" });

    // Import from relative path to the dist folder (simulates consumer)
    const importPath = `../../packages/${pkg}/dist/index.d.ts`;
    writeFileSync(
      main,
      `// Smoke type-check: all public exports of @postbote/${pkg}\n` +
        `import { ${names.join(", ")} } from ${JSON.stringify(importPath)};\n` +
        `console.log("${pkg}:", ${JSON.stringify(names)});\n`,
    );

    writeFileSync(
      tsconfig,
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: [],
        },
        include: ["main.ts"],
      }),
    );

    try {
      const _pkgPath = join(root, "packages", pkg);
      // Use the TypeScript version specified
      const tsPkg =
        tsVer === "latest" ? "typescript" : `typescript@~${tsVer}.0`;
      const npxCmd = `npx -p ${tsPkg} tsc --project ${tsconfig}`;
      execSync(npxCmd, { cwd: root, stdio: "pipe", timeout: 30000 });
      console.log(`  ✓ ${pkg}`);
    } catch (e) {
      const msg = e.stderr?.toString() || e.stdout?.toString() || String(e);
      console.error(`  ✗ ${pkg}`);
      console.error(
        `    ${msg.split("\n").filter(Boolean).slice(-5).join("\n    ")}`,
      );
      exitCode = 1;
    }

    // Clean temp project
    execSync(`rm -rf ${tmp}`, { cwd: root, stdio: "pipe" });
  }
}

process.exit(exitCode);
