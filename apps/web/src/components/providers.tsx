"use client";

import { ThemeProvider } from "./theme-provider";
import { ConvexClientProvider } from "./convex-client-provider";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
	return (
		<ConvexClientProvider>
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				enableSystem
				disableTransitionOnChange
			>
				{children}
			</ThemeProvider>
		</ConvexClientProvider>
	);
}
