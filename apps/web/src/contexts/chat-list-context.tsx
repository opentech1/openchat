"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@server/convex/_generated/api";
import { useConvexUser } from "./convex-user-context";
import type { Id } from "@server/convex/_generated/dataModel";

/**
 * Real-time chat list type matching Convex chats.list query return
 */
export type RealtimeChat = {
	_id: Id<"chats">;
	title: string;
	createdAt: number;
	updatedAt: number;
	lastMessageAt?: number;
	// Chat status for streaming indicator: "idle" | "streaming"
	status?: string;
};

type ChatListContextValue = {
	/** Real-time chat list from Convex subscription */
	chats: RealtimeChat[];
	/** Whether the query is still loading */
	isLoading: boolean;
	/** Whether there was an error loading chats */
	hasError: boolean;
};

const ChatListContext = createContext<ChatListContextValue | undefined>(undefined);

/**
 * Provider for real-time chat list updates using Convex subscription.
 *
 * This enables features like:
 * - Streaming indicator in sidebar (shows which chat is actively generating)
 * - Real-time chat list updates when new chats are created
 * - Live title updates when chat titles change
 */
export function ChatListProvider({ children }: { children: React.ReactNode }) {
	const { convexUser, isLoading: userLoading } = useConvexUser();
	const userId = convexUser?._id;

	// Real-time subscription to chat list - updates automatically when any chat changes
	// This includes status changes (idle -> streaming -> idle)
	const chatListResult = useQuery(
		api.chats.list,
		userId ? { userId, limit: 200 } : "skip"
	);

	const isLoading = userLoading || (userId !== undefined && chatListResult === undefined);
	const hasError = userId !== undefined && chatListResult === undefined && !isLoading;

	const contextValue = useMemo<ChatListContextValue>(
		() => ({
			chats: chatListResult?.chats ?? [],
			isLoading,
			hasError,
		}),
		[chatListResult?.chats, isLoading, hasError]
	);

	return (
		<ChatListContext.Provider value={contextValue}>
			{children}
		</ChatListContext.Provider>
	);
}

/**
 * Hook to access real-time chat list data.
 *
 * The chat list automatically updates when:
 * - A chat's status changes (streaming indicator)
 * - A new chat is created
 * - A chat is deleted
 * - Chat titles are updated
 */
export function useChatList() {
	const context = useContext(ChatListContext);
	// Return loading state during SSG/SSR when provider isn't mounted yet
	if (context === undefined) {
		return { chats: [], isLoading: true, hasError: false };
	}
	return context;
}
