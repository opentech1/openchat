import { motion } from "framer-motion"
import { OnboardingData } from "../onboarding"

interface CompleteStepProps {
  data: OnboardingData
}

export function CompleteStep({ data }: CompleteStepProps) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-2xl text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="relative mx-auto mb-8 h-32 w-32"
        >
          <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-green-400/30 to-emerald-400/30 blur-2xl" />
          <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600">
            <svg
              className="h-16 w-16 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-4 text-4xl font-bold text-foreground"
        >
          Welcome aboard{data.userName ? `, ${data.userName}` : ""}!
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8 text-xl text-muted-foreground"
        >
          Your workspace is ready. Let's start building something amazing.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mx-auto max-w-md rounded-xl border border-border/50 bg-card/50 p-6"
        >
          <h3 className="mb-4 font-semibold text-foreground">Your Configuration</h3>
          <div className="space-y-3 text-left">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Theme</span>
              <span className="text-sm font-medium text-foreground capitalize">
                {data.theme || "Default"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Workspace</span>
              <span className="text-sm font-medium text-foreground capitalize">
                {data.workspaceLayout || "Default"} Layout
              </span>
            </div>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex justify-center gap-8"
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">24/7</div>
            <div className="text-sm text-muted-foreground">Support</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">1000+</div>
            <div className="text-sm text-muted-foreground">Integrations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">99.9%</div>
            <div className="text-sm text-muted-foreground">Uptime</div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}