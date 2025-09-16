import type { ReactNode } from "react";
import OptionalClerkProvider from "@/lib/optional-clerk";

export default function AuthLayout({ children }: { children: ReactNode }) {
	return <OptionalClerkProvider>{children}</OptionalClerkProvider>;
}
