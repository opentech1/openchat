import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth-server";
import { serverClient } from "@/utils/orpc-server";

export const dynamic = "force-dynamic";

export default async function NewChatPage() {
  const userId = await getUserId();
  if (!userId) redirect("/auth/sign-in");

  // Prefer server-created UUID; fallback to client-generated on failure
  try {
    const { id } = await serverClient.chats.create({ title: "New Chat" });
    redirect(`/dashboard/chat/${id}`);
  } catch {
    const id = (() => {
      try {
        return crypto.randomUUID();
      } catch {
        return Math.random().toString(36).slice(2) + Date.now().toString(36);
      }
    })();
    redirect(`/dashboard/chat/${id}`);
  }
}
