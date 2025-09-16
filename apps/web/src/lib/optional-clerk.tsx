export default async function OptionalClerkProvider({ children }: { children: React.ReactNode }) {
	if (process.env.NODE_ENV === "test" || process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "1") {
		return children as any;
	}
	const mod = await import("@clerk/nextjs");
	const ClerkProvider = mod.ClerkProvider as any;
	return <ClerkProvider>{children}</ClerkProvider>;
}

