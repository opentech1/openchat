import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export type UserContext = {
	userId: string;
	email?: string | null;
	name?: string | null;
	image?: string | null;
};

// Get session from better-auth API
const resolveUserContext = cache(async (): Promise<UserContext> => {
	const cookieStore = await cookies();

	// better-auth stores session token with the cookiePrefix from convex/auth.ts
	// Default is "openchat" so cookie is "openchat.session_token"
	const sessionToken = cookieStore.get("openchat.session_token")?.value;

	if (!sessionToken) {
		redirect("/auth/sign-in");
	}

	// Call better-auth API to get session
	try {
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || "http://localhost:3000";
		const response = await fetch(`${baseUrl}/api/auth/get-session`, {
			headers: {
				Cookie: `openchat.session_token=${sessionToken}`,
			},
			cache: "no-store",
		});

		if (!response.ok) {
			redirect("/auth/sign-in");
		}

		const data = await response.json();

		if (!data.user) {
			redirect("/auth/sign-in");
		}

		return {
			userId: data.user.id,
			email: data.user.email,
			name: data.user.name,
			image: data.user.image,
		};
	} catch (error) {
		console.error("Failed to get session:", error);
		redirect("/auth/sign-in");
	}
});

export async function getUserContext(): Promise<UserContext> {
	return resolveUserContext();
}

export async function getUserId(): Promise<string> {
	const { userId } = await resolveUserContext();
	return userId;
}
