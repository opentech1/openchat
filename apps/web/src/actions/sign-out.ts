"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Server action to sign out the user.
 * Clears the Better Auth session cookie and redirects to sign-in.
 */
export async function signOutAction() {
	const cookieStore = await cookies();

	// Clear Better Auth session cookies
	cookieStore.delete("better-auth.session_token");
	cookieStore.delete("__Secure-better-auth.session_token");

	// Redirect to sign-in page
	redirect("/auth/sign-in");
}
