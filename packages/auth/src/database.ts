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

type EnvValue = {
	value: string;
	source: string;
};

type Overrides = {
	host?: EnvValue;
	port?: EnvValue;
	user?: EnvValue;
	password?: EnvValue;
	database?: EnvValue;
	protocol?: EnvValue;
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

function readEnvValue(key: string): EnvValue | undefined {
	const fileKey = `${key}_FILE`;
	const filePath = cleanValue(process.env[fileKey]);
	if (filePath) {
		try {
			const fileValue = cleanValue(readFileSync(filePath, "utf8"));
			if (fileValue !== undefined) {
				return { value: fileValue, source: key };
			}
		} catch (error) {
			console.warn(
				`[database] Failed to read ${fileKey} at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
	const envValue = cleanValue(process.env[key]);
	if (envValue !== undefined) {
		return { value: envValue, source: key };
	}
	return undefined;
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
	const baseUrlInfo = pickFirst(["DATABASE_URL", "POSTGRES_URL", "POSTGRES_CONNECTION"]);
	const baseUrl = baseUrlInfo?.value;
	const overrides = collectOverrides();
	const overridesUsed = new Set<string>();

	let connectionString = baseUrl;
	const baseNamespace = baseUrlInfo ? classifySource(baseUrlInfo.source) : undefined;

	if (connectionString) {
		try {
			const url = new URL(connectionString);
			const allowPostgresOverrides = !baseNamespace || baseNamespace === "postgres";

			const applyOverride = (
				key: keyof Overrides,
				setter: (value: string) => void,
			) => {
				const entry = overrides[key];
				if (!entry) return;
				const namespace = classifySource(entry.source);
				const shouldApply =
					namespace === "database" ||
					namespace === "pg" ||
					(namespace === "postgres" && allowPostgresOverrides);
				if (!shouldApply) return;
				setter(entry.value);
				overridesUsed.add(key);
			};

			applyOverride("host", (value) => {
				url.hostname = value;
			});
			applyOverride("port", (value) => {
				url.port = value;
			});
			applyOverride("database", (value) => {
				url.pathname = `/${value.replace(/^\//, "")}`;
			});
			applyOverride("user", (value) => {
				url.username = value;
			});
			applyOverride("password", (value) => {
				url.password = value;
			});
			applyOverride("protocol", (value) => {
				url.protocol = value.endsWith(":") ? value : `${value}:`;
			});
			connectionString = url.toString();
		} catch (error) {
			console.warn(
				`[database] Could not parse DATABASE_URL "${connectionString}" to apply overrides: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	} else {
		const anyOverrides = Object.values(overrides).some((value) => value?.value !== undefined);
		if (anyOverrides) {
			const protocol = overrides.protocol?.value || "postgres";
			const host = overrides.host?.value || "localhost";
			const portSegment = overrides.port?.value ? `:${overrides.port.value}` : "";
			const username = overrides.user?.value ?? "postgres";
			const password = overrides.password?.value ?? "";
			const databaseName = (overrides.database?.value ||
				pickFirst(["POSTGRES_DB", "PGDATABASE"])?.value ||
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
				if (overrides[key]?.value !== undefined) overridesUsed.add(key);
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

function classifySource(source: string): "database" | "postgres" | "pg" | "other" {
	if (source.startsWith("DATABASE_")) return "database";
	if (source.startsWith("POSTGRES_")) return "postgres";
	if (source.startsWith("PG")) return "pg";
	return "other";
}
