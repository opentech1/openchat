"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/utils/orpc";
import { ThemeProvider } from "./theme-provider";
import { BrandThemeProvider } from "./brand-theme-provider";
import { Toaster } from "sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
		>
			<BrandThemeProvider>
				<QueryClientProvider client={queryClient}>
					{children}
					<Toaster richColors position="top-center" />
				</QueryClientProvider>
			</BrandThemeProvider>
		</ThemeProvider>
	);
}
