import { cpSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));
const docsRoot = resolve(repositoryRoot, "docs");
const outputRoot = resolve(repositoryRoot, "dist");

function copyRuntimeCollections() {
  return {
    name: "copy-runtime-collections",
    closeBundle() {
      for (const directory of ["data", "schemas", "vendor"]) {
        cpSync(resolve(docsRoot, directory), resolve(outputRoot, directory), {
          recursive: true,
        });
      }
    },
  };
}

export default defineConfig({
  root: docsRoot,
  base: "./",
  publicDir: false,
  build: {
    outDir: outputRoot,
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        index: resolve(docsRoot, "index.html"),
        editor: resolve(docsRoot, "editor.html"),
        about: resolve(docsRoot, "about.html"),
      },
    },
  },
  plugins: [copyRuntimeCollections()],
});
