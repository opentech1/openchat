import { useRouterState } from "@tanstack/react-router"

export function NavigationProgress() {
	const isLoading = useRouterState({
		select: (state) => state.isLoading,
	})

	return (
		<>
			<style>{`
				@keyframes navigation-progress-shimmer {
					0% {
						transform: translateX(-100%);
					}
					100% {
						transform: translateX(200%);
					}
				}
				
				@keyframes navigation-progress-grow {
					0% {
						width: 0%;
					}
					50% {
						width: 70%;
					}
					100% {
						width: 95%;
					}
				}
			`}</style>
			<div
				aria-hidden="true"
				data-loading={isLoading}
				className="fixed inset-x-0 top-0 z-[9999] h-[2px] pointer-events-none opacity-0 data-[loading=true]:opacity-100 transition-opacity duration-200"
			>
				<div className="absolute inset-0 bg-primary/10" />

				<div
					className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary/80 to-primary"
					style={{
						width: isLoading ? undefined : "0%",
						animation: isLoading
							? "navigation-progress-grow 8s cubic-bezier(0.4, 0, 0.2, 1) forwards"
							: "none",
					}}
				>
					<div
						className="absolute inset-0 w-full"
						style={{
							background:
								"linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
							animation: isLoading
								? "navigation-progress-shimmer 1.5s ease-in-out infinite"
								: "none",
						}}
					/>
				</div>

				<div
					className="absolute top-0 right-0 h-full w-24 opacity-0 data-[loading=true]:opacity-100 transition-opacity"
					data-loading={isLoading}
					style={{
						background:
							"linear-gradient(90deg, transparent, hsl(var(--primary) / 0.6), hsl(var(--primary)))",
						filter: "blur(3px)",
						animation: isLoading
							? "navigation-progress-grow 8s cubic-bezier(0.4, 0, 0.2, 1) forwards"
							: "none",
					}}
				/>
			</div>
		</>
	)
}
