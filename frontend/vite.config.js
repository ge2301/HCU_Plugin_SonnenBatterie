import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The built assets are served by the plugin's embedded HTTP server from ./public,
// so we use relative asset paths (base: "./"). During local development the
// dev server proxies API calls to the running plugin on port 8090.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    proxy: {
      "/api": "http://localhost:8090",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
