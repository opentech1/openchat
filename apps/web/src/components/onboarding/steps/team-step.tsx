import { OnboardingData } from "../onboarding"
import { cn } from "@/lib/utils"

interface TeamStepProps {
  data: OnboardingData
  updateData: (data: Partial<OnboardingData>) => void
}

const teamSizes = [
  { id: "solo", label: "Just me", icon: "👤", description: "Personal workspace" },
  { id: "small", label: "2-10", icon: "👥", description: "Small team" },
  { id: "medium", label: "11-50", icon: "🏢", description: "Growing team" },
  { id: "large", label: "51-200", icon: "🏛️", description: "Large organization" },
  { id: "enterprise", label: "200+", icon: "🌐", description: "Enterprise" }
]

export function TeamStep({ data, updateData }: TeamStepProps) {
  return (
    <div className="flex h-full gap-8">
      <div className="flex-1">
        <div className="mb-6">
          <h3 className="mb-2 text-2xl font-semibold text-foreground">Team Size</h3>
          <p className="text-muted-foreground">How many people will be using OpenChat?</p>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {teamSizes.map((size) => (
            <button
              key={size.id}
              onClick={() => updateData({ teamSize: size.id })}
              className={cn(
                "flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all hover:scale-[1.01]",
                data.teamSize === size.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <span className="text-3xl">{size.icon}</span>
              <div className="flex-1">
                <div className="font-semibold text-foreground">{size.label}</div>
                <div className="text-sm text-muted-foreground">{size.description}</div>
              </div>
              {data.teamSize === size.id && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
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
      
      <div className="w-px bg-border/50" />
      
      <div className="flex-1">
        <div className="mb-6">
          <h3 className="mb-2 text-2xl font-semibold text-foreground">Collaboration Features</h3>
          <p className="text-muted-foreground">Enhanced features based on your team size</p>
        </div>
        
        <div className="space-y-4">
          {data.teamSize && data.teamSize !== "solo" && (
            <>
              <div className="rounded-xl border border-border/50 bg-card/50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xl">👥</span>
                  <span className="font-medium text-foreground">Team Features Included</span>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Real-time collaboration
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Shared workspaces
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Team analytics
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Role-based permissions
                  </li>
                </ul>
              </div>
              
              {(data.teamSize === "large" || data.teamSize === "enterprise") && (
                <div className="rounded-xl border border-primary/50 bg-primary/10 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xl">🚀</span>
                    <span className="font-medium text-foreground">Enterprise Features</span>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      SSO integration
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Advanced security
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Priority support
                    </li>
                  </ul>
                </div>
              )}
            </>
          )}
          
          {data.teamSize === "solo" && (
            <div className="rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xl">✨</span>
                <span className="font-medium text-foreground">Personal Features</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Perfect for individual use with all core features included. Upgrade anytime when you're ready to collaborate.
              </p>
            </div>
          )}
          
          <div className="rounded-xl bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Tip:</span> You can invite team members and change your plan anytime from settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}