"use client";
import { orpc } from "@/utils/orpc";

export default function ServerHealth() {
  const { data, isLoading, isError } = orpc.healthCheck.useQuery();
  if (isLoading) return <p className="text-sm text-muted-foreground">Checking server…</p>;
  if (isError) return <p className="text-sm text-destructive">Server unreachable</p>;
  return <p className="text-sm text-muted-foreground">Server: {data}</p>;
}

