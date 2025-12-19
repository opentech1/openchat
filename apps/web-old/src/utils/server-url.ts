const PROD_INTERNAL_FALLBACK = "http://openchat-server:3000";
const DEV_FALLBACK = "http://localhost:3000";

function normalize(value: string | undefined | null) {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	return trimmed.replace(/\/$/, "");
}

function sameOrigin(a: string | undefined, b: string | undefined) {
	if (!a || !b) return false;
	try {
		return new URL(a).origin === new URL(b).origin;
	} catch {
		return false;
	}
}

function fallbackBase() {
	return process.env.NODE_ENV === "production" ? PROD_INTERNAL_FALLBACK : DEV_FALLBACK;
}

export function resolveServerBaseUrls() {
	const explicitInternal =
		normalize(process.env.INTERNAL_SERVER_URL) ||
		normalize(process.env.SERVER_DIRECT_URL) ||
		normalize(process.env.SERVER_INTERNAL_URL);
	const publicUrl = normalize(process.env.NEXT_PUBLIC_SERVER_URL);

	let primary =
		explicitInternal ||
		publicUrl ||
		fallbackBase();

	const fallback = fallbackBase();
	const effectiveFallback = fallback !== primary ? fallback : undefined;

	// If SERVER_INTERNAL_URL matches the public URL (common misconfig), prefer the internal fallback first.
	if (explicitInternal && publicUrl && sameOrigin(explicitInternal, publicUrl)) {
		const fallbackPrimary = effectiveFallback ?? fallback;
		const alternate = fallbackPrimary === publicUrl ? undefined : publicUrl;
		return {
			primary: fallbackPrimary,
			fallback: alternate,
			publicUrl,
		};
	}

	return {
		primary,
		fallback: effectiveFallback,
		publicUrl,
	};
}

export function resolveServerBaseUrl() {
	return resolveServerBaseUrls().primary;
}
