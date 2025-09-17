"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AccountSettingsModal } from "@/components/account-settings-modal";
import ThemeSelector from "@/components/settings/theme-selector";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { LifeBuoy, Settings2, Sparkles } from "lucide-react";

const categories = [
	{ id: "account", label: "Account" },
	{ id: "customization", label: "Customization" },
	{ id: "history", label: "History & Sync" },
	{ id: "models", label: "Models" },
	{ id: "api", label: "API Keys" },
	{ id: "attachments", label: "Attachments" },
	{ id: "support", label: "Contact Us" },
] as const;

const benefits: Array<{
	icon: LucideIcon;
	title: string;
	description: string;
}> = [
	{
		icon: Sparkles,
		title: "Access to All Models",
		description: "Use the entire suite of available models with priority routing and new features first.",
	},
	{
		icon: Settings2,
		title: "Generous Limits",
		description: "Enjoy a larger daily message cap plus a monthly pool of premium credits for power sessions.",
	},
	{
		icon: LifeBuoy,
		title: "Priority Support",
		description: "Skip the queue and get help from the team whenever your workflow needs attention.",
	},
];

const usageTiers = [
	{
		label: "Standard",
		used: 88,
		limit: 1500,
	},
	{
		label: "Premium",
		used: 32,
		limit: 100,
	},
];

export default function SettingsPageClient() {
	const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]["id"]>("account");
	const [accountModalOpen, setAccountModalOpen] = useState(false);
	const [emailReceipts, setEmailReceipts] = useState(false);

	const activeCategoryLabel = useMemo(
		() => categories.find((item) => item.id === activeCategory)?.label ?? "Settings",
		[activeCategory],
	);

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-16 pt-8 lg:flex-row lg:gap-12">
			<aside className="lg:w-72">
				<div className="flex flex-col gap-6">
					<Card className="items-center text-center">
						<CardHeader className="flex flex-col items-center gap-3 text-center">
							<div className="rounded-full border border-border/40 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
								Pro Plan
							</div>
							<Avatar className="size-20 border border-border/50">
								<AvatarFallback className="bg-gradient-to-br from-primary/30 via-primary/10 to-transparent text-base font-semibold uppercase">
									JD
								</AvatarFallback>
							</Avatar>
							<CardTitle className="text-lg">Jamie Doe</CardTitle>
							<CardDescription>jamie@example.com</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-3">
							<p className="text-muted-foreground text-sm">
								Manage your profile, email preferences, and security settings in one place.
							</p>
						</CardContent>
						<CardFooter>
							<Button className="w-full" variant="outline" onClick={() => setAccountModalOpen(true)}>
								Manage account
							</Button>
						</CardFooter>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Message Usage</CardTitle>
							<CardDescription>Resets 09/28/2025</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-col gap-4">
							{usageTiers.map((tier) => {
								const percent = Math.min(100, Math.round((tier.used / tier.limit) * 100));
								return (
									<div key={tier.label} className="space-y-2">
										<div className="flex items-center justify-between text-sm font-medium">
											<span>{tier.label}</span>
											<span className="text-muted-foreground">
												{tier.used}/{tier.limit}
											</span>
										</div>
										<div className="bg-muted relative h-2 overflow-hidden rounded-full">
											<div
												className="bg-primary absolute inset-y-0 left-0 rounded-full"
												style={{ width: `${percent}%` }}
											/>
										</div>
									</div>
								);
							})}
						</CardContent>
						<CardFooter className="flex-col items-stretch gap-2">
							<Button className="w-full" variant="secondary">
								Buy more premium credits
							</Button>
							<p className="text-muted-foreground text-xs">
								Each tool call may use additional premium credits depending on the selected model.
							</p>
						</CardFooter>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Keyboard Shortcuts</CardTitle>
							<CardDescription>Boost your productivity inside the workspace.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3 text-sm">
							<div className="flex items-center justify-between">
								<span>Search</span>
								<Kbd>⌘</Kbd>
							</div>
							<div className="flex items-center justify-between">
								<span>New chat</span>
								<div className="flex items-center gap-1">
									<Kbd>⌘</Kbd>
									<Kbd>Shift</Kbd>
									<Kbd>N</Kbd>
								</div>
							</div>
							<div className="flex items-center justify-between">
								<span>Toggle sidebar</span>
								<div className="flex items-center gap-1">
									<Kbd>⌘</Kbd>
									<Kbd>B</Kbd>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</aside>

			<main className="flex-1 space-y-8">
				<header className="space-y-4">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h1 className="text-2xl font-semibold tracking-tight">{activeCategoryLabel}</h1>
							<p className="text-muted-foreground text-sm">
								Fine-tune your workspace across billing, theme, usage, and developer tools.
							</p>
						</div>
						<Button className="w-full sm:w-auto">Manage subscription</Button>
					</div>
					<nav className="flex flex-wrap gap-2">
						{categories.map((category) => (
							<button
								key={category.id}
								type="button"
								onClick={() => setActiveCategory(category.id)}
								className={cn(
									"rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
									activeCategory === category.id
										? "bg-primary text-primary-foreground border-primary shadow-sm"
										: "bg-muted/40 text-muted-foreground border-border/70 hover:bg-muted/70",
								)}
							>
								{category.label}
							</button>
						))}
					</nav>
				</header>

				<section className="space-y-4">
					<div>
						<h2 className="text-base font-medium">Pro Plan Benefits</h2>
						<p className="text-muted-foreground text-sm">
							The full suite of tooling, credits, and support you receive as a subscriber.
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-3">
						{benefits.map((benefit) => (
							<Card key={benefit.title} className="h-full">
								<CardContent className="flex h-full flex-col gap-4">
									<div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
										<benefit.icon className="size-5" aria-hidden />
									</div>
									<div className="space-y-2">
										<p className="text-sm font-medium leading-tight">{benefit.title}</p>
										<p className="text-muted-foreground text-sm">{benefit.description}</p>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</section>

				<section>
					<Card>
						<CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
							<div className="space-y-1">
								<p className="text-base font-medium">Billing Preferences</p>
								<p className="text-muted-foreground text-sm">Receive an email receipt every time a payment succeeds.</p>
							</div>
							<button
								type="button"
								role="switch"
								aria-checked={emailReceipts}
								onClick={() => setEmailReceipts((previous) => !previous)}
								className={cn(
									"relative inline-flex h-6 w-11 items-center rounded-full border transition-colors",
									emailReceipts
										? "border-primary bg-primary"
										: "border-border bg-muted/60",
								)}
							>
								<span
									className={cn(
										"inline-block size-4 rounded-full bg-background shadow transition-transform",
										emailReceipts ? "translate-x-5" : "translate-x-1",
									)}
								/>
							</button>
						</CardContent>
					</Card>
				</section>

				<section>
					<Card>
						<CardContent className="flex flex-col gap-6 py-6">
							<div className="space-y-2">
								<p className="text-base font-medium">Customization</p>
								<p className="text-muted-foreground text-sm">Choose the accent color applied across the dashboard interface.</p>
							</div>
							<ThemeSelector />
						</CardContent>
					</Card>
				</section>

				<section>
					<Card className="border-destructive/40">
						<CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
							<div className="space-y-2">
								<p className="text-base font-medium text-destructive">Danger Zone</p>
								<p className="text-muted-foreground text-sm">
									Permanently delete your account and all associated data. This action cannot be undone.
								</p>
							</div>
							<Button variant="destructive" className="w-full sm:w-auto">
								Delete account
							</Button>
						</CardContent>
					</Card>
				</section>
			</main>
			<AccountSettingsModal open={accountModalOpen} onClose={() => setAccountModalOpen(false)} />
		</div>
	);
}

function Kbd({ children }: { children: ReactNode }) {
	return (
		<span className="border-border bg-muted text-muted-foreground inline-flex min-w-[1.5rem] items-center justify-center rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
			{children}
		</span>
	);
}
