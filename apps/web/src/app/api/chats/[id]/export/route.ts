import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Id } from "@server/convex/_generated/dataModel";
import { api } from "@server/convex/_generated/api";
import {
	getConvexUserFromSession,
	listMessagesForChat,
} from "@/lib/convex-server";
import { withCsrfProtection, CSRF_COOKIE_NAME } from "@/lib/csrf";
import { chatIdSchema, createValidationErrorResponse } from "@/lib/validation";
import { logError } from "@/lib/logger-server";
import { auditChatExport, getRequestMetadata } from "@/lib/audit-logger";
import {
	exportToMarkdown,
	exportToJSON,
	exportToPDF,
	type ExportMessage,
	type ExportChat,
} from "@/lib/chat-exporters";
import { ConvexHttpClient } from "convex/browser";

type ExportFormat = "markdown" | "json" | "pdf";

async function getConvexUrl() {
	const { getServerEnv } = await import("@/lib/env");
	const env = getServerEnv();
	return env.CONVEX_URL ?? env.NEXT_PUBLIC_CONVEX_URL;
}

async function getClient() {
	const url = await getConvexUrl();
	if (!url) {
		throw new Error(
			"CONVEX_URL is not configured. Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL.",
		);
	}
	return new ConvexHttpClient(url);
}

export async function GET(
	request: Request,
	context: { params: Promise<{ id: string }> },
) {
	// Validate chat ID FIRST before expensive operations
	const { id } = await context.params;
	const validation = chatIdSchema.safeParse(id);

	if (!validation.success) {
		return createValidationErrorResponse(validation.error);
	}

	const validatedId = validation.data;

	// Get CSRF token from cookies
	const cookieStore = await cookies();
	const csrfCookie = cookieStore.get(CSRF_COOKIE_NAME);

	return withCsrfProtection(request, csrfCookie?.value, async () => {
		try {
			// Get user session
			const [session, convexUserId] = await getConvexUserFromSession();

			// Parse format from query parameter
			const url = new URL(request.url);
			const format = url.searchParams.get("format") || "markdown";

			// Validate format
			if (!["markdown", "json", "pdf"].includes(format)) {
				return NextResponse.json(
					{ error: "Invalid format. Must be one of: markdown, json, pdf" },
					{ status: 400 },
				);
			}

			const chatId = validatedId as Id<"chats">;

			// Get chat details (verifies ownership)
			const client = await getClient();
			const chat = await client.query(api.chats.get, {
				chatId,
				userId: convexUserId,
			});

			if (!chat) {
				return NextResponse.json(
					{ error: "Chat not found or access denied" },
					{ status: 404 },
				);
			}

			// Apply rate limiting (will throw if limit exceeded)
			try {
				await client.mutation(api.chats.checkExportRateLimit, {
					userId: convexUserId,
				});
			} catch (error) {
				// Check if it's a rate limit error
				if (
					error instanceof Error &&
					error.message.includes("Too many requests")
				) {
					return NextResponse.json(
						{ error: error.message },
						{ status: 429 },
					);
				}
				throw error;
			}

			// Fetch messages
			const messages = await listMessagesForChat(convexUserId, chatId);

			// Convert to export format
			const exportMessages: ExportMessage[] = messages.map((msg) => ({
				role: msg.role,
				content: msg.content,
				reasoning: msg.reasoning,
				createdAt: msg.createdAt,
				attachments: msg.attachments?.map((att) => ({
					name: att.filename,
					type: att.contentType,
					url: att.url,
				})),
			}));

			const exportChat: ExportChat = {
				title: chat.title,
				createdAt: chat.createdAt,
				updatedAt: chat.updatedAt,
			};

			// Generate export based on format
			let exportData: string | Blob;
			let contentType: string;
			let fileExtension: string;

			switch (format as ExportFormat) {
				case "markdown":
					exportData = exportToMarkdown(exportChat, exportMessages);
					contentType = "text/markdown; charset=utf-8";
					fileExtension = "md";
					break;
				case "json":
					exportData = exportToJSON(exportChat, exportMessages);
					contentType = "application/json; charset=utf-8";
					fileExtension = "json";
					break;
				case "pdf":
					exportData = exportToPDF(exportChat, exportMessages);
					contentType = "application/pdf";
					fileExtension = "pdf";
					break;
			}

			// Create safe filename from chat title
			const safeTitle = chat.title
				.replace(/[^a-zA-Z0-9]/g, "_")
				.substring(0, 50);
			const filename = `${safeTitle}_${chatId}.${fileExtension}`;

			// Audit log the export
			const { ipAddress, userAgent } = getRequestMetadata(request);
			await auditChatExport({
				userId: session.id,
				chatId: validatedId,
				format: format as ExportFormat,
				ipAddress,
				userAgent,
			});

			// Return file
			return new NextResponse(exportData, {
				status: 200,
				headers: {
					"Content-Type": contentType,
					"Content-Disposition": `attachment; filename="${filename}"`,
				},
			});
		} catch (error) {
			logError("Error exporting chat", error);
			// Pass through the actual error message from Convex (e.g., rate limit messages)
			const errorMessage =
				error instanceof Error ? error.message : "Failed to export chat";
			return NextResponse.json({ error: errorMessage }, { status: 500 });
		}
	});
}
