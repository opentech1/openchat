import { createClient } from "redis";

const url = process.env.REDIS_URL ?? "redis://localhost:6379";

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return await new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error("Redis connection timed out"));
		}, ms);
		promise
			.then((value) => {
				clearTimeout(timer);
				resolve(value);
			})
			.catch((err) => {
				clearTimeout(timer);
				reject(err);
			});
	});
}

async function main() {
	const client = createClient({ url });
	try {
		await withTimeout(client.connect(), 2000);
		const pong = await withTimeout(client.ping(), 2000);
		if (pong !== "PONG") {
			throw new Error("Redis ping failed");
		}
		process.env.REDIS_URL = url;
		await client.quit();
	} catch (error) {
		try {
			await client.quit();
		} catch {
		}
		const message = error instanceof Error ? error.message : String(error);
		process.stderr.write(`Redis is not reachable at ${url}. ${message}\n`);
		process.stderr.write("Start Redis locally (docker run -d -p 6379:6379 redis:alpine) or set REDIS_URL.\n");
		process.exit(1);
	}
}

main();
