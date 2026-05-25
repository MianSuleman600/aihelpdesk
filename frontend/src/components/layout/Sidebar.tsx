"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Sparkles,
  Ticket,
  BookOpen,
  Settings,
  LogOut,
  Zap,
  BarChart3,
  Users,
  FileEdit,
  Upload,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/ai-chat", label: "AI Assistant", icon: Sparkles },
  { href: "/dashboard/tickets", label: "My Tickets", icon: Ticket },
  { href: "/dashboard/kb", label: "Knowledge Base", icon: BookOpen },
];

const ADMIN_NAV_ITEMS = [
  { href: "/dashboard/admin", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/admin/users", label: "Manage Users", icon: Users },
  { href: "/dashboard/admin/kb", label: "Manage KB", icon: FileEdit },
  { href: "/dashboard/admin/documents", label: "Documents", icon: Upload },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    // FIX 1: Changed h-screen to fixed height approach, ensure no overflow clipping
    <aside className="w-[240px] flex-shrink-0 flex flex-col border-r border-white/5 bg-[var(--surface-container-lowest)]">
      {/* Logo */}
      <div className="px-5 h-16 flex items-center gap-2.5 shrink-0 border-b border-white/5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))' }}
        >
          <Zap size={15} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="text-[15px] font-bold tracking-tight text-white leading-none">
          HelpDesk <span style={{ color: 'var(--primary)' }}>AI</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 min-h-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2.5 text-white/25">
          Main Menu
        </p>

        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (pathname.startsWith(item.href + "/") && item.href !== "/dashboard");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 relative",
                  active
                    ? "text-white"
                    : "text-white/45 hover:text-white/80 hover:bg-white/5"
                )}
                style={active ? {
                  background: 'rgba(var(--primary-rgb), 0.12)',
                  boxShadow: 'inset 0 0 0 1px rgba(var(--primary-rgb), 0.2)',
                } : undefined}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                    style={{
                      background: 'var(--primary)',
                      boxShadow: '0 0 8px rgba(var(--primary-rgb), 0.6)',
                    }}
                  />
                )}
                <item.icon
                  size={16}
                  strokeWidth={active ? 2.2 : 1.8}
                  style={{ color: active ? 'var(--primary)' : undefined, flexShrink: 0 }}
                />
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {user?.role === "admin" && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2.5 mt-6 text-white/25">
              Administration
            </p>
            <div className="space-y-0.5">
              {ADMIN_NAV_ITEMS.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 relative",
                      active
                        ? "text-white"
                        : "text-white/45 hover:text-white/80 hover:bg-white/5"
                    )}
                    style={active ? {
                      background: 'rgba(var(--primary-rgb), 0.12)',
                      boxShadow: 'inset 0 0 0 1px rgba(var(--primary-rgb), 0.2)',
                    } : undefined}
                  >
                    {active && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                        style={{ background: 'var(--primary)', boxShadow: '0 0 8px rgba(var(--primary-rgb), 0.6)' }}
                      />
                    )}
                    <item.icon
                      size={16}
                      strokeWidth={active ? 2.2 : 1.8}
                      style={{ color: active ? 'var(--primary)' : undefined, flexShrink: 0 }}
                    />
                    <span className="leading-none">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>

      <div className="shrink-0 px-3 pb-4 pt-3 border-t border-white/5 bg-[var(--surface-container-lowest)]">
        <Link
          href="/dashboard/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 mb-2",
            pathname.startsWith("/dashboard/settings")
              ? "text-white bg-white/5"
              : "text-white/40 hover:text-white/70 hover:bg-white/5"
          )}
        >
          <Settings size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          <span className="leading-none">Settings</span>
        </Link>

        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl group border border-white/5 bg-white/5">
          <div className="relative shrink-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold uppercase"
              style={{ background: 'rgba(var(--primary-rgb), 0.18)', color: 'var(--primary)' }}
            >
              {user?.name ? user.name.charAt(0) : "U"}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--surface-container-lowest)] bg-[var(--success)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white truncate leading-tight">
              {user?.name || "User"}
            </p>
            <p className="text-[11px] capitalize text-white/35 leading-tight mt-0.5">
              {user?.role || "User"}
            </p>
          </div>
          <button
            onClick={logout}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70"
            title="Log out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}