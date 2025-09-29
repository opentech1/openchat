# Build and run the Bun/Elysia server
FROM oven/bun:1.2.21 AS base
WORKDIR /app
ENV BUN_INSTALL_CACHE=/tmp/.bun-cache

# Install workspace dependencies
COPY bun.lock bunfig.toml package.json turbo.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/extension/package.json apps/extension/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY apps/extension/wxt.config.ts apps/extension/wxt.config.ts
COPY apps/extension/tsconfig.json apps/extension/tsconfig.json
COPY apps/extension/entrypoints apps/extension/entrypoints
RUN bun install

# Copy source and build the server bundle
COPY . .
RUN bunx turbo run build --filter=server

# Runtime image
FROM oven/bun:1.2.21 AS runtime
WORKDIR /app

# Copy compiled server bundle and minimal workspace metadata
COPY --from=base /app/apps/server/dist ./apps/server/dist
COPY --from=base /app/apps/server/package.json ./apps/server/package.json
COPY --from=base /app/packages/auth ./packages/auth
COPY --from=base /app/bun.lock ./bun.lock
COPY --from=base /app/bunfig.toml ./bunfig.toml
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/node_modules ./node_modules

# node_modules already pruned in build stage; no extra install necessary

EXPOSE 3000
CMD ["bun", "run", "--cwd", "apps/server", "start"]
