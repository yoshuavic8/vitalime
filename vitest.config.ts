import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify("test") },
  test: {
    environment: "node",
    setupFiles: ["fake-indexeddb/auto"],
    include: ["src/**/*.test.ts"],
  },
});
