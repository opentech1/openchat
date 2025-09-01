import type { Metadata } from "next";
import { api } from "server/convex/_generated/api";
import { fetchQuery } from "convex/nextjs";
import ChatPageClient from "./chat-client-v2";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ chatId: string }> }): Promise<Metadata> {
  try {
    const { chatId } = await params;
    const chat = await fetchQuery(api.chats.getChat, { chatId: chatId as any });
    
    if (chat && chat.title) {
      return {
        title: `${chat.title} - OpenChat`,
        description: `Chat conversation: ${chat.title}`,
      };
    }
  } catch (error) {
    console.error("Error generating metadata for chat:", error);
  }
  
  return {
    title: "Chat - OpenChat",
    description: "OpenChat conversation",
  };
}

export default async function ChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = await params;
  return <ChatPageClient chatId={chatId} />;
}
