import { lookup as resolveHost } from "node:dns/promises";
import { readFileSync } from "node:fs";

export type ConnectionFingerprint = {
	protocol: string;
	host: string;
	port?: string;
	database?: string;
	user?: string;
};

type HostWarningOptions = {
	label?: string;
	hint?: string;
};

type Overrides = {
	host?: string;
	port?: string;
	user?: string;
	password?: string;
	database?: string;
	protocol?: string;
};

export type ResolvedDatabaseConfig = {
	connectionString?: string;
	fingerprint?: ConnectionFingerprint;
	source?: "url" | "overrides";
	appliedOverrides: string[];
};

const warnedHosts = new Set<string>();
const placeholderHosts = new Set([
	"postgres-host",
	"postgres.example.com",
	"db-host",
	"database-host",
	"replace-with-host",
]);

function cleanValue(value: string | undefined) {
	if (value === undefined) return undefined;
	const trimmed = value.trim();
	return trimmed === "" ? undefined : trimmed;
}

function readEnvValue(key: string) {
	const fileKey = `${key}_FILE`;
	const filePath = cleanValue(process.env[fileKey]);
	if (filePath) {
		try {
			return cleanValue(readFileSync(filePath, "utf8"));
		} catch (error) {
			console.warn(
				`[database] Failed to read ${fileKey} at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
	return cleanValue(process.env[key]);
}

function pickFirst(keys: string[]) {
	for (const key of keys) {
		const value = readEnvValue(key);
		if (value !== undefined) return value;
	}
	return undefined;
}

function collectOverrides(): Overrides {
	return {
		host: pickFirst(["DATABASE_HOST", "POSTGRES_HOST", "PGHOST"]),
		port: pickFirst(["DATABASE_PORT", "POSTGRES_PORT", "PGPORT"]),
		user: pickFirst(["DATABASE_USER", "POSTGRES_USER", "PGUSER"]),
		password: pickFirst(["DATABASE_PASSWORD", "POSTGRES_PASSWORD", "PGPASSWORD"]),
		database: pickFirst(["DATABASE_NAME", "DATABASE_DB", "POSTGRES_DB", "PGDATABASE"]),
		protocol: pickFirst(["DATABASE_PROTOCOL", "POSTGRES_PROTOCOL"]),
	};
}

export function parseConnectionFingerprint(value: string): ConnectionFingerprint | undefined {
	try {
		const url = new URL(value);
		return {
			protocol: url.protocol.replace(/:$/, ""),
			host: url.hostname,
			port: url.port || undefined,
			database: url.pathname.replace(/^\//, "") || undefined,
			user: url.username ? decodeURIComponent(url.username) : undefined,
		};
	} catch {
		return undefined;
	}
}

export function warnOnUnresolvedHost(info: ConnectionFingerprint, options: HostWarningOptions = {}) {
	const host = info.host?.trim();
	if (!host || warnedHosts.has(host)) return;
	warnedHosts.add(host);

	const label = options.label ?? "database";
	const hint = options.hint ? ` ${options.hint}` : "";

	if (placeholderHosts.has(host)) {
		console.warn(
			`[${label}] DATABASE_URL host "${host}" looks like a template placeholder.${hint}`,
		);
		return;
	}

	void resolveHost(host).catch(() => {
		console.warn(
			`[${label}] Unable to resolve Postgres host "${host}" from DATABASE_URL.${hint}`,
		);
	});
}

export function resolveDatabaseConfig(): ResolvedDatabaseConfig {
	const baseUrl = pickFirst(["DATABASE_URL", "POSTGRES_URL", "POSTGRES_CONNECTION"]);
	const overrides = collectOverrides();
	const overridesUsed = new Set<string>();

	let connectionString = baseUrl;

	if (connectionString) {
		try {
			const url = new URL(connectionString);
			if (overrides.host) {
				url.hostname = overrides.host;
				overridesUsed.add("host");
			}
			if (overrides.port) {
				url.port = overrides.port;
				overridesUsed.add("port");
			}
			if (overrides.database) {
				url.pathname = `/${overrides.database.replace(/^\//, "")}`;
				overridesUsed.add("database");
			}
			if (overrides.user !== undefined) {
				url.username = overrides.user;
				overridesUsed.add("user");
			}
			if (overrides.password !== undefined) {
				url.password = overrides.password;
				overridesUsed.add("password");
			}
			if (overrides.protocol) {
				url.protocol = overrides.protocol.endsWith(":")
					? overrides.protocol
					: `${overrides.protocol}:`;
				overridesUsed.add("protocol");
			}
			connectionString = url.toString();
		} catch (error) {
			console.warn(
				`[database] Could not parse DATABASE_URL "${connectionString}" to apply overrides: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	} else {
		const anyOverrides = Object.values(overrides).some((value) => value !== undefined);
		if (anyOverrides) {
			const protocol = overrides.protocol || "postgres";
			const host = overrides.host || "localhost";
			const portSegment = overrides.port ? `:${overrides.port}` : "";
			const username = overrides.user ?? "postgres";
			const password = overrides.password ?? "";
			const databaseName = (overrides.database ??
				pickFirst(["POSTGRES_DB", "PGDATABASE"]) ??
				"postgres"
			).replace(/^\//, "");
			const auth =
				username && password !== undefined
					? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
					: username
						? `${encodeURIComponent(username)}@`
						: "";
			connectionString = `${protocol}://${auth}${host}${portSegment}/${databaseName}`;
			for (const key of Object.keys(overrides) as Array<keyof Overrides>) {
				if (overrides[key] !== undefined) overridesUsed.add(key);
			}
		}
	}

	const fingerprint = connectionString ? parseConnectionFingerprint(connectionString) : undefined;

	return {
		connectionString,
		fingerprint,
		source: connectionString ? (baseUrl ? "url" : "overrides") : undefined,
		appliedOverrides: Array.from(overridesUsed),
	};
}
