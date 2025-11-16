#!/usr/bin/env bun
/**
 * Database Migration Runner for OpenChat
 *
 * Runs all pending database migrations in the correct order.
 * Safe to run multiple times - migrations are idempotent.
 *
 * Usage:
 *   bun ./scripts/run-migrations.ts
 *   bun ./scripts/run-migrations.ts --verify-only
 *   bun ./scripts/run-migrations.ts --force
 */

import { $ } from "bun";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Find project root
const scriptDir = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = dirname(scriptDir);
const SERVER_DIR = join(PROJECT_ROOT, "apps/server");

interface MigrationResult {
	name: string;
	success: boolean;
	error?: string;
	skipped?: boolean;
	details?: unknown;
}

const migrations: Array<{
	name: string;
	command: string;
	description: string;
	args?: string;
	optional?: boolean;
}> = [
	{
		name: "initializeStats",
		command: "migrations:initializeStats",
		description: "Initialize database statistics counters",
		args: '{"force": false}',
	},
	{
		name: "backfillMessageCounts",
		command: "migrations:backfillMessageCounts",
		description: "Backfill messageCount field for existing chats",
		args: '{"skipExisting": true}',
	},
];

async function runMigration(
	migration: (typeof migrations)[0],
	force = false
): Promise<MigrationResult> {
	console.log(`\n📦 Running migration: ${migration.name}`);
	console.log(`   ${migration.description}`);

	try {
		const args = force && migration.name === "initializeStats"
			? '{"force": true}'
			: migration.args || "{}";

		const result =
			await $`bunx convex run ${migration.command} ${args}`.cwd(SERVER_DIR).quiet();

		const output = result.stdout.toString();
		console.log(output);

		// Check if migration was successful
		if (output.includes('"success": true') || output.includes("success: true")) {
			console.log(`✅ ${migration.name} completed successfully`);
			return {
				name: migration.name,
				success: true,
				details: output,
			};
		}

		console.log(`⚠️  ${migration.name} completed with warnings`);
		return {
			name: migration.name,
			success: true,
			details: output,
		};
	} catch (error) {
		if (migration.optional) {
			console.log(`⏭️  ${migration.name} skipped (optional)`);
			return {
				name: migration.name,
				success: true,
				skipped: true,
			};
		}

		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`❌ ${migration.name} failed:`, errorMessage);

		return {
			name: migration.name,
			success: false,
			error: errorMessage,
		};
	}
}

async function verifyDataConsistency(): Promise<MigrationResult> {
	console.log("\n🔍 Verifying data consistency...");

	try {
		const result = await $`bunx convex run migrations:verifyMessageCounts`.cwd(
			SERVER_DIR
		).quiet();

		const output = result.stdout.toString();
		console.log(output);

		// Check for inconsistencies
		if (output.includes('"inconsistencies": 0') || output.includes("inconsistencies: 0")) {
			console.log("✅ All data is consistent!");
			return {
				name: "verifyMessageCounts",
				success: true,
			};
		}

		console.log("⚠️  Data inconsistencies found - may need to run fixMessageCounts");
		return {
			name: "verifyMessageCounts",
			success: true,
			details: "Inconsistencies detected",
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error("❌ Verification failed:", errorMessage);

		return {
			name: "verifyMessageCounts",
			success: false,
			error: errorMessage,
		};
	}
}

async function main() {
	const args = process.argv.slice(2);
	const verifyOnly = args.includes("--verify-only");
	const force = args.includes("--force");

	console.log("🔄 OpenChat Database Migration Runner\n");
	console.log(`📂 Working directory: ${SERVER_DIR}`);
	console.log(`🎯 Mode: ${verifyOnly ? "Verify Only" : "Run Migrations"}`);
	if (force) {
		console.log("⚠️  Force mode enabled - will re-run migrations");
	}

	const results: MigrationResult[] = [];

	if (!verifyOnly) {
		// Run all migrations
		for (const migration of migrations) {
			const result = await runMigration(migration, force);
			results.push(result);

			// Stop on critical failures (unless optional)
			if (!result.success && !migration.optional) {
				console.error("\n💥 Migration failed - stopping execution");
				break;
			}
		}
	}

	// Always verify at the end
	const verificationResult = await verifyDataConsistency();
	results.push(verificationResult);

	// Print summary
	console.log("\n" + "=".repeat(50));
	console.log("📊 Migration Summary");
	console.log("=".repeat(50));

	const successful = results.filter((r) => r.success).length;
	const failed = results.filter((r) => !r.success).length;
	const skipped = results.filter((r) => r.skipped).length;

	console.log(`Total migrations: ${results.length}`);
	console.log(`✅ Successful: ${successful}`);
	if (failed > 0) {
		console.log(`❌ Failed: ${failed}`);
	}
	if (skipped > 0) {
		console.log(`⏭️  Skipped: ${skipped}`);
	}

	if (failed > 0) {
		console.log("\n❌ Some migrations failed. Please review the errors above.");
		process.exit(1);
	}

	console.log("\n✅ All migrations completed successfully!");
}

main().catch((error) => {
	console.error("💥 Migration runner failed:", error);
	process.exit(1);
});
