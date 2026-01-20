import * as React from "react";

import { cn } from "@/lib/utils";

type SwitchProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type">;

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, defaultChecked, onCheckedChange, disabled, ...props }, ref) => {
    const [uncontrolledChecked, setUncontrolledChecked] = React.useState(!!defaultChecked);
    const isControlled = typeof checked === "boolean";
    const isChecked = isControlled ? checked : uncontrolledChecked;

    const handleToggle = () => {
      if (disabled) return;
      const next = !isChecked;
      if (!isControlled) {
        setUncontrolledChecked(next);
      }
      onCheckedChange?.(next);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isChecked}
        data-state={isChecked ? "checked" : "unchecked"}
        disabled={disabled}
        className={cn(
          "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
        onClick={handleToggle}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none block size-5 translate-x-0 rounded-full bg-background shadow-lg ring-0 transition-transform",
            isChecked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
