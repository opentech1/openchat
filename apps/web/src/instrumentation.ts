import * as Sentry from "@sentry/nextjs";

export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		// Validate environment variables on server startup
		try {
			const { validateServerEnv } = await import("./lib/env");
			validateServerEnv();
			console.log("✅ Environment variables validated successfully");
		} catch (error) {
			// Log error but don't crash - let the app start and show user-friendly errors
			console.error("Environment validation failed:", error);
		}
		
		await import("./sentry.server.config");
	}

	if (process.env.NEXT_RUNTIME === "edge") {
		await import("./sentry.edge.config");
	}
}

export const onRequestError = Sentry.captureRequestError;
