import { motion } from "framer-motion"
import { Rocket, Zap, Palette } from "lucide-react"

export function WelcomeStep() {
  return (
    <div className="flex flex-col items-center justify-center text-center w-full space-y-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring" }}
        className="relative h-20 w-20 sm:h-24 sm:w-24">
        <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-primary/30 to-chart-2/30 blur-xl" />
        <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-2">
          <Rocket className="h-10 w-10 text-white sm:h-12 sm:w-12" />
        </div>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-2"
      >
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
          Welcome to OpenChat
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base lg:text-lg">
          Let's set up your workspace in just a few steps
        </p>
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 max-w-lg">
        {[
          { icon: Zap, label: "Quick Setup", desc: "2 minutes" },
          { icon: Palette, label: "Customizable", desc: "Your style" },
          { icon: Rocket, label: "Powerful", desc: "AI-driven" }
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + i * 0.1 }}
            className="rounded-lg border border-border/50 bg-card/50 p-3 hover:border-primary/50 transition-colors">
            <div className="mb-1 flex justify-center">
              <item.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="text-xs font-semibold text-foreground sm:text-sm">{item.label}</div>
            <div className="text-xs text-muted-foreground">{item.desc}</div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}