"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignUpForm() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [inviteCode, setInviteCode] = useState("");
	const [submitting, setSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;
		setSubmitting(true);
	try {
		const response = await fetch("/api/auth/invite-sign-up", {
			method: "POST",
			headers: { "content-type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ name, email, password, inviteCode }),
		});
		const payload = await response.json().catch(() => ({}));
		if (!response.ok) {
			const message = typeof payload?.error === "string" ? payload.error : "Unable to create account";
			toast.error(message);
			return;
		}
		toast.success("Account created");
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
		<div className="space-y-2">
			<Label htmlFor="invite">Invite code</Label>
			<Input
				id="invite"
				required
				autoComplete="off"
				placeholder="XXXX-XXXX"
				value={inviteCode}
				onChange={(event) => setInviteCode(event.target.value)}
				disabled={submitting}
			/>
		</div>
			<Button type="submit" className="w-full" disabled={submitting}>
				{submitting ? "Creating account…" : "Create account"}
			</Button>
		</form>
	);
}
