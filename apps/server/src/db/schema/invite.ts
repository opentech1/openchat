import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const inviteCode = pgTable(
	"invite_code",
	{
		codeHash: text("code_hash").primaryKey(),
		createdBy: text("created_by"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		reservationToken: text("reservation_token"),
		reservedAt: timestamp("reserved_at", { withTimezone: true }),
		reservedByEmail: text("reserved_by_email"),
		usedAt: timestamp("used_at", { withTimezone: true }),
		usedByUserId: text("used_by_user_id"),
		usedByEmail: text("used_by_email"),
	},
	(table) => ({
		reservationIdx: index("invite_reservation_idx").on(table.reservationToken),
		usedIdx: index("invite_used_idx").on(table.usedAt),
	}),
);
