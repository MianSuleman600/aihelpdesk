"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { kbAPI, ticketsAPI, notificationsAPI } from "@/lib/api";
import type { KBArticle, Ticket, Notification } from "@/types";
import { TICKET_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/constants";
import {
  Search, Sparkles, BookOpen, Ticket as TicketIcon, Plus,
  ArrowRight, ChevronRight, Bell, TrendingUp, Clock,
  MessageSquare, BarChart3, ArrowUpRight,
} from "lucide-react";
import { cn, timeAgo, truncate } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function DashboardPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "admin";
  const isAgent = user?.role === "agent" || isAdmin;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const results = await Promise.allSettled([
          kbAPI.getArticles({ limit: 4 }),
          ticketsAPI.getAll({ limit: 5 }),
          notificationsAPI.getAll(true),
        ]);
        if (results[0].status === "fulfilled") setArticles(results[0].value);
        if (results[1].status === "fulfilled") setTickets(results[1].value);
        if (results[2].status === "fulfilled") setNotifications(results[2].value);
      } catch {
        // Silent fail — demo mode
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const quickActions = [
    {
      title: "Chat with AI",
      desc: "Get instant answers from our knowledge base",
      icon: Sparkles,
      href: "/dashboard/ai-chat",
      gradient: "from-violet-500/20 to-purple-500/20",
      iconColor: "text-violet-400",
    },
    {
      title: "Knowledge Base",
      desc: "Browse articles, guides & documentation",
      icon: BookOpen,
      href: "/dashboard/kb",
      gradient: "from-blue-500/20 to-cyan-500/20",
      iconColor: "text-blue-400",
    },
    {
      title: "Create Ticket",
      desc: "Submit a new support request",
      icon: TicketIcon,
      href: "/dashboard/tickets/new",
      gradient: "from-emerald-500/20 to-teal-500/20",
      iconColor: "text-emerald-400",
    },
  ];

  const stats = isAgent
    ? [
        { label: "Open Tickets", value: tickets.filter((t) => t.status === "open").length, icon: TicketIcon, color: "text-violet-400", bg: "bg-violet-500/10" },
        { label: "In Progress", value: tickets.filter((t) => t.status === "in_progress").length, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
        { label: "Resolved", value: tickets.filter((t) => t.status === "resolved").length, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
        { label: "Total", value: tickets.length, icon: BarChart3, color: "text-blue-400", bg: "bg-blue-500/10" },
      ]
    : [
        { label: "My Tickets", value: tickets.length, icon: TicketIcon, color: "text-violet-400", bg: "bg-violet-500/10" },
        { label: "Open", value: tickets.filter((t) => t.status === "open").length, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
        { label: "Resolved", value: tickets.filter((t) => t.status === "resolved").length, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
      ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* ── Hero Section ── */}
      <section className="relative overflow-hidden rounded-2xl p-8 sm:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/20 via-[var(--surface-container)]/80 to-purple-900/15 rounded-2xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(124,92,250,0.15),transparent_60%)]" />
        <div className="absolute top-0 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-[rgba(192,193,255,0.3)] to-transparent" />

        <div className="relative z-10 max-w-2xl">
          <p className="text-sm font-medium text-[var(--primary)] mb-2">{getGreeting()}</p>
          <h1 className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight">
            Welcome back, {user?.name?.split(" ")[0] || "User"}
          </h1>
          <p className="text-[var(--on-surface-variant)] text-base mb-6 leading-relaxed">
            Search our knowledge base, chat with AI, or create a support ticket.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (searchQuery.trim())
                window.location.href = `/dashboard/kb?search=${encodeURIComponent(searchQuery)}`;
            }}
            className="relative max-w-lg"
          >
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="How can we help you today?"
              className="w-full py-3 pl-11 pr-4 rounded-xl bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.1)] text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/50 outline-none focus:bg-[rgba(255,255,255,0.1)] focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/20 transition-all text-sm"
            />
          </form>
        </div>
      </section>

      {/* ── Quick Actions ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickActions.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="group h-full hover:border-[var(--primary)]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[var(--primary)]/5 cursor-pointer">
              <CardContent className="p-6">
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br", item.gradient)}>
                  <item.icon size={22} className={item.iconColor} />
                </div>
                <h3 className="text-base font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-[var(--on-surface-variant)] leading-relaxed">{item.desc}</p>
                <div className="flex items-center gap-1.5 mt-4 text-sm font-medium text-[var(--primary)] opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-1">
                  Get started <ArrowRight size={14} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      {/* ── Stats ── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", stat.bg)}>
                  <stat.icon size={18} className={stat.color} />
                </div>
                {loading && <Skeleton className="h-8 w-10" />}
              </div>
              <p className="text-xs font-medium text-[var(--on-surface-variant)] uppercase tracking-wider mb-1">{stat.label}</p>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      {/* ── Recent Tickets ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Recent Tickets</h2>
            <p className="text-sm text-[var(--on-surface-variant)]">Your latest support requests</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/tickets" className="flex items-center gap-1.5">
              View all <ChevronRight size={14} />
            </Link>
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 flex-1" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : tickets.length > 0 ? (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <th className="text-left py-3 px-5 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">ID</th>
                    <th className="text-left py-3 px-5 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Subject</th>
                    <th className="text-left py-3 px-5 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Status</th>
                    <th className="text-left py-3 px-5 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Priority</th>
                    <th className="text-left py-3 px-5 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => {
                    const statusVariant = ticket.status === "resolved" ? "success" : ticket.status === "open" ? "default" : "warning";
                    const prioVariant = ticket.priority === "high" ? "danger" : ticket.priority === "low" ? "success" : "warning";
                    return (
                      <tr
                        key={ticket.id}
                        className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.03)] transition-colors cursor-pointer group"
                        onClick={() => (window.location.href = `/dashboard/tickets/${ticket.id}`)}
                      >
                        <td className="py-3.5 px-5 font-mono text-xs text-[var(--primary)]">
                          #{ticket.id.slice(0, 8)}
                        </td>
                        <td className="py-3.5 px-5 font-medium group-hover:text-[var(--primary)] transition-colors">
                          {truncate(ticket.subject, 45)}
                        </td>
                        <td className="py-3.5 px-5">
                          <Badge variant={statusVariant}>
                            {TICKET_STATUS_CONFIG[ticket.status]?.label}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5">
                          <Badge variant={prioVariant}>
                            {PRIORITY_CONFIG[ticket.priority]?.label}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5 text-[var(--on-surface-variant)] text-xs">
                          {timeAgo(ticket.updated_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={TicketIcon}
              title="No tickets yet"
              description="You haven't created any support tickets. Get started by creating your first one."
            >
              <Button asChild>
                <Link href="/dashboard/tickets/new">
                  <Plus size={16} /> Create your first ticket
                </Link>
              </Button>
            </EmptyState>
          </Card>
        )}
      </section>

      {/* ── Bottom Grid: Notifications + KB Articles ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notifications */}
        {isAgent && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/notifications" className="flex items-center gap-1.5">
                  View all <ChevronRight size={14} />
                </Link>
              </Button>
            </div>
            <Card>
              <CardContent className="p-4 space-y-2">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-3 p-3">
                      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))
                ) : notifications.length > 0 ? (
                  notifications.slice(0, 4).map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg transition-colors",
                        notif.is_read
                          ? "hover:bg-[rgba(255,255,255,0.03)]"
                          : "bg-[var(--primary)]/5 border border-[var(--primary)]/15"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        notif.is_read ? "bg-[rgba(255,255,255,0.06)]" : "bg-[var(--primary)]/15"
                      )}>
                        <Bell size={14} className={notif.is_read ? "text-[var(--on-surface-variant)]" : "text-[var(--primary)]"} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{notif.title}</p>
                        <p className="text-xs text-[var(--on-surface-variant)] mt-0.5 line-clamp-1">
                          {truncate(notif.message, 60)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-sm text-[var(--on-surface-variant)]">
                    No new notifications
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* KB Articles */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Popular Articles</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/kb" className="flex items-center gap-1.5">
                Browse all <ChevronRight size={14} />
              </Link>
            </Button>
          </div>
          <Card>
            <CardContent className="p-4 space-y-1">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-3">
                    <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))
              ) : articles.length > 0 ? (
                articles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/dashboard/kb/${article.id}`}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                      <BookOpen size={16} className="text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug group-hover:text-[var(--primary)] transition-colors line-clamp-1">
                        {article.title}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[var(--on-surface-variant)]">
                        <span>{article.view_count} views</span>
                        <span>{timeAgo(article.updated_at)}</span>
                      </div>
                    </div>
                    <ArrowUpRight size={14} className="text-[var(--on-surface-variant)] opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                  </Link>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-[var(--on-surface-variant)]">
                  No articles published yet
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}