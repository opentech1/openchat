import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const bucket = process.env.R2_BUCKET;
const accountId = process.env.R2_ACCOUNT_ID;
const prefix = process.env.R2_PREFIX ?? "prod/db";

if (!bucket || !accountId) {
	console.error("[backup] Missing R2_BUCKET or R2_ACCOUNT_ID env vars");
	process.exit(1);
}

const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
const s3 = new S3Client({
	region: "auto",
	endpoint,
	forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === "true",
	credentials: {
		accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
		secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
	},
});

const pgEnv = {
	PGHOST: process.env.PGHOST ?? process.env.POSTGRES_HOST ?? "openchat-postgres",
	PGPORT: process.env.PGPORT ?? "5432",
	PGUSER: process.env.POSTGRES_USER ?? "openchat",
	PGPASSWORD: process.env.POSTGRES_PASSWORD ?? "",
};

async function runPgDump(database: string, file: string) {
	await new Promise<void>((resolve, reject) => {
		execFile(
			"pg_dump",
			["-Fc", "--no-owner", "--no-acl", "-d", database, "-f", file],
			{ env: { ...process.env, ...pgEnv } },
			(error) => (error ? reject(error) : resolve()),
		);
	});
}

async function uploadDump(path: string, key: string) {
	const gzipPath = `${path}.gz`;
	await pipeline(createReadStream(path), createGzip(), createWriteStream(gzipPath));
	const body = await fs.readFile(gzipPath);
	await s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: `${prefix}/${key}.tar.gz`,
			Body: body,
			ContentType: "application/gzip",
		}),
	);
	await fs.unlink(gzipPath);
}

async function main() {
	const tempDir = await mkdtemp(join(tmpdir(), "openchat-backup-"));
	try {
		const mainDump = join(tempDir, `openchat-${timestamp}.pgdump`);
		const shadowDump = join(tempDir, `openchat-shadow-${timestamp}.pgdump`);

		await runPgDump("openchat", mainDump);
		await runPgDump("openchat_shadow", shadowDump);

		await uploadDump(mainDump, `openchat-${timestamp}`);
		await uploadDump(shadowDump, `openchat-shadow-${timestamp}`);
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
}

main().catch((error) => {
	console.error("[backup] failed", error);
	process.exit(1);
});
