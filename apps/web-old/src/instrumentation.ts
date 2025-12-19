import * as Sentry from "@sentry/nextjs";

export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		// Validate environment variables on server startup
		// This will throw and prevent app startup if validation fails
		const { validateServerEnv } = await import("./lib/env");
		const { logInfo } = await import("./lib/logger-server");
		validateServerEnv();
		logInfo("✅ Environment variables validated successfully");
		
		await import("./sentry.server.config");
	}

	if (process.env.NEXT_RUNTIME === "edge") {
		await import("./sentry.edge.config");
	}
}

export const onRequestError = Sentry.captureRequestError;
