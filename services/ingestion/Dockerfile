# syntax=docker/dockerfile:1

# ---- deps: full install (incl. devDependencies) for bundling ----
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY services/ingestion/package.json services/ingestion/package.json
COPY services/mock-gateway/package.json services/mock-gateway/package.json
COPY services/reconciliation-worker/package.json services/reconciliation-worker/package.json
RUN npm ci

# ---- build: generate the Prisma client and bundle this service into a
# single CommonJS file. @payrecon/shared and @payrecon/db have no dist of
# their own (see packages/*/package.json) — esbuild inlines their
# TypeScript source directly, which is what makes a plain `node
# dist/server.js` (no tsx/ts-node) work at runtime. True npm packages that
# read their own files off disk at runtime — Prisma's native query engine,
# @fastify/swagger-ui's bundled HTML/CSS/JS — are left external; esbuild
# can only bundle code, not fs.readFile'd static assets, so bundling them
# would break at runtime (see prod-deps below for how they're supplied). ----
FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run db:generate
RUN npm run build --workspace=@payrecon/ingestion

# ---- prod-deps: a clean, production-only node_modules (no tsx/esbuild/
# vitest/eslint/...) supplying the packages left external above, complete
# with their own transitive dependency trees. A fresh `npm ci --omit=dev`
# rather than pruning `deps`, since npm workspaces has no reliable way to
# drop devDependencies from an already-completed install. ----
FROM node:20-alpine AS prod-deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY services/ingestion/package.json services/ingestion/package.json
COPY services/mock-gateway/package.json services/mock-gateway/package.json
COPY services/reconciliation-worker/package.json services/reconciliation-worker/package.json
RUN npm ci --omit=dev
COPY packages/db/prisma packages/db/prisma
RUN npm run db:generate

# ---- runtime ----
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S payrecon && adduser -S payrecon -G payrecon
COPY --from=build /app/services/ingestion/dist/server.js ./server.js
COPY --from=prod-deps /app/node_modules ./node_modules
USER payrecon
EXPOSE 3000
CMD ["node", "server.js"]
