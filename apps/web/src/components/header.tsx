"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Github, Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { authClient } from "@openchat/auth/client";
import { AccountSettingsModal } from "@/components/account-settings-modal";

const menuItems = [
	{ name: "Features", href: "#features" },
	{ name: "Workflow", href: "#workflow" },
	{ name: "Self-host", href: "#self-host" },
	{ name: "Pricing", href: "#pricing" },
];

const githubRepoUrl = "https://github.com/opentech1/openchat";

export const HeroHeader = () => {
	const [menuState, setMenuState] = useState(false);
	const [isScrolled, setIsScrolled] = useState(false);
	const [accountOpen, setAccountOpen] = useState(false);
	const { data: session } = authClient.useSession();

	useEffect(() => {
		const handleScroll = () => {
			setIsScrolled(window.scrollY > 50);
		};
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	const userInitials = useMemo(() => {
		const name = session?.user?.name || session?.user?.email || "";
		if (!name) return "";
		const parts = name.trim().split(/\s+/);
		return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
	}, [session?.user?.email, session?.user?.name]);

	return (
		<header>
			<nav data-state={menuState && "active"} className="fixed z-20 w-full px-2">
				<div
					className={cn(
						"mx-auto mt-2 max-w-6xl px-6 transition-all duration-300 lg:px-12",
						isScrolled && "bg-background/50 max-w-4xl rounded-2xl border backdrop-blur-lg lg:px-5",
					)}
				>
					<div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
						<div className="flex w-full justify-between lg:w-auto">
							<Link href="/" aria-label="home" className="flex items-center space-x-2">
								<Logo />
							</Link>

							<button
								onClick={() => setMenuState((value) => !value)}
								aria-label={menuState ? "Close Menu" : "Open Menu"}
								className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden"
							>
								<Menu className="in-data-[state=active]:rotate-180 in-data-[state=active]:scale-0 in-data-[state=active]:opacity-0 m-auto size-6 duration-200" />
								<X className="in-data-[state=active]:rotate-0 in-data-[state=active]:scale-100 in-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
							</button>
						</div>

						<div className="absolute inset-0 m-auto hidden size-fit lg:block">
							<ul className="flex gap-8 text-sm">
								{menuItems.map((item) => (
									<li key={item.name}>
										<a href={item.href} className="text-muted-foreground hover:text-accent-foreground block duration-150">
											<span>{item.name}</span>
										</a>
									</li>
								))}
							</ul>
						</div>

						<div className="bg-background in-data-[state=active]:block lg:in-data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent">
							<div className="lg:hidden">
								<ul className="space-y-6 text-base">
									{menuItems.map((item) => (
										<li key={item.name}>
											<a href={item.href} className="text-muted-foreground hover:text-accent-foreground block duration-150">
												<span>{item.name}</span>
											</a>
										</li>
									))}
								</ul>
							</div>
							<div className="flex w-full items-center justify-end gap-3 md:w-fit">
								<Link
									href={githubRepoUrl}
									target="_blank"
									rel="noreferrer"
									className="text-muted-foreground hover:text-accent-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors"
									aria-label="View OpenChat on GitHub"
								>
									<Github className="size-4" />
									<span className="hidden sm:inline">GitHub</span>
								</Link>
								{session?.user ? (
									<>
										<Link href="/dashboard" className="text-sm">
											Dashboard
										</Link>
										<button
											type="button"
											className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent"
											onClick={() => setAccountOpen(true)}
										>
											<Avatar className="size-8">
												{session.user.image ? (
													<AvatarImage src={session.user.image} alt={session.user.name ?? session.user.email ?? "User"} />
												) : null}
												<AvatarFallback>{userInitials || "U"}</AvatarFallback>
											</Avatar>
											<span className="hidden text-sm font-medium lg:inline">{session.user.name || session.user.email}</span>
										</button>
									</>
								) : (
									<Button size="sm" asChild>
										<Link href="/dashboard">Try OpenChat</Link>
									</Button>
								)}
							</div>
						</div>
					</div>
				</div>
			</nav>
			<AccountSettingsModal open={accountOpen} onClose={() => setAccountOpen(false)} />
		</header>
	);
};
