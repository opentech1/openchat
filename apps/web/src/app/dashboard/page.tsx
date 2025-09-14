import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import ChatPreview from "@/components/chat-preview";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const { userId } = await auth();
    if (!userId) redirect("/auth/sign-in");

    return (
        <div className="h-[100svh] grid place-items-center p-4">
            <ChatPreview className="w-full max-w-2xl" />
        </div>
    );
}
