FROM oven/bun:1.3.1 AS deps
WORKDIR /app
ENV BUN_INSTALL_CACHE=/tmp/.bun-cache

# Build-time configuration
ARG NEXT_PUBLIC_APP_URL=http://localhost:3001
ARG NEXT_PUBLIC_SERVER_URL=http://localhost:3000
ARG NEXT_PUBLIC_ELECTRIC_URL=http://localhost:3010
ARG BETTER_AUTH_URL=http://localhost:3000

ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL} \
    NEXT_PUBLIC_ELECTRIC_URL=${NEXT_PUBLIC_ELECTRIC_URL} \
    BETTER_AUTH_URL=${BETTER_AUTH_URL} \
    NEXT_TELEMETRY_DISABLED=1

COPY bun.lock bunfig.toml package.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/extension/package.json apps/extension/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY apps/extension/wxt.config.ts apps/extension/wxt.config.ts
COPY apps/extension/tsconfig.json apps/extension/tsconfig.json
COPY apps/extension/entrypoints apps/extension/entrypoints
RUN bun install

COPY . .
RUN bunx turbo run build --filter=web

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone Next.js server output (includes node_modules)
COPY --from=deps /app/apps/web/.next/standalone ./
COPY --from=deps /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=deps /app/apps/web/public ./apps/web/public

EXPOSE 3001
WORKDIR /app/apps/web
CMD ["node", "server.js"]
