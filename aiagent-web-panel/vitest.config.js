import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.test.js", "src/**/*.spec.js"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@backend": fileURLToPath(new URL("../aiagent-be", import.meta.url)),
    },
  },
  define: {
    "import.meta.env.VITE_API_KEY": JSON.stringify("test-key"),
    "import.meta.env.VITE_DISABLE_HMR_LOGS": JSON.stringify("true"),
  },
});
