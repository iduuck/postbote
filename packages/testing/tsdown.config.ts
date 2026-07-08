import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/register.ts"],
  format: ["esm"],
  dts: true,
  target: "es2022",
  platform: "neutral",
  sourcemap: true,
  clean: true,
  publint: true,
  deps: {
    onlyBundle: false,
  },
});
