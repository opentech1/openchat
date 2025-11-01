"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export async function signOutAction() {
	// Clear auth cookies
	const cookieStore = await cookies();
	const cookieNames = ["openchat-session-token", "openchat.session-token"];

	for (const name of cookieNames) {
		cookieStore.delete(name);
	}

	redirect("/");
}
