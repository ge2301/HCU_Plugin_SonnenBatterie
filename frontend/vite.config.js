import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The built assets are served by the plugin's embedded HTTP server from ./public,
// so we use relative asset paths (base: "./"). During local development the
// dev server proxies API calls to the running plugin on port 8090.
// The proxy is configured to silently fail when the backend is not running —
// the frontend shows a helpful hint instead of crashing.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8090",
        changeOrigin: true,
        secure: false,
        ws: false,
        configure: (proxy) => {
          proxy.on("error", () => {
            // Silently ignore — frontend handles the failure gracefully
          });
          proxy.on("proxyReq", () => {});
          proxy.on("proxyRes", () => {});
        },
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
