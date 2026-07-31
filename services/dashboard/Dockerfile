# syntax=docker/dockerfile:1

# ---- build ----
# No esbuild/CJS bundling here (unlike the other three services) — this is a
# static SPA, so the "build" is `tsc -b && vite build` producing plain
# HTML/CSS/JS assets, not a Node entrypoint.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY services/ingestion/package.json services/ingestion/package.json
COPY services/mock-gateway/package.json services/mock-gateway/package.json
COPY services/reconciliation-worker/package.json services/reconciliation-worker/package.json
COPY services/dashboard/package.json services/dashboard/package.json
RUN npm ci
COPY . .

# Vite inlines VITE_* env vars into the built JS at build time — unlike the
# other services' docker-compose `environment:` overrides (read at container
# start), these must be build ARGs. They should point at whatever the
# *browser* can reach (the host-mapped ports), not the in-network service
# names, since the bundle runs in the user's browser, not inside the compose
# network.
ARG VITE_API_BASE_URL=http://localhost:3000
ARG VITE_GATEWAY_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GATEWAY_BASE_URL=$VITE_GATEWAY_BASE_URL
RUN npm run build --workspace=@payrecon/dashboard

# ---- runtime ----
FROM nginx:alpine AS runtime
COPY --from=build /app/services/dashboard/dist /usr/share/nginx/html
COPY services/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
