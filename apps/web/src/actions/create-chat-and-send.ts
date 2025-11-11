"use server";

import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth-server";
import { ensureConvexUser, createChatForUser, sendMessagePair } from "@/lib/convex-server";

export async function createChatAndSendAction(
  message: string,
  modelId: string
): Promise<{ chatId: string } | { error: string }> {
  try {
    if (!message.trim()) {
      return { error: "Message cannot be empty" };
    }

    if (!modelId.trim()) {
      return { error: "Model not selected" };
    }

    const session = await getUserContext();
    const convexUserId = await ensureConvexUser({
      id: session.userId,
      email: session.email,
      name: session.name,
      image: session.image,
    });

    // Create the chat with a title derived from the message
    const title =
      message.trim().slice(0, 50) + (message.length > 50 ? "..." : "");
    const chat = await createChatForUser(convexUserId, title);

    // Send the initial user message (AI response will stream via /api/chat)
    await sendMessagePair({
      userId: convexUserId,
      chatId: chat._id,
      user: {
        content: message.trim(),
        createdAt: Date.now(),
      },
    });

    // Store the pending model for the chat page to use
    // The chat page will auto-send the first message with this model
    return { chatId: chat._id };
  } catch (error) {
    console.error("Failed to create chat:", error);
    return { error: "Failed to create chat. Please try again." };
  }
}
