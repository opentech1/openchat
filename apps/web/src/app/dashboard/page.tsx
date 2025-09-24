import ChatPreview from "@/components/chat-preview";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
	return (
		<div className="h-[100svh] grid place-items-center p-4">
			<div className="w-full max-w-2xl space-y-2">
				<ChatPreview className="w-full" />
			</div>
		</div>
	);
}
