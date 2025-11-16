import type { Id } from "@server/convex/_generated/dataModel";

export type SerializedMessage = {
	id: Id<"messages">;
	role: string;
	content: string;
	createdAt: string;
	status?: string | null;
	clientMessageId?: string | null;
};

// Message type returned by messages.list query (optimized, without redundant fields)
export type ListMessage = {
	_id: Id<"messages">;
	role: string;
	content: string;
	createdAt: number;
	clientMessageId?: string;
	reasoning?: string;
	thinkingTimeMs?: number;
	deletedAt?: number;
	attachments?: Array<{
		storageId: Id<"_storage">;
		filename: string;
		contentType: string;
		size: number;
		uploadedAt: number;
		url?: string;
	}>;
};

export function serializeMessage(message: ListMessage): SerializedMessage {
	return {
		id: message._id,
		role: message.role,
		content: message.content,
		createdAt: new Date(message.createdAt).toISOString(),
		status: null, // Not included in optimized list response
		clientMessageId: message.clientMessageId ?? null,
	};
}
