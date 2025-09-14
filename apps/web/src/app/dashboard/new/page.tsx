import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export default async function NewChatPage() {
  const { userId } = await auth();
  if (!userId) redirect("/auth/sign-in");
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">New Chat</h1>
      <p className="text-muted-foreground mt-2">Start a new conversation.</p>
      <div className="mt-6 rounded-2xl border p-6">
        <p className="text-sm">This is a placeholder. Hook up your chat flow here.</p>
      </div>
    </div>
  );
}

