FROM oven/bun:1.2.21 AS deps
WORKDIR /app
COPY package.json ./
RUN bun install

FROM deps AS build
COPY . .
RUN bun run build

FROM oven/bun:1.2.21-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

RUN chown -R bun:bun /app
USER bun

EXPOSE 3000

CMD ["bun", "dist/index.js"]
