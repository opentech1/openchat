import { nextJsHandler } from "@convex-dev/better-auth/nextjs";

// The handler automatically uses NEXT_PUBLIC_CONVEX_SITE_URL from env
export const { GET, POST } = nextJsHandler();
