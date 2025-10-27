import { GalleryVerticalEnd } from "lucide-react";
import Link from "next/link";
import { getSignInUrl, getSignUpUrl } from "@workos-inc/authkit-nextjs";

export default async function LoginPage() {
	const [signInUrl, signUpUrl] = await Promise.all([getSignInUrl(), getSignUpUrl()]);
	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			<div className="flex flex-col gap-4 p-6 md:p-10">
				<div className="flex justify-center gap-2 md:justify-start">
					<Link href="/" className="flex items-center gap-2 font-medium">
						<div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
							<GalleryVerticalEnd className="size-4" />
						</div>
						OpenChat
					</Link>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-xs space-y-6">
						<div className="space-y-1 text-center">
							<h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
							<p className="text-muted-foreground text-sm">Sign in to access your workspace.</p>
						</div>
						<a
							href={signInUrl}
							className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition"
						>
							Continue with WorkOS
						</a>
						<p className="text-center text-sm text-muted-foreground">
							Don&apos;t have an account?{" "}
							<a href={signUpUrl} className="text-primary underline-offset-4 hover:underline">
								Create one
							</a>
						</p>
					</div>
				</div>
			</div>
			<div className="bg-muted relative hidden lg:block">
				<img
					src="/placeholder.svg"
					alt="OpenChat"
					className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
				/>
			</div>
		</div>
	);
}

export const dynamic = "force-dynamic";
