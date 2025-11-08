'use client';

import Link from 'next/link'
import { Logo } from '@/components/logo'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import React, { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { authClient } from '@/lib/auth-client'
import { captureClientEvent } from '@/lib/posthog'
import { throttleRAF } from '@/lib/throttle'
import { borderRadius, iconSize, shadows, spacing } from '@/styles/design-tokens';

const menuItems = [
    { name: 'Features', href: '#features' },
    { name: 'Integrations', href: '#integrations' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Docs', href: '/docs' },
]

export const HeroHeader = () => {
    const [menuState, setMenuState] = useState(false)
    const [isScrolled, setIsScrolled] = useState(false)
    const { data: session } = authClient.useSession(); const user = session?.user

    const handleHeaderCtaClick = useCallback(() => {
        const width = typeof window !== 'undefined' ? window.innerWidth : 0
        captureClientEvent('marketing.cta_clicked', {
            cta_id: 'header_try_openchat',
            cta_copy: 'Try OpenChat',
            section: 'header',
            screen_width_bucket: width < 640 ? 'xs' : width < 768 ? 'sm' : width < 1024 ? 'md' : width < 1280 ? 'lg' : 'xl',
        })
    }, [])

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 48)
        }
        // Throttle scroll handler to sync with browser paint cycles (~60fps)
        const throttledScroll = throttleRAF(handleScroll)
        handleScroll()
        window.addEventListener('scroll', throttledScroll, { passive: true })
        return () => window.removeEventListener('scroll', throttledScroll)
    }, [])

    const closeMenu = () => setMenuState(false)

    return (
        <header>
            <nav
                data-state={menuState ? 'active' : 'inactive'}
                className={cn(
                    'fixed z-20 w-full border-b border-border/50 transition-all duration-300',
                    isScrolled ? `bg-background/80 backdrop-blur-2xl ${shadows.md}` : 'bg-background/30 backdrop-blur-sm',
                )}>
                <div className="mx-auto max-w-6xl px-6 transition-all duration-300">
                    <div className={`relative flex flex-wrap items-center justify-between ${spacing.gap.md} py-3 lg:gap-0 lg:py-4`}>
                        <div className="flex w-full items-center justify-between gap-12 lg:w-auto">
                            <Link
                                href="/"
                                aria-label="home"
                                className="flex items-center space-x-2">
                                <Logo />
                            </Link>

                            <button
                                data-state={menuState ? 'active' : 'inactive'}
                                onClick={() => setMenuState(!menuState)}
                                aria-label={menuState == true ? 'Close Menu' : 'Open Menu'}
                                className="relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden">
                                <Menu
                                    data-state={menuState ? 'active' : 'inactive'}
                                    className={`in-data-[state=active]:rotate-180 in-data-[state=active]:scale-0 in-data-[state=active]:opacity-0 m-auto ${iconSize.lg} duration-200`}
                                />
                                <X
                                    data-state={menuState ? 'active' : 'inactive'}
                                    className={`in-data-[state=active]:rotate-0 in-data-[state=active]:scale-100 in-data-[state=active]:opacity-100 absolute inset-0 m-auto ${iconSize.lg} -rotate-180 scale-0 opacity-0 duration-200`}
                                />
                            </button>

                            <div className="hidden lg:block">
                                <ul className="flex gap-8 text-sm">
									{menuItems.map((item) => (
										<li key={item.name}>
											<a
												href={item.href}
												onClick={(event) => {
													closeMenu();
													if (item.href.startsWith("#")) {
														event.preventDefault();
														const target = document.querySelector(item.href);
														target?.scrollIntoView({ behavior: "smooth", block: "start" });
														window.history.replaceState(null, "", item.href);
													}
												}}
												className="text-muted-foreground hover:text-accent-foreground block duration-150"
											>
												<span>{item.name}</span>
											</a>
										</li>
									))}
                                </ul>
                            </div>
                        </div>

                        <div
                            data-state={menuState ? 'active' : 'inactive'}
                            className={`bg-background in-data-[state=active]:block lg:in-data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 ${borderRadius["2xl"]} border ${spacing.padding.xl} ${shadows["2xl"]} shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent`}>
                            <div className="lg:hidden">
                                <ul className="space-y-6 text-base">
									{menuItems.map((item) => (
										<li key={item.name}>
											<a
												href={item.href}
												onClick={(event) => {
													closeMenu();
													if (item.href.startsWith("#")) {
														event.preventDefault();
														const target = document.querySelector(item.href);
														target?.scrollIntoView({ behavior: "smooth", block: "start" });
														window.history.replaceState(null, "", item.href);
													}
												}}
												className="text-muted-foreground hover:text-accent-foreground block duration-150"
											>
												<span>{item.name}</span>
											</a>
										</li>
									))}
                                </ul>
                            </div>
                            <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit">
                                {user ? (
                                    <Link
                                        href="/dashboard"
                                        onClick={closeMenu}
                                        className="text-sm font-medium">
                                        Dashboard
                                    </Link>
                                ) : (
                                    <>
                                        <Button
                                            asChild
                                            variant="outline"
                                            size="sm">
                                            <Link
                                                href="/auth/sign-in"
                                                onClick={closeMenu}>
                                                <span>Log in</span>
                                            </Link>
                                        </Button>
                                        <Button
                                            asChild
                                            size="sm">
                                            <Link
                                                href="/dashboard"
                                                onClick={() => {
                                                    handleHeaderCtaClick()
                                                    closeMenu()
                                                }}>
                                                <span>Try OpenChat</span>
                                            </Link>
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    )
}
