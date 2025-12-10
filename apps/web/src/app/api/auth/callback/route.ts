import { handleAuth, getWorkOS } from '@workos-inc/authkit-nextjs';
import { NextResponse } from 'next/server';

export const GET = handleAuth({
	returnPathname: '/',
	onSuccess: async ({ user, authenticationMethod }) => {
		// Auto-verify email for OAuth users (GitHub/Google already verify emails)
		// This prevents future issues with email verification requirements
		const isOAuthMethod = authenticationMethod === 'GitHubOAuth' || authenticationMethod === 'GoogleOAuth';

		if (user && !user.emailVerified && isOAuthMethod) {
			try {
				const workos = getWorkOS();
				await workos.userManagement.updateUser({
					userId: user.id,
					emailVerified: true,
				});
				console.log(`[Auth] Auto-verified email for OAuth user: ${user.email}`);
			} catch (error) {
				console.error('[Auth] Failed to auto-verify user email:', error);
			}
		}
	},
	onError: async ({ error, request }) => {
		// Handle email verification required error by redirecting to our verification page
		const err = error as {
			code?: string;
			pendingAuthenticationToken?: string;
			email?: string;
			rawData?: {
				code?: string;
				pending_authentication_token?: string;
				email?: string;
			};
		};

		// Check for email_verification_required error (can be in error.code or error.rawData.code)
		const errorCode = err?.code || err?.rawData?.code;
		const token = err?.pendingAuthenticationToken || err?.rawData?.pending_authentication_token;
		const email = err?.email || err?.rawData?.email;

		if (errorCode === 'email_verification_required' && token && email) {
			console.log(`[Auth] Email verification required for: ${email}`);
			const verifyUrl = new URL('/auth/verify-email', request.url);
			verifyUrl.searchParams.set('email', email);
			verifyUrl.searchParams.set('token', token);
			return NextResponse.redirect(verifyUrl);
		}

		// For other errors, redirect to sign-in with error message
		console.error('[Auth] Authentication error:', error);
		const signInUrl = new URL('/auth/sign-in', request.url);
		signInUrl.searchParams.set('error', 'auth_failed');
		return NextResponse.redirect(signInUrl);
	},
});
