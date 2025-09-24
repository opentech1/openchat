"use client";
import { orpc } from "@/utils/orpc";
import { useQuery } from "@tanstack/react-query";

export default function ServerHealth() {
  const { data, isLoading, isError } = useQuery(orpc.healthCheck.queryOptions());
  if (isLoading) return <p className="text-sm text-muted-foreground">Checking server…</p>;
  if (isError) return <p className="text-sm text-destructive">Server unreachable</p>;
  const status = typeof data === "string" ? data : "Unknown";
  return <p className="text-sm text-muted-foreground">Server: {status}</p>;
}
