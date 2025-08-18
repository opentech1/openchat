import { OnboardingData } from "../onboarding"

interface ProfileStepProps {
  data: OnboardingData
  updateData: (data: Partial<OnboardingData>) => void
}

export function ProfileStep({ data, updateData }: ProfileStepProps) {
  const roles = [
    { id: "developer", label: "Developer", icon: "💻" },
    { id: "designer", label: "Designer", icon: "🎨" },
    { id: "manager", label: "Manager", icon: "📊" },
    { id: "marketer", label: "Marketer", icon: "📈" },
    { id: "founder", label: "Founder", icon: "🚀" },
    { id: "other", label: "Other", icon: "✨" }
  ]

  return (
    <div className="flex h-full">
      <div className="flex-1 pr-8">
        <div className="mb-8">
          <h3 className="mb-2 text-2xl font-semibold text-foreground">Personal Information</h3>
          <p className="text-muted-foreground">Help us personalize your experience</p>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Your Name *
            </label>
            <input
              type="text"
              value={data.userName}
              onChange={(e) => updateData({ userName: e.target.value })}
              placeholder="John Doe"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          </div>
          
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Company Name
            </label>
            <input
              type="text"
              value={data.companyName}
              onChange={(e) => updateData({ companyName: e.target.value })}
              placeholder="Acme Inc. (Optional)"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          
          <div>
            <label className="mb-3 block text-sm font-medium text-foreground">
              Your Role *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => updateData({ role: role.id })}
                  className={`rounded-xl border-2 p-4 text-center transition-all ${
                    data.role === role.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="mb-2 text-2xl">{role.icon}</div>
                  <div className="text-sm font-medium text-foreground">{role.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      <div className="w-px bg-border/50" />
      
      <div className="flex-1 pl-8">
        <div className="mb-8">
          <h3 className="mb-2 text-2xl font-semibold text-foreground">Quick Preferences</h3>
          <p className="text-muted-foreground">Set your initial preferences</p>
        </div>
        
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Language
            </label>
            <select
              value={data.language}
              onChange={(e) => updateData({ language: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="ja">Japanese</option>
              <option value="zh">Chinese</option>
            </select>
          </div>
          
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Timezone
            </label>
            <select
              value={data.timezone}
              onChange={(e) => updateData({ timezone: e.target.value })}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Paris">Paris (CET)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
            </select>
          </div>
          
          <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">💡</span>
              <span className="font-medium text-foreground">Pro Tip</span>
            </div>
            <p className="text-sm text-muted-foreground">
              You can change all these settings later from your profile. We're just getting the basics to personalize your initial experience.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}