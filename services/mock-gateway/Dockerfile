# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
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
RUN npm run build --workspace=@payrecon/mock-gateway

# mock-gateway never touches Postgres, so unlike ingestion/worker its
# runtime image needs nothing but the bundle itself.
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S payrecon && adduser -S payrecon -G payrecon
COPY --from=build /app/services/mock-gateway/dist/server.js ./server.js
USER payrecon
EXPOSE 4000
CMD ["node", "server.js"]
