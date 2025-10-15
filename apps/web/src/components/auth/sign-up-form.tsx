"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@openchat/auth/client";
import { captureClientEvent } from "@/lib/posthog";

export default function SignUpForm() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;
		setSubmitting(true);
		try {
			const { error } = await authClient.signUp.email({
				name,
				email,
				password,
				callbackURL: "/dashboard",
			});
			if (error) {
				toast.error(error.message ?? "Unable to create account");
				return;
			}
			toast.success("Account created");
			captureClientEvent("auth.sign_up", {
				emailDomain: email.split("@")[1] ?? "unknown",
				method: "email-password",
			});
			router.push("/dashboard");
			router.refresh();
		} catch (error) {
			console.error("sign-up", error);
			toast.error("Unexpected error while creating account");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form className="space-y-4" onSubmit={handleSubmit} data-ph-no-capture>
			<div className="space-y-2">
				<Label htmlFor="name">Name</Label>
				<Input
					id="name"
					placeholder="Leo"
					required
					value={name}
					onChange={(event) => setName(event.target.value)}
					disabled={submitting}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="email">Email</Label>
				<Input
					id="email"
					type="email"
					required
					autoComplete="email"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					disabled={submitting}
				/>
			</div>
		<div className="space-y-2">
			<Label htmlFor="password">Password</Label>
				<Input
					id="password"
					type="password"
					required
					autoComplete="new-password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					disabled={submitting}
				/>
		</div>
			<Button type="submit" className="w-full" disabled={submitting}>
				{submitting ? "Creating account…" : "Create account"}
			</Button>
		</form>
	);
}
