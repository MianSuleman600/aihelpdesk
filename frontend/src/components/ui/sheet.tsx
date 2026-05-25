"use client"

import * as React from "react"
import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface SheetProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  side?: "left" | "right"
}

function Sheet({ open, onClose, children, side = "left" }: SheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (open) {
      document.addEventListener("keydown", handleEscape)
    }
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed top-0 bottom-0 w-[280px] max-w-[85vw] bg-[var(--surface)] border-r border-white/5 shadow-2xl animate-slide-in z-50",
          side === "left" ? "left-0" : "right-0"
        )}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors z-10"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  )
}

export { Sheet }
