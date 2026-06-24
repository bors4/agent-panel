import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@backend": fileURLToPath(new URL("../aiagent-be", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["localhost.charlesproxy.com"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://127.0.0.1:3000",
        ws: true,
      },
    },
    hmr: {
      overlay: false,
      pingTimeout: 5000,
      pingInterval: 10000,
    },
  },
  define: {
    "import.meta.env.VITE_DISABLE_HMR_LOGS": JSON.stringify("true"),
  },
});
