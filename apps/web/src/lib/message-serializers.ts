import type { Doc, Id } from "@server/convex/_generated/dataModel";

export type SerializedMessage = {
	id: Id<"messages">;
	role: string;
	content: string;
	createdAt: string;
	status?: string | null;
	clientMessageId?: string | null;
};

export function serializeMessage(message: Doc<"messages">): SerializedMessage {
	return {
		id: message._id,
		role: message.role,
		content: message.content,
		createdAt: new Date(message.createdAt).toISOString(),
		status: message.status ?? null,
		clientMessageId: message.clientMessageId ?? null,
	};
}
