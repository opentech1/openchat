"use client";
import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";

export default function ServerHealth() {
	const healthCheckOptions =
		typeof (orpc as any)?.healthCheck?.queryOptions === "function"
			? (orpc as any).healthCheck.queryOptions()
			: {
				queryKey: ["health-check"],
				queryFn: async () => "Unknown",
			};
	const { data, isLoading, isError } = useQuery(healthCheckOptions);
	if (isLoading) return <p className="text-sm text-muted-foreground">Checking server...</p>;
	if (isError) return <p className="text-sm text-destructive">Server unreachable</p>;
	const status = typeof data === "string" ? data : "Unknown";
	return <p className="text-sm text-muted-foreground">Server: {status}</p>;
}
