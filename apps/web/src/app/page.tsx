"use client"

import { useEffect, useState } from "react"
import { Onboarding } from "@/components/onboarding/onboarding"
import { getOnboardingStatus, getOnboardingData } from "@/lib/cookies"
import { Button } from "@/components/ui/button"

export default function Home() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const hasCompletedOnboarding = getOnboardingStatus()
    const onboardingData = getOnboardingData()
    
    // Show onboarding if not completed OR if we have no saved data
    const shouldShowOnboarding = !hasCompletedOnboarding || 
      (!onboardingData.userName && !onboardingData.workspaceLayout)
    
    setShowOnboarding(shouldShowOnboarding)
  }, [])

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
  }

  if (!mounted) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-8 w-8 rounded-full bg-primary/20" />
        </div>
      </div>
    )
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <div className="min-h-screen bg-background">
      
      <nav className="border-b border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-chart-2" />
            <span className="text-xl font-bold text-foreground">OpenChat</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm">Documentation</Button>
            <Button variant="ghost" size="sm">Pricing</Button>
            <Button variant="ghost" size="sm">About</Button>
            <Button size="sm" className="bg-primary text-primary-foreground">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6">
        <section className="flex min-h-[calc(100vh-4rem)] items-center">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="flex flex-col justify-center">
              <div className="mb-4 inline-flex items-center rounded-full border border-border/50 bg-muted/30 px-3 py-1 text-sm">
                <span className="mr-2">✨</span>
                <span className="text-muted-foreground">Powered by advanced AI</span>
              </div>
              <h1 className="mb-6 text-5xl font-bold tracking-tight text-foreground lg:text-6xl">
                Conversations
                <span className="block bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
                  Reimagined
                </span>
              </h1>
              <p className="mb-8 text-xl text-muted-foreground">
                Experience the next generation of AI-powered communication. 
                Intelligent, intuitive, and incredibly powerful.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button 
                  size="lg" 
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setShowOnboarding(true)}
                >
                  Start Free Trial
                </Button>
                <Button size="lg" variant="outline">
                  Watch Demo
                </Button>
              </div>
              <div className="mt-8 flex items-center gap-8">
                <div>
                  <div className="text-2xl font-bold text-foreground">10M+</div>
                  <div className="text-sm text-muted-foreground">Active Users</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">99.9%</div>
                  <div className="text-sm text-muted-foreground">Uptime</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">50ms</div>
                  <div className="text-sm text-muted-foreground">Response Time</div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/20 to-chart-2/20 blur-3xl" />
              <div className="relative rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur-sm">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 rounded bg-muted/50" />
                      <div className="h-3 w-full rounded bg-muted/30" />
                      <div className="h-3 w-5/6 rounded bg-muted/30" />
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-chart-2/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 rounded bg-muted/50" />
                      <div className="h-3 w-full rounded bg-muted/30" />
                      <div className="h-3 w-4/5 rounded bg-muted/30" />
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-5/6 rounded bg-muted/50" />
                      <div className="h-3 w-3/4 rounded bg-muted/30" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground">
              Everything you need to succeed
            </h2>
            <p className="mb-12 text-lg text-muted-foreground">
              Powerful features designed for modern teams
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "⚡",
                title: "Lightning Fast",
                description: "Instant responses powered by cutting-edge infrastructure"
              },
              {
                icon: "🔒",
                title: "Secure by Default",
                description: "Enterprise-grade security with end-to-end encryption"
              },
              {
                icon: "🎨",
                title: "Fully Customizable",
                description: "Tailor every aspect to match your workflow"
              },
              {
                icon: "🤝",
                title: "Team Collaboration",
                description: "Work together seamlessly with real-time sync"
              },
              {
                icon: "📊",
                title: "Advanced Analytics",
                description: "Deep insights into your conversations and productivity"
              },
              {
                icon: "🔗",
                title: "Integrations",
                description: "Connect with all your favorite tools and services"
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/50 bg-card/30 p-6 transition-all hover:border-primary/50 hover:bg-card/50"
              >
                <div className="mb-4 text-4xl">{feature.icon}</div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}