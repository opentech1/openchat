# Vite + TanStack Start production image for apps/web-start

FROM oven/bun:1.3 AS deps
WORKDIR /app
ENV BUN_INSTALL_CACHE=/tmp/.bun-cache

# Build-time configuration for the web app
ARG VITE_APP_URL=http://localhost:3001
ARG VITE_SERVER_URL=http://localhost:3000
ARG VITE_ELECTRIC_URL=http://localhost:3010

ENV VITE_APP_URL=${VITE_APP_URL} \
    VITE_SERVER_URL=${VITE_SERVER_URL} \
    VITE_ELECTRIC_URL=${VITE_ELECTRIC_URL}

# Workspace manifests
COPY bun.lock bunfig.toml package.json turbo.json ./
COPY apps/web-start/package.json apps/web-start/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/auth/package.json packages/auth/package.json

RUN bun install

# Copy source
COPY . .

# Build only the web-start app
RUN bunx turbo run build --filter=web-start

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy Vite build output
COPY --from=deps /app/apps/web-start/dist ./apps/web-start/dist

EXPOSE 3001
WORKDIR /app/apps/web-start

# Serve SSR using the React Start production preview server
# For a real deployment, replace with a Node adapter or custom server once routes are migrated.
CMD [ "node", "./dist/server/server.js" ]

