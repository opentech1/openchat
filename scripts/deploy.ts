#!/usr/bin/env bun
/**
 * Production deployment script for OpenChat
 * Deploys Convex schema and functions to production
 */

import { $ } from "bun";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Find project root (where this script is located in scripts/)
const scriptDir = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = dirname(scriptDir);
const CONVEX_DIR = join(PROJECT_ROOT, "apps/server");
const CONVEX_CONFIG = join(process.env.HOME || "~", ".convex/config.json");

async function main() {
	console.log("🚀 OpenChat Production Deployment\n");

	// Change to server directory
	process.chdir(CONVEX_DIR);
	console.log(`📂 Working directory: ${CONVEX_DIR}\n`);

	// Kill any local Convex dev servers
	console.log("🔪 Stopping local Convex dev servers...");
	try {
		await $`lsof -ti:3210 | xargs kill -9 2>/dev/null`.quiet();
	} catch {
		// Port already clear
	}

	// Create production deployment config if it doesn't exist
	const convexDir = join(CONVEX_DIR, ".convex");
	const envLocal = join(CONVEX_DIR, ".env.local");
	if (!existsSync(convexDir)) {
		console.log("📝 No deployment configured, setting up production deployment...\n");

		// Create .convex directory and configure production deployment
		const fs = await import("fs/promises");
		await fs.mkdir(convexDir, { recursive: true });

		// Production deployment URL from Convex dashboard
		const deploymentUrl = "https://outgoing-setter-201.convex.cloud";

		// Write deployment URL file
		await fs.writeFile(join(convexDir, "deployment_url.txt"), deploymentUrl);

		// Write .env.local with CONVEX_DEPLOYMENT
		const envContent = `# Convex production deployment configuration
CONVEX_DEPLOYMENT=outgoing-setter-201
NEXT_PUBLIC_CONVEX_URL=${deploymentUrl}
`;
		await fs.writeFile(envLocal, envContent);

		console.log(`✅ Configured production deployment: ${deploymentUrl}\n`);
	}

	// Deploy to Convex production
	console.log("☁️  Deploying to Convex production...\n");
	try {
		await $`bunx convex deploy --yes`;
		console.log("\n✅ Convex deployment complete!");
	} catch (error) {
		console.error("\n❌ Convex deployment failed");
		console.log("\nTo fix this:");
		console.log("1. Run: bunx convex dev");
		console.log("2. Select your PRODUCTION deployment (outgoing-setter-201)");
		console.log("3. Press Ctrl+C to stop the dev server");
		console.log("4. Run this deploy script again");
		console.log("\nOr set CONVEX_DEPLOY_KEY from your Vercel environment variables\n");
		process.exit(1);
	}

	// Check deployment status
	console.log("\n📊 Checking deployment status...");
	try {
		const { stdout } = await $`bunx convex env get NEXT_PUBLIC_CONVEX_URL`.quiet();
		console.log(`✅ Production URL: ${stdout.trim()}`);
	} catch {
		console.log("⚠️  Could not retrieve production URL");
	}

	console.log("\n🎉 Deployment complete!");
	console.log("\nNext steps:");
	console.log("1. Vercel will auto-deploy on git push to main");
	console.log("2. Or manually redeploy: vercel --prod");
}

main().catch((error) => {
	console.error("💥 Deployment failed:", error);
	process.exit(1);
});
