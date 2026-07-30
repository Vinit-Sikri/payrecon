import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    // Integration tests share one Postgres/Redis instance and truncate
    // tables between tests — running them concurrently would race.
    fileParallelism: false,
  },
});
