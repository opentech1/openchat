"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Server action to sign out the user.
 * Clears the Better Auth session cookie and redirects to sign-in.
 */
export async function signOutAction() {
	const cookieStore = await cookies();

	// Clear Better Auth session cookie (ba_session is set by hybridStorage in auth-client.ts)
	cookieStore.delete("ba_session");

	// Redirect to sign-in page
	redirect("/auth/sign-in");
}
