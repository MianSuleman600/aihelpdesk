"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ticketsAPI } from "@/lib/api";
import { timeAgo, truncate } from "@/lib/utils";
import { TICKET_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/constants";
import type { Ticket, TicketStatus } from "@/types";
import { Plus, Ticket as TIcon, Search, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function TicketsListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const t = await ticketsAPI.getAll({
          status: (statusFilter as TicketStatus) || undefined,
        });
        setTickets(t);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [statusFilter]);

  const filtered = search
    ? tickets.filter(
        (t) =>
          t.subject.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase())
      )
    : tickets;

  const statusFilters = ["", "open", "in_progress", "resolved", "closed"];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Tickets</h1>
          <p className="text-sm text-[var(--on-surface-variant)] mt-1">
            Track and manage your support requests
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/tickets/new">
            <Plus size={16} /> New Ticket
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]/50"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets…"
            className="w-full py-2.5 pl-10 pr-10 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[var(--outline-variant)]/50 text-sm text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/50 outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/15 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {statusFilters.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className={statusFilter === s ? "" : "text-[var(--on-surface-variant)]"}
            >
              {s ? TICKET_STATUS_CONFIG[s]?.label : "All"}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <Card>
          <CardContent className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 flex-1" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : filtered.length > 0 ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)]">
                  <th className="text-left py-3 px-5 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                    ID
                  </th>
                  <th className="text-left py-3 px-5 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                    Subject
                  </th>
                  <th className="text-left py-3 px-5 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                    Status
                  </th>
                  <th className="text-left py-3 px-5 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                    Priority
                  </th>
                  <th className="text-left py-3 px-5 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const statusVariant =
                    t.status === "resolved"
                      ? "success"
                      : t.status === "open"
                      ? "default"
                      : t.status === "closed"
                      ? "secondary"
                      : "warning";
                  const prioVariant =
                    t.priority === "high"
                      ? "danger"
                      : t.priority === "low"
                      ? "success"
                      : "warning";

                  return (
                    <tr
                      key={t.id}
                      className="border-b border-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.03)] transition-colors cursor-pointer group"
                      onClick={() =>
                        (window.location.href = `/dashboard/tickets/${t.id}`)
                      }
                    >
                      <td className="py-3.5 px-5 font-mono text-xs text-[var(--primary)]">
                        #{t.id.slice(0, 8)}
                      </td>
                      <td className="py-3.5 px-5 font-medium group-hover:text-[var(--primary)] transition-colors">
                        {truncate(t.subject, 50)}
                      </td>
                      <td className="py-3.5 px-5">
                        <Badge variant={statusVariant as "default"}>
                          {TICKET_STATUS_CONFIG[t.status]?.label}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-5">
                        <Badge variant={prioVariant as "default"}>
                          {PRIORITY_CONFIG[t.priority]?.label}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-5 text-[var(--on-surface-variant)] text-xs">
                        {timeAgo(t.updated_at)}
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
            icon={TIcon}
            title="No tickets found"
            description={
              search
                ? "No tickets match your search. Try a different term."
                : "You haven't created any tickets yet."
            }
          >
            <Button asChild>
              <Link href="/dashboard/tickets/new">
                <Plus size={16} /> Create your first ticket
              </Link>
            </Button>
          </EmptyState>
        </Card>
      )}
    </div>
  );
}
