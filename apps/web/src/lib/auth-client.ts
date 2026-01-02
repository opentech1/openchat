/**
 * Better Auth Client - Authentication utilities
 */

import { createAuthClient } from "better-auth/react";
import {
  convexClient as convexAuthPlugin,
  crossDomainClient,
} from "@convex-dev/better-auth/client/plugins";
import { env } from "./env";

const AUTH_SESSION_COOKIE = "ba_session";

/**
 * Sync session from localStorage to cookie for SSR access
 */
function syncSessionToCookie() {
  if (typeof window === "undefined") return;

  const keys = Object.keys(localStorage).filter((k) => k.includes("session"));
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value) {
      const isSecure = window.location.protocol === "https:";
      const secureFlag = isSecure ? "; Secure" : "";
      document.cookie = `${AUTH_SESSION_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${secureFlag}`;
      break;
    }
  }
}

// Sync on module load
if (typeof window !== "undefined") {
  syncSessionToCookie();
}

/**
 * Hybrid storage that syncs to cookies for SSR
 */
const hybridStorage = {
  setItem: (key: string, value: string) => {
    localStorage.setItem(key, value);

    if (key.includes("session")) {
      const isSecure = window.location.protocol === "https:";
      const secureFlag = isSecure ? "; Secure" : "";
      document.cookie = `${AUTH_SESSION_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${secureFlag}`;
    }
  },
  getItem: (key: string) => localStorage.getItem(key),
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    if (key.includes("session")) {
      document.cookie = `${AUTH_SESSION_COOKIE}=; path=/; max-age=0`;
    }
  },
};

/**
 * Better Auth client with Convex integration
 */
export const authClient = createAuthClient({
  baseURL: env.CONVEX_SITE_URL,
  plugins: [
    convexAuthPlugin(),
    crossDomainClient({
      storage: hybridStorage,
    }),
  ],
});

/**
 * Hook to get current session
 */
export function useSession() {
  const { data: session, isPending } = authClient.useSession();

  return {
    data: session?.user
      ? {
          user: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name || session.user.email.split("@")[0] || "User",
            image: session.user.image ?? null,
          },
        }
      : null,
    isPending,
  };
}

/**
 * Hook for auth state
 */
export function useAuth() {
  const { data: session, isPending } = authClient.useSession();

  return {
    user: session?.user ?? null,
    session: session?.session ?? null,
    loading: isPending,
    isAuthenticated: !!session?.user,
  };
}

/**
 * Sign in with GitHub OAuth
 */
export async function signInWithGitHub(callbackURL = "/") {
  return authClient.signIn.social({
    provider: "github",
    callbackURL,
  });
}

/**
 * Sign out
 */
export async function signOut() {
  return authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        window.location.href = "/auth/sign-in";
      },
    },
  });
}
