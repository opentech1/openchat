import { OnboardingData } from "../onboarding"

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
    <div className="flex h-full w-full items-center justify-center">
      <div className="w-full max-w-lg text-center">
        <div className="mb-8">
          <h3 className="mb-3 text-3xl font-bold text-foreground">Nice to meet you!</h3>
          <p className="text-lg text-muted-foreground">
            What should we call you?
          </p>
        </div>
        
        <div className="mb-8">
          <input
            type="text"
            value={data.userName}
            onChange={(e) => updateData({ userName: e.target.value })}
            onKeyPress={handleKeyPress}
            placeholder="Enter your name"
            className="w-full rounded-2xl border-2 border-border bg-background px-6 py-4 text-xl text-center text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
            autoFocus
          />
          <p className="mt-3 text-sm text-muted-foreground">
            Press Enter to continue
          </p>
        </div>
        
        <div className="rounded-2xl border border-border/50 bg-gradient-to-r from-primary/5 to-chart-2/5 p-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-2xl">⚡</span>
            <span className="text-lg font-semibold text-foreground">Quick Setup</span>
          </div>
          <p className="text-sm text-muted-foreground">
            We'll get you set up in just a few simple steps
          </p>
        </div>
      </div>
    </div>
  )
}