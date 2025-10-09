#!/usr/bin/env bun
import "dotenv/config";
import { parseArgs } from "node:util";

import { createInviteCodes, invalidateExpiredReservations } from "../src/lib/invite";

const { values } = parseArgs({
	options: {
		count: { type: "string", short: "c" },
		expires: { type: "string", short: "e" },
		createdBy: { type: "string", short: "u" },
	},
});

const countRaw = values.count ? Number(values.count) : 1;
if (!Number.isFinite(countRaw) || countRaw <= 0) {
	console.error("--count must be a positive integer");
	process.exit(1);
}
const count = Math.floor(countRaw);

let expiresHours: number | undefined;
if (values.expires !== undefined) {
	const parsed = Number(values.expires);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		console.error("--expires must be a positive number of hours");
		process.exit(1);
	}
	expiresHours = parsed;
}

async function main() {
	await invalidateExpiredReservations();
	const expiresAt = typeof expiresHours === "number" ? new Date(Date.now() + expiresHours * 60 * 60 * 1000) : null;
	const codes = await createInviteCodes({
		count,
		createdBy: typeof values.createdBy === "string" ? values.createdBy : undefined,
		expiresAt,
	});
	if (codes.length === 0) {
		console.log("No invite codes generated (they may already exist).");
		return;
	}
	console.log(`Generated ${codes.length} invite code${codes.length === 1 ? "" : "s"}:`);
	for (const code of codes) {
		console.log(`  ${code}${expiresAt ? ` (expires ${expiresAt.toISOString()})` : ""}`);
	}
}

main().catch((error) => {
	console.error("Failed to generate invite codes", error);
	process.exit(1);
});
