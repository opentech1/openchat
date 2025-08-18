import { motion } from "framer-motion"

export function WelcomeStep() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-3xl text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="relative mx-auto mb-8 h-32 w-32"
        >
          <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-primary/30 to-chart-2/30 blur-2xl" />
          <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-2">
            <svg
              className="h-16 w-16 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a1.5 1.5 0 00-1.006-1.006L15.75 7.5l1.035-.259a1.5 1.5 0 001.006-1.006L18 5.25l.259 1.035a1.5 1.5 0 001.006 1.006L20.25 7.5l-1.035.259a1.5 1.5 0 00-1.006 1.006zM16.894 17.801L16.5 19.5l-.394-1.699a2.25 2.25 0 00-1.407-1.407L13 16l1.699-.394a2.25 2.25 0 001.407-1.407L16.5 12.5l.394 1.699a2.25 2.25 0 001.407 1.407L20 16l-1.699.394a2.25 2.25 0 00-1.407 1.407z"
              />
            </svg>
          </div>
        </motion.div>
        
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-4 text-5xl font-bold text-foreground"
        >
          Welcome to OpenChat
        </motion.h1>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8 text-xl text-muted-foreground"
        >
          Let's set up your workspace in just a few steps
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-3 gap-6"
        >
          {[
            { icon: "⚡", label: "Quick Setup", desc: "2 minutes" },
            { icon: "🎨", label: "Customizable", desc: "Your style" },
            { icon: "🚀", label: "Powerful", desc: "AI-driven" }
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="rounded-xl border border-border/50 bg-card/50 p-4"
            >
              <div className="mb-2 text-3xl">{item.icon}</div>
              <div className="font-semibold text-foreground">{item.label}</div>
              <div className="text-sm text-muted-foreground">{item.desc}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}