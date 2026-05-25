"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div className="relative">
      <select
        className={cn(
          "flex h-10 w-full appearance-none rounded-lg border border-[var(--outline-variant)] bg-[rgba(255,255,255,0.04)] px-3 py-2 pr-8 text-sm text-[var(--on-surface)] outline-none transition-all cursor-pointer",
          "focus:border-[var(--primary)]/50 focus:bg-[rgba(var(--primary-rgb),0.06)] focus:shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.15)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]" />
    </div>
  )
})
Select.displayName = "Select"

export { Select }
