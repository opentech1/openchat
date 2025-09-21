export async function auth() {
  return { userId: process.env.E2E_USER_ID || "e2e-user", getToken: async () => null } as any;
}
export function clerkMiddleware() {
  return () => new Response(null);
}

