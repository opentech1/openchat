CREATE TABLE IF NOT EXISTS "invite_code" (
    "code_hash" text PRIMARY KEY,
    "created_by" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "expires_at" timestamptz,
    "reservation_token" text,
    "reserved_at" timestamptz,
    "reserved_by_email" text,
    "used_at" timestamptz,
    "used_by_user_id" text,
    "used_by_email" text
);

CREATE INDEX IF NOT EXISTS "invite_reservation_idx" ON "invite_code" ("reservation_token");
CREATE INDEX IF NOT EXISTS "invite_used_idx" ON "invite_code" ("used_at");
