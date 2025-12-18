import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { NextResponse } from "next/server";

import { createLogger } from "@/lib/logger";

const logger = createLogger("GenerateTitle");

// Use a cheap, fast model for title generation
const TITLE_MODEL = "x-ai/grok-3-fast";

const TITLE_SYSTEM_PROMPT = `Generate a concise, descriptive title (3-8 words) for this chat based on the user's message. 
- Focus on the main topic or question being asked
- Return ONLY the title text, nothing else
- Do not use quotes or special formatting
- Be specific and informative`;

type GenerateTitlePayload = {
	message?: string;
	apiKey?: string;
};

export async function POST(request: Request) {
	try {
		const body = await request.json() as GenerateTitlePayload;
		const { message, apiKey } = body;

		if (!apiKey || typeof apiKey !== "string") {
			return NextResponse.json(
				{ error: "API key required" },
				{ status: 401 }
			);
		}

		if (!message || typeof message !== "string") {
			return NextResponse.json(
				{ error: "Message is required" },
				{ status: 400 }
			);
		}

		// Truncate message if too long to avoid wasting tokens
		const truncatedMessage = message.slice(0, 500);

		const provider = createOpenRouter({
			apiKey,
			baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
		});

		const { text: generatedTitle } = await generateText({
			model: provider(TITLE_MODEL),
			messages: [{ role: "user", content: truncatedMessage }],
			system: TITLE_SYSTEM_PROMPT,
			maxOutputTokens: 30,
		});

		// Clean up the title
		const cleanTitle = generatedTitle
			.replace(/^["']|["']$/g, "") // Remove quotes
			.replace(/^Title:\s*/i, "") // Remove "Title:" prefix
			.replace(/\n/g, " ") // Remove newlines
			.trim()
			.slice(0, 60); // Max 60 chars

		logger.debug("Generated title", {
			messageLength: message.length,
			generatedTitle: cleanTitle,
		});

		return NextResponse.json({ title: cleanTitle || "New Chat" });
	} catch (error) {
		logger.error("Failed to generate title", error);
		
		// Return a fallback - don't fail the whole request
		return NextResponse.json({ title: "New Chat" });
	}
}
