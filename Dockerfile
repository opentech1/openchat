# syntax=docker/dockerfile:1.6

######################################################################
# Base dependencies stage – installs workspaces with Bun once
######################################################################
FROM oven/bun:1.2.21 AS base
WORKDIR /app
ENV BUN_INSTALL_CACHE=/tmp/.bun-cache

COPY bun.lock bunfig.toml package.json turbo.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json

RUN bun install

COPY . .

######################################################################
# Build the API (Bun + Elysia) bundle
######################################################################
FROM base AS build-server
ENV NEXT_TELEMETRY_DISABLED=1
RUN bunx turbo run build --filter=server

######################################################################
# Build the Next.js web app
######################################################################
FROM base AS build-web
ENV NEXT_PUBLIC_SERVER_URL=http://localhost:3000 \
    NEXT_PUBLIC_ELECTRIC_URL=http://localhost:3010 \
    ELECTRIC_SERVICE_URL=http://localhost:3010 \
    NEXT_TELEMETRY_DISABLED=1
RUN bunx turbo run build --filter=web

######################################################################
# Runtime image for the API service
######################################################################
FROM oven/bun:1.2.21-slim AS server-runner
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=build-server /app/apps/server/dist ./apps/server/dist
COPY --from=build-server /app/apps/server/package.json ./apps/server/package.json
COPY --from=base /app/bun.lock ./bun.lock
COPY --from=base /app/bunfig.toml ./bunfig.toml

RUN chown -R bun:bun /app
USER bun

EXPOSE 3000

CMD ["bun", "apps/server/dist/index.js"]

######################################################################
# Runtime image for the Next.js web app
######################################################################
FROM node:20-slim AS web-runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3001

COPY --from=build-web /app/apps/web/.next ./apps/web/.next
COPY --from=build-web /app/apps/web/public ./apps/web/public
COPY --from=build-web /app/apps/web/package.json ./apps/web/package.json
COPY --from=build-web /app/package.json ./package.json
COPY --from=build-web /app/node_modules ./node_modules

WORKDIR /app/apps/web

EXPOSE 3001

CMD ["node", "../node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3001"]
