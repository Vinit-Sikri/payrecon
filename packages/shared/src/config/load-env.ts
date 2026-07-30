import type { ZodType, ZodTypeDef } from "zod";

/**
 * Parses process.env against a service-specific zod schema and exits the
 * process immediately with a readable error if anything is missing/invalid.
 * Every service must call this once at boot, before touching the DB/Redis/
 * network, so misconfiguration fails fast instead of surfacing as a mystery
 * runtime error later.
 */
export function loadEnv<T>(schema: ZodType<T, ZodTypeDef, unknown>, env: NodeJS.ProcessEnv = process.env): T {
  const result = schema.safeParse(env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    // eslint-disable-next-line no-console
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }

  return result.data;
}
