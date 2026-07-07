import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  target: "es2022",
  platform: "node",
  sourcemap: true,
  clean: true,
  publint: true,
});
