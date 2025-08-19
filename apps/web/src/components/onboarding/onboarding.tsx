"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { setOnboardingStatus } from "@/lib/cookies"
import { cn } from "@/lib/utils"
import { WelcomeStep } from "./steps/welcome-step"
import { ProfileStep } from "./steps/profile-step"
import { ThemeStep } from "./steps/theme-step"
import { WorkspaceStep } from "./steps/workspace-step"
import { CompleteStep } from "./steps/complete-step"

interface OnboardingProps {
  onComplete: () => void
}

export interface OnboardingData {
  userName: string
  theme: string
  workspaceLayout: string
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    userName: "",
    theme: "",
    workspaceLayout: ""
  })

  const steps = [
    {
      id: "welcome",
      title: "Welcome to OpenChat",
      component: WelcomeStep
    },
    {
      id: "profile", 
      title: "Let's Get Personal",
      component: ProfileStep
    },
    {
      id: "theme",
      title: "Choose Your Style",
      component: ThemeStep
    },
    {
      id: "workspace",
      title: "Configure Workspace", 
      component: WorkspaceStep
    },
    {
      id: "complete",
      title: "Ready to Go!",
      component: CompleteStep
    }
  ]

  const CurrentStepComponent = steps[currentStep].component

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setDirection(1)
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection(-1)
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    setOnboardingStatus(true)
    onComplete()
  }

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }

  const canProceed = () => {
    switch (steps[currentStep].id) {
      case "welcome":
        return true
      case "profile":
        return data.userName.trim().length > 0
      case "theme":
        return data.theme !== ""
      case "workspace":
        return data.workspaceLayout !== ""
      default:
        return true
    }
  }

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && canProceed() && !e.defaultPrevented) {
        handleNext()
      } else if (e.key === 'Escape') {
        if (currentStep > 0) {
          handleBack()
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentStep, canProceed])

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="absolute inset-0 bg-background/95 backdrop-blur-xl"
      />
      
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 30 }}
        className="relative z-10 h-[80vh] w-full max-w-6xl"
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-border/50 bg-card shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-chart-2/5" />
          
          <div className="relative flex flex-1 flex-col">
            <div className="border-b border-border/50 px-8 py-6">
              <div className="flex items-center justify-between">
                <motion.h2 
                  key={steps[currentStep].title}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-3xl font-bold text-foreground"
                >
                  {steps[currentStep].title}
                </motion.h2>
                
                <div className="flex items-center gap-6">
                  <span className="text-sm text-muted-foreground">
                    Step {currentStep + 1} of {steps.length}
                  </span>
                  <div className="flex gap-2">
                    {steps.map((_, index) => (
                      <motion.div
                        key={index}
                        initial={false}
                        animate={{
                          width: index === currentStep ? 32 : 8,
                          backgroundColor: 
                            index === currentStep 
                              ? "var(--primary)" 
                              : index < currentStep 
                              ? "var(--primary)" 
                              : "var(--muted)"
                        }}
                        className="h-2 rounded-full transition-all"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative flex-1 overflow-hidden">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={currentStep}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 300, damping: 30 },
                    opacity: { duration: 0.2 }
                  }}
                  className="absolute inset-0 overflow-y-auto px-8 py-6"
                >
                  <CurrentStepComponent data={data} updateData={updateData} />
                </motion.div>
              </AnimatePresence>
            </div>
            
            <div className="border-t border-border/50 px-8 py-6">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className={cn(
                    "min-w-[100px]",
                    currentStep === 0 && "invisible"
                  )}
                >
                  Back
                  {currentStep > 0 && <span className="ml-2 text-xs opacity-70">Esc</span>}
                </Button>
                
                <div className="flex items-center gap-3">
                  {currentStep === 0 && (
                    <Button
                      variant="outline"
                      onClick={handleComplete}
                      className="min-w-[100px]"
                    >
                      Skip Setup
                    </Button>
                  )}
                  
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    size="lg"
                    className="min-w-[160px] bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {currentStep === steps.length - 1 ? "Complete Setup" : "Continue"}
                    <span className="ml-2 text-xs opacity-70">↵</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}