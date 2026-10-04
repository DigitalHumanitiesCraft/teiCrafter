import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Dev-only configuration for the viewer prototypes. The server root is the
// repository so that pages under prototypes/ can link ../src assets directly.
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root: repositoryRoot,
  appType: "mpa",
  base: "./",
  publicDir: false,
  server: { host: "127.0.0.1", port: 5174, strictPort: true, open: "/prototypes/index.html" },
});
