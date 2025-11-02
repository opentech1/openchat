/**
 * Helper functions for encrypting/decrypting chat messages and titles
 */

import { encryptContent, decryptContent, type EncryptedData } from "./chat-encryption";

/**
 * Prepares message content for sending to server.
 * Returns both encrypted (for storage) and plaintext (for AI processing).
 */
export async function prepareMessageForSending(content: string): Promise<{
	encryptedContent: string;
	contentIv: string;
	contentEncryptionVersion: string;
	contentForAI: string; // Plaintext for AI processing (not stored)
}> {
	const encrypted = await encryptContent(content);
	return {
		encryptedContent: encrypted.data,
		contentIv: encrypted.iv,
		contentEncryptionVersion: encrypted.version,
		contentForAI: content, // Keep plaintext for AI
	};
}

/**
 * Decrypts a message for display.
 * Returns the plaintext content or a fallback if decryption fails.
 */
export async function decryptMessageForDisplay(encryptedData: {
	encryptedContent?: string;
	contentIv?: string;
	contentEncryptionVersion?: string;
	content?: string; // Legacy plain text fallback
}): Promise<string> {
	// Try encrypted content first
	if (
		encryptedData.encryptedContent &&
		encryptedData.contentIv &&
		encryptedData.contentEncryptionVersion
	) {
		const decrypted = await decryptContent({
			data: encryptedData.encryptedContent,
			iv: encryptedData.contentIv,
			version: encryptedData.contentEncryptionVersion,
		});

		if (decrypted) {
			return decrypted;
		}

		// Decryption failed
		return "[Encrypted message - decryption failed]";
	}

	// Fall back to legacy plain text
	if (encryptedData.content) {
		return encryptedData.content;
	}

	return "[No content available]";
}

/**
 * Prepares chat title for sending to server.
 */
export async function prepareTitleForSending(title: string): Promise<{
	encryptedTitle: string;
	titleIv: string;
	titleEncryptionVersion: string;
}> {
	const encrypted = await encryptContent(title);
	return {
		encryptedTitle: encrypted.data,
		titleIv: encrypted.iv,
		titleEncryptionVersion: encrypted.version,
	};
}

/**
 * Decrypts a chat title for display.
 */
export async function decryptTitleForDisplay(encryptedData: {
	encryptedTitle?: string;
	titleIv?: string;
	titleEncryptionVersion?: string;
	title?: string; // Legacy plain text fallback
}): Promise<string> {
	// Try encrypted title first
	if (
		encryptedData.encryptedTitle &&
		encryptedData.titleIv &&
		encryptedData.titleEncryptionVersion
	) {
		const decrypted = await decryptContent({
			data: encryptedData.encryptedTitle,
			iv: encryptedData.titleIv,
			version: encryptedData.titleEncryptionVersion,
		});

		if (decrypted) {
			return decrypted;
		}

		// Decryption failed
		return "[Encrypted title]";
	}

	// Fall back to legacy plain text
	if (encryptedData.title) {
		return encryptedData.title;
	}

	return "New Chat";
}
