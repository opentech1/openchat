import { ConvexHttpClient } from "convex/browser";
import type { Doc, Id } from "@server/convex/_generated/dataModel";
import { api } from "@server/convex/_generated/api";

export type SessionUser = {
	id: string;
	email?: string | null;
	name?: string | null;
	image?: string | null;
};

let cachedClient: ConvexHttpClient | null = null;

function getConvexUrl() {
	return process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
}

function getClient() {
	if (!cachedClient) {
		const url = getConvexUrl();
		if (!url) {
			throw new Error("CONVEX_URL is not configured. Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL.");
		}
		cachedClient = new ConvexHttpClient(url);
	}
	return cachedClient;
}

export async function ensureConvexUser(sessionUser: SessionUser) {
	const client = getClient();
	const result = await client.mutation(api.users.ensure, {
		externalId: sessionUser.id,
		email: sessionUser.email ?? undefined,
		name: sessionUser.name ?? undefined,
		avatarUrl: sessionUser.image ?? undefined,
	});
	return result.userId as Id<"users">;
}

export async function listChats(userId: Id<"users">) {
	const client = getClient();
	return client.query(api.chats.list, { userId });
}

export async function createChatForUser(
	userId: Id<"users">,
	titleData: {
		title?: string;
		encryptedTitle?: string;
		titleIv?: string;
		titleEncryptionVersion?: string;
	}
) {
	const client = getClient();
	const { chatId } = await client.mutation(api.chats.create, {
		userId,
		title: titleData.title,
		encryptedTitle: titleData.encryptedTitle,
		titleIv: titleData.titleIv,
		titleEncryptionVersion: titleData.titleEncryptionVersion,
	});
	const chat = await client.query(api.chats.get, { chatId, userId });
	if (!chat) throw new Error("Chat not found after creation");
	return chat;
}

export async function deleteChatForUser(userId: Id<"users">, chatId: Id<"chats">) {
	const client = getClient();
	return client.mutation(api.chats.remove, { userId, chatId });
}

export async function listMessagesForChat(userId: Id<"users">, chatId: Id<"chats">) {
	const client = getClient();
	return client.query(api.messages.list, { userId, chatId });
}

export async function sendMessagePair(args: {
	userId: Id<"users">;
	chatId: Id<"chats">;
	user: {
		content?: string;
		encryptedContent?: string;
		contentIv?: string;
		contentEncryptionVersion?: string;
		createdAt?: number;
		clientMessageId?: string;
	};
	assistant?: {
		content?: string;
		encryptedContent?: string;
		contentIv?: string;
		contentEncryptionVersion?: string;
		createdAt?: number;
		clientMessageId?: string;
	};
}) {
	const client = getClient();
	return client.mutation(api.messages.send, {
		userId: args.userId,
		chatId: args.chatId,
		userMessage: {
			content: args.user.content,
			encryptedContent: args.user.encryptedContent,
			contentIv: args.user.contentIv,
			contentEncryptionVersion: args.user.contentEncryptionVersion,
			createdAt: args.user.createdAt,
			clientMessageId: args.user.clientMessageId,
		},
		assistantMessage: args.assistant
			? {
					content: args.assistant.content,
					encryptedContent: args.assistant.encryptedContent,
					contentIv: args.assistant.contentIv,
					contentEncryptionVersion: args.assistant.contentEncryptionVersion,
					createdAt: args.assistant.createdAt,
					clientMessageId: args.assistant.clientMessageId,
			  }
			: undefined,
	});
}

export async function streamUpsertMessage(args: {
	userId: Id<"users">;
	chatId: Id<"chats">;
	messageId?: Id<"messages">;
	clientMessageId?: string;
	role: "user" | "assistant";
	content?: string;
	encryptedContent?: string;
	contentIv?: string;
	contentEncryptionVersion?: string;
	status?: "streaming" | "completed";
	createdAt?: number;
}) {
	const client = getClient();
	return client.mutation(api.messages.streamUpsert, {
		userId: args.userId,
		chatId: args.chatId,
		messageId: args.messageId,
		clientMessageId: args.clientMessageId,
		role: args.role,
		content: args.content,
		encryptedContent: args.encryptedContent,
		contentIv: args.contentIv,
		contentEncryptionVersion: args.contentEncryptionVersion,
		status: args.status,
		createdAt: args.createdAt,
	});
}

export type ChatDoc = Doc<"chats">;
export type MessageDoc = Doc<"messages">;
