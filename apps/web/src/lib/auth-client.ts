import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { lastLoginMethodClient } from "better-auth/client/plugins";

// Configure client with proper base URL for API routes
const baseURL = typeof window !== 'undefined' 
	? window.location.origin 
	: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

export const authClient = createAuthClient({
	baseURL: `${baseURL}/api/auth`,
	plugins: [convexClient(), lastLoginMethodClient()],
});
