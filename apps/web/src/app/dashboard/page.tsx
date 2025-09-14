import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import ChatPreview from "@/components/chat-preview";
import ServerHealth from "@/components/server-health";
import { client } from "@/utils/orpc";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const { userId } = await auth();
    if (!userId) redirect("/auth/sign-in");

    // SSR call to protected RPC to validate server-side auth
    let privateMessage: string | null = null;
    try {
        const res = await client.privateData();
        privateMessage = `${res.message} — user ${res.user?.id ?? "unknown"}`;
    } catch {
        privateMessage = null;
    }

    return (
        <div className="h-[100svh] grid place-items-center p-4">
            <div className="w-full max-w-2xl space-y-2">
                <ServerHealth />
                {privateMessage && (
                    <p className="text-xs text-muted-foreground">{privateMessage}</p>
                )}
                <ChatPreview className="w-full" />
            </div>
        </div>
    );
}
