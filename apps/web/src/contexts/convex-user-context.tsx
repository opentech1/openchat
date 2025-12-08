"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@server/convex/_generated/api";
import { useSession } from "@/lib/auth-client";
import type { Id } from "@server/convex/_generated/dataModel";

type ConvexUser = {
  _id: Id<"users">;
  _creationTime: number;
  externalId: string;
  email?: string;
  name?: string;
  image?: string;
};

type ConvexUserContextValue = {
  convexUser: ConvexUser | null | undefined;
  isLoading: boolean;
};

const ConvexUserContext = createContext<ConvexUserContextValue | undefined>(undefined);

export function ConvexUserProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  const user = session?.user;
  const workspaceId = user?.id ?? null;

  // Single shared query for the Convex user
  const convexUser = useQuery(
    api.users.getByExternalId,
    workspaceId ? { externalId: workspaceId } : "skip"
  );

  const isLoading = isPending || (workspaceId !== null && convexUser === undefined);

  const contextValue = useMemo(
    () => ({ convexUser, isLoading }),
    [convexUser, isLoading]
  );

  return (
    <ConvexUserContext.Provider value={contextValue}>
      {children}
    </ConvexUserContext.Provider>
  );
}

export function useConvexUser() {
  const context = useContext(ConvexUserContext);
  // Return loading state during SSG/SSR when provider isn't mounted yet
  if (context === undefined) {
    return { convexUser: undefined, isLoading: true };
  }
  return context;
}
