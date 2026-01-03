import { useState, useEffect, useCallback, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexProviderWithAuth } from "convex/react";
import { Toaster } from "sonner";
import { convexClient } from "../lib/convex";
import { authClient, StableAuthProvider } from "../lib/auth-client";
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
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const fetchedRef = { current: false };

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const session = await authClient.getSession();
        if (session.data?.session) {
          const tokenResult = await authClient.convex.token();
          setToken(tokenResult.data?.token || null);
          setIsAuthenticated(true);
        }
      } catch {
        setToken(null);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const fetchAccessToken = useCallback(async () => {
    if (token) return token;
    try {
      const result = await authClient.convex.token();
      const newToken = result.data?.token || null;
      setToken(newToken);
      return newToken;
    } catch {
      return null;
    }
  }, [token]);

  return useMemo(
    () => ({ isLoading, isAuthenticated, fetchAccessToken }),
    [isLoading, isAuthenticated, fetchAccessToken]
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
        <ConvexProviderWithAuth client={convexClient} useAuth={useStableConvexAuth}>
          {content}
        </ConvexProviderWithAuth>
      </StableAuthProvider>
    </PostHogProvider>
  );
}
