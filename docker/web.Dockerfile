# syntax=docker/dockerfile:1
FROM oven/bun:1.3.0 AS deps
WORKDIR /app
COPY . .
RUN bun install --filter openchat --filter web

FROM deps AS builder
ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_CONVEX_SITE_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SERVER_URL
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_CONVEX_URL=${NEXT_PUBLIC_CONVEX_URL}
ENV NEXT_PUBLIC_CONVEX_SITE_URL=${NEXT_PUBLIC_CONVEX_SITE_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_SERVER_URL=${NEXT_PUBLIC_SERVER_URL}
ENV NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY}
ENV NEXT_PUBLIC_POSTHOG_HOST=${NEXT_PUBLIC_POSTHOG_HOST}
RUN bun run --cwd apps/web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
# Copy the standalone server output
COPY --from=builder /app/apps/web/.next/standalone ./ 
# Static assets and public directory
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3001
CMD ["node", "apps/web/server.js"]
