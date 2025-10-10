import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { db } from "../db";
import { inviteCode } from "../db/schema/invite";

const RESERVATION_TTL_MS = Number(process.env.INVITE_RESERVATION_TTL_MS ?? 10 * 60_000);
const DEFAULT_CODE_LENGTH = Number(process.env.INVITE_CODE_LENGTH ?? 12);
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function hashInviteCode(code: string) {
	return createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
}

function generateCode(length = DEFAULT_CODE_LENGTH) {
	const targetLength = Number.isFinite(length) && length > 0 ? Math.floor(length) : DEFAULT_CODE_LENGTH;
	let output = "";
	while (output.length < targetLength) {
		const buf = randomBytes(targetLength);
		for (const byte of buf) {
			if (output.length >= targetLength) break;
			output += CODE_ALPHABET[byte % CODE_ALPHABET.length]!;
		}
	}
	return output;
}

export async function createInviteCodes({
	count,
	createdBy,
	expiresAt,
}: {
	count: number;
	createdBy?: string;
	expiresAt?: Date | null;
}) {
	const normalizedCount = Math.max(0, Math.floor(count));
	const createdByValue = createdBy ?? null;
	const expiresValue = expiresAt ?? null;
	const issued: string[] = [];
	const seenHashes = new Set<string>();

	while (issued.length < normalizedCount) {
		const remaining = normalizedCount - issued.length;
		const batchSize = Math.max(remaining * 2, 4);
		const candidates = new Map<string, string>();

		while (candidates.size < batchSize) {
			const code = generateCode();
			const codeHash = hashInviteCode(code);
			if (seenHashes.has(codeHash) || candidates.has(codeHash)) continue;
			candidates.set(codeHash, code);
		}

		const rows = Array.from(candidates.keys()).map((codeHash) => ({
			codeHash,
			createdBy: createdByValue,
			expiresAt: expiresValue,
		}));

		const inserted = await db
			.insert(inviteCode)
			.values(rows)
			.onConflictDoNothing({ target: inviteCode.codeHash })
			.returning({ codeHash: inviteCode.codeHash });

		for (const { codeHash } of inserted) {
			const code = candidates.get(codeHash);
			if (!code) continue;
			issued.push(code);
			seenHashes.add(codeHash);
			if (issued.length >= normalizedCount) break;
		}
	}

	return issued;
}

export async function reserveInviteCode({
	code,
	email,
}: {
	code: string;
	email: string;
}) {
	await invalidateExpiredReservations();
	const now = new Date();
	const cutoff = new Date(now.getTime() - RESERVATION_TTL_MS);
	const reservationToken = randomBytes(16).toString("base64url");
	const codeHash = hashInviteCode(code);
	const result = await db
		.update(inviteCode)
		.set({
			reservationToken,
			reservedAt: now,
			reservedByEmail: email,
		})
		.where(
			and(
				eq(inviteCode.codeHash, codeHash),
				isNull(inviteCode.usedAt),
				or(isNull(inviteCode.expiresAt), gt(inviteCode.expiresAt, now)),
				or(
					isNull(inviteCode.reservationToken),
					or(isNull(inviteCode.reservedAt), lt(inviteCode.reservedAt, cutoff)),
				),
			),
		)
		.returning({ reservationToken: inviteCode.reservationToken, expiresAt: inviteCode.expiresAt });
	if (result.length === 0) return null;
	return {
		reservationToken,
		expiresAt: result[0]!.expiresAt ?? null,
	};
}

export async function releaseInviteReservation(reservationToken: string) {
	if (!reservationToken) return;
	await db
		.update(inviteCode)
		.set({ reservationToken: null, reservedAt: null, reservedByEmail: null })
		.where(and(eq(inviteCode.reservationToken, reservationToken), isNull(inviteCode.usedAt)));
}

export async function consumeInviteReservation({
	reservationToken,
	userId,
	email,
}: {
	reservationToken: string;
	userId: string;
	email: string;
}) {
	const now = new Date();
	const result = await db
		.update(inviteCode)
		.set({
			usedAt: now,
			usedByUserId: userId,
			usedByEmail: email,
			reservationToken: null,
			reservedAt: null,
			reservedByEmail: null,
		})
		.where(and(eq(inviteCode.reservationToken, reservationToken), isNull(inviteCode.usedAt)))
		.returning({ codeHash: inviteCode.codeHash });
	return result.length > 0;
}

export async function invalidateExpiredReservations() {
	const cutoff = new Date(Date.now() - RESERVATION_TTL_MS);
	await db
		.update(inviteCode)
		.set({ reservationToken: null, reservedAt: null, reservedByEmail: null })
		.where(
			and(
				isNull(inviteCode.usedAt),
				or(isNull(inviteCode.reservationToken), lt(inviteCode.reservedAt, cutoff)),
			),
		);
}
