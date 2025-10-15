import { useRouter as useTSRouter, useLocation, redirect as tsRedirect } from "@tanstack/react-router";

export function useRouter() {
  const r = useTSRouter();
  return {
    push: (to: string) => r.navigate({ to } as any),
    replace: (to: string) => r.navigate({ to, replace: true } as any),
    back: () => window.history.back(),
    refresh: () => window.location.reload(),
  } as const;
}

export function usePathname() {
  return useLocation().pathname;
}

export function useSearchParams() {
  const search = useLocation().searchStr ?? "";
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

export const redirect = tsRedirect;

