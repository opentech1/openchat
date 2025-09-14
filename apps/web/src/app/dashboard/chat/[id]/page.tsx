import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { serverClient } from "@/utils/orpc-server";
import ChatRoom from "@/components/chat-room";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/auth/sign-in");
  const { id: chatId } = await params;
  // Preload initial messages on the server for faster first paint
  const initialMessages = await serverClient.messages.list({ chatId }).catch(() => []);

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <ChatRoom chatId={chatId} initialMessages={initialMessages} />
    </div>
  );
}
