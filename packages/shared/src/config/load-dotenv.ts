import path from "node:path";
import dotenv from "dotenv";

/**
 * Loads the repo-root .env file regardless of which workspace package the
 * process is started from (npm sets cwd to the workspace dir, e.g.
 * services/ingestion, when running `npm run dev --workspace=...`). Every
 * service's entrypoint calls this before reading any env vars.
 */
export function loadDotEnv(): void {
  dotenv.config({ path: path.resolve(process.cwd(), "..", "..", ".env") });
}
