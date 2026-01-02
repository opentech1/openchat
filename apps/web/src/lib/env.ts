/**
 * Type-safe environment variables for TanStack Start
 * Access these via import.meta.env in client code
 */

// Client-side env vars (must be prefixed with VITE_)
export const env = {
  CONVEX_URL: import.meta.env.VITE_CONVEX_URL as string,
  CONVEX_SITE_URL: import.meta.env.VITE_CONVEX_SITE_URL as string,
  POSTHOG_KEY: import.meta.env.VITE_POSTHOG_KEY as string | undefined,
  POSTHOG_HOST: import.meta.env.VITE_POSTHOG_HOST as string | undefined,
} as const;

// Validate required env vars
export function validateEnv() {
  if (!env.CONVEX_URL) {
    console.warn("Missing VITE_CONVEX_URL environment variable");
  }
  if (!env.CONVEX_SITE_URL) {
    console.warn("Missing VITE_CONVEX_SITE_URL environment variable");
  }
}
