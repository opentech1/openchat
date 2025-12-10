import { internalAction } from "./_generated/server";

/**
 * Preview deployment seed function
 *
 * This function is automatically run on preview deployments via the --preview-run flag.
 *
 * Usage in package.json build command:
 * convex deploy --cmd 'bun run build' --preview-run previewSeed --preview-create NEXT_PUBLIC_DEPLOYMENT=preview
 *
 * Note: With WorkOS AuthKit, users are managed externally. This seed function
 * can be used to initialize any preview-specific data if needed.
 */
export default internalAction(async (_ctx) => {
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

	// With WorkOS AuthKit, user authentication is handled externally.
	// You can sign in using the WorkOS-configured OAuth providers (GitHub, Google, etc.)
	console.log("[Preview Seed] Preview deployment ready");
	console.log("[Preview Seed] Sign in using WorkOS AuthKit (GitHub, Google, etc.)");

	return {
		success: true,
		message: "Preview deployment initialized",
		note: "Sign in using WorkOS AuthKit providers",
	};
});
