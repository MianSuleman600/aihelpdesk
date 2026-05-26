"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { kbAPI, ticketsAPI, notificationsAPI } from "@/lib/api";
import type { KBArticle, Ticket, Notification } from "@/types";
import {
  Search, Sparkles, BookOpen, Ticket as TicketIcon, Plus,
  ArrowRight, ChevronRight, Bell, TrendingUp, Clock,
  BarChart3, ArrowUpRight,
} from "lucide-react";
import { cn, timeAgo, truncate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateTicketModal } from "@/components/tickets/CreateTicketModal";

import { Badge } from "@/components/ui/badge";

function SectionHeader({ title, subtitle, href, linkLabel }: {
  title: string; subtitle?: string; href?: string; linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h2 className="text-[13px] font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-[11px] text-white/35 mt-0.5">{subtitle}</p>}
      </div>
      {href && linkLabel && (
        <Link href={href} className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/60 transition-colors">
          {linkLabel} <ChevronRight size={11} />
        </Link>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);

  const isAdmin = user?.role === "admin";
  const isAgent = isAdmin || user?.role === "agent";

  useEffect(() => {
    (async () => {
      try {
        const [a, t, n] = await Promise.allSettled([
          kbAPI.getArticles({ limit: 4 }),
          ticketsAPI.getAll({ limit: 5 }),
          notificationsAPI.getAll({ unread_only: true }),
        ]);
        if (a.status === "fulfilled") setArticles(a.value.items);
        if (t.status === "fulfilled") setTickets(t.value.items);
        if (n.status === "fulfilled") setNotifications(n.value.items);
      } catch { /* empty */ } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = isAgent
    ? [
        { label: "Open",        value: tickets.filter((t) => t.status === "open").length,        icon: TicketIcon, color: "text-[var(--primary)]", bg: "bg-[var(--primary)]/10" },
        { label: "In Progress", value: tickets.filter((t) => t.status === "in_progress").length, icon: Clock,      color: "text-[var(--warning)]",  bg: "bg-[var(--warning)]/10" },
        { label: "Resolved",    value: tickets.filter((t) => t.status === "resolved").length,    icon: TrendingUp, color: "text-[var(--success)]", bg: "bg-[var(--success)]/10" },
        { label: "Total",       value: tickets.length,                                           icon: BarChart3,  color: "text-[var(--primary-light)]", bg: "bg-[var(--primary-light)]/10" },
      ]
    : [
        { label: "My Tickets", value: tickets.length,                                           icon: TicketIcon, color: "text-white/70",    bg: "bg-white/5" },
        { label: "Open",       value: tickets.filter((t) => t.status === "open").length,        icon: Clock,      color: "text-[var(--warning)]",  bg: "bg-[var(--warning)]/10" },
        { label: "Resolved",   value: tickets.filter((t) => t.status === "resolved").length,    icon: TrendingUp, color: "text-[var(--success)]", bg: "bg-[var(--success)]/10" },
      ];

  const quickActions = [
    { title: "Chat with AI",    desc: "Instant answers from the knowledge base", icon: Sparkles,    href: "/dashboard/ai-chat" },
    { title: "Knowledge Base",  desc: "Browse guides and documentation",          icon: BookOpen,    href: "/dashboard/kb" },
    { title: "Create Ticket",   desc: "Submit a new support request",             icon: TicketIcon,  href: null, onClick: () => setShowNewTicket(true) },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative rounded-2xl p-4 sm:p-6 overflow-hidden border border-[var(--primary)]/15"
        style={{ background: 'linear-gradient(135deg, rgba(var(--primary-rgb),0.10) 0%, rgba(var(--primary-rgb),0.04) 60%, transparent 100%)' }}
      >
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-60 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(var(--primary-rgb),0.15) 0%, transparent 70%)', transform: 'translate(25%, -25%)' }}
        />

        <div className="relative z-10">
          <Badge variant="primary" dot className="mb-4">AI-Powered Support</Badge>

          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1.5 leading-tight">
            How can we help you <span className="text-[var(--primary)]">today?</span>
          </h1>
          <p className="text-[13px] text-white/45 mb-5">
            Search the knowledge base, chat with AI, or open a ticket.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim()) window.location.href = `/dashboard/kb?search=${encodeURIComponent(searchQuery)}`;
            }}
            className="flex items-center gap-2 max-w-sm"
          >
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for answers..."
                className="w-full h-10 pl-9 pr-3 rounded-lg text-[13px] outline-none text-white placeholder-white/30 border border-white/10 bg-white/5 focus:border-[var(--primary)]/40 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
              />
            </div>
            <button type="submit" className="btn-primary h-10 px-5 rounded-lg text-[13px]">
              Search
            </button>
          </form>
        </div>
      </section>

      {/* ── QUICK ACTIONS ──────────────────────────────────────── */}
      <section>
        <SectionHeader title="Quick Actions" subtitle="Jump into something" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {quickActions.map((item, i) => {
            const inner = (
              <div className="glass-card p-4 h-full transition-all duration-200 hover:border-[var(--primary)]/20 hover:-translate-y-0.5 group">
                <div className="w-9 h-9 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center mb-3">
                  <item.icon size={16} style={{ color: 'var(--primary)' }} />
                </div>
                <h3 className="text-[13px] font-semibold text-white mb-0.5">{item.title}</h3>
                <p className="text-[11px] text-white/40 leading-snug">{item.desc}</p>
                <div className="flex items-center gap-1 mt-3 text-[11px] font-semibold text-[var(--primary)] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                  Open <ArrowRight size={11} />
                </div>
              </div>
            );

            return item.href ? (
              <Link key={item.href} href={item.href} className="block">{inner}</Link>
            ) : (
              <button key={i} onClick={item.onClick} className="text-left w-full">{inner}</button>
            );
          })}
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Overview" subtitle="Your ticket activity at a glance" />
        <div className={cn("grid gap-2.5", isAgent ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3")}>
          {stats.map((stat, i) => (
            <div key={i} className="glass-card p-4">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-3", stat.bg)}>
                <stat.icon size={15} className={stat.color} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35 mb-1.5">{stat.label}</p>
              {loading ? (
                <Skeleton className="h-7 w-10" />
              ) : (
                <p className="text-2xl font-bold text-white tabular-nums leading-none">{stat.value}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── RECENT TICKETS ─────────────────────────────────────── */}
      <section>
        <SectionHeader title="Recent Tickets" subtitle="Latest support requests" href="/dashboard/tickets" linkLabel="View all" />

        {loading ? (
          <div className="glass-card p-4 space-y-3">
            {[1, 2, 3].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-14" />
              </div>
            ))}
          </div>
        ) : tickets.length > 0 ? (
          <div className="glass-card overflow-hidden">
            {tickets.map((ticket, idx) => (
              <div
                key={ticket.id}
                onClick={() => window.location.href = `/dashboard/tickets/${ticket.id}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5",
                  idx < tickets.length - 1 && "border-b border-white/5"
                )}
              >
                <span className="font-mono text-[11px] text-[var(--primary)] shrink-0">
                  #{ticket.id.slice(0, 8)}
                </span>
                <span className="flex-1 text-[12px] text-white/65 truncate">{truncate(ticket.subject, 40)}</span>
                <Badge status={ticket.status} />
                <Badge priority={ticket.priority} />
                <span className="text-[11px] text-white/25 shrink-0 hidden sm:block">{timeAgo(ticket.updated_at)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-8 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center mb-3">
              <TicketIcon size={18} className="text-[var(--primary)]" />
            </div>
            <p className="text-[13px] font-semibold text-white mb-1">No tickets yet</p>
            <p className="text-[12px] text-white/40 mb-4">Submit your first request to get started.</p>
            <button onClick={() => setShowNewTicket(true)} className="btn-primary h-9 px-4 rounded-lg text-[12px]">
              <Plus size={14} /> Create ticket
            </button>
          </div>
        )}
      </section>

      {/* ── NOTIFICATIONS + ARTICLES ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-2">
        {isAgent && (
          <section>
            <SectionHeader title="Notifications" href="/dashboard/notifications" linkLabel="View all" />
            <div className="glass-card">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-2.5 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : notifications.length > 0 ? (
                notifications.slice(0, 4).map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0",
                      !notif.is_read && "bg-[var(--primary)]/5"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      notif.is_read ? "bg-white/5" : "bg-[var(--primary)]/10"
                    )}>
                      <Bell size={12} className={notif.is_read ? "text-white/25" : "text-[var(--primary)]"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-white leading-snug">{notif.title}</p>
                      <p className="text-[11px] text-white/35 mt-0.5 truncate">{truncate(notif.message, 60)}</p>
                    </div>
                    {!notif.is_read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] mt-2 shrink-0" />
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-[12px] text-white/25">No new notifications</div>
              )}
            </div>
          </section>
        )}

        <section className={!isAgent ? "lg:col-span-2" : ""}>
          <SectionHeader title="Popular Articles" href="/dashboard/kb" linkLabel="Browse all" />
          <div className="glass-card">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2.5 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : articles.length > 0 ? (
              articles.map((article, idx) => (
                <Link
                  key={article.id}
                  href={`/dashboard/kb/${article.id}`}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 group transition-colors hover:bg-white/5",
                    idx < articles.length - 1 && "border-b border-white/5"
                  )}
                >
                  <div className="w-7 h-7 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <BookOpen size={12} className="text-[var(--primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-white/65 group-hover:text-white transition-colors line-clamp-1">
                      {article.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-white/30">
                      <span>{article.view_count} views</span>
                      <span>·</span>
                      <span>{timeAgo(article.updated_at)}</span>
                    </div>
                  </div>
                  <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-60 transition-opacity mt-0.5 shrink-0 text-white/50" />
                </Link>
              ))
            ) : (
              <div className="py-8 text-center text-[12px] text-white/25">No articles published yet</div>
            )}
          </div>
        </section>
      </div>

      <CreateTicketModal open={showNewTicket} onClose={() => setShowNewTicket(false)} />
    </div>
  );
}