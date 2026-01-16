/**
 * Server-side Convex HTTP Client
 * Use this for API routes, server functions, and SSR contexts
 * where the browser-based ConvexReactClient is not available.
 */

import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.VITE_CONVEX_URL;

function createServerClient() {
	if (!CONVEX_URL) {
		return null;
	}
	return new ConvexHttpClient(CONVEX_URL);
}

export const convexServerClient = createServerClient();

export function getConvexServerClient() {
	if (!convexServerClient) {
		throw new Error("VITE_CONVEX_URL is not configured");
	}
	return convexServerClient;
}
