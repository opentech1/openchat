import { cn } from "@/lib/utils";

interface StepperProps {
	steps: number;
	currentStep: number;
	className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
	return (
		<div className={cn("flex items-center justify-center gap-2", className)}>
			{Array.from({ length: steps }).map((_, index) => {
				const stepNumber = index + 1;
				const isCompleted = stepNumber < currentStep;
				const isCurrent = stepNumber === currentStep;

				return (
					<div
						key={index}
						className={cn(
							"h-2 w-2 rounded-full transition-all duration-300",
							{
								"bg-primary": isCurrent,
								"bg-primary/50": isCompleted,
								"bg-muted": !isCurrent && !isCompleted,
							},
						)}
						aria-current={isCurrent ? "step" : undefined}
						aria-label={`Step ${stepNumber} of ${steps}`}
					/>
				);
			})}
		</div>
	);
}
