import { createAuthClient } from "better-auth/react";

const baseServerUrl = (process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/$/, "");
const baseURL = baseServerUrl || undefined;

export const authClient = createAuthClient({
	baseURL,
	basePath: "/api/auth",
	fetchOptions: {
		credentials: "include",
	},
});

export type AuthClient = typeof authClient;
