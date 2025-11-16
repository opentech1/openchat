import { LoaderIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

type NiceLoaderProps = {
	message?: string;
	size?: "sm" | "md" | "lg";
	className?: string;
	fullScreen?: boolean;
};

export function NiceLoader({
	message,
	size = "md",
	className,
	fullScreen = false,
}: NiceLoaderProps) {
	const sizeClasses = {
		sm: "size-8",
		md: "size-10",
		lg: "size-16",
	};

	const containerClasses = fullScreen
		? "flex min-h-screen items-center justify-center"
		: "flex items-center justify-center";

	return (
		<div className={cn(containerClasses, className)}>
			<div className="flex flex-col items-center gap-3">
				<LoaderIcon
					role="status"
					aria-label="Loading"
					className={cn("animate-spin", sizeClasses[size])}
				/>
				{message && (
					<p className="text-sm text-muted-foreground animate-pulse">{message}</p>
				)}
			</div>
		</div>
	);
}

// Preset variants for common use cases
export function PageLoader({ message }: { message?: string }) {
	return <NiceLoader message={message ?? "Loading..."} size="md" fullScreen />;
}

export function DashboardLoader() {
	return (
		<div className="flex h-full w-full items-center justify-center">
			<NiceLoader message="Loading dashboard..." size="md" />
		</div>
	);
}

export function SettingsLoader() {
	return (
		<div className="flex h-full w-full items-center justify-center">
			<NiceLoader message="Loading settings..." size="md" />
		</div>
	);
}

export function ChatLoader() {
	return (
		<div className="flex h-full w-full items-center justify-center">
			<NiceLoader message="Loading chat..." size="md" />
		</div>
	);
}
