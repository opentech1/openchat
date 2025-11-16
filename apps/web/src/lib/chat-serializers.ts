import type { Id } from "@server/convex/_generated/dataModel";

export type SerializedChat = {
	id: Id<"chats">;
	title: string | null;
	updatedAt: string;
	lastMessageAt: string | null;
};

// Chat type returned by chats.list query (optimized, without redundant fields)
export type ListChat = {
	_id: Id<"chats">;
	title: string;
	createdAt: number;
	updatedAt: number;
	lastMessageAt?: number;
};

export function serializeChat(chat: ListChat): SerializedChat {
	return {
		id: chat._id,
		title: chat.title,
		updatedAt: new Date(chat.updatedAt).toISOString(),
		lastMessageAt: chat.lastMessageAt ? new Date(chat.lastMessageAt).toISOString() : null,
	};
}
