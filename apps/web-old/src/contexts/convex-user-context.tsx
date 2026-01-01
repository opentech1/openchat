"use client";

import React, { createContext, useContext, useMemo, useEffect, useState, useRef } from "react";
import { api } from "@server/convex/_generated/api";
import { useSession } from "@/lib/auth-client";
import { useConvexQuery, useConvexMutation } from "@/hooks/use-convex-query";
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
  // Use Better Auth user ID as the external ID
  const betterAuthUserId = user?.id ?? null;
  const userEmail = user?.email ?? null;
  const userName = user?.name ?? null;
  const userImage = user?.image ?? null;

  // Track if we've already ensured this user to avoid duplicate calls
  const ensuredUserRef = useRef<string | null>(null);
  const [ensuredUserId, setEnsuredUserId] = useState<Id<"users"> | null>(null);

  // Mutation to ensure/migrate user (handles WorkOS -> Better Auth migration)
  const ensureUser = useConvexMutation(api.users.ensure);

  // Effect to ensure user exists when authenticated
  useEffect(() => {
    if (!betterAuthUserId || !userEmail) return;
    if (ensuredUserRef.current === betterAuthUserId) return; // Already ensured this user

    // Mark as in-progress to prevent duplicate calls
    ensuredUserRef.current = betterAuthUserId;

    ensureUser({
      externalId: betterAuthUserId,
      email: userEmail,
      name: userName ?? undefined,
      avatarUrl: userImage ?? undefined,
    })
      .then((result) => {
        setEnsuredUserId(result.userId);
      })
      .catch((error) => {
        console.error("[ConvexUserContext] Failed to ensure user:", error);
        // Reset to allow retry
        ensuredUserRef.current = null;
      });
  }, [betterAuthUserId, userEmail, userName, userImage, ensureUser]);

  // Query for the Convex user (will find after ensure completes)
  const { data: convexUser, isLoading: queryLoading } = useConvexQuery(
    api.users.getByExternalId,
    betterAuthUserId ? { externalId: betterAuthUserId } : "skip"
  );

  // Use ensured user ID as fallback while query updates
  const resolvedUser = convexUser ?? (ensuredUserId ? { _id: ensuredUserId } as ConvexUser : null);
  const isLoading = isPending || (queryLoading && !ensuredUserId);

  const contextValue = useMemo(
    () => ({ convexUser: resolvedUser, isLoading }),
    [resolvedUser, isLoading]
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
