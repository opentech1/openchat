import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

/**
 * Better Auth API route handler for Next.js.
 * Proxies authentication requests to the Convex deployment.
 *
 * This creates endpoints like:
 * - POST /api/auth/sign-in/social (GitHub OAuth)
 * - GET /api/auth/sign-out
 * - GET /api/auth/callback/github
 * - GET /api/auth/get-session
 */
const auth = convexBetterAuthNextJs({
	convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
	convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
});

export const { GET, POST } = auth.handler;
