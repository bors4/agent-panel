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
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
    hmr: {
          // Увеличиваем таймауты, чтобы не спамить при кратковременных обрывах
          pingTimeout: 5000, // было, возможно, 1000
          pingInterval: 10000, // проверять реже
        },
  },
  define: {
      'import.meta.env.VITE_DISABLE_HMR_LOGS': JSON.stringify('true'),
    },
});
