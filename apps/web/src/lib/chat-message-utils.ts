import type { UIMessage } from "ai";

const DEFAULT_ROLE: NormalizedMessage["role"] = "user";

type PrimitiveDate = string | number | Date | null | undefined;

export type MessageLike = {
	id: string;
	role: string;
	content: string;
	reasoning?: string;
	thinkingTimeMs?: number;
	reasoningRequested?: boolean;
	attachments?: Array<{
		storageId: string;
		filename: string;
		contentType: string;
		size: number;
		uploadedAt: number;
	}>;
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
	reasoningRequested?: boolean;
	attachments?: Array<{
		storageId: string;
		filename: string;
		contentType: string;
		size: number;
		uploadedAt: number;
	}>;
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
	// IMPORTANT: Reasoning MUST come before text content in parts array
	// UI components like chat-messages-panel.tsx rely on this ordering
	const parts: MessagePart[] = [];
	if (message.reasoning) {
		parts.push({ type: "reasoning", text: message.reasoning });
	}
	if (message.content) {
		parts.push({ type: "text", text: message.content });
	}

	// Ensure attachments have uploadedAt field (fallback to createdAt if missing)
	const normalizedAttachments = message.attachments?.map((attachment) => ({
		...attachment,
		uploadedAt: attachment.uploadedAt ?? createdAt.getTime(),
	}));

	return {
		id: message.id,
		role: normalizeRole(message.role),
		content: message.content,
		parts: parts.length > 0 ? parts : undefined,
		thinkingTimeMs: message.thinkingTimeMs,
		reasoningRequested: message.reasoningRequested,
		attachments: normalizedAttachments,
		createdAt,
		updatedAt,
	};
}

export function normalizeUiMessage(message: UIMessage<{
	createdAt?: string;
	thinkingTimeMs?: number;
	reasoningRequested?: boolean;
	attachments?: Array<{
		storageId: string;
		filename: string;
		contentType: string;
		size: number;
		uploadedAt?: number;
	}>;
}>): NormalizedMessage {
	// Extract text content for backward compatibility
	const content = message.parts
		.filter((part): part is { type: "text"; text: string } => part?.type === "text")
		.map((part) => part.text)
		.join("");

	// Preserve all parts including reasoning
	const parts: MessagePart[] = message.parts
		.filter((part): part is { type: "text" | "reasoning"; text: string } => {
			if (!part || typeof part !== "object") return false;
			const hasType = part.type === "text" || part.type === "reasoning";
			const hasText = "text" in part && typeof part.text === "string";
			return hasType && hasText;
		})
		.map((part) => ({
			type: part.type as "text" | "reasoning",
			text: part.text,
		}));

	// Extract thinkingTimeMs and reasoningRequested from metadata if available
	const thinkingTimeMs = message.metadata?.thinkingTimeMs;
	const reasoningRequested = message.metadata?.reasoningRequested;

	return {
		...normalizeMessage({
			id: message.id,
			role: message.role,
			content,
			thinkingTimeMs,
			reasoningRequested,
			created_at: message.metadata?.createdAt,
		}),
		parts: parts.length > 0 ? parts : undefined,
		thinkingTimeMs, // Ensure it's preserved even after normalizeMessage
		reasoningRequested, // Ensure it's preserved even after normalizeMessage
	};
}

export function toUiMessage(message: NormalizedMessage): UIMessage<{ createdAt: string; thinkingTimeMs?: number; reasoningRequested?: boolean }> {
	return {
		id: message.id,
		role: message.role,
		parts: message.parts ?? [{ type: "text", text: message.content }],
		metadata: {
			createdAt: message.createdAt.toISOString(),
			thinkingTimeMs: message.thinkingTimeMs,
			reasoningRequested: message.reasoningRequested,
		},
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
