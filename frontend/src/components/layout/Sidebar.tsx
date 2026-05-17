"use client";
/* ============================================================
   Sidebar Navigation — matches Stitch Design 1 sidebar
   ============================================================ */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, Sparkles, Ticket, Bell,
  BarChart3, Users, FileEdit, LogOut, HelpCircle, Settings, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn, getInitials } from "@/lib/utils";
import { NAV_ITEMS, ADMIN_NAV_ITEMS, APP_NAME } from "@/lib/constants";
import { useState } from "react";

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, BookOpen, Sparkles, Ticket, Bell,
  BarChart3, Users, FileEdit, Settings, HelpCircle,
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = user?.role === "admin";
  const isAgent = user?.role === "agent" || isAdmin;

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-40 flex flex-col glass transition-all duration-300"
      style={{
        width: collapsed ? 72 : "var(--sidebar-width)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-white" />
        </div>
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight gradient-text">{APP_NAME}</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = ICON_MAP[item.icon] || LayoutDashboard;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-[var(--indigo)]/15 text-[var(--primary)] border border-[var(--indigo)]/20"
                    : "text-[var(--on-surface-variant)] hover:bg-white/5 hover:text-[var(--on-surface)] border border-transparent",
                )}
              >
                <Icon size={20} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className="my-4 mx-3 border-t border-white/5" />
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)]/60">
                Administration
              </p>
            )}
            <div className="space-y-1">
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = ICON_MAP[item.icon] || LayoutDashboard;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-[var(--indigo)]/15 text-[var(--primary)] border border-[var(--indigo)]/20"
                        : "text-[var(--on-surface-variant)] hover:bg-white/5 hover:text-[var(--on-surface)] border border-transparent",
                    )}
                  >
                    <Icon size={20} className="shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mx-3 mb-2 p-2 rounded-lg text-[var(--on-surface-variant)] hover:bg-white/5 transition-colors flex items-center justify-center"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      {/* User footer */}
      <div className="px-3 pb-4 border-t border-white/5 pt-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
            {getInitials(user?.name || "U")}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-[var(--on-surface-variant)] capitalize">{user?.role}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={logout}
              className="p-2 rounded-lg text-[var(--on-surface-variant)] hover:text-[var(--rose)] hover:bg-white/5 transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
