import type { UIMessage } from "ai";

const DEFAULT_ROLE: NormalizedMessage["role"] = "user";

type PrimitiveDate = string | number | Date | null | undefined;

export type MessageLike = {
	id: string;
	role: string;
	content: string;
	reasoning?: string;
	thinkingTimeMs?: number;
	created_at?: PrimitiveDate;
	updated_at?: PrimitiveDate;
	createdAt?: PrimitiveDate;
	updatedAt?: PrimitiveDate;
};

export type MessagePart =
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string };

export type NormalizedMessage = {
	id: string;
	role: "assistant" | "user";
	content: string;
	parts?: MessagePart[];
	thinkingTimeMs?: number;
	createdAt: Date;
	updatedAt: Date | null;
};

function parseDate(value: PrimitiveDate): Date | null {
	if (value instanceof Date) {
		return Number.isNaN(value.valueOf()) ? null : value;
	}
	if (typeof value === "number" && Number.isFinite(value)) {
		const date = new Date(value);
		return Number.isNaN(date.valueOf()) ? null : date;
	}
	if (typeof value === "string" && value.length > 0) {
		const date = new Date(value);
		return Number.isNaN(date.valueOf()) ? null : date;
	}
	return null;
}

function normalizeRole(role: string | null | undefined): NormalizedMessage["role"] {
	return role === "assistant" ? "assistant" : DEFAULT_ROLE;
}

function fallbackDate(value: PrimitiveDate, fallback: Date): Date {
	return parseDate(value) ?? fallback;
}

export function normalizeMessage(message: MessageLike): NormalizedMessage {
	const createdFallback = new Date();
	const createdAt =
		parseDate(message.created_at) ??
		parseDate(message.createdAt) ??
		parseDate(message.updated_at) ??
		parseDate(message.updatedAt) ??
		createdFallback;
	const updatedAt =
		parseDate(message.updated_at) ??
		parseDate(message.updatedAt) ??
		(null);

	// Build parts array if reasoning exists
	const parts: MessagePart[] = [];
	if (message.reasoning) {
		parts.push({ type: "reasoning", text: message.reasoning });
	}
	if (message.content) {
		parts.push({ type: "text", text: message.content });
	}

	return {
		id: message.id,
		role: normalizeRole(message.role),
		content: message.content,
		parts: parts.length > 0 ? parts : undefined,
		thinkingTimeMs: message.thinkingTimeMs,
		createdAt,
		updatedAt,
	};
}

export function normalizeUiMessage(message: UIMessage<{ createdAt?: string }>): NormalizedMessage {
	// Extract text content for backward compatibility
	const content = message.parts
		.filter((part): part is { type: "text"; text: string } => part?.type === "text")
		.map((part) => part.text)
		.join("");

	// Preserve all parts including reasoning
	const parts: MessagePart[] = message.parts
		.filter((part): part is { type: "text" | "reasoning"; text: string } =>
			(part?.type === "text" || part?.type === "reasoning") && typeof (part as any).text === "string"
		)
		.map((part) => ({
			type: part.type as "text" | "reasoning",
			text: part.text,
		}));

	return {
		...normalizeMessage({
			id: message.id,
			role: message.role,
			content,
			created_at: message.metadata?.createdAt,
		}),
		parts: parts.length > 0 ? parts : undefined,
	};
}

export function toUiMessage(message: NormalizedMessage): UIMessage<{ createdAt: string }> {
	return {
		id: message.id,
		role: message.role,
		parts: message.parts ?? [{ type: "text", text: message.content }],
		metadata: { createdAt: message.createdAt.toISOString() },
	};
}

export function toElectricMessageRecord(message: NormalizedMessage) {
	return {
		id: message.id,
		role: message.role,
		content: message.content,
		created_at: message.createdAt.toISOString(),
		updated_at: fallbackDate(message.updatedAt, message.createdAt).toISOString(),
	};
}

export function mergeNormalizedMessages(
	base: NormalizedMessage[],
	overlay: NormalizedMessage[],
	options: { preferNewerContent?: boolean } = {},
): NormalizedMessage[] {
	const preferNewerContent = options.preferNewerContent ?? true;
	const map = new Map<string, NormalizedMessage>();
	for (const message of base) {
		map.set(message.id, message);
	}
	for (const candidate of overlay) {
		const existing = map.get(candidate.id);
		if (!existing) {
			map.set(candidate.id, candidate);
			continue;
		}
		if (candidate.createdAt.getTime() > existing.createdAt.getTime()) {
			map.set(candidate.id, candidate);
			continue;
		}
		if (preferNewerContent) {
			const existingLength = existing.content.length;
			const candidateLength = candidate.content.length;
			if (candidateLength > existingLength) {
				map.set(candidate.id, candidate);
				continue;
			}
			const existingUpdated = existing.updatedAt?.getTime() ?? existing.createdAt.getTime();
			const candidateUpdated = candidate.updatedAt?.getTime() ?? candidate.createdAt.getTime();
			if (candidateUpdated > existingUpdated) {
				map.set(candidate.id, candidate);
			}
		}
	}
	return Array.from(map.values()).sort((a, b) => {
		const diff = a.createdAt.getTime() - b.createdAt.getTime();
		if (diff !== 0) return diff;
		return a.id.localeCompare(b.id);
	});
}
