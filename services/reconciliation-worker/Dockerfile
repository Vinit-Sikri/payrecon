# syntax=docker/dockerfile:1

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

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run db:generate
RUN npm run build --workspace=@payrecon/reconciliation-worker

# See services/ingestion/Dockerfile for why this is a separate install
# rather than a prune of `deps` — supplies @prisma/client's native query
# engine, left external from the bundle above.
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

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S payrecon && adduser -S payrecon -G payrecon
COPY --from=build /app/services/reconciliation-worker/dist/index.js ./index.js
COPY --from=prod-deps /app/node_modules ./node_modules
USER payrecon
EXPOSE 4100
CMD ["node", "index.js"]
