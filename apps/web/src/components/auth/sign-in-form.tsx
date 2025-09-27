"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@openchat/auth/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInForm() {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [rememberMe, setRememberMe] = useState(true);
	const [submitting, setSubmitting] = useState(false);

	const disableForm = submitting || isPending;

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;
		setSubmitting(true);
		try {
			const { error } = await authClient.signIn.email({
				email,
				password,
				rememberMe,
				callbackURL: "/dashboard",
			});
			if (error) {
				toast.error(error.message ?? "Unable to sign in");
				return;
			}
			toast.success("Signed in successfully");
			router.push("/dashboard");
			router.refresh();
		} catch (error) {
			console.error("sign-in", error);
			toast.error("Unexpected error while signing in");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form className="space-y-4" onSubmit={handleSubmit}>
			<div className="space-y-2">
				<Label htmlFor="email">Email</Label>
				<Input
					id="email"
					type="email"
					required
					autoComplete="email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					disabled={disableForm}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="password">Password</Label>
				<Input
					id="password"
					type="password"
					required
					autoComplete="current-password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					disabled={disableForm}
				/>
			</div>
			<label className="flex items-center gap-2 text-sm text-muted-foreground">
				<input
					type="checkbox"
					checked={rememberMe}
					onChange={(event) => setRememberMe(event.target.checked)}
					disabled={disableForm}
					className="size-4"
				/>
				<span>Keep me signed in</span>
			</label>
			<Button type="submit" className="w-full" disabled={disableForm}>
				{submitting ? "Signing in…" : session ? "Continue" : "Sign in"}
			</Button>
		</form>
	);
}
