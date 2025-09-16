"use client";

import Link from "next/link";
import { Logo } from "@/components/logo";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import React from "react";
import { cn } from "@/lib/utils";

const menuItems = [
	{ name: "Features", href: "#link" },
	{ name: "Solution", href: "#link" },
	{ name: "Pricing", href: "#link" },
	{ name: "About", href: "#link" },
];

export const HeroHeader = () => {
	const [menuOpen, setMenuOpen] = React.useState(false);
	const [isScrolled, setIsScrolled] = React.useState(false);

	React.useEffect(() => {
		const handleScroll = () => {
			setIsScrolled(window.scrollY > 50);
		};
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	return (
		<header>
			<nav data-state={menuOpen ? "active" : undefined} className="fixed z-20 w-full px-2">
				<div
					className={cn(
						"mx-auto mt-2 max-w-6xl px-6 transition-all duration-300 lg:px-12",
						isScrolled && "bg-background/60 max-w-4xl rounded-2xl border backdrop-blur-lg lg:px-5",
					)}
				>
					<div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
						<div className="flex w-full justify-between lg:w-auto">
							<Link href="/" aria-label="home" className="flex items-center space-x-2">
								<Logo />
							</Link>

							<button
								onClick={() => setMenuOpen((prev) => !prev)}
								aria-label={menuOpen ? "Close Menu" : "Open Menu"}
								aria-expanded={menuOpen}
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
										<a
											href={item.href}
											className="text-muted-foreground hover:text-accent-foreground block duration-150"
										>
											<span>{item.name}</span>
										</a>
									</li>
								))}
							</ul>
						</div>

						<div className="bg-background in-data-[state=active]:block lg:in-data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none">
							<div className="lg:hidden">
								<ul className="space-y-6 text-base">
									{menuItems.map((item) => (
										<li key={item.name}>
											<a
												href={item.href}
												className="text-muted-foreground hover:text-accent-foreground block duration-150"
											>
												<span>{item.name}</span>
											</a>
										</li>
									))}
								</ul>
							</div>
							<div className="flex w-full items-center justify-end gap-3 md:w-fit">
								<Button variant="outline" size="sm" asChild>
									<Link href="/auth/sign-in">Log in</Link>
								</Button>
								<Button size="sm" asChild>
									<Link href="/auth/sign-up">Get Started</Link>
								</Button>
							</div>
						</div>
					</div>
				</div>
			</nav>
		</header>
	);
};
