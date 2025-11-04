import { WorkOS } from "@workos-inc/node";

// Initialize WorkOS client
const workos = new WorkOS(process.env.WORKOS_API_KEY!);
const clientId = process.env.WORKOS_CLIENT_ID!;

export type WorkOSProvider = "GoogleOAuth" | "GitHubOAuth";

/**
 * Generate WorkOS authorization URL for social login
 * @param provider - The social provider (GoogleOAuth or GitHubOAuth)
 * @param redirectUri - Where to redirect after authentication
 * @param state - CSRF protection state parameter
 */
export function getWorkOSAuthorizationUrl(
	provider: WorkOSProvider,
	redirectUri: string,
	state?: string,
): string {
	return workos.userManagement.getAuthorizationUrl({
		provider,
		clientId,
		redirectUri,
		state,
	});
}

/**
 * Exchange authorization code for user profile
 * @param code - Authorization code from WorkOS callback
 */
export async function authenticateWithWorkOS(code: string) {
	const { user, accessToken } = await workos.userManagement.authenticateWithCode({
		code,
		clientId,
	});

	return {
		user: {
			id: user.id,
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			emailVerified: user.emailVerified,
			profilePictureUrl: user.profilePictureUrl,
		},
		accessToken,
	};
}

export { workos };
