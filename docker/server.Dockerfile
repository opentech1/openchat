# Build and run the Bun/Elysia server
FROM oven/bun:1.2.21 AS base
WORKDIR /app
ENV BUN_INSTALL_CACHE=/tmp/.bun-cache

# Install workspace dependencies
COPY bun.lock bunfig.toml package.json turbo.json ./
COPY apps/server/package.json apps/server/package.json
RUN bun install --frozen-lockfile

# Copy source and build the server bundle
COPY . .
RUN bunx turbo run build --filter=server

# Runtime image
FROM oven/bun:1.2.21 AS runtime
WORKDIR /app

# Copy compiled server bundle and minimal workspace metadata
COPY --from=base /app/apps/server/dist ./apps/server/dist
COPY --from=base /app/apps/server/package.json ./apps/server/package.json
COPY --from=base /app/bun.lock ./bun.lock
COPY --from=base /app/bunfig.toml ./bunfig.toml
COPY --from=base /app/package.json ./package.json

# Install production deps for the server workspace
RUN bun install --frozen-lockfile --production

EXPOSE 3000
CMD ["bun", "run", "--cwd", "apps/server", "start"]
