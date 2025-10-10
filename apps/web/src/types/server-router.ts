export type ChatSummary = {
	id: string;
	title: string | null;
	updatedAt: string | Date | null | undefined;
	lastMessageAt: string | Date | null | undefined;
};

export type MessageRow = {
	id: string;
	role: string;
	content: string;
	createdAt: string | Date | null | undefined;
};

import type { AppRouterClient as ServerAppRouterClient, AppRouter } from "../../../server/src/routers";

export type { AppRouter };
export type AppRouterClient = ServerAppRouterClient;
