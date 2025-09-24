# syntax=docker/dockerfile:1.6

FROM oven/bun:1.2.21 AS deps
WORKDIR /app
ENV BUN_INSTALL_CACHE=/tmp/.bun-cache

COPY bun.lock bunfig.toml package.json turbo.json ./
COPY apps/server/package.json apps/server/package.json

RUN bun install

FROM deps AS build
COPY . .
RUN bunx turbo run build --filter=server

FROM oven/bun:1.2.21-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/server/package.json ./package.json
COPY --from=deps /app/bun.lock ./bun.lock
COPY --from=deps /app/bunfig.toml ./bunfig.toml

RUN chown -R bun:bun /app
USER bun

EXPOSE 3000

CMD ["bun", "dist/index.js"]
