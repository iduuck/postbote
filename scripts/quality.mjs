import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");
const packages = readdirSync(join(root, "packages")).filter((p) =>
  existsSync(join(root, "packages", p, "package.json")),
);

let exitCode = 0;

console.log("\n=== arethetypeswrong ===\n");

for (const pkg of packages) {
  const dir = join(root, "packages", pkg);
  const { name } = JSON.parse(
    execSync("node -p \"JSON.stringify(require('./package.json'))\"", {
      cwd: dir,
      encoding: "utf-8",
    }),
  );

  try {
    execSync("pnpm pack --pack-destination /tmp 2>/dev/null", {
      cwd: dir,
      stdio: "pipe",
    });
    const tgz = name.replace("@", "").replace("/", "-");
    execSync(`attw --pack /tmp/${tgz}-*.tgz --profile esm-only`, {
      cwd: root,
      stdio: "inherit",
    });
    console.log(`  ✓ ${name}`);
  } catch {
    console.error(`  ✗ ${name}`);
    exitCode = 1;
  }
}

console.log("\n=== size-limit ===\n");

try {
  execSync("npx size-limit", { cwd: root, stdio: "inherit" });
} catch {
  exitCode = 1;
}

process.exit(exitCode);
