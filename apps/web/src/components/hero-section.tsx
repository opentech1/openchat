import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroHeader } from "./header";

const logos = [
	{ src: "/logos/nvidia.svg", alt: "Nvidia Logo", width: 120, height: 32 },
	{ src: "/logos/column.svg", alt: "Column Logo", width: 110, height: 28 },
	{ src: "/logos/github.svg", alt: "GitHub Logo", width: 104, height: 28 },
	{ src: "/logos/nike.svg", alt: "Nike Logo", width: 96, height: 24 },
	{ src: "/logos/lemonsqueezy.svg", alt: "Lemon Squeezy Logo", width: 120, height: 32 },
	{ src: "/logos/laravel.svg", alt: "Laravel Logo", width: 110, height: 28 },
	{ src: "/logos/lilly.svg", alt: "Lilly Logo", width: 108, height: 32 },
	{ src: "/logos/openai.svg", alt: "OpenAI Logo", width: 110, height: 28 },
];

export default function HeroSection() {
	return (
		<>
			<HeroHeader />
			<main className="overflow-hidden">
				<div aria-hidden className="absolute inset-0 isolate hidden opacity-65 contain-strict lg:block">
					<div className="w-140 h-320 -translate-y-87.5 absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
					<div className="h-320 absolute left-0 top-0 w-60 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
					<div className="h-320 -translate-y-87.5 absolute left-0 top-0 w-60 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
				</div>
				<section>
					<div className="relative pt-24 md:pt-36">
						<div aria-hidden className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--color-background)_75%)]" />

						<div className="mx-auto max-w-7xl px-6">
							<div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
								<Link
									href="/#get-started"
									className="hero-fade hero-delay-1 hover:bg-background dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-zinc-950/5 transition-colors duration-300 dark:border-t-white/5 dark:shadow-zinc-950"
								>
									<span className="text-foreground text-sm">Open‑source • Privacy‑first • TypeScript</span>
									<span className="dark:border-background block h-4 w-0.5 border-l bg-white dark:bg-zinc-700" />
									<div className="bg-background group-hover:bg-muted size-6 overflow-hidden rounded-full duration-500">
										<div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
											<span className="flex size-6">
												<ArrowRight className="m-auto size-3" />
											</span>
											<span className="flex size-6">
												<ArrowRight className="m-auto size-3" />
											</span>
										</div>
									</div>
								</Link>

								<h1 className="hero-fade hero-delay-2 mx-auto mt-8 max-w-4xl text-balance text-5xl max-md:font-semibold md:text-7xl lg:mt-16 xl:text-[5.25rem]">
									OpenChat — Open‑source AI chat platform
								</h1>
								<p className="hero-fade hero-delay-3 mx-auto mt-8 max-w-2xl text-balance text-lg">
									Embed a fast, secure, and fully customizable AI chat into your product. Batteries‑included auth, oRPC, and a Bun + Elysia API.
								</p>

								<div className="hero-fade hero-delay-4 mt-12 flex flex-col items-center justify-center gap-2 md:flex-row">
									<div className="bg-foreground/10 rounded-[calc(var(--radius-xl)+0.125rem)] border p-0.5">
										<Button asChild size="lg" className="rounded-xl px-5 text-base">
											<Link href="/#get-started">
												<span className="text-nowrap">Get Started</span>
											</Link>
										</Button>
									</div>
									<Button asChild size="lg" variant="ghost" className="h-10.5 rounded-xl px-5">
										<Link href="/#demo">
											<span className="text-nowrap">Request a demo</span>
										</Link>
									</Button>
								</div>
							</div>
						</div>

						<div className="hero-fade hero-delay-5 mask-b-from-55% relative -mr-56 mt-8 overflow-hidden px-2 sm:mr-0 sm:mt-12 md:mt-20">
							<div className="inset-shadow-2xs ring-background dark:inset-shadow-white/20 bg-background relative mx-auto max-w-6xl overflow-hidden rounded-2xl border p-4 shadow-lg shadow-zinc-950/15 ring-1">
								<div className="aspect-15/8 relative rounded-2xl border border-border/25 bg-[linear-gradient(135deg,theme(colors.primary)_0%,theme(colors.primary/30%)_40%,transparent_100%),radial-gradient(120%_120%_at_70%_0%,theme(colors.accent/30%)_0%,transparent_70%)]" />
							</div>
						</div>
					</div>
				</section>
				<section className="bg-background pb-16 pt-16 md:pb-32">
					<div className="group relative m-auto max-w-5xl px-6">
						<div className="absolute inset-0 z-10 flex scale-95 items-center justify-center opacity-0 duration-500 group-hover:scale-100 group-hover:opacity-100">
							<Link href="/" className="block text-sm duration-150 hover:opacity-75">
								<span> Meet Our Customers</span>
								<ChevronRight className="ml-1 inline-block size-3" />
							</Link>
						</div>
						<div className="group-hover:blur-xs mx-auto mt-12 grid max-w-2xl grid-cols-4 gap-x-12 gap-y-8 transition-all duration-500 group-hover:opacity-50 sm:gap-x-16 sm:gap-y-14">
							{logos.map((logo) => (
								<div key={logo.src} className="flex">
									<Image
										src={logo.src}
										alt={logo.alt}
										width={logo.width}
										height={logo.height}
										className="mx-auto h-5 w-auto dark:invert"
										loading="lazy"
									/>
								</div>
							))}
						</div>
					</div>
				</section>
			</main>
		</>
	);
}
