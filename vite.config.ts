import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "build",
    minify: true,
    lib: {
      name: "Wibe3",
      entry: "src/index.ts",
      formats: ["es", "cjs", "iife"],
      fileName: (format) => `wibe3.${format}.js`,
    },
    rollupOptions: {
      external: ["react", "react-dom"],
    },
  },
});
