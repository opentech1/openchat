import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export type UserContext = {
	userId: string;
	email?: string | null;
	name?: string | null;
	image?: string | null;
};

export type SessionData = {
	user: {
		id: string;
		email?: string | null;
		name?: string | null;
		image?: string | null;
	};
} | null;

// Shared cached session fetch that both middleware and server components use
export const fetchSession = cache(async (sessionToken: string): Promise<SessionData> => {
	try {
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || "http://localhost:3001";
		const response = await fetch(`${baseUrl}/api/auth/session`, {
			headers: {
				Cookie: `openchat.session-token=${sessionToken}`,
			},
			cache: "no-store",
		});

		if (!response.ok) {
			return null;
		}

		const data = await response.json();
		return data.user ? data : null;
	} catch (error) {
		console.error("Failed to fetch session:", error);
		return null;
	}
});

// Get session from better-auth API
const resolveUserContext = cache(async (): Promise<UserContext> => {
	const cookieStore = await cookies();

	// better-auth stores session token with the cookiePrefix from convex/auth.ts
	// Default is "openchat" so cookie is "openchat.session-token"
	const sessionToken = cookieStore.get("openchat.session-token")?.value;

	if (!sessionToken) {
		redirect("/auth/sign-in");
	}

	// Use the shared cached session fetch
	const session = await fetchSession(sessionToken);

	if (!session?.user) {
		redirect("/auth/sign-in");
	}

	return {
		userId: session.user.id,
		email: session.user.email,
		name: session.user.name,
		image: session.user.image,
	};
});

export async function getUserContext(): Promise<UserContext> {
	return resolveUserContext();
}

export async function getUserId(): Promise<string> {
	const { userId } = await resolveUserContext();
	return userId;
}
