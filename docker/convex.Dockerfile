# syntax=docker/dockerfile:1
FROM oven/bun:1.3.0
WORKDIR /app
COPY convex.json ./convex.json
COPY convex-rules.txt ./convex-rules.txt
COPY apps/server ./apps/server
WORKDIR /app/apps/server
RUN bun install --production
EXPOSE 3210 6790
CMD ["bun", "x", "convex", "dev", "--port", "3210", "--tail-logs", "disable"]
