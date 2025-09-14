"use client";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

type Mode = "sign-in" | "sign-up";

export function AuthForm({
	mode,
	className,
	...props
}: { mode: Mode } & React.ComponentProps<"form">) {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const onSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			setPending(true);
			setError(null);
			try {
				if (mode === "sign-in") {
					await authClient.$fetch("/sign-in/email", {
						method: "POST",
						body: { email, password },
						credentials: "include",
					});
				} else {
					await authClient.$fetch("/sign-up/email", {
						method: "POST",
						body: { email, password, name },
						credentials: "include",
					});
				}
				router.push("/");
				router.refresh();
			} catch (err: any) {
				const message = err?.message || "Something went wrong";
				setError(message);
			} finally {
				setPending(false);
			}
		},
		[email, password, name, mode, router]
	);

	return (
		<form className={cn("flex flex-col gap-6", className)} onSubmit={onSubmit} {...props}>
			<div className="flex flex-col items-center gap-2 text-center">
				<h1 className="text-2xl font-bold">
					{mode === "sign-in" ? "Sign in to your account" : "Create your account"}
				</h1>
				<p className="text-muted-foreground text-sm text-balance">
					{mode === "sign-in"
						? "Enter your email to sign in"
						: "Use your email to sign up"}
				</p>
			</div>
			<div className="grid gap-6">
				{mode === "sign-up" && (
					<div className="grid gap-3">
						<Label htmlFor="name">Name</Label>
						<Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
					</div>
				)}
				<div className="grid gap-3">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						type="email"
						placeholder="m@example.com"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>
				</div>
				<div className="grid gap-3">
					<div className="flex items-center">
						<Label htmlFor="password">Password</Label>
						{mode === "sign-in" && (
							<a
								href="#"
								className="ml-auto text-sm underline-offset-4 hover:underline"
							>
								Forgot your password?
							</a>
						)}
					</div>
					<Input
						id="password"
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						required
					/>
				</div>
				{error && (
					<p className="text-destructive text-sm" role="alert">
						{error}
					</p>
				)}
				<Button type="submit" className="w-full" disabled={pending}>
					{pending ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}
				</Button>
			</div>
			<div className="text-center text-sm">
				{mode === "sign-in" ? (
					<span>
						Don&apos;t have an account?{" "}
						<a href="/auth/sign-up" className="underline underline-offset-4">
							Sign up
						</a>
					</span>
				) : (
					<span>
						Already have an account?{" "}
						<a href="/auth/sign-in" className="underline underline-offset-4">
							Sign in
						</a>
					</span>
				)}
			</div>
		</form>
	);
}

