"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { setOnboardingStatus } from "@/lib/cookies"
import { cn } from "@/lib/utils"

interface OnboardingProps {
  onComplete: () => void
}

const themes = [
  {
    id: "arctic",
    name: "Arctic Ice",
    description: "Cool blues and crisp whites",
    colors: ["#4A90E2", "#6BB6FF", "#E8F4FD", "#2C5F8B"],
    preview: "bg-gradient-to-br from-blue-500 to-cyan-400"
  },
  {
    id: "aurora",
    name: "Aurora Borealis",
    description: "Northern lights inspired",
    colors: ["#7C3AED", "#10B981", "#3B82F6", "#EC4899"],
    preview: "bg-gradient-to-br from-purple-500 via-green-400 to-blue-500"
  },
  {
    id: "midnight",
    name: "Midnight Frost",
    description: "Deep purples and dark blues",
    colors: ["#6366F1", "#8B5CF6", "#1E293B", "#4C1D95"],
    preview: "bg-gradient-to-br from-indigo-600 to-purple-600"
  },
  {
    id: "glacier",
    name: "Glacier",
    description: "Pure ice and snow tones",
    colors: ["#CBD5E1", "#F1F5F9", "#94A3B8", "#64748B"],
    preview: "bg-gradient-to-br from-slate-300 to-gray-400"
  },
  {
    id: "nebula",
    name: "Nebula Dreams",
    description: "Cosmic purples and pinks",
    colors: ["#A855F7", "#EC4899", "#F97316", "#6366F1"],
    preview: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500"
  },
  {
    id: "deepfreeze",
    name: "Deep Freeze",
    description: "Ultra dark with blue accents",
    colors: ["#0F172A", "#1E3A8A", "#60A5FA", "#0EA5E9"],
    preview: "bg-gradient-to-br from-slate-900 via-blue-900 to-sky-500"
  }
]

const layouts = [
  {
    id: "sidebar",
    name: "Sidebar Navigation",
    description: "Classic sidebar layout",
    icon: (
      <div className="flex h-full w-full overflow-hidden rounded-lg border border-border bg-background/50">
        <div className="w-1/4 border-r border-border bg-muted/50" />
        <div className="flex-1 p-2">
          <div className="mb-2 h-3 w-3/4 rounded bg-muted" />
          <div className="space-y-1">
            <div className="h-2 w-full rounded bg-muted/50" />
            <div className="h-2 w-5/6 rounded bg-muted/50" />
            <div className="h-2 w-4/6 rounded bg-muted/50" />
          </div>
        </div>
      </div>
    )
  },
  {
    id: "topbar",
    name: "Top Navigation",
    description: "Horizontal menu bar",
    icon: (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-background/50">
        <div className="h-1/4 border-b border-border bg-muted/50" />
        <div className="flex-1 p-2">
          <div className="mb-2 h-3 w-3/4 rounded bg-muted" />
          <div className="space-y-1">
            <div className="h-2 w-full rounded bg-muted/50" />
            <div className="h-2 w-5/6 rounded bg-muted/50" />
            <div className="h-2 w-4/6 rounded bg-muted/50" />
          </div>
        </div>
      </div>
    )
  },
  {
    id: "dual",
    name: "Dual Panel",
    description: "Split screen view",
    icon: (
      <div className="flex h-full w-full overflow-hidden rounded-lg border border-border bg-background/50">
        <div className="flex-1 border-r border-border p-2">
          <div className="mb-1 h-2 w-3/4 rounded bg-muted" />
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded bg-muted/50" />
            <div className="h-1.5 w-5/6 rounded bg-muted/50" />
          </div>
        </div>
        <div className="flex-1 p-2">
          <div className="mb-1 h-2 w-3/4 rounded bg-muted" />
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded bg-muted/50" />
            <div className="h-1.5 w-5/6 rounded bg-muted/50" />
          </div>
        </div>
      </div>
    )
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean and focused",
    icon: (
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-background/50">
        <div className="w-3/4">
          <div className="mx-auto mb-2 h-3 w-1/2 rounded bg-muted" />
          <div className="space-y-1">
            <div className="h-2 w-full rounded bg-muted/50" />
            <div className="h-2 w-4/5 rounded bg-muted/50" />
          </div>
        </div>
      </div>
    )
  }
]

export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedTheme, setSelectedTheme] = useState("")
  const [selectedLayout, setSelectedLayout] = useState("")
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [userName, setUserName] = useState("")

  const steps = [
    {
      id: "welcome",
      title: "Welcome to OpenChat",
      description: "Let's personalize your experience",
      content: (
        <div className="flex h-full items-center gap-12">
          <div className="flex-1">
            <div className="relative mb-8 h-40 w-40">
              <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-2xl" />
              <svg
                className="relative h-40 w-40 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a1.5 1.5 0 00-1.006-1.006L15.75 7.5l1.035-.259a1.5 1.5 0 001.006-1.006L18 5.25l.259 1.035a1.5 1.5 0 001.006 1.006L20.25 7.5l-1.035.259a1.5 1.5 0 00-1.006 1.006zM16.894 17.801L16.5 19.5l-.394-1.699a2.25 2.25 0 00-1.407-1.407L13 16l1.699-.394a2.25 2.25 0 001.407-1.407L16.5 12.5l.394 1.699a2.25 2.25 0 001.407 1.407L20 16l-1.699.394a2.25 2.25 0 00-1.407 1.407z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-3xl font-bold text-foreground">Get Started</h3>
            <p className="text-lg text-muted-foreground">
              We'll guide you through a quick setup to customize your workspace
            </p>
          </div>
          
          <div className="flex-1">
            <div className="space-y-6">
              <div>
                <label className="mb-3 block text-lg font-medium text-foreground">
                  What should we call you?
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full rounded-xl border border-border bg-input px-5 py-3 text-lg text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  autoFocus
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  This helps us personalize your experience
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
                  <span className="text-2xl">⚡</span>
                  <div>
                    <p className="font-medium text-foreground">Quick Setup</p>
                    <p className="text-sm text-muted-foreground">Takes less than 2 minutes</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
                  <span className="text-2xl">🎨</span>
                  <div>
                    <p className="font-medium text-foreground">Fully Customizable</p>
                    <p className="text-sm text-muted-foreground">Choose your theme and layout</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "theme",
      title: "Choose Your Theme",
      description: "Select a color scheme that suits your style",
      content: (
        <div className="h-full">
          <div className="grid grid-cols-3 gap-4">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setSelectedTheme(theme.id)}
                className={cn(
                  "group relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all hover:scale-[1.02]",
                  selectedTheme === theme.id
                    ? "border-primary bg-primary/10 shadow-lg"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className={cn("mb-3 h-24 rounded-lg shadow-inner", theme.preview)} />
                <h3 className="mb-1 font-semibold text-foreground">{theme.name}</h3>
                <p className="mb-3 text-xs text-muted-foreground">{theme.description}</p>
                <div className="flex gap-1">
                  {theme.colors.map((color, i) => (
                    <div
                      key={i}
                      className="h-5 w-5 rounded-md border border-border/50 shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                {selectedTheme === theme.id && (
                  <div className="absolute right-3 top-3 rounded-full bg-primary p-1.5 shadow-lg">
                    <svg
                      className="h-4 w-4 text-primary-foreground"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      id: "layout",
      title: "Select Your Layout",
      description: "Choose how you want your workspace organized",
      content: (
        <div className="h-full">
          <div className="grid grid-cols-2 gap-6">
            {layouts.map((layout) => (
              <button
                key={layout.id}
                onClick={() => setSelectedLayout(layout.id)}
                className={cn(
                  "group relative overflow-hidden rounded-xl border-2 p-6 text-left transition-all hover:scale-[1.02]",
                  selectedLayout === layout.id
                    ? "border-primary bg-primary/10 shadow-lg"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="mb-4 h-32 w-full">{layout.icon}</div>
                <h3 className="mb-1 text-lg font-semibold text-foreground">{layout.name}</h3>
                <p className="text-sm text-muted-foreground">{layout.description}</p>
                {selectedLayout === layout.id && (
                  <div className="absolute right-3 top-3 rounded-full bg-primary p-1.5 shadow-lg">
                    <svg
                      className="h-4 w-4 text-primary-foreground"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      id: "features",
      title: "Enable Features",
      description: "Choose which features you'd like to start with",
      content: (
        <div className="h-full">
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                id: "ai-assistant",
                name: "AI Assistant",
                description: "Get help with coding, writing, and more",
                icon: "🤖"
              },
              {
                id: "collaboration",
                name: "Real-time Collaboration",
                description: "Work together with your team in real-time",
                icon: "👥"
              },
              {
                id: "analytics",
                name: "Analytics Dashboard",
                description: "Track your productivity and insights",
                icon: "📊"
              },
              {
                id: "integrations",
                name: "Third-party Integrations",
                description: "Connect with your favorite tools",
                icon: "🔗"
              },
              {
                id: "automation",
                name: "Workflow Automation",
                description: "Automate repetitive tasks",
                icon: "⚡"
              },
              {
                id: "security",
                name: "Advanced Security",
                description: "Enhanced security features and 2FA",
                icon: "🔒"
              }
            ].map((feature) => (
              <button
                key={feature.id}
                onClick={() => {
                  setSelectedFeatures((prev) =>
                    prev.includes(feature.id)
                      ? prev.filter((f) => f !== feature.id)
                      : [...prev, feature.id]
                  )
                }}
                className={cn(
                  "flex items-start gap-4 rounded-xl border-2 p-5 text-left transition-all hover:scale-[1.02]",
                  selectedFeatures.includes(feature.id)
                    ? "border-primary bg-primary/10 shadow-lg"
                    : "border-border hover:border-primary/50"
                )}
              >
                <span className="text-3xl">{feature.icon}</span>
                <div className="flex-1">
                  <h3 className="mb-1 font-semibold text-foreground">{feature.name}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
                <div
                  className={cn(
                    "mt-1 h-6 w-6 rounded-md border-2 transition-all",
                    selectedFeatures.includes(feature.id)
                      ? "border-primary bg-primary"
                      : "border-border"
                  )}
                >
                  {selectedFeatures.includes(feature.id) && (
                    <svg
                      className="h-full w-full text-primary-foreground p-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )
    },
    {
      id: "notifications",
      title: "Notification Preferences",
      description: "How would you like to stay updated?",
      content: (
        <div className="flex h-full gap-8">
          <div className="flex-1">
            <h3 className="mb-6 text-xl font-semibold text-foreground">Communication Channels</h3>
            <div className="space-y-4">
              {[
                {
                  id: "email",
                  name: "Email Notifications",
                  description: "Important updates and weekly summaries",
                  icon: "📧",
                  enabled: true
                },
                {
                  id: "push",
                  name: "Push Notifications",
                  description: "Real-time alerts in your browser",
                  icon: "🔔",
                  enabled: false
                },
                {
                  id: "mobile",
                  name: "Mobile Notifications",
                  description: "Get notified on your phone",
                  icon: "📱",
                  enabled: false
                },
                {
                  id: "digest",
                  name: "Daily Digest",
                  description: "Summary of your daily activity",
                  icon: "📰",
                  enabled: true
                }
              ].map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card/50 p-4 transition-all hover:bg-card"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{notification.icon}</span>
                    <div>
                      <h3 className="font-semibold text-foreground">{notification.name}</h3>
                      <p className="text-sm text-muted-foreground">{notification.description}</p>
                    </div>
                  </div>
                  <button
                    className={cn(
                      "relative h-7 w-12 rounded-full transition-colors",
                      notification.enabled ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                        notification.enabled ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="w-px bg-border" />
          
          <div className="flex-1">
            <h3 className="mb-6 text-xl font-semibold text-foreground">Frequency Settings</h3>
            <div className="space-y-6">
              <div>
                <label className="mb-2 block font-medium text-foreground">Email Frequency</label>
                <select className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground">
                  <option>Instant</option>
                  <option>Daily Summary</option>
                  <option>Weekly Digest</option>
                  <option>Monthly Report</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block font-medium text-foreground">Quiet Hours</label>
                <div className="flex gap-3">
                  <input
                    type="time"
                    defaultValue="22:00"
                    className="flex-1 rounded-lg border border-border bg-input px-4 py-2.5 text-foreground"
                  />
                  <span className="flex items-center text-muted-foreground">to</span>
                  <input
                    type="time"
                    defaultValue="08:00"
                    className="flex-1 rounded-lg border border-border bg-input px-4 py-2.5 text-foreground"
                  />
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">
                  You can change these preferences anytime in your account settings
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "complete",
      title: "You're All Set!",
      description: `Welcome aboard${userName ? `, ${userName}` : ""}! Your workspace is ready.`,
      content: (
        <div className="flex h-full items-center gap-12">
          <div className="flex-1">
            <div className="relative mb-8 h-40 w-40">
              <div className="absolute inset-0 animate-pulse rounded-full bg-chart-4/20 blur-2xl" />
              <svg
                className="relative h-40 w-40 text-chart-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="mb-4 text-3xl font-bold text-foreground">Setup Complete!</h3>
            <p className="text-lg text-muted-foreground">
              Your personalized workspace is ready. You can always adjust these settings later.
            </p>
          </div>
          
          <div className="flex-1">
            <div className="rounded-xl border border-border bg-card/50 p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">Your Configuration</h3>
              <div className="space-y-3">
                {selectedTheme && (
                  <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
                    <span className="text-muted-foreground">Theme</span>
                    <span className="font-medium text-foreground">
                      {themes.find((t) => t.id === selectedTheme)?.name}
                    </span>
                  </div>
                )}
                {selectedLayout && (
                  <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
                    <span className="text-muted-foreground">Layout</span>
                    <span className="font-medium text-foreground">
                      {layouts.find((l) => l.id === selectedLayout)?.name}
                    </span>
                  </div>
                )}
                {selectedFeatures.length > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
                    <span className="text-muted-foreground">Features</span>
                    <span className="font-medium text-foreground">{selectedFeatures.length} enabled</span>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
                  <span className="text-muted-foreground">Notifications</span>
                  <span className="font-medium text-foreground">Configured</span>
                </div>
              </div>
            </div>
            
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>You can change these settings anytime from your profile</span>
            </div>
          </div>
        </div>
      )
    }
  ]

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    setOnboardingStatus(true)
    onComplete()
  }

  const canProceed = () => {
    switch (steps[currentStep].id) {
      case "welcome":
        return userName.trim().length > 0
      case "theme":
        return selectedTheme !== ""
      case "layout":
        return selectedLayout !== ""
      case "features":
        return selectedFeatures.length > 0
      default:
        return true
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-2xl" />
      
      <div className="relative z-10 h-[85vh] w-[90vw] max-w-7xl">
        <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-chart-2/5" />
          
          <div className="relative flex flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-border px-8 py-5">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {steps[currentStep].title}
                </h2>
                <p className="mt-1 text-muted-foreground">
                  {steps[currentStep].description}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  Step {currentStep + 1} of {steps.length}
                </span>
                <div className="flex gap-1.5">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        "h-2 w-2 rounded-full transition-all",
                        index === currentStep
                          ? "w-8 bg-primary"
                          : index < currentStep
                          ? "bg-primary/50"
                          : "bg-muted"
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {steps[currentStep].content}
            </div>
            
            <div className="border-t border-border px-8 py-5">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {currentStep === 0 ? "Let's get started" : currentStep === steps.length - 1 ? "Ready to explore!" : "Almost there..."}
                </div>
                <div className="flex gap-3">
                  {currentStep > 0 && (
                    <Button
                      variant="outline"
                      onClick={handleBack}
                      size="lg"
                      className="min-w-[100px] border-border bg-transparent hover:bg-accent"
                    >
                      Back
                    </Button>
                  )}
                  
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    size="lg"
                    className="min-w-[140px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {currentStep === steps.length - 1 ? "Get Started" : "Continue"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}