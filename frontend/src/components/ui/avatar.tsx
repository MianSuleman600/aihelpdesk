"use client"

import * as React from "react"
import { cn, getInitials } from "@/lib/utils"

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string
  src?: string | null
  size?: "sm" | "md" | "lg"
}

const sizeMap = {
  sm: "w-7 h-7 text-[10px]",
  md: "w-9 h-9 text-xs",
  lg: "w-12 h-12 text-sm",
}

function Avatar({ className, name, src, size = "sm", ...props }: AvatarProps) {
  if (src) {
    return (
      <div
        className={cn("rounded-full overflow-hidden shrink-0", sizeMap[size], className)}
        {...props}
      >
        <img src={src} alt={name || "Avatar"} className="w-full h-full object-cover" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center text-white font-bold shrink-0",
        sizeMap[size],
        className
      )}
      {...props}
    >
      {name ? getInitials(name) : "?"}
    </div>
  )
}
Avatar.displayName = "Avatar"

export { Avatar }
