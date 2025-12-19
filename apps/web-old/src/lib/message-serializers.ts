import type { Id } from "@server/convex/_generated/dataModel";

export type SerializedMessage = {
	id: Id<"messages">;
	role: string;
	content: string;
	createdAt: string;
	status?: string | null;
	clientMessageId?: string | null;
	// CRITICAL: Include reasoning and thinking time for reload support
	reasoning?: string | null;
	thinkingTimeMs?: number | null;
	// STREAM RECONNECTION: Include streamId to reconnect to active streams on reload
	streamId?: string | null;
	attachments?: Array<{
		storageId: string;
		filename: string;
		contentType: string;
		size: number;
		uploadedAt: number;
		url?: string;
	}> | null;
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
	// STREAM RECONNECTION: Include status and streamId
	status?: string;
	streamId?: string;
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
		// STREAM RECONNECTION: Include status and streamId from the message
		status: message.status ?? null,
		streamId: message.streamId ?? null,
		clientMessageId: message.clientMessageId ?? null,
		// CRITICAL: Include reasoning and thinking time so they persist after reload
		reasoning: message.reasoning ?? null,
		thinkingTimeMs: message.thinkingTimeMs ?? null,
		attachments: message.attachments?.map(a => ({
			storageId: a.storageId as string,
			filename: a.filename,
			contentType: a.contentType,
			size: a.size,
			uploadedAt: a.uploadedAt,
			url: a.url,
		})) ?? null,
	};
}
