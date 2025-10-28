import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GaugeCircle, Palette, Users } from "lucide-react";
import type { ReactNode } from "react";

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
                <div className="@min-4xl:max-w-full @min-4xl:grid-cols-3 mx-auto mt-12 grid max-w-sm gap-6 *:text-left md:mt-16">
                    <Card className="group border-border/60 bg-card/90 shadow-none backdrop-blur">
                        <CardHeader className="pb-3">
                            <CardDecorator>
                                <GaugeCircle className="size-6" aria-hidden />
                            </CardDecorator>

                            <h3 className="mt-6 font-semibold text-foreground">Blazing-fast UI</h3>
                        </CardHeader>

                        <CardContent>
                            <p className="text-sm text-muted-foreground">Next.js 15 + Bun deliver sub-second interactions, realtime streaming, and zero client jank out of the box.</p>
                        </CardContent>
                    </Card>

                    <Card className="group border-border/60 bg-card/90 shadow-none backdrop-blur">
                        <CardHeader className="pb-3">
                            <CardDecorator>
                                <Palette className="size-6" aria-hidden />
                            </CardDecorator>

                            <h3 className="mt-6 font-semibold text-foreground">Made to customize</h3>
                        </CardHeader>

                        <CardContent>
                            <p className="mt-3 text-sm text-muted-foreground">Tailwind v4, shadcn primitives, and config-driven theming let you bend every pixel to match your product’s brand.</p>
                        </CardContent>
                    </Card>

                    <Card className="group border-border/60 bg-card/90 shadow-none backdrop-blur">
                        <CardHeader className="pb-3">
                            <CardDecorator>
                                <Users className="size-6" aria-hidden />
                            </CardDecorator>

                            <h3 className="mt-6 font-semibold text-foreground">Community-led roadmap</h3>
                        </CardHeader>

                        <CardContent>
                            <p className="mt-3 text-sm text-muted-foreground">Active Discord, weekly feature drops, and plug-and-play add-ons mean you’re shipping alongside hundreds of builders.</p>
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
