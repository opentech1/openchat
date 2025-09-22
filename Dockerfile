# syntax=docker/dockerfile:1.6

FROM oven/bun:1.2.21 AS base
WORKDIR /app
ENV BUN_INSTALL_CACHE=/tmp/.bun-cache

COPY bun.lock bunfig.toml package.json turbo.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json

RUN bun install

COPY . .

ENV NEXT_PUBLIC_SERVER_URL=http://localhost:3000 \
    NEXT_PUBLIC_ELECTRIC_URL=http://localhost:3010 \
    ELECTRIC_SERVICE_URL=http://localhost:3010 \
    NEXT_TELEMETRY_DISABLED=1
RUN bunx turbo run build --filter=web --filter=server

FROM oven/bun:1.2.21-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV SERVER_PORT=3000
ENV WEB_PORT=3001

RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates curl tini \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=base /app/apps/server/dist ./apps/server/dist
COPY --from=base /app/apps/server/package.json ./apps/server/package.json
COPY --from=base /app/apps/web/.next/standalone ./apps/web/.next/standalone
COPY --from=base /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=base /app/apps/web/public ./apps/web/public
COPY --from=base /app/apps/web/package.json ./apps/web/package.json
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/bun.lock ./bun.lock
COPY --from=base /app/bunfig.toml ./bunfig.toml
COPY --from=base /app/infra/docker-entrypoint.sh ./infra/docker-entrypoint.sh

RUN chmod +x infra/docker-entrypoint.sh

RUN chown -R bun:bun /app
USER bun

EXPOSE 3000 3001

ENTRYPOINT ["/usr/bin/tini", "--", "/app/infra/docker-entrypoint.sh"]
