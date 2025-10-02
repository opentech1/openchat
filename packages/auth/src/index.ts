import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { memoryAdapter } from "better-auth/adapters/memory";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as authSchema from "./schema";

const globalSymbol = Symbol.for("openchat.auth.pool");
const memorySymbol = Symbol.for("openchat.auth.memory");

function getConnectionString() {
	return (
		process.env.DATABASE_URL ||
		process.env.POSTGRES_URL ||
		process.env.POSTGRES_CONNECTION ||
		""
	);
}

type GlobalWithAuth = typeof globalThis & {
	[globalSymbol]?: {
		pool: Pool;
		db: ReturnType<typeof drizzle>;
	};
	[memorySymbol]?: {
		db: Record<string, any[]>;
		adapter: ReturnType<typeof memoryAdapter>;
	};
};

function getPool(connectionString: string) {
	const globalRef = globalThis as GlobalWithAuth;
	if (!globalRef[globalSymbol]) {
		const pool = new Pool({ connectionString });
		const db = drizzle(pool, { schema: authSchema });
		globalRef[globalSymbol] = { pool, db };
	}
	return globalRef[globalSymbol]!;
}

function computeCookieDomain(baseURL: string | undefined) {
	if (!baseURL) return undefined;
	try {
		const { hostname } = new URL(baseURL);
		if (!hostname) return undefined;
		if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname === "localhost") {
			return undefined;
		}
		const parts = hostname.split(".");
		if (parts.length <= 2) {
			return `.${hostname}`;
		}
		return `.${parts.slice(-2).join(".")}`;
	} catch {
		return undefined;
	}
}

const connectionString = getConnectionString();
const dbResources = connectionString ? getPool(connectionString) : null;

function getMemoryAdapter() {
	const globalRef = globalThis as GlobalWithAuth;
	if (!globalRef[memorySymbol]) {
		const db: Record<string, any[]> = {};
		const adapter = memoryAdapter(db);
		globalRef[memorySymbol] = { db, adapter };
	}
	return globalRef[memorySymbol]!.adapter;
}

const fallbackAdapter = getMemoryAdapter();

const rawBaseUrl = process.env.BETTER_AUTH_URL || process.env.SERVER_INTERNAL_URL || process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
const baseURL = rawBaseUrl.replace(/\/$/, "");
const secret = process.env.BETTER_AUTH_SECRET || "dev-secret";
const crossDomain = process.env.AUTH_COOKIE_DOMAIN || computeCookieDomain(baseURL);

const originCandidates = [
	baseURL,
	process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3001" : undefined),
	process.env.CORS_ORIGIN,
	process.env.NEXT_PUBLIC_SERVER_URL,
	process.env.NEXT_PUBLIC_ELECTRIC_URL,
]
	.filter((value): value is string => Boolean(value));

const trustedOrigins = Array.from(
	new Set(
		originCandidates
			.map((url) => {
				try {
					return new URL(url).origin;
				} catch {
					return null;
				}
			})
			.filter((value): value is string => Boolean(value)),
	),
);


export const auth = betterAuth({
	baseURL,
	secret,
	emailAndPassword: {
		enabled: true,
		autoSignIn: true,
	},
	trustedOrigins,
	advanced: {
		useSecureCookies: process.env.NODE_ENV === "production",
		crossSubDomainCookies: crossDomain
			? {
				enabled: true,
				domain: crossDomain,
			}
			: undefined,
		cookiePrefix: process.env.AUTH_COOKIE_PREFIX || "openchat",
	},
	database: dbResources
		? drizzleAdapter(dbResources.db, {
			schema: authSchema,
			provider: "pg",
		})
		: fallbackAdapter,
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		freshAge: 60 * 60, // 1 hour
		cookieCache: {
			enabled: true,
			maxAge: 60 * 60, // 1 hour cache
		},
	},
});

export type AuthSession = typeof auth.$Infer.Session;

export async function getSessionFromHeaders(headers: Headers) {
	try {
		return await auth.api.getSession({ headers });
	} catch {
		return null;
	}
}

export async function getSessionFromRequest(request: Request) {
	return getSessionFromHeaders(request.headers);
}

export async function signOut(headers: Headers) {
	return auth.api.signOut({
		headers,
		asResponse: true,
	});
}
