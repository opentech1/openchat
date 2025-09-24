import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardAccessFallbackProps = {
	title?: string;
	description?: string;
	showHomeLink?: boolean;
};

export default function DashboardAccessFallback({
	title = "Sign in to continue",
	description = "We couldn't verify your session. Sign in again or try refreshing if Clerk is still starting up.",
	showHomeLink = true,
}: DashboardAccessFallbackProps) {
	return (
		<div className="flex h-[100svh] flex-col items-center justify-center gap-6 px-6 py-10 text-center">
			<div className="space-y-3">
				<h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
				<p className="text-muted-foreground max-w-lg text-sm sm:text-base">
					{description}
				</p>
			</div>
			<div className="flex flex-wrap items-center justify-center gap-3">
				<Link
					href="/auth/sign-in"
					className={cn(buttonVariants({ variant: "default", size: "lg" }))}
				>
					Sign in
				</Link>
				<Link
					href="/auth/sign-up"
					className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
				>
					Create account
				</Link>
				{showHomeLink ? (
					<Link
						href="/"
						className={cn(buttonVariants({ variant: "ghost", size: "lg" }))}
					>
						Back to home
					</Link>
				) : null}
			</div>
		</div>
	);
}
