import { spawn, type ChildProcess } from "node:child_process";

export type RunningServer = {
	baseURL: string;
	proc: ChildProcess;
	close: () => Promise<void>;
};

async function waitForHealth(url: string, timeoutMs = 20_000) {
	const start = Date.now();
	let lastErr: any;
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(url);
			if (res.ok) return;
		} catch (e) {
			lastErr = e;
		}
		await new Promise((r) => setTimeout(r, 250));
	}
	throw lastErr || new Error(`Timed out waiting for ${url}`);
}

function pickPort(): number {
	return 3200 + Math.floor(Math.random() * 800);
}

export async function startTestServer(env?: Record<string, string>): Promise<RunningServer> {
	const fixedPort = env?.PORT || process.env.PORT;
	let lastError: unknown;
	for (let attempt = 0; attempt < 8; attempt += 1) {
		const port = Number(fixedPort || pickPort());
		const baseURL = `http://localhost:${port}`;
		const proc = spawn(
			"bun",
			["run", "apps/server/src/index.ts"],
			{
				stdio: "inherit",
				env: {
					...process.env,
					NODE_ENV: "test",
					PORT: String(port),
					CORS_ORIGIN: env?.CORS_ORIGIN || process.env.CORS_ORIGIN || "http://localhost:3001",
					DATABASE_URL:
						env?.DATABASE_URL || process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/openchat_test",
					ELECTRIC_GATEKEEPER_SECRET: env?.ELECTRIC_GATEKEEPER_SECRET || process.env.ELECTRIC_GATEKEEPER_SECRET,
					ELECTRIC_SERVICE_URL: env?.ELECTRIC_SERVICE_URL || process.env.ELECTRIC_SERVICE_URL,
					DEV_ALLOW_HEADER_BYPASS: env?.DEV_ALLOW_HEADER_BYPASS || process.env.DEV_ALLOW_HEADER_BYPASS,
				},
			}
		);
		let exited = false;
		proc.once("exit", () => {
			exited = true;
		});
		try {
			await waitForHealth(`${baseURL}/health`);
			const close = async () => {
				try {
					proc.kill("SIGTERM");
				} catch {}
				if (!exited) {
					await new Promise<void>((resolve) => {
						proc.once("exit", () => resolve());
					});
				}
			};
			return { baseURL, proc, close };
		} catch (error) {
			lastError = error;
			try {
				proc.kill("SIGTERM");
			} catch {}
			if (!exited) {
				await new Promise<void>((resolve) => {
					proc.once("exit", () => resolve());
				});
			}
			if (fixedPort) break;
		}
	}
	throw lastError ?? new Error("Failed to start test server");
}
