import type { FastifyInstance } from "fastify";

/**
 * Overrides JSON body parsing to return the raw Buffer instead of a parsed
 * object. HMAC verification must run against the exact bytes the sender
 * signed — re-serializing a parsed object (JSON.stringify) can reorder keys
 * or change whitespace and silently break every signature check. Register
 * this inside a scoped plugin (see webhook.routes.ts) so it only affects
 * the webhook route's encapsulation context, not the rest of the app.
 */
export async function rawBodyPlugin(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_request, body, done) => {
    done(null, body);
  });
}
