import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["esm"],
  clean: true,
  dts: true,
  sourcemap: true,
  target: "node22.0.0",
  minify: true,
})
