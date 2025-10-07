import { defineConfig } from "drizzle-kit";
import { resolveDatabaseConfig } from "@openchat/auth/database";

const resolvedDatabase = resolveDatabaseConfig();

if (!resolvedDatabase.connectionString) {
	throw new Error(
		"[drizzle] DATABASE_URL not configured. Set DATABASE_URL or the DATABASE_* overrides before running Drizzle commands.",
	);
}

export default defineConfig({
	schema: "./src/db/schema",
	out: "./src/db/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: resolvedDatabase.connectionString,
	},
});
