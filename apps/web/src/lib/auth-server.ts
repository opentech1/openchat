import { cache } from "react";
import { redirect } from "next/navigation";
import { createAuth } from "@/convex/auth";
import { getToken as getTokenNextjs } from "@convex-dev/better-auth/nextjs";

export type UserContext = {
	userId: string;
	email?: string | null;
	name?: string | null;
	image?: string | null;
};

export const getToken = () => {
	return getTokenNextjs(createAuth);
};

const resolveUserContext = cache(async (): Promise<UserContext> => {
	const { auth, headers } = await getToken();
	const session = await auth.api.getSession({ headers });

	if (!session?.user) {
		redirect("/auth/sign-in");
	}

	const user = session.user;
	return {
		userId: user.id,
		email: user.email ?? null,
		name: user.name ?? null,
		image: user.image ?? null,
	};
});

export async function getUserContext(): Promise<UserContext> {
	return resolveUserContext();
}

export async function getUserId(): Promise<string> {
	const { userId } = await resolveUserContext();
	return userId;
}
