import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export type UserContext = {
	userId: string;
	email?: string | null;
	name?: string | null;
	image?: string | null;
};

// Simple session parsing from cookies
// In production, this should validate the JWT/session token properly
const resolveUserContext = cache(async (): Promise<UserContext> => {
	const cookieStore = await cookies();
	const sessionCookie = cookieStore.get("openchat.session-token") || cookieStore.get("openchat-session-token");

	if (!sessionCookie) {
		redirect("/auth/sign-in");
	}

	// For now, return a placeholder
	// TODO: Properly decode and validate the session token
	return {
		userId: "placeholder-id",
		email: "user@example.com",
		name: "User",
		image: null,
	};
});

export async function getUserContext(): Promise<UserContext> {
	return resolveUserContext();
}

export async function getUserId(): Promise<string> {
	const { userId } = await resolveUserContext();
	return userId;
}
