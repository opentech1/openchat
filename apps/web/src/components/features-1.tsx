import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Zap, Wrench, Heart } from "lucide-react";
import type { ReactNode } from "react";
import { spacing, opacity, iconSize } from "@/styles/design-tokens";

export default function Features() {
    return (
        <section
            id="features"
            className="relative py-20 md:py-36">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full bg-[radial-gradient(60%_80%_at_50%_0%,theme(colors.primary/8%)0%,transparent70%)] dark:bg-[radial-gradient(60%_80%_at_50%_0%,theme(colors.primary/12%)0%,transparent70%)]"
            />
            <div className="@container mx-auto max-w-5xl px-6">
                <div className="text-center">
                    <h2 className="text-balance text-4xl font-semibold lg:text-5xl">Why teams choose OpenChat</h2>
                    <p className="mt-4 text-muted-foreground">
                        We obsess over speed, flexibility, and community so your product can ship delightful AI chat experiences without vendor lock-in.
                    </p>
                </div>
                <div className={`@min-4xl:max-w-full @min-4xl:grid-cols-3 mx-auto mt-12 grid max-w-sm *:text-left md:mt-16 ${spacing.gap.xl}`}>
                    <Card className={`group border-border/60 bg-card/${opacity.medium} shadow-none backdrop-blur`}>
                        <CardHeader className="pb-3">
                            <CardDecorator>
                                <Zap className={iconSize.lg} aria-hidden />
                            </CardDecorator>

                            <h3 className="mt-6 font-semibold text-foreground">Blazing Performance</h3>
                        </CardHeader>

                        <CardContent>
                            <p className="text-sm text-muted-foreground">Next.js 15 + Bun deliver sub-second streaming, realtime updates, and zero lag. Built for speed from the ground up.</p>
                        </CardContent>
                    </Card>

                    <Card className={`group border-border/60 bg-card/${opacity.medium} shadow-none backdrop-blur`}>
                        <CardHeader className="pb-3">
                            <CardDecorator>
                                <Wrench className={iconSize.lg} aria-hidden />
                            </CardDecorator>

                            <h3 className="mt-6 font-semibold text-foreground">Fully Customizable</h3>
                        </CardHeader>

                        <CardContent>
                            <p className="mt-3 text-sm text-muted-foreground">Tailwind v4, shadcn, and open source code. Bend every pixel to match your brand. White-label ready.</p>
                        </CardContent>
                    </Card>

                    <Card className={`group border-border/60 bg-card/${opacity.medium} shadow-none backdrop-blur`}>
                        <CardHeader className="pb-3">
                            <CardDecorator>
                                <Heart className={iconSize.lg} aria-hidden />
                            </CardDecorator>

                            <h3 className="mt-6 font-semibold text-foreground">Community-Driven</h3>
                        </CardHeader>

                        <CardContent>
                            <p className="mt-3 text-sm text-muted-foreground">Active development, weekly features, and plug-and-play add-ons. Built with the community, for the community.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>
    )
}

const CardDecorator = ({ children }: { children: ReactNode }) => (
    <div className="mask-radial-from-40% mask-radial-to-60% relative mx-auto size-32 duration-200 [--color-border:color-mix(in_oklab,var(--color-zinc-950)12%,transparent)] group-hover:[--color-border:color-mix(in_oklab,var(--color-zinc-950)25%,transparent)] dark:[--color-border:color-mix(in_oklab,var(--color-white)18%,transparent)] dark:group-hover:[--color-border:color-mix(in_oklab,var(--color-white)30%,transparent)]">
        <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:20px_20px] opacity-60 dark:opacity-40"
        />

        <div className="bg-background absolute inset-0 m-auto flex size-12 items-center justify-center border border-border/60 rounded-full">{children}</div>
    </div>
)
