FROM oven/bun:1.2.21 AS deps
WORKDIR /app
COPY package.json ./
RUN bun install

FROM deps AS build
COPY . .
ENV NEXT_PUBLIC_SERVER_URL=http://localhost:3000 \
    NEXT_PUBLIC_ELECTRIC_URL=http://localhost:3010 \
    ELECTRIC_SERVICE_URL=http://localhost:3010 \
    NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3001

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json

ENV PATH="/app/node_modules/.bin:${PATH}"

EXPOSE 3001

CMD ["next", "start", "-H", "0.0.0.0", "-p", "3001"]
