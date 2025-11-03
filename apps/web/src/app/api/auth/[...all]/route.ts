import { nextJsHandler } from "@convex-dev/better-auth/nextjs";

// Convex Site URL is required for Better Auth to work
// It's set at build time from NEXT_PUBLIC_CONVEX_SITE_URL
const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || "https://outgoing-setter-201.convex.site";

export const { GET, POST } = nextJsHandler({ convexSiteUrl });
