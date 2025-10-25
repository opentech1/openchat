const PROD_SERVER_URL = (process.env.PROD_SERVER_URL ?? "https://api.osschat.dev").replace(/\/$/, "");
const PROD_WEB_ORIGIN = process.env.PROD_WEB_ORIGIN ?? "https://osschat.dev";
const REQUEST_TIMEOUT_MS = Number(process.env.CANARY_TIMEOUT_MS ?? 15000);

type TestCase = {
	name: string;
	run: () => Promise<void>;
};

type TimedResponse = {
	response: Response;
	durationMs: number;
};

const targetShapeUrl = `${PROD_SERVER_URL}/api/electric/v1/shape?scope=chats&offset=-1&table=chat`;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<TimedResponse> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	const startedAt = Date.now();
	try {
		const response = await fetch(url, {
			...init,
			signal: controller.signal,
			headers: {
				"User-Agent": "openchat-prod-canary/1.0",
				...(init?.headers ?? {}),
			},
		});
		return { response, durationMs: Date.now() - startedAt };
	} finally {
		clearTimeout(timeout);
	}
}

async function checkHealthEndpoint() {
	const { response, durationMs } = await fetchWithTimeout(`${PROD_SERVER_URL}/health`);
	if (!response.ok) {
		throw new Error(`Expected 200 OK from /health but received ${response.status} ${response.statusText}`);
	}
	const body = await response
		.json()
		.catch(() => null)
		.then((value) => value ?? {});
	if (!body?.ok) {
		throw new Error(`Health endpoint responded without { ok: true } payload (received: ${JSON.stringify(body)})`);
	}
	console.log(`   ↳ /health responded in ${durationMs}ms`);
}

async function checkShapePreflight() {
	const { response, durationMs } = await fetchWithTimeout(targetShapeUrl, {
		method: "OPTIONS",
		headers: {
			Origin: PROD_WEB_ORIGIN,
			"Access-Control-Request-Method": "GET",
			"Access-Control-Request-Headers": "content-type",
		},
	});
	if (response.status !== 204) {
		throw new Error(`Expected 204 from OPTIONS shape preflight, received ${response.status}`);
	}
	const allowOrigin = response.headers.get("access-control-allow-origin");
	if (allowOrigin !== PROD_WEB_ORIGIN) {
		throw new Error(
			`Expected Access-Control-Allow-Origin "${PROD_WEB_ORIGIN}" but received "${allowOrigin ?? "missing"}"`,
		);
	}
	console.log(`   ↳ Shape preflight responded in ${durationMs}ms with Access-Control-Allow-Origin ${allowOrigin}`);
}

async function checkShapeRequest() {
	const { response, durationMs } = await fetchWithTimeout(targetShapeUrl, {
		headers: {
			Origin: PROD_WEB_ORIGIN,
		},
	});
	if (response.status >= 500) {
		throw new Error(`Shape endpoint returned ${response.status} ${response.statusText}`);
	}
	const acceptableStatuses = new Set([200, 401, 403]);
	if (!acceptableStatuses.has(response.status)) {
		throw new Error(`Unexpected shape status ${response.status}; expected one of ${Array.from(acceptableStatuses)}`);
	}
	if (response.status === 200) {
		const electricHandle = response.headers.get("electric-handle");
		if (!electricHandle) {
			throw new Error("Shape request succeeded (200) but Electric handle header is missing");
		}
		await response.arrayBuffer(); // drain body to keep connection clean
		console.log(`   ↳ Shape request succeeded in ${durationMs}ms (handle=${electricHandle})`);
	} else {
		console.log(`   ↳ Shape request returned ${response.status} in ${durationMs}ms (auth likely required)`);
	}
}

async function run() {
	const tests: TestCase[] = [
		{ name: "Health endpoint", run: checkHealthEndpoint },
		{ name: "Electric shape preflight", run: checkShapePreflight },
		{ name: "Electric shape request", run: checkShapeRequest },
	];

	const failures: Array<{ name: string; message: string }> = [];

	for (const test of tests) {
		process.stdout.write(`• ${test.name}... `);
		try {
			await test.run();
			console.log("OK");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			failures.push({ name: test.name, message });
			console.log("FAILED");
			console.error(`   ↳ ${message}`);
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
