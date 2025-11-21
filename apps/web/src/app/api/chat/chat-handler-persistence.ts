/**
 * Message persistence logic for chat handler
 * Handles saving messages to the database with proper error handling
 */

import type { StreamPersistRequest, ChatRequestPayload } from "./chat-handler-types";
import { toConvexUserId, toConvexChatId, toConvexStorageId } from "@/lib/type-converters";
import { createLogger } from "@/lib/logger";

const logger = createLogger("PersistenceHandler");

/**
 * Options for creating a persistence handler
 */
export interface PersistenceHandlerOptions {
	/** Function to persist messages to database */
	persistMessage: (input: StreamPersistRequest) => Promise<{ ok: boolean }>;
}

/**
 * Result of persisting a user message
 */
export interface PersistUserMessageResult {
	success: boolean;
	error?: Error;
}

/**
 * Parameters for persisting a user message
 */
export interface PersistUserMessageParams {
	userId: string;
	chatId: string;
	messageId: string;
	content: string;
	createdAt: string;
	attachments?: ChatRequestPayload["attachments"];
}

/**
 * Result of persisting an assistant message bootstrap
 */
export interface PersistAssistantBootstrapResult {
	success: boolean;
	error?: Error;
}

/**
 * Parameters for bootstrapping an assistant message
 */
export interface PersistAssistantBootstrapParams {
	userId: string;
	chatId: string;
	messageId: string;
	createdAt: string;
}

/**
 * Persistence handler manages database operations for messages
 */
export class PersistenceHandler {
	private options: PersistenceHandlerOptions;

	constructor(options: PersistenceHandlerOptions) {
		this.options = options;
	}

	/**
	 * Persist a user message to the database
	 */
	async persistUserMessage(params: PersistUserMessageParams): Promise<PersistUserMessageResult> {
		try {
			const result = await this.options.persistMessage({
				userId: params.userId,
				chatId: params.chatId,
				clientMessageId: params.messageId,
				role: "user",
				content: params.content,
				createdAt: params.createdAt,
				status: "completed",
				attachments: params.attachments?.map((a) => ({
					storageId: toConvexStorageId(a.storageId),
					filename: a.filename,
					contentType: a.contentType,
					size: a.size,
					uploadedAt: Date.now(),
				})),
			});

			if (!result.ok) {
				throw new Error("user streamUpsert rejected");
			}

			return { success: true };
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			logger.error("Failed to persist user message", err, {
				chatId: params.chatId,
				messageId: params.messageId,
			});
			return { success: false, error: err };
		}
	}

	/**
	 * Bootstrap an assistant message in the database
	 * Creates an empty streaming message that will be filled in later
	 */
	async persistAssistantBootstrap(params: PersistAssistantBootstrapParams): Promise<PersistAssistantBootstrapResult> {
		try {
			const result = await this.options.persistMessage({
				userId: params.userId,
				chatId: params.chatId,
				clientMessageId: params.messageId,
				role: "assistant",
				content: "",
				createdAt: params.createdAt,
				status: "streaming",
			});

			if (!result.ok) {
				throw new Error("assistant streamUpsert rejected");
			}

			return { success: true };
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			logger.error("Failed to bootstrap assistant message", err, {
				chatId: params.chatId,
				messageId: params.messageId,
			});
			return { success: false, error: err };
		}
	}
}

/**
 * Helper to coerce a value to an ISO date string
 */
export function coerceIsoDate(value: unknown): string {
	if (typeof value === "string" && value.length > 0) {
		const date = new Date(value);
		if (!Number.isNaN(date.valueOf())) return date.toISOString();
	}
	if (value instanceof Date && !Number.isNaN(value.valueOf())) {
		return value.toISOString();
	}
	return new Date().toISOString();
}
