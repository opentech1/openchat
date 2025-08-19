import { AlertCircle } from "lucide-react"

interface SkipConfirmStepProps {
  onConfirm: () => void
  onCancel: () => void
}

export function SkipConfirmStep({ onConfirm, onCancel }: SkipConfirmStepProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center w-full space-y-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      
      <div className="space-y-2">
        <h3 className="text-2xl font-bold text-foreground">Skip Setup?</h3>
        <p className="text-base text-muted-foreground max-w-sm">
          Are you sure you want to skip the setup process? You can always configure these settings later from your profile.
        </p>
      </div>
      
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4 w-full max-w-xs">
        <button
          onClick={onCancel}
          className="w-full px-4 py-2 rounded-lg border-2 font-medium transition-opacity"
          style={{
            borderColor: `var(--primary)`,
            backgroundColor: `var(--primary)`,
            color: `var(--primary-foreground)`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
        >
          Continue Setup
        </button>
        <button
          onClick={onConfirm}
          className="w-full px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium"
        >
          Skip Setup
        </button>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Press <span className="font-mono bg-muted px-1 py-0.5 rounded">ESC</span> to continue setup or{" "}
        <span className="font-mono bg-muted px-1 py-0.5 rounded">Enter</span> to skip
      </p>
    </div>
  )
}