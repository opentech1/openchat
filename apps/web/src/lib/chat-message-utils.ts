import type { UIMessage } from "ai";

const DEFAULT_ROLE: NormalizedMessage["role"] = "user";

type PrimitiveDate = string | number | Date | null | undefined;

// Type for tool invocation data from database
export type ToolInvocationData = {
	toolName: string;
	toolCallId: string;
	state: string; // "input-streaming" | "input-available" | "output-available" | "output-error"
	input?: unknown;
	output?: unknown;
	errorText?: string;
};

export type MessageLike = {
	id: string;
	role: string;
	content: string;
	reasoning?: string;
	thinkingTimeMs?: number;
	reasoningRequested?: boolean;
	toolInvocations?: ToolInvocationData[];
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

export type ToolInvocationPart = {
	type: "tool-invocation";
	toolName: string;
	toolCallId: string;
	state: "input-streaming" | "input-available" | "output-available" | "output-error";
	input?: unknown;
	output?: unknown;
	errorText?: string;
};

export type MessagePart =
	| { type: "text"; text: string }
	| { type: "reasoning"; text: string }
	| ToolInvocationPart;

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

	// Build parts array from reasoning, tool invocations, and text content
	// IMPORTANT: Order matters for UI rendering:
	// 1. Reasoning (first, shown at top)
	// 2. Tool invocations (shown between reasoning and text)
	// 3. Text content (shown last)
	const parts: MessagePart[] = [];
	if (message.reasoning) {
		parts.push({ type: "reasoning", text: message.reasoning });
	}
	// Add tool invocations from database
	if (message.toolInvocations && message.toolInvocations.length > 0) {
		for (const invocation of message.toolInvocations) {
			parts.push({
				type: "tool-invocation",
				toolName: invocation.toolName,
				toolCallId: invocation.toolCallId,
				state: invocation.state as ToolInvocationPart["state"],
				input: invocation.input,
				output: invocation.output,
				errorText: invocation.errorText,
			});
		}
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

/**
 * Type guard to check if a part is a tool invocation from AI SDK
 * AI SDK uses types like "tool-search" for tool invocations
 */
function isToolInvocationPart(part: unknown): part is {
	type: string;
	toolCallId: string;
	state: "input-streaming" | "input-available" | "output-available" | "output-error";
	input?: unknown;
	output?: unknown;
	errorText?: string;
} {
	if (!part || typeof part !== "object") return false;
	const p = part as Record<string, unknown>;
	return (
		typeof p.type === "string" &&
		p.type.startsWith("tool-") &&
		typeof p.toolCallId === "string" &&
		typeof p.state === "string"
	);
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

	// Preserve all parts including reasoning and tool invocations
	const parts: MessagePart[] = [];

	for (const part of message.parts) {
		if (!part || typeof part !== "object") continue;

		// Handle text and reasoning parts
		if (part.type === "text" || part.type === "reasoning") {
			if ("text" in part && typeof part.text === "string") {
				parts.push({
					type: part.type as "text" | "reasoning",
					text: part.text,
				});
			}
			continue;
		}

		// Handle tool invocation parts (type is "tool-{toolName}")
		if (isToolInvocationPart(part)) {
			// Extract tool name from type (e.g., "tool-search" -> "search")
			const toolName = part.type.replace(/^tool-/, "");
			parts.push({
				type: "tool-invocation",
				toolName,
				toolCallId: part.toolCallId,
				state: part.state,
				input: part.input,
				output: part.output,
				errorText: part.errorText,
			});
		}
	}

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

/**
 * Convert normalized message back to UIMessage format
 * Tool invocation parts need to be converted back to AI SDK format
 */
export function toUiMessage(message: NormalizedMessage): UIMessage<{ createdAt: string; thinkingTimeMs?: number; reasoningRequested?: boolean }> {
	// Convert parts to AI SDK format
	const convertedParts: Array<
		| { type: "text"; text: string }
		| { type: "reasoning"; text: string }
		| { type: string; toolCallId: string; toolName?: string; state: string; input?: unknown; output?: unknown; errorText?: string }
	> = [];

	if (message.parts) {
		for (const part of message.parts) {
			if (part.type === "text" || part.type === "reasoning") {
				convertedParts.push(part);
			} else if (part.type === "tool-invocation") {
				// Convert back to AI SDK format: type is "tool-{toolName}"
				convertedParts.push({
					type: `tool-${part.toolName}`,
					toolCallId: part.toolCallId,
					toolName: part.toolName,
					state: part.state,
					input: part.input,
					output: part.output,
					errorText: part.errorText,
				});
			}
		}
	}

	// Use converted parts or fallback to text content
	const finalParts = convertedParts.length > 0 ? convertedParts : [{ type: "text" as const, text: message.content }];

	return {
		id: message.id,
		role: message.role,
		// Cast to any to bypass strict type checking - AI SDK types are complex
		parts: finalParts as UIMessage<{ createdAt: string }>["parts"],
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
