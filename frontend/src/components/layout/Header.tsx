"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { Search, Plus, ChevronRight, Menu } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { CreateTicketModal } from "@/components/tickets/CreateTicketModal"
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown"

const ROUTE_META: Record<string, { title: string }> = {
  "/dashboard": { title: "Dashboard" },
  "/dashboard/ai-chat": { title: "AI Assistant" },
  "/dashboard/tickets": { title: "My Tickets" },
  "/dashboard/kb": { title: "Knowledge Base" },
  "/dashboard/settings": { title: "Settings" },
  "/dashboard/notifications": { title: "Notifications" },
  "/dashboard/admin": { title: "Analytics" },
  "/dashboard/admin/tickets": { title: "Ticket Queue" },
  "/dashboard/admin/users": { title: "Manage Users" },
  "/dashboard/admin/kb": { title: "Manage KB" },
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "morning"
  if (h < 17) return "afternoon"
  return "evening"
}

interface HeaderProps {
  onMenuToggle?: () => void
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [showNewTicket, setShowNewTicket] = useState(false)

  const meta = ROUTE_META[pathname] ?? { title: "Dashboard" }
  const isHome = pathname === "/dashboard"

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/dashboard/kb?search=${encodeURIComponent(searchQuery)}`)
      setSearchOpen(false)
    }
  }

  return (
    <header className="h-14 md:h-16 flex items-center justify-between px-3 md:px-6 gap-2 border-b border-white/5 shrink-0 bg-[var(--surface-container-lowest)]">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors -ml-1"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>

        {!isHome && (
          <>
            <Link href="/dashboard" className="hidden sm:inline text-[13px] text-white/35 hover:text-white/60 transition-colors shrink-0">
              Home
            </Link>
            <ChevronRight size={12} className="hidden sm:block text-white/20 shrink-0" />
          </>
        )}
        <h1 className="text-[14px] font-semibold text-white truncate">
          {isHome
            ? `Good ${getGreeting()}, ${user?.name?.split(" ")[0] ?? "User"}`
            : meta.title}
        </h1>
      </div>

      {/* Right: search + actions */}
      <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0">
        {/* Mobile search toggle */}
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          aria-label="Search"
        >
          <Search size={16} />
        </button>

        {/* Desktop search */}
        <form onSubmit={handleSearch} className="hidden md:block relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/25" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search anything..."
            className="h-9 pl-8 pr-4 text-[12px] rounded-lg outline-none transition-all text-white placeholder-white/25 w-[180px] lg:w-[220px] bg-white/5 border border-white/10 hover:border-white/20 focus:border-[var(--primary)]/50 focus:bg-[rgba(var(--primary-rgb),0.06)]"
          />
        </form>

        {/* New Ticket button */}
        <button
          onClick={() => setShowNewTicket(true)}
          className="hidden sm:flex items-center gap-1.5 h-9 px-3 lg:px-4 rounded-lg text-[12px] font-semibold text-white btn-primary active:scale-95 shrink-0"
        >
          <Plus size={13} strokeWidth={2.5} />
          <span className="hidden lg:inline">New Ticket</span>
        </button>

        <button
          onClick={() => setShowNewTicket(true)}
          className="sm:hidden p-2 rounded-lg btn-primary"
          aria-label="New ticket"
        >
          <Plus size={16} />
        </button>

        <div className="flex items-center justify-center rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-colors">
          <NotificationDropdown />
        </div>
      </div>

      {/* Mobile search bar */}
      {searchOpen && (
        <div className="fixed left-0 right-0 top-14 z-30 p-3 border-b border-white/5 animate-fade-in bg-[var(--surface-container-lowest)]">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search anything..."
              className="flex-1 h-10 px-4 text-sm rounded-lg outline-none text-white placeholder-white/30 bg-white/5 border border-white/10 focus:border-[var(--primary)]/50"
              autoFocus
            />
            <button type="submit" className="btn-primary h-10 px-4 rounded-lg text-sm">
              Go
            </button>
          </form>
        </div>
      )}

      <CreateTicketModal open={showNewTicket} onClose={() => setShowNewTicket(false)} />
    </header>
  )
}
