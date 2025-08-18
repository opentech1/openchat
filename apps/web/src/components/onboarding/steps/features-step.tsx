import { OnboardingData } from "../onboarding"
import { cn } from "@/lib/utils"

interface FeaturesStepProps {
  data: OnboardingData
  updateData: (data: Partial<OnboardingData>) => void
}

const features = [
  {
    id: "code-assist",
    name: "Code Assistant",
    description: "AI-powered code completion and debugging",
    icon: "🔧",
    category: "development"
  },
  {
    id: "smart-search",
    name: "Smart Search",
    description: "Find anything instantly across your workspace",
    icon: "🔍",
    category: "productivity"
  },
  {
    id: "voice-commands",
    name: "Voice Commands",
    description: "Control your workspace with voice",
    icon: "🎤",
    category: "accessibility"
  },
  {
    id: "realtime-collab",
    name: "Real-time Collaboration",
    description: "Work together with your team seamlessly",
    icon: "👥",
    category: "collaboration"
  },
  {
    id: "analytics",
    name: "Advanced Analytics",
    description: "Track productivity and insights",
    icon: "📊",
    category: "analytics"
  },
  {
    id: "integrations",
    name: "1000+ Integrations",
    description: "Connect with your favorite tools",
    icon: "🔗",
    category: "integration"
  },
  {
    id: "automation",
    name: "Workflow Automation",
    description: "Automate repetitive tasks",
    icon: "⚡",
    category: "automation"
  },
  {
    id: "security",
    name: "Enhanced Security",
    description: "Enterprise-grade security features",
    icon: "🔐",
    category: "security"
  },
  {
    id: "templates",
    name: "Smart Templates",
    description: "Pre-built templates for common tasks",
    icon: "📋",
    category: "productivity"
  }
]

export function FeaturesStep({ data, updateData }: FeaturesStepProps) {
  const toggleFeature = (featureId: string) => {
    const current = data.features || []
    const updated = current.includes(featureId)
      ? current.filter(f => f !== featureId)
      : [...current, featureId]
    updateData({ features: updated })
  }

  return (
    <div className="h-full">
      <div className="mb-6">
        <h3 className="mb-2 text-2xl font-semibold text-foreground">Choose Your Tools</h3>
        <p className="text-muted-foreground">Select the features you want to enable (you can always change these later)</p>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        {features.map((feature) => (
          <button
            key={feature.id}
            onClick={() => toggleFeature(feature.id)}
            className={cn(
              "relative rounded-xl border-2 p-5 text-left transition-all hover:scale-[1.02]",
              data.features.includes(feature.id)
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50"
            )}
          >
            <div className="mb-3 text-3xl">{feature.icon}</div>
            <h4 className="mb-1 font-semibold text-foreground">{feature.name}</h4>
            <p className="text-xs text-muted-foreground">{feature.description}</p>
            
            <div
              className={cn(
                "absolute right-3 top-3 h-6 w-6 rounded-md border-2 transition-all",
                data.features.includes(feature.id)
                  ? "border-primary bg-primary"
                  : "border-border"
              )}
            >
              {data.features.includes(feature.id) && (
                <svg className="h-full w-full p-0.5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
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
      
      <div className="mt-6 flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-4">
        <div>
          <p className="font-medium text-foreground">
            {data.features.length} features selected
          </p>
          <p className="text-sm text-muted-foreground">
            Select at least one feature to continue
          </p>
        </div>
        {data.features.length > 5 && (
          <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            Power User
          </div>
        )}
      </div>
    </div>
  )
}