import { spawn } from "node:child_process";
import process from "node:process";
import { createRequire } from "node:module";

import { shutdownPosthog } from "../apps/server/src/lib/posthog";

const requireFromServer = createRequire(new URL("../apps/server/package.json", import.meta.url));
const { Client } = requireFromServer("pg") as typeof import("pg");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	console.error("[server-entry] DATABASE_URL env variable is required");
	process.exit(1);
}

const waitTimeoutMs = Number(process.env.POSTGRES_WAIT_TIMEOUT ?? 120_000);
const retryIntervalMs = Number(process.env.POSTGRES_WAIT_INTERVAL ?? 2_000);
const runMigrations = process.env.RUN_DB_MIGRATIONS !== "0";

async function waitForPostgres() {
	const startedAt = Date.now();
	while (Date.now() - startedAt < waitTimeoutMs) {
		const client = new Client({ connectionString: DATABASE_URL });
		try {
			await client.connect();
			await client.end();
			console.log("[server-entry] Postgres is ready");
			return;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.warn(`(server-entry) Waiting for Postgres: ${message}`);
			await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
		} finally {
			try {
				await client.end();
			} catch {}
		}
	}

	throw new Error("Timed out waiting for Postgres");
}

async function runCommand(command: string, args: string[], options: { cwd?: string } = {}) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: "inherit",
			env: process.env,
			cwd: options.cwd ?? process.cwd(),
		});
		child.on("exit", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
			}
		});
		child.on("error", reject);
	});
}

async function main() {
	await waitForPostgres();

	if (runMigrations) {
		console.log("[server-entry] Running migrations (apps/server)");
		await runCommand("bun", ["run", "db:push"], { cwd: "/app/apps/server" });
	} else {
		console.log("[server-entry] Skipping migrations (RUN_DB_MIGRATIONS=0)");
	}

	console.log("[server-entry] Starting API server");
	const server = spawn("bun", ["run", "start"], {
		cwd: "/app/apps/server",
		stdio: "inherit",
		env: process.env,
	});

	const forward = (signal: NodeJS.Signals) => () => {
		if (!server.killed) {
			server.kill(signal);
		}
	};

	process.on("SIGTERM", forward("SIGTERM"));
	process.on("SIGINT", forward("SIGINT"));

	server.on("exit", (code) => process.exit(code ?? 0));
	server.on("error", (error) => {
		console.error("[server-entry] Server process failed", error);
		process.exit(1);
	});

	const cleanup = async () => {
		await shutdownPosthog();
	};

	process.on("exit", () => {
		void cleanup();
	});
	process.on("SIGTERM", () => {
		void cleanup();
	});
	process.on("SIGINT", () => {
		void cleanup();
	});
}

main().catch((error) => {
	console.error("[server-entry] Fatal error", error);
	process.exit(1);
});
