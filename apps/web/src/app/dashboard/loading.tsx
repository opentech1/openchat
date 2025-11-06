export default function DashboardLoading() {
	return (
		<div className="flex h-full items-center justify-center">
			<div className="flex flex-col items-center gap-3">
				<div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
				<p className="text-sm text-muted-foreground">Loading dashboard...</p>
			</div>
		</div>
	);
}
