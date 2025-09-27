FROM oven/bun:1.2.21 AS deps
WORKDIR /app
ENV BUN_INSTALL_CACHE=/tmp/.bun-cache

COPY bun.lock bunfig.toml package.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
RUN bun install --frozen-lockfile

COPY . .
RUN bunx turbo run build --filter=web

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy standalone Next.js server output
COPY --from=deps /app/apps/web/.next/standalone/apps/web ./apps/web
COPY --from=deps /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=deps /app/apps/web/public ./apps/web/public

EXPOSE 3001
WORKDIR /app/apps/web
CMD ["node", "server.js"]
