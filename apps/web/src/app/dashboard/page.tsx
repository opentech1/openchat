import ChatPreview from "@/components/chat-preview";
import LightRays from "@/components/light-rays";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
	return (
		<div className="h-[100svh] grid place-items-center p-4 relative">
			<div className="absolute inset-0 z-0">
				<LightRays
					raysOrigin="top-center"
					raysColor="#00ffff"
					raysSpeed={1.5}
					lightSpread={0.8}
					rayLength={1.2}
					followMouse={true}
					mouseInfluence={0.1}
					noiseAmount={0.1}
					distortion={0.05}
				/>
			</div>
			<div className="w-full max-w-2xl space-y-2 relative z-10">
				<ChatPreview className="w-full" />
			</div>
		</div>
	);
}
