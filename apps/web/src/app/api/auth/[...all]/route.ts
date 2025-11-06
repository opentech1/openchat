import { nextJsHandler } from "@convex-dev/better-auth/nextjs";

// Export the Convex Better Auth handler for Next.js
// This uses Convex as the database backend instead of SQLite
// Sessions and user data are stored in Convex
export const { GET, POST } = nextJsHandler();
