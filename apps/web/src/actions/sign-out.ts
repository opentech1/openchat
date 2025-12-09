"use server";

import { signOut } from "@workos-inc/authkit-nextjs";

/**
 * Server action to sign out the user using WorkOS AuthKit.
 * WorkOS handles session invalidation and cookie cleanup.
 */
export async function signOutAction() {
	await signOut();
}
