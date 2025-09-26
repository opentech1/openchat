#!/usr/bin/env bash
set -Eeuo pipefail

export PATH=/usr/lib/postgresql/15/bin:$PATH

psql_exec() {
	local sql="$1"
	local tmp
	tmp=$(mktemp)
	printf '%s\n' "$sql" > "$tmp"
	chown postgres:postgres "$tmp"
	chmod 600 "$tmp"
	su - postgres -c "$PSQL_BIN -v ON_ERROR_STOP=1 -f $tmp"
	rm -f "$tmp"
}

psql_query() {
	local query="$1"
	su - postgres -c "$PSQL_BIN -tAc \"$query\""
}

log() {
	printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

# Resolve binaries dynamically
INITDB_BIN="$(command -v initdb)"
PG_CTL_BIN="$(command -v pg_ctl)"
PG_ISREADY_BIN="$(command -v pg_isready)"
PSQL_BIN="$(command -v psql)"

if [[ -z "$INITDB_BIN" || -z "$PG_CTL_BIN" || -z "$PG_ISREADY_BIN" || -z "$PSQL_BIN" ]]; then
	log "Postgres binaries are not available"
	exit 1
fi

ELECTRIC_BIN="$(command -v electric || true)"
ELECTRIC_ARGS=()
if [[ -z "$ELECTRIC_BIN" ]]; then
	if [[ -x /opt/electric/bin/electric ]]; then
		ELECTRIC_BIN=/opt/electric/bin/electric
	elif [[ -x /opt/electric/electric ]]; then
		ELECTRIC_BIN=/opt/electric/electric
	elif [[ -x /app/bin/electric ]]; then
		ELECTRIC_BIN=/app/bin/electric
	elif [[ -x /opt/electric/bin/entrypoint ]]; then
		ELECTRIC_BIN=/opt/electric/bin/entrypoint
		ELECTRIC_ARGS=(start)
	elif [[ -x /app/bin/entrypoint ]]; then
		ELECTRIC_BIN=/app/bin/entrypoint
		ELECTRIC_ARGS=(start)
	fi
fi

if [[ -z "$ELECTRIC_BIN" ]]; then
	log "ElectricSQL binary not found in PATH"
	exit 1
fi

: "${HOST:=0.0.0.0}"
: "${SERVER_PORT:=3000}"
: "${WEB_PORT:=3001}"
: "${ELECTRIC_HTTP_PORT:=3010}"
: "${ELECTRIC_PROXY_PORT:=5133}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:=postgres}"
: "${POSTGRES_PASSWORD:=postgres}"
: "${POSTGRES_DB:=openchat}"
: "${POSTGRES_SHADOW_DB:=${POSTGRES_DB}_shadow}"
: "${PGDATA:=/var/lib/postgresql/data}"
: "${PGHOST:=127.0.0.1}"
: "${PG_PROXY_PASSWORD:=dev-proxy-password}"
: "${ELECTRIC_INSECURE:=true}"
: "${ELECTRIC_LOG_LEVEL:=info}"

export NODE_ENV="${NODE_ENV:-production}"
export HOSTNAME="$HOST"

install -d -o postgres -g postgres "$PGDATA"

if [[ ! -s "$PGDATA/PG_VERSION" ]]; then
	log "Initializing Postgres data directory at $PGDATA"
	su - postgres -c "$INITDB_BIN -D '$PGDATA' --username=postgres"
fi

	cat <<'EOF' >> "$PGDATA/postgresql.conf"
wal_level = logical
max_wal_senders = 10
max_replication_slots = 10
EOF

	cat <<'EOF' >> "$PGDATA/pg_hba.conf"
host replication all 127.0.0.1/32 trust
host replication all ::1/128 trust
EOF

log "Starting Postgres on port $POSTGRES_PORT"
su - postgres -c "$PG_CTL_BIN -D '$PGDATA' -o '-p $POSTGRES_PORT' -w start"

stop_services() {
	set +e
	if [[ -n "${WEB_PID:-}" ]]; then
		kill -TERM "$WEB_PID" 2>/dev/null || true
		wait "$WEB_PID" 2>/dev/null || true
	fi
	if [[ -n "${SERVER_PID:-}" ]]; then
		kill -TERM "$SERVER_PID" 2>/dev/null || true
		wait "$SERVER_PID" 2>/dev/null || true
	fi
	if [[ -n "${ELECTRIC_PID:-}" ]]; then
		kill -TERM "$ELECTRIC_PID" 2>/dev/null || true
		wait "$ELECTRIC_PID" 2>/dev/null || true
	fi
	su - postgres -c "$PG_CTL_BIN -D '$PGDATA' -m fast stop" 2>/dev/null || true
}
trap stop_services EXIT SIGINT SIGTERM

until su - postgres -c "$PG_ISREADY_BIN -h '$PGHOST' -p $POSTGRES_PORT" >/dev/null 2>&1; do
	log "Waiting for Postgres to be ready..."
	sleep 1
done

log "Configuring Postgres roles/databases"

if [[ "$POSTGRES_USER" == "postgres" ]]; then
	psql_exec "ALTER USER postgres WITH PASSWORD '${POSTGRES_PASSWORD}';"
else
	if [[ -z $(psql_query "SELECT 1 FROM pg_roles WHERE rolname = '${POSTGRES_USER}'") ]]; then
		psql_exec "CREATE ROLE ${POSTGRES_USER} LOGIN PASSWORD '${POSTGRES_PASSWORD}';"
	else
		psql_exec "ALTER ROLE ${POSTGRES_USER} WITH PASSWORD '${POSTGRES_PASSWORD}';"
	fi
fi

if [[ -z $(psql_query "SELECT 1 FROM pg_database WHERE datname = '${POSTGRES_DB}'") ]]; then
	psql_exec "CREATE DATABASE ${POSTGRES_DB} OWNER ${POSTGRES_USER};"
fi
if [[ -z $(psql_query "SELECT 1 FROM pg_database WHERE datname = '${POSTGRES_SHADOW_DB}'") ]]; then
	psql_exec "CREATE DATABASE ${POSTGRES_SHADOW_DB} OWNER ${POSTGRES_USER};"
fi

if compgen -G "/app/infra/postgres-init/*.sql" >/dev/null; then
	for sql in /app/infra/postgres-init/*.sql; do
		log "Running init script $sql"
		su - postgres -c "$PSQL_BIN -v ON_ERROR_STOP=1 -v shadow_db='${POSTGRES_SHADOW_DB}' -v db_owner='${POSTGRES_USER}' -f '$sql'"
	done
fi

export DATABASE_URL="${DATABASE_URL:-postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${PGHOST}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable}"
export SHADOW_DATABASE_URL="${SHADOW_DATABASE_URL:-postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${PGHOST}:${POSTGRES_PORT}/${POSTGRES_SHADOW_DB}?sslmode=disable}"
export ELECTRIC_SERVICE_URL="${ELECTRIC_SERVICE_URL:-http://127.0.0.1:${ELECTRIC_HTTP_PORT}}"
export NEXT_PUBLIC_ELECTRIC_URL="${NEXT_PUBLIC_ELECTRIC_URL:-http://localhost:${ELECTRIC_HTTP_PORT}}"
export NEXT_PUBLIC_SERVER_URL="${NEXT_PUBLIC_SERVER_URL:-http://localhost:${SERVER_PORT}}"
export ELECTRIC_INSECURE
export PG_PROXY_PASSWORD

log "Starting ElectricSQL (http:${ELECTRIC_HTTP_PORT}, proxy:${ELECTRIC_PROXY_PORT})"
ELECTRIC_PORT="$ELECTRIC_HTTP_PORT" \
ELECTRIC_HTTP_PORT="$ELECTRIC_HTTP_PORT" \
ELECTRIC__HTTP__HOST="0.0.0.0" \
ELECTRIC__HTTP__PORT="$ELECTRIC_HTTP_PORT" \
ELECTRIC_PG_PROXY_PORT="$ELECTRIC_PROXY_PORT" \
ELECTRIC__PG_PROXY__HOST="0.0.0.0" \
ELECTRIC__PG_PROXY__PORT="$ELECTRIC_PROXY_PORT" \
ELECTRIC_PG_PROXY_PASSWORD="$PG_PROXY_PASSWORD" \
ELECTRIC__PG_PROXY__PASSWORD="$PG_PROXY_PASSWORD" \
ELECTRIC__LOG_LEVEL="$ELECTRIC_LOG_LEVEL" \
DATABASE_URL="$DATABASE_URL" \
SHADOW_DATABASE_URL="$SHADOW_DATABASE_URL" \
ELECTRIC_INSECURE="$ELECTRIC_INSECURE" \
 "$ELECTRIC_BIN" "${ELECTRIC_ARGS[@]}" &
ELECTRIC_PID=$!

log "Starting Bun API on $SERVER_PORT"
PORT="$SERVER_PORT" HOST="$HOST" bun /app/apps/server/dist/index.js &
SERVER_PID=$!

log "Starting Next.js web on $WEB_PORT"
cd /app/apps/web/standalone/apps/web
PORT="$WEB_PORT" HOSTNAME="$HOST" node server.js &
WEB_PID=$!

wait -n "$ELECTRIC_PID" "$SERVER_PID" "$WEB_PID"
EXIT_CODE=$?
log "Process exited with code $EXIT_CODE"
exit "$EXIT_CODE"
