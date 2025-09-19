import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // Ensures assets load correctly in Electron (relative paths)
  base: "./",

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  build: {
    outDir: "dist", // Where your build goes
    emptyOutDir: true,
    sourcemap: false,
  },
});
