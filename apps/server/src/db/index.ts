import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { resolveDatabaseConfig, warnOnUnresolvedHost } from "@openchat/auth/database";

const resolvedDatabase = resolveDatabaseConfig();
const connectionString = resolvedDatabase.connectionString;

const hostHint = process.env.SERVER_REQUIRE_WORKSPACE_ENV
	? undefined
	: "Update the runtime environment or set SERVER_REQUIRE_WORKSPACE_ENV=1 to load workspace-level .env values.";
if (resolvedDatabase.fingerprint) {
	warnOnUnresolvedHost(resolvedDatabase.fingerprint, { label: "server:db", hint: hostHint });
}

const logDetails = process.env.NODE_ENV !== "test";
if (logDetails && resolvedDatabase.appliedOverrides.length > 0) {
	const descriptor =
		resolvedDatabase.source === "overrides"
			? "Derived Postgres connection from"
			: "Applied Postgres overrides for";
	console.info(
		`[server:db] ${descriptor} ${resolvedDatabase.appliedOverrides.join(", ")}`,
	);
}

if (!connectionString) {
	if (process.env.NODE_ENV === "production") {
		throw new Error(
			"[server:db] Database connection not configured. Set DATABASE_URL or the DATABASE_* overrides before starting the server.",
		);
	}
	if (logDetails) {
		console.warn(
			"[server:db] DATABASE_URL not set; relying on PG* environment defaults. This should only be used for local development.",
		);
	}
}

const pool = connectionString ? new Pool({ connectionString }) : new Pool();
export const db = drizzle(pool);
