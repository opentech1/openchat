import { OnboardingData } from "../onboarding"
import { Zap } from "lucide-react"

interface ProfileStepProps {
  data: OnboardingData
  updateData: (data: Partial<OnboardingData>) => void
}

export function ProfileStep({ data, updateData }: ProfileStepProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && data.userName.trim().length > 0) {
      e.preventDefault()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center text-center w-full space-y-4">
      <div className="w-full max-w-md space-y-4">
        <div>
          <h3 className="text-xl font-bold text-foreground sm:text-2xl">Nice to meet you!</h3>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            What should we call you?
          </p>
        </div>
        
        <div>
          <input
            type="text"
            value={data.userName}
            onChange={(e) => updateData({ userName: e.target.value })}
            onKeyPress={handleKeyPress}
            placeholder="Enter your name"
            className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-center text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all sm:text-lg"
            autoFocus
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Press Enter to continue
          </p>
        </div>
        
        <div className="rounded-lg border border-border/50 bg-gradient-to-r from-primary/5 to-chart-2/5 p-3 sm:p-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Quick Setup</span>
          </div>
          <p className="text-xs text-muted-foreground">
            We'll get you set up in just a few simple steps
          </p>
        </div>
      </div>
    </div>
  )
}