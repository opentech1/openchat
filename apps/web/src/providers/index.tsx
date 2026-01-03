import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexProviderWithAuth } from "convex/react";
import { Toaster } from "sonner";
import { convexClient } from "../lib/convex";
import { authClient, useAuth, StableAuthProvider } from "../lib/auth-client";
import { ThemeProvider } from "./theme-provider";
import { PostHogProvider } from "./posthog";
import { prefetchModels } from "../stores/model";

if (typeof window !== "undefined") {
  prefetchModels();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

interface ProvidersProps {
  children: React.ReactNode;
}

function useStableConvexAuth() {
  const { isAuthenticated, loading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const tokenFetchedRef = useRef(false);

  useEffect(() => {
    if (loading || tokenFetchedRef.current) return;
    if (!isAuthenticated) {
      tokenFetchedRef.current = true;
      return;
    }
    tokenFetchedRef.current = true;
    authClient.convex.token().then((result) => {
      setToken(result.data?.token || null);
    }).catch(() => {
      setToken(null);
    });
  }, [isAuthenticated, loading]);

  const fetchAccessToken = useCallback(async () => {
    if (token) return token;
    if (!isAuthenticated) return null;
    try {
      const result = await authClient.convex.token();
      const newToken = result.data?.token || null;
      setToken(newToken);
      return newToken;
    } catch {
      return null;
    }
  }, [token, isAuthenticated]);

  return useMemo(
    () => ({ isLoading: loading, isAuthenticated, fetchAccessToken }),
    [loading, isAuthenticated, fetchAccessToken]
  );
}

function ConvexAuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convexClient!} useAuth={useStableConvexAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}

export function Providers({ children }: ProvidersProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const content = (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors position="bottom-right" theme="system" />
      </QueryClientProvider>
    </ThemeProvider>
  );

  if (!isClient || !convexClient) {
    return <PostHogProvider>{content}</PostHogProvider>;
  }

  return (
    <PostHogProvider>
      <StableAuthProvider>
        <ConvexAuthWrapper>{content}</ConvexAuthWrapper>
      </StableAuthProvider>
    </PostHogProvider>
  );
}
