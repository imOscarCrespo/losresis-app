import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

// Compila el visor de PDFs en un único HTML (pdf.js y su worker dentro).
// Uso: npm run pdfviewer:build
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [viteSingleFile()],
  build: { outDir: "build", emptyOutDir: true, target: "es2020" },
  worker: { format: "es" },
  logLevel: "warn",
});
