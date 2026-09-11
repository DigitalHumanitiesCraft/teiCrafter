import { execFileSync } from "node:child_process";
import { copyFileSync, lstatSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const repositoryRoot = fileURLToPath(new URL(".", import.meta.url));
const docsRoot = resolve(repositoryRoot, "docs");
const outputRoot = resolve(repositoryRoot, "dist");

export function copyRuntimeCollections(root = repositoryRoot) {
  return {
    name: "copy-runtime-collections",
    closeBundle() {
      // Only versioned files cross the publication boundary; local examples may
      // contain edition material whose redistribution is not permitted.
      const paths = execFileSync("git", [
        "ls-files", "--cached", "-z", "--", "docs/data", "docs/schemas", "docs/vendor",
      ], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
      for (const path of paths) {
        const source = resolve(root, path);
        if (!lstatSync(source).isFile()) {
          throw new Error(`Runtime asset must be a regular versioned file: ${path}`);
        }
        const target = resolve(root, "dist", path.slice("docs/".length));
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(source, target);
      }
    },
  };
}

export default defineConfig({
  root: docsRoot,
  appType: "mpa",
  base: "./",
  publicDir: false,
  worker: { format: "es" },
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
