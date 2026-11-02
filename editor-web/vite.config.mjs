import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

// Compila editor-web/ en un único HTML con todo dentro (lo carga el WebView del
// editor de ResiNotes). Uso: npm run editor:build
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
  resolve: {
    // @tiptap/react solo está dentro de TenTap: se usa esa misma copia, la que
    // usa su useTenTap (dos copias de TipTap rompen el editor).
    alias: {
      "@tiptap/react": fileURLToPath(new URL("../node_modules/@10play/tentap-editor/node_modules/@tiptap/react", import.meta.url)),
    },
    dedupe: ["react", "react-dom", "@tiptap/core", "@tiptap/pm"],
  },
  logLevel: "warn",
});
