import * as React from "react";
import { cn } from "@/lib/utils";

/* ============================================================
   Skeleton — loading placeholder with shimmer
   ============================================================ */

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg bg-gradient-to-r from-[var(--surface-container)] via-[var(--surface-container-high)] to-[var(--surface-container)] bg-[length:200%_100%] animate-[shimmer_1.5s_infinite]",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
