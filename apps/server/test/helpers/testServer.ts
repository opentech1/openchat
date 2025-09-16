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
	const base = 3200 + Math.floor(Math.random() * 300);
	return base;
}

export async function startTestServer(env?: Record<string, string>): Promise<RunningServer> {
	const port = Number(env?.PORT || process.env.PORT || pickPort());
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
			},
		}
	);
	await waitForHealth(`${baseURL}/health`);
	return {
		baseURL,
		proc,
		close: async () => {
			try {
				proc.kill("SIGTERM");
			} catch {}
		},
	};
}

