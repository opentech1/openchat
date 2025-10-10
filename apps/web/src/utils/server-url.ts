const PROD_INTERNAL_FALLBACK = "http://openchat-server:3000";
const DEV_FALLBACK = "http://localhost:3000";

function normalize(value: string | undefined | null) {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	return trimmed.replace(/\/$/, "");
}

export function resolveServerBaseUrl() {
	const candidates = [
		normalize(process.env.SERVER_INTERNAL_URL),
		normalize(process.env.NEXT_PUBLIC_SERVER_URL),
		normalize(process.env.BETTER_AUTH_URL),
	];
	for (const candidate of candidates) {
		if (candidate) return candidate;
	}
	return process.env.NODE_ENV === "production" ? PROD_INTERNAL_FALLBACK : DEV_FALLBACK;
}
