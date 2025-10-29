const PROD_CONVEX_URL = (process.env.PROD_CONVEX_URL ?? "").replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = Number(process.env.CANARY_TIMEOUT_MS ?? 15000);
const MAX_RETRIES = Math.max(1, Number(process.env.CANARY_MAX_RETRIES ?? 3));
const RETRY_DELAY_MS = Number(process.env.CANARY_RETRY_DELAY_MS ?? 5000);

type TestCase = {
	name: string;
	run: () => Promise<void>;
};

type TimedResponse = {
	response: Response;
	durationMs: number;
};

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<TimedResponse> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	const startedAt = Date.now();
	try {
		const response = await fetch(url, {
			...init,
			signal: controller.signal,
			headers: {
				"User-Agent": "openchat-prod-canary/2.0",
				...(init?.headers ?? {}),
			},
		});
		return { response, durationMs: Date.now() - startedAt };
	} finally {
		clearTimeout(timeout);
	}
}

async function checkConvexHealthEndpoint() {
	if (!PROD_CONVEX_URL) {
		throw new Error("PROD_CONVEX_URL environment variable is not set");
	}
	const { response, durationMs } = await fetchWithTimeout(`${PROD_CONVEX_URL}/health`);
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Expected 200 OK from Convex /health but received ${response.status} ${response.statusText}. Body: ${body.substring(0, 200)}`);
	}
	const body = await response
		.json()
		.catch(() => null)
		.then((value) => value ?? {});
	if (!body?.ok) {
		throw new Error(`Convex health endpoint responded without { ok: true } payload (received: ${JSON.stringify(body)})`);
	}
	console.log(`   ↳ Convex /health responded in ${durationMs}ms`);
}

async function checkConvexQueryEndpoint() {
	if (!PROD_CONVEX_URL) {
		throw new Error("PROD_CONVEX_URL environment variable is not set");
	}

	// Test a simple query endpoint - Convex should at least respond
	const { response, durationMs } = await fetchWithTimeout(`${PROD_CONVEX_URL}/api/query`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			path: "chats:list",
			format: "json",
			args: {},
		}),
	});

	// Accept 200, 400, or 401 - just verify Convex is responding
	if (response.status >= 500) {
		const body = await response.text();
		throw new Error(`Convex API returned server error ${response.status}. Body: ${body.substring(0, 200)}`);
	}

	const body = await response.json().catch(() => null);
	if (!body) {
		throw new Error("Convex API returned non-JSON response");
	}

	console.log(`   ↳ Convex API responded in ${durationMs}ms (status: ${response.status})`);
}

async function checkConvexDashboard() {
	if (!PROD_CONVEX_URL) {
		throw new Error("PROD_CONVEX_URL environment variable is not set");
	}

	// Check that the Convex dashboard/admin interface is accessible
	const { response, durationMs } = await fetchWithTimeout(PROD_CONVEX_URL);

	// Dashboard should return HTML or redirect, not 404/500
	if (response.status >= 500) {
		throw new Error(`Convex dashboard returned server error ${response.status}`);
	}

	if (response.status === 404) {
		throw new Error("Convex dashboard returned 404 - service may not be running");
	}

	console.log(`   ↳ Convex dashboard responded in ${durationMs}ms (status: ${response.status})`);
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
	console.log(`Testing Convex backend at: ${PROD_CONVEX_URL || "(not set)"}\n`);

	const tests: TestCase[] = [
		{ name: "Convex dashboard", run: checkConvexDashboard },
		{ name: "Convex health endpoint", run: checkConvexHealthEndpoint },
		{ name: "Convex query endpoint", run: checkConvexQueryEndpoint },
	];

	const failures: Array<{ name: string; message: string }> = [];

		for (const test of tests) {
			let attempt = 0;
			let lastError: unknown;
			while (attempt < MAX_RETRIES) {
				attempt += 1;
				process.stdout.write(`• ${test.name} (attempt ${attempt}/${MAX_RETRIES})... `);
				try {
					await test.run();
					console.log("OK");
					lastError = null;
					break;
				} catch (error) {
					lastError = error;
					const message = error instanceof Error ? error.message : String(error);
					console.log("FAILED");
					console.error(`   ↳ ${message}`);
					if (attempt < MAX_RETRIES) {
						console.log(`   ↳ retrying in ${RETRY_DELAY_MS}ms...`);
						await sleep(RETRY_DELAY_MS);
					}
				}
			}
			if (lastError) {
				const message = lastError instanceof Error ? lastError.message : String(lastError);
				failures.push({ name: test.name, message });
			}
		}

	if (failures.length > 0) {
		console.error("\nProduction canary detected failures:");
		for (const failure of failures) {
			console.error(` - ${failure.name}: ${failure.message}`);
		}
		process.exit(1);
	}

	console.log("\nAll production canary checks passed.");
}

if (import.meta.main) {
	run().catch((error) => {
		console.error("Unhandled canary error", error);
		process.exit(1);
	});
}
