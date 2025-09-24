# syntax=docker/dockerfile:1.6

FROM oven/bun:1.2.21 AS deps
WORKDIR /app
ENV BUN_INSTALL_CACHE=/tmp/.bun-cache

COPY bun.lock bunfig.toml package.json turbo.json ./
COPY apps/web/package.json apps/web/package.json

RUN bun install

FROM deps AS build
COPY . .
ENV NEXT_PUBLIC_SERVER_URL=http://localhost:3000 \
    NEXT_PUBLIC_ELECTRIC_URL=http://localhost:3010 \
    ELECTRIC_SERVICE_URL=http://localhost:3010 \
    NEXT_TELEMETRY_DISABLED=1
RUN bunx turbo run build --filter=web

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3001

COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

ENV PATH="/app/node_modules/.bin:${PATH}"
WORKDIR /app/apps/web

EXPOSE 3001

CMD ["next", "start", "-H", "0.0.0.0", "-p", "3001"]
