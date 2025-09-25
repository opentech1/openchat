# syntax=docker/dockerfile:1.6

# Build application artifacts with Bun/Next.js
FROM oven/bun:1.2.21 AS builder
WORKDIR /app
ENV BUN_INSTALL_CACHE=/tmp/.bun-cache

COPY bun.lock bunfig.toml package.json turbo.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json

RUN bun install

COPY . .

ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG CLERK_SECRET_KEY
ARG CLERK_PUBLISHABLE_KEY

ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} \
    CLERK_SECRET_KEY=${CLERK_SECRET_KEY} \
    CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY} \
    NEXT_PUBLIC_SERVER_URL=http://localhost:3000 \
    NEXT_PUBLIC_ELECTRIC_URL=http://localhost:3010 \
    ELECTRIC_SERVICE_URL=http://localhost:3010 \
    NEXT_PUBLIC_DEV_BYPASS_AUTH=0 \
    NEXT_TELEMETRY_DISABLED=1

RUN bunx turbo run build --filter=server --filter=web

# Node runtime for the Next.js standalone server
FROM node:20-slim AS node_runtime

# ElectricSQL binary stage
FROM electricsql/electric:latest AS electric_runtime

# Final runtime image: combine Postgres, ElectricSQL, Bun API, and Next.js web
FROM debian:bookworm-slim AS runner

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    tini \
    postgresql \
    postgresql-contrib \
  && rm -rf /var/lib/apt/lists/*

# Copy Bun runtime from builder
COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun
COPY --from=builder /usr/local/lib/bun /usr/local/lib/bun
COPY --from=builder /usr/local/share/bun /usr/local/share/bun
COPY --from=builder /usr/local/include/bun /usr/local/include/bun

# Copy Node runtime from official image
COPY --from=node_runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node_runtime /usr/local/bin/npm /usr/local/bin/npm
COPY --from=node_runtime /usr/local/bin/npx /usr/local/bin/npx
COPY --from=node_runtime /usr/local/lib/node_modules /usr/local/lib/node_modules
# Copy ElectricSQL binary and assets
COPY --from=electric_runtime /app /opt/electric

WORKDIR /app

# Application artifacts
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/web/.next/standalone ./apps/web/standalone
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/bunfig.toml ./bunfig.toml
COPY --from=builder /app/apps/server/drizzle.config.ts ./apps/server/drizzle.config.ts

# Helper SQL files (if any)
COPY --from=builder /app/infra/postgres-init ./infra/postgres-init

# Entry script orchestrating Postgres, Electric, API, and web
COPY infra/docker-entrypoint.sh ./infra/docker-entrypoint.sh

RUN chmod +x ./infra/docker-entrypoint.sh \
  && mkdir -p /var/lib/postgresql/data \
  && chown -R postgres:postgres /var/lib/postgresql \
  && ln -sf /usr/local/bin/node /usr/bin/node

ENV PATH=/opt/electric/bin:$PATH

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    SERVER_PORT=3000 \
    WEB_PORT=3001 \
    ELECTRIC_HTTP_PORT=3010 \
    ELECTRIC_PROXY_PORT=5133 \
    POSTGRES_PORT=5432 \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres \
    POSTGRES_DB=openchat \
    POSTGRES_SHADOW_DB=openchat_shadow \
    PGDATA=/var/lib/postgresql/data \
    NEXT_PUBLIC_DEV_BYPASS_AUTH=0 \
    NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000 3001 3010 5133 5432

ENTRYPOINT ["/usr/bin/tini", "--", "/app/infra/docker-entrypoint.sh"]
