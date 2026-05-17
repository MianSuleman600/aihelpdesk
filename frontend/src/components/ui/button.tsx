import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* ============================================================
   Button — shadcn-style with design system variants
   ============================================================ */

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shadow-md hover:shadow-lg hover:shadow-[var(--primary)]/25 active:scale-[0.98]",
        secondary:
          "bg-[rgba(255,255,255,0.05)] text-[var(--on-surface)] border border-[var(--outline-variant)] hover:bg-[rgba(255,255,255,0.1)] hover:border-[var(--outline)]",
        ghost:
          "text-[var(--on-surface-variant)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--on-surface)]",
        destructive:
          "bg-[var(--danger)] text-white hover:bg-[var(--danger)]/90 shadow-md",
        outline:
          "border border-[var(--outline-variant)] text-[var(--on-surface)] hover:bg-[rgba(255,255,255,0.05)]",
        link:
          "text-[var(--primary)] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs rounded-md",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
