import { internalAction } from "./_generated/server";

/**
 * Preview deployment seed function
 *
 * This function is automatically run on preview deployments via the --preview-run flag.
 * It creates a test user for development and testing purposes.
 *
 * Usage in package.json build command:
 * convex deploy --cmd 'bun run build' --preview-run previewSeed --preview-create NEXT_PUBLIC_DEPLOYMENT=preview
 *
 * Test credentials:
 * Email: test@example.com
 * Password: test
 */
export default internalAction(async (ctx) => {
	const deployment = process.env.NEXT_PUBLIC_DEPLOYMENT;
	const nodeEnv = process.env.NODE_ENV;
	const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

	console.log(`[Preview Seed] Running in deployment: ${deployment}, NODE_ENV: ${nodeEnv}`);
	console.log(`[Preview Seed] App URL: ${appUrl}`);

	// Only seed in preview deployments
	if (deployment !== "preview") {
		console.log("[Preview Seed] Skipping - not a preview deployment");
		return { success: false, message: "Not a preview deployment" };
	}

	try {
		// Get the Convex site URL for the auth endpoint
		const convexSiteUrl = process.env.CONVEX_SITE_URL;
		if (!convexSiteUrl) {
			throw new Error("CONVEX_SITE_URL not available");
		}

		const signupUrl = `${convexSiteUrl}/sign-up/email`;

		console.log("[Preview Seed] Creating test user via better-auth signup endpoint");

		// Call the better-auth signup endpoint
		const response = await fetch(signupUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				email: "test@example.com",
				password: "test",
				name: "Test User",
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			// If user already exists, that's okay
			if (errorText.includes("already exists") || response.status === 409) {
				console.log("[Preview Seed] Test user already exists");
				return {
					success: true,
					message: "Test user already exists",
					credentials: {
						email: "test@example.com",
						password: "test",
					},
				};
			}
			throw new Error(`Signup failed: ${response.status} ${errorText}`);
		}

		const result = await response.json();
		console.log("[Preview Seed] Successfully created test user");

		return {
			success: true,
			message: "Test user created successfully",
			credentials: {
				email: "test@example.com",
				password: "test",
			},
			result,
		};
	} catch (error) {
		console.error("[Preview Seed] Error creating test user:", error);
		// Don't throw - just log the error so deployment doesn't fail
		return {
			success: false,
			message: error instanceof Error ? error.message : "Unknown error",
			credentials: {
				email: "test@example.com",
				password: "test",
				note: "You may need to create this user manually",
			},
		};
	}
});
