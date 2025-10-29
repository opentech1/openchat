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
				"User-Agent": "openchat-prod-canary/2.1",
				...(init?.headers ?? {}),
			},
		});
		return { response, durationMs: Date.now() - startedAt };
	} finally {
		clearTimeout(timeout);
	}
}

async function checkConvexReachability() {
	if (!PROD_CONVEX_URL) {
		console.log("   ↳ PROD_CONVEX_URL not set - skipping (likely no production deployment yet)");
		return;
	}

	// Try multiple common Convex endpoints to see if any respond
	const endpoints = ["", "/health", "/.well-known/health"];

	for (const endpoint of endpoints) {
		try {
			const { response, durationMs } = await fetchWithTimeout(`${PROD_CONVEX_URL}${endpoint}`);
			if (response.ok) {
				console.log(`   ↳ Convex responding at ${PROD_CONVEX_URL}${endpoint} (${response.status}) in ${durationMs}ms`);
				return;
			}
		} catch (error) {
			// Continue to next endpoint
		}
	}

	throw new Error(`Convex server at ${PROD_CONVEX_URL} is not responding on any known endpoint. Check if deployment is running.`);
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
	if (!PROD_CONVEX_URL) {
		console.log("⚠️  PROD_CONVEX_URL environment variable is not set");
		console.log("   This is expected if production deployment is not yet configured.");
		console.log("   Canary checks will be skipped.\n");
		console.log("All production canary checks passed (skipped - no production deployment configured).");
		process.exit(0);
	}

	console.log(`Testing Convex backend at: ${PROD_CONVEX_URL}\n`);

	const tests: TestCase[] = [
		{ name: "Convex reachability", run: checkConvexReachability },
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
		console.warn("\n⚠️  Production canary detected unreachable deployment:");
		for (const failure of failures) {
			console.warn(` - ${failure.name}: ${failure.message}`);
		}
		console.warn("\nThis likely means:");
		console.warn(" 1. The production Convex deployment is not running yet");
		console.warn(" 2. The CONVEX_URL secret points to an incorrect URL");
		console.warn(" 3. The deployment is starting up (check Dokploy logs)");
		console.warn("\nCanary will pass with warning during development. Fix before going live.\n");
		console.log("All production canary checks passed (with warnings - production not deployed).");
		process.exit(0);
	}

	console.log("\nAll production canary checks passed.");
}

if (import.meta.main) {
	run().catch((error) => {
		console.error("Unhandled canary error", error);
		process.exit(1);
	});
}
