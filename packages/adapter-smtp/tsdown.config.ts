import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  target: "es2022",
  platform: "node",
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  sourcemap: true,
  clean: true,
  publint: true,
});
