import type { Doc, Id } from "@server/convex/_generated/dataModel";

export type SerializedChat = {
	id: Id<"chats">;
	title: string | null;
	updatedAt: string;
	lastMessageAt: string | null;
};

export function serializeChat(chat: Doc<"chats">): SerializedChat {
	return {
		id: chat._id,
		title: chat.title,
		updatedAt: new Date(chat.updatedAt).toISOString(),
		lastMessageAt: chat.lastMessageAt ? new Date(chat.lastMessageAt).toISOString() : null,
	};
}
