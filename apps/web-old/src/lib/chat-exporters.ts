/**
 * Chat Export Utilities
 *
 * Provides functions to export chat conversations to various formats:
 * - Markdown (.md)
 * - JSON (.json)
 * - PDF (.pdf)
 */

import jsPDF from "jspdf";

export interface ExportMessage {
	role: string;
	content: string;
	reasoning?: string;
	createdAt: number;
	attachments?: Array<{
		name: string;
		type: string;
		url?: string;
	}>;
}

export interface ExportChat {
	title: string;
	createdAt: number;
	updatedAt: number;
}

/**
 * Export chat to Markdown format
 */
export function exportToMarkdown(
	chat: ExportChat,
	messages: ExportMessage[],
): string {
	const lines: string[] = [];

	// Header
	lines.push(`# ${chat.title}`);
	lines.push("");
	lines.push(
		`**Created:** ${new Date(chat.createdAt).toLocaleString()}`,
	);
	lines.push(
		`**Last Updated:** ${new Date(chat.updatedAt).toLocaleString()}`,
	);
	lines.push(
		`**Messages:** ${messages.length}`,
	);
	lines.push("");
	lines.push("---");
	lines.push("");

	// Messages
	for (const message of messages) {
		const timestamp = new Date(message.createdAt).toLocaleString();
		const role = message.role === "user" ? "User" : "Assistant";

		lines.push(`## ${role}`);
		lines.push(`*${timestamp}*`);
		lines.push("");
		lines.push(message.content);
		lines.push("");

		// Add reasoning if present
		if (message.reasoning) {
			lines.push("**Reasoning:**");
			lines.push("");
			lines.push(message.reasoning);
			lines.push("");
		}

		// Add attachments if present
		if (message.attachments && message.attachments.length > 0) {
			lines.push("**Attachments:**");
			for (const attachment of message.attachments) {
				if (attachment.url) {
					lines.push(`- [${attachment.name}](${attachment.url})`);
				} else {
					lines.push(`- ${attachment.name}`);
				}
			}
			lines.push("");
		}

		lines.push("---");
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Export chat to JSON format
 */
export function exportToJSON(
	chat: ExportChat,
	messages: ExportMessage[],
): string {
	const exportData = {
		chat: {
			title: chat.title,
			createdAt: chat.createdAt,
			updatedAt: chat.updatedAt,
			messageCount: messages.length,
		},
		messages: messages.map((msg) => ({
			role: msg.role,
			content: msg.content,
			reasoning: msg.reasoning,
			createdAt: msg.createdAt,
			timestamp: new Date(msg.createdAt).toISOString(),
			attachments: msg.attachments,
		})),
		exportedAt: new Date().toISOString(),
	};

	return JSON.stringify(exportData, null, 2);
}

/**
 * Export chat to PDF format
 */
export function exportToPDF(
	chat: ExportChat,
	messages: ExportMessage[],
): Blob {
	const doc = new jsPDF();
	const pageWidth = doc.internal.pageSize.getWidth();
	const pageHeight = doc.internal.pageSize.getHeight();
	const margin = 15;
	const maxWidth = pageWidth - 2 * margin;
	let yPosition = margin;

	// Helper function to add text with word wrapping
	const addText = (
		text: string,
		fontSize: number,
		isBold: boolean = false,
	) => {
		doc.setFontSize(fontSize);
		doc.setFont("helvetica", isBold ? "bold" : "normal");

		const lines = doc.splitTextToSize(text, maxWidth);
		const lineHeight = fontSize * 0.5;

		for (const line of lines) {
			// Check if we need a new page
			if (yPosition + lineHeight > pageHeight - margin) {
				doc.addPage();
				yPosition = margin;
			}

			doc.text(line, margin, yPosition);
			yPosition += lineHeight;
		}
	};

	// Add spacing
	const addSpace = (space: number = 5) => {
		yPosition += space;
	};

	// Title
	addText(chat.title, 18, true);
	addSpace(8);

	// Metadata
	addText(`Created: ${new Date(chat.createdAt).toLocaleString()}`, 10);
	addText(`Last Updated: ${new Date(chat.updatedAt).toLocaleString()}`, 10);
	addText(`Messages: ${messages.length}`, 10);
	addSpace(10);

	// Separator line
	doc.setLineWidth(0.5);
	doc.line(margin, yPosition, pageWidth - margin, yPosition);
	addSpace(10);

	// Messages
	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		const role = message.role === "user" ? "User" : "Assistant";
		const timestamp = new Date(message.createdAt).toLocaleString();

		// Check if we need significant space for the next message
		if (yPosition > pageHeight - margin - 30) {
			doc.addPage();
			yPosition = margin;
		}

		// Role and timestamp
		addText(`${role} - ${timestamp}`, 11, true);
		addSpace(3);

		// Content
		addText(message.content, 10);
		addSpace(5);

		// Reasoning if present
		if (message.reasoning) {
			addText("Reasoning:", 10, true);
			addSpace(2);
			addText(message.reasoning, 9);
			addSpace(5);
		}

		// Attachments if present
		if (message.attachments && message.attachments.length > 0) {
			addText("Attachments:", 10, true);
			for (const attachment of message.attachments) {
				addText(`• ${attachment.name}`, 9);
			}
			addSpace(5);
		}

		// Separator between messages (except for the last one)
		if (i < messages.length - 1) {
			doc.setLineWidth(0.2);
			doc.line(margin, yPosition, pageWidth - margin, yPosition);
			addSpace(8);
		}
	}

	return doc.output("blob");
}
