import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { TICKET_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/constants";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "bg-[var(--primary)]/15 text-[var(--primary)]",
        primary: "bg-[var(--primary)]/15 text-[var(--primary)]",
        success: "bg-[var(--success)]/15 text-[var(--success)]",
        warning: "bg-[var(--warning)]/15 text-[var(--warning)]",
        danger: "bg-[var(--danger)]/15 text-[var(--danger)]",
        outline: "border border-[var(--outline-variant)] text-[var(--on-surface-variant)]",
        secondary: "bg-[rgba(255,255,255,0.06)] text-[var(--on-surface-variant)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const STATUS_MAP: Record<string, string> = {
  open: "primary",
  in_progress: "warning",
  waiting: "warning",
  resolved: "success",
  closed: "secondary",
};

const PRIORITY_MAP: Record<string, string> = {
  high: "danger",
  medium: "warning",
  low: "primary",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  status?: string;
  priority?: string;
  dot?: boolean;
}

function Badge({ className, variant, status, priority, dot, children, ...props }: BadgeProps) {
  if (status) {
    const cfg = TICKET_STATUS_CONFIG[status];
    return (
      <div className={cn(badgeVariants({ variant: STATUS_MAP[status] as any }), className)} {...props}>
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", status === "closed" ? "bg-white/30" : "bg-current")} />
        {cfg?.label ?? status}
      </div>
    );
  }
  if (priority) {
    const cfg = PRIORITY_CONFIG[priority];
    return (
      <div className={cn(badgeVariants({ variant: PRIORITY_MAP[priority] as any }), className)} {...props}>
        {cfg?.label ?? priority}
      </div>
    );
  }
  return (
    <div className={cn(badgeVariants({ variant }), dot && "gap-1.5", className)} {...props}>
      {dot && <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-current" />}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
