import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { db } from "../db";
import { inviteCode } from "../db/schema/invite";

const RESERVATION_TTL_MS = Number(process.env.INVITE_RESERVATION_TTL_MS ?? 10 * 60_000);

export function hashInviteCode(code: string) {
	return createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
}

function generateCode(byteLength = 6) {
	return randomBytes(byteLength).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, byteLength * 2);
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
	const codes: Array<{ code: string; codeHash: string }> = [];
	while (codes.length < count) {
		const code = generateCode();
		const codeHash = hashInviteCode(code);
		codes.push({ code, codeHash });
	}
	const rows = codes.map(({ codeHash }) => ({
		codeHash,
		createdBy: createdBy ?? null,
		expiresAt: expiresAt ?? null,
	}));
	await db
		.insert(inviteCode)
		.values(rows)
		.onConflictDoNothing({ target: inviteCode.codeHash });
	return codes.map(({ code }) => code);
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
