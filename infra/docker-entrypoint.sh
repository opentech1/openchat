#!/usr/bin/env bash
set -Eeuo pipefail

SERVER_PORT="${SERVER_PORT:-3000}"
WEB_PORT="${WEB_PORT:-3001}"
HOST="${HOST:-0.0.0.0}"

export NODE_ENV="${NODE_ENV:-production}"
export PORT="$SERVER_PORT"
export HOSTNAME="$HOST"
export NEXT_TELEMETRY_DISABLED="1"

if [[ -z "${NEXT_PUBLIC_SERVER_URL:-}" ]]; then
	if [[ -n "${PUBLIC_BASE_URL:-}" ]]; then
		export NEXT_PUBLIC_SERVER_URL="${PUBLIC_BASE_URL%/}"
	else
		export NEXT_PUBLIC_SERVER_URL="http://localhost:${SERVER_PORT}"
	fi
fi

if [[ -z "${ELECTRIC_SERVICE_URL:-}" && -n "${NEXT_PUBLIC_ELECTRIC_URL:-}" ]]; then
	export ELECTRIC_SERVICE_URL="$NEXT_PUBLIC_ELECTRIC_URL"
fi

bun apps/server/dist/index.js &
SERVER_PID=$!

pushd apps/web >/dev/null
PORT="$WEB_PORT" HOSTNAME="$HOST" node .next/standalone/server.js &
WEB_PID=$!
popd >/dev/null

cleanup() {
	kill -TERM "$SERVER_PID" "$WEB_PID" 2>/dev/null || true
}

trap cleanup SIGINT SIGTERM

wait -n "$SERVER_PID" "$WEB_PID"
EXIT_CODE=$?
cleanup
wait "$SERVER_PID" 2>/dev/null || true
wait "$WEB_PID" 2>/dev/null || true
exit "$EXIT_CODE"
