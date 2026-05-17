"use client";
/* ============================================================
   Header bar with search + notifications
   ============================================================ */

import { useState } from "react";
import { Search, Bell, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getInitials } from "@/lib/utils";

export default function Header() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/dashboard/kb?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 glass"
      style={{
        height: "var(--header-height)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xl">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]" />
          <input
            type="text"
            placeholder="Search knowledge base or ask AI…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10 pr-10 py-2.5 text-sm"
            style={{ background: "rgba(255,255,255,0.04)" }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </form>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <button
          onClick={() => router.push("/dashboard/notifications")}
          className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          <Bell size={20} className="text-[var(--on-surface-variant)]" />
          <span className="absolute top-1 right-1 w-4 h-4 bg-[var(--rose)] rounded-full text-[10px] font-bold flex items-center justify-center text-white">
            3
          </span>
        </button>

        {/* User avatar */}
        <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold cursor-pointer">
          {getInitials(user?.name || "U")}
        </div>
      </div>
    </header>
  );
}
