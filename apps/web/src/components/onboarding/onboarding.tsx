"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { setOnboardingStatus, setOnboardingData, getOnboardingData, type OnboardingData as CookieOnboardingData } from "@/lib/cookies"
import { useTheme } from "@/components/theme-provider-simple"
import { cn } from "@/lib/utils"
import { X, AlertCircle } from "lucide-react"
import { WelcomeStep } from "./steps/welcome-step"
import { ProfileStep } from "./steps/profile-step"
// import { ThemeStep } from "./steps/theme-step"
import { WorkspaceStep } from "./steps/workspace-step"
import { CompleteStep } from "./steps/complete-step"
import { SkipConfirmStep } from "./steps/skip-confirm-step"

interface OnboardingProps {
  onComplete: () => void
}

export interface OnboardingData {
  userName: string
  // theme: string
  theme: string // Keep for compatibility but won't be used
  workspaceLayout: string
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const { theme } = useTheme() // Get current theme to trigger re-renders
  const [currentStep, setCurrentStep] = useState(0)
  const [direction, setDirection] = useState(0)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const [data, setData] = useState<OnboardingData>({
    userName: "",
    theme: "",
    workspaceLayout: ""
  })

  // Load saved onboarding data on mount
  useEffect(() => {
    const savedData = getOnboardingData()
    if (savedData.userName || savedData.theme || savedData.workspaceLayout) {
      setData(savedData)
    }
  }, [])

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
    // {
    //   id: "theme",
    //   title: "Choose Your Style",
    //   component: ThemeStep
    // },
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

  const CurrentStepComponent = showSkipConfirm 
    ? SkipConfirmStep 
    : steps[currentStep].component

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
    const newData = { ...data, ...updates }
    setData(newData)
    // Save to localStorage immediately when data changes
    setOnboardingData(updates)
  }

  const canProceed = () => {
    switch (steps[currentStep].id) {
      case "welcome":
        return true
      case "profile":
        return data.userName.trim().length > 0
      // case "theme":
      //   return data.theme !== ""
      case "workspace":
        return data.workspaceLayout !== ""
      default:
        return true
    }
  }

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (showSkipConfirm) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setShowSkipConfirm(false)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          handleComplete()
        }
        return
      }
      
      if (e.key === 'Enter' && canProceed() && !e.defaultPrevented) {
        handleNext()
      } else if (e.key === 'Escape') {
        if (currentStep > 0) {
          handleBack()
        } else {
          setShowSkipConfirm(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [currentStep, canProceed, showSkipConfirm])


  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '50%' : '-50%',
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '50%' : '-50%',
      opacity: 0
    })
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background overflow-hidden">
        <div className="flex h-full w-full flex-col lg:flex-row">
          {/* Left side - Onboarding content */}
          <div className="relative flex h-full w-full flex-col lg:w-[50%] overflow-hidden">
            <div className="flex h-full flex-col justify-between p-6 sm:p-8 lg:p-12 xl:p-16">
            {/* Header section */}
            <div className="flex-shrink-0 space-y-4">
              <div className="flex justify-center lg:justify-start">
                <div className="flex gap-2">
                  {steps.map((_, index) => (
                    <motion.div
                      key={index}
                      className="h-2 rounded-full bg-primary"
                      animate={{
                        width: index === currentStep ? 32 : 8,
                        opacity: index <= currentStep ? 1 : 0.3
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  ))}
                </div>
              </div>

              {!showSkipConfirm && (
                <div className="text-center lg:text-left">
                  <motion.h2 
                    key={steps[currentStep].title}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl font-bold text-foreground sm:text-3xl"
                  >
                    {steps[currentStep].title}
                  </motion.h2>
                  <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                    Step {currentStep + 1} of {steps.length}
                  </p>
                </div>
              )}
            </div>
            
            {/* Content section - flex-1 to take available space */}
            <div className="flex-1 relative overflow-hidden">
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
                  className="absolute inset-0 flex items-center justify-center p-6"
                >
                  <div className="w-full">
                    {showSkipConfirm ? (
                    <SkipConfirmStep 
                      onConfirm={handleComplete}
                      onCancel={() => setShowSkipConfirm(false)}
                    />
                  ) : (
                    <CurrentStepComponent data={data} updateData={updateData} />
                  )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            
            {/* Footer section - buttons */}
            {!showSkipConfirm && (
              <div className="flex-shrink-0 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between pt-4">
                {currentStep === 0 ? (
                  <Button
                    key={`skip-${theme}`}
                    variant="outline"
                    onClick={() => setShowSkipConfirm(true)}
                    className="w-full sm:w-auto"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Skip Setup
                    <span className="ml-2 text-xs opacity-50 border-l pl-2">Esc</span>
                  </Button>
              ) : (
                <Button
                  key={`back-${theme}`}
                  variant="outline"
                  onClick={handleBack}
                  className="w-full sm:w-auto"
                >
                  Back
                  <span className="ml-2 text-xs opacity-50 border-l pl-2">Esc</span>
                </Button>
              )}
              
              <Button
                key={`continue-${theme}`} // Force re-render when theme changes
                onClick={handleNext}
                disabled={!canProceed()}
                size="lg"
                className="w-full sm:w-auto sm:min-w-[160px]"
                style={{
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
                {currentStep === steps.length - 1 ? "Complete Setup" : "Continue"}
                <span className="ml-2 text-xs opacity-70">↵</span>
              </Button>
            </div>
          )}
            </div>
          </div>

          {/* Right side - Visual */}
        <div className="relative hidden lg:block lg:w-[50%]">
          <div className="absolute inset-0 bg-gradient-to-br from-muted/50 via-background to-muted/50" />
          
          <div className="relative h-full w-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-chart-2/5" />
            
            <div className="relative flex h-full flex-col items-center justify-center p-12">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <div className="mb-8 inline-flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                    <div className="h-16 w-16 rounded-full bg-primary/20" />
                  </div>
                  <h2 className="mb-4 text-4xl font-bold text-foreground">
                    {steps[currentStep].id === "welcome" && "Welcome aboard!"}
                    {steps[currentStep].id === "profile" && "Personalize your experience"}
                    {/* {steps[currentStep].id === "theme" && "Make it yours"} */}
                    {steps[currentStep].id === "workspace" && "Your perfect workspace"}
                    {steps[currentStep].id === "complete" && "All set!"}
                  </h2>
                  <p className="mx-auto max-w-md text-lg text-muted-foreground">
                    {steps[currentStep].id === "welcome" && "Let's get you started with OpenChat"}
                    {steps[currentStep].id === "profile" && "Tell us a bit about yourself"}
                    {/* {steps[currentStep].id === "theme" && "Choose a theme that suits you"} */}
                    {steps[currentStep].id === "workspace" && "Configure your ideal layout"}
                    {steps[currentStep].id === "complete" && "You're ready to start chatting!"}
                  </p>
                </motion.div>
              </AnimatePresence>

              <div className="absolute bottom-12 flex gap-2">
                {steps.map((_, index) => (
                  <motion.div
                    key={index}
                    className="h-2 rounded-full bg-primary"
                    animate={{
                      width: index === currentStep ? 24 : 8,
                      opacity: index === currentStep ? 1 : 0.3
                    }}
                    transition={{ duration: 0.3 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  )
}