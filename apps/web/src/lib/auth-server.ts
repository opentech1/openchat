import { cache } from "react";
import { redirect } from "next/navigation";
import { withAuth } from "@workos-inc/authkit-nextjs";

export type UserContext = {
	userId: string;
	email?: string | null;
	name?: string | null;
	image?: string | null;
};

const resolveUserContext = cache(async (): Promise<UserContext> => {
	const { user } = await withAuth();
	if (!user) {
		redirect("/auth/sign-in");
	}
	const nameParts = [user.firstName, user.lastName].filter((part): part is string => Boolean(part?.trim()));
	const displayName = nameParts.join(" ").trim() || user.email || null;
	return {
		userId: user.id,
		email: user.email,
		name: displayName,
		image: user.profilePictureUrl ?? null,
	};
});

export async function getUserContext(): Promise<UserContext> {
	return resolveUserContext();
}

export async function getUserId(): Promise<string> {
	const { userId } = await resolveUserContext();
	return userId;
}
