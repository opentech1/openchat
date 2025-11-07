import { logWarn } from "./logger-server";

// Primary environment variable for the web app URL
// Legacy variables are still checked for backwards compatibility
const POSSIBLE_ORIGIN_ENVS = [
	"NEXT_PUBLIC_APP_URL", // Primary
	"NEXT_PUBLIC_SITE_URL", // Deprecated - use NEXT_PUBLIC_APP_URL
	"NEXT_PUBLIC_WEB_URL", // Deprecated - use NEXT_PUBLIC_APP_URL
	"NEXT_PUBLIC_BASE_URL", // Deprecated - use NEXT_PUBLIC_APP_URL
	"NEXT_PUBLIC_ORIGIN", // Deprecated - use NEXT_PUBLIC_APP_URL
	"CORS_ORIGIN",
];

const DEPRECATED_ENV_VARS = new Set([
	"NEXT_PUBLIC_SITE_URL",
	"NEXT_PUBLIC_WEB_URL",
	"NEXT_PUBLIC_BASE_URL",
	"NEXT_PUBLIC_ORIGIN",
]);

// Track if we've already warned about deprecated vars to avoid spam
let hasWarnedDeprecated = false;

function normalizeOrigin(value: string | null | undefined) {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed || trimmed === "*") return null;
	try {
		// Ensure we keep only scheme + host (+ port)
		return new URL(trimmed).origin;
	} catch {
		return null;
	}
}

function expandOrigins(value: string | string[] | null | undefined) {
	if (!value) return [] as string[];
	const parts = Array.isArray(value) ? value : value.split(",");
	return parts
		.map((part) => normalizeOrigin(part))
		.filter((origin): origin is string => Boolean(origin));
}

export function resolveAllowedOrigins(extra?: string | string[]) {
	const origins = new Set<string>();
	const deprecatedVarsUsed: string[] = [];
	
	for (const envKey of POSSIBLE_ORIGIN_ENVS) {
		const envValue = process.env[envKey];
		if (envValue && DEPRECATED_ENV_VARS.has(envKey)) {
			deprecatedVarsUsed.push(envKey);
		}
		for (const origin of expandOrigins(envValue)) {
			origins.add(origin);
		}
	}
	
	// Warn about deprecated variables (only once per process)
	if (!hasWarnedDeprecated && deprecatedVarsUsed.length > 0) {
		logWarn(
			`⚠️  Deprecated environment variables detected: ${deprecatedVarsUsed.join(", ")}\n` +
			`   Please use NEXT_PUBLIC_APP_URL instead. These variables will be removed in a future version.`
		);
		hasWarnedDeprecated = true;
	}
	
	for (const origin of expandOrigins(extra ?? null)) {
		origins.add(origin);
	}
	return origins;
}

export function validateRequestOrigin(request: Request, allowedOrigins: Set<string>) {
	const originSet = new Set(allowedOrigins);
	let requestOrigin: string | null = null;
	try {
		requestOrigin = new URL(request.url).origin;
		if (requestOrigin) originSet.add(requestOrigin);
	} catch {
		// ignore malformed URL; fall back to allowed set only
	}

	const originHeader = request.headers.get("origin");
	if (originHeader) {
		const normalized = normalizeOrigin(originHeader);
		if (normalized && originSet.has(normalized)) {
			return { ok: true as const, origin: normalized };
		}
		return { ok: false as const };
	}

	const refererHeader = request.headers.get("referer");
	if (refererHeader) {
		const normalized = (() => {
			try {
				return new URL(refererHeader).origin;
			} catch {
				return null;
			}
		})();
		if (normalized && originSet.has(normalized)) {
			return { ok: true as const, origin: normalized };
		}
		return { ok: false as const };
	}

	// Allow requests without Origin/Referer (e.g., server-to-server) to proceed, but
	// prefer echoing the API origin to keep CORS reflective behaviour consistent.
	return { ok: true as const, origin: requestOrigin };
}

export type OriginValidationResult = ReturnType<typeof validateRequestOrigin>;
