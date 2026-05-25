"use client";

import { useState, useEffect } from "react";
import { ticketsAPI, kbAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { timeAgo, getInitials } from "@/lib/utils";
import type { Ticket, TicketStatus, Category } from "@/types";
import {
  Ticket as TIcon, Search, X, UserCheck, UserPlus,
  Loader2, Filter, CheckCircle2, ArrowUpDown,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_FILTERS = ["", "open", "in_progress", "waiting", "resolved", "closed"];
const PRIORITY_FILTERS = ["", "low", "medium", "high"];

export default function AdminTicketsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [unassigned, setUnassigned] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user?.role !== "admin" && user?.role !== "agent") {
      router.replace("/dashboard");
      return;
    }
    kbAPI.getCategories().then(setCategories).catch((e) => console.error(e));
  }, [user, router]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const t = await ticketsAPI.getAll({
          status: (statusFilter as TicketStatus) || undefined,
          assigned_to_me: assignedToMe || undefined,
          category_id: categoryFilter || undefined,
        });
        let filtered = t;
        if (priorityFilter) {
          filtered = filtered.filter((tk) => tk.priority === priorityFilter);
        }
        if (unassigned) {
          filtered = filtered.filter((tk) => !tk.assigned_to_id);
        }
        setTickets(filtered);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [statusFilter, priorityFilter, categoryFilter, assignedToMe, unassigned]);

  const searched = search
    ? tickets.filter(
        (t) =>
          t.subject.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase()) ||
          t.id.toLowerCase().includes(search.toLowerCase())
      )
    : tickets;

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Ticket Queue
          </h1>
          <p className="text-sm text-[var(--on-surface-variant)] mt-1">
            {searched.length} ticket{searched.length !== 1 ? "s" : ""} &middot; Manage, assign, and resolve support requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setAssignedToMe(false); setUnassigned(false); setStatusFilter(""); setPriorityFilter(""); setCategoryFilter(""); setSearch(""); }}
            className="text-xs"
          >
            <Filter size={13} /> Clear
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tickets…"
            className="w-full py-2 pl-9 pr-8 rounded-lg bg-white/5 border border-[var(--outline-variant)]/50 text-sm text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/50 outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/15 transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] hover:text-white transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-1 flex-wrap items-center">
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "ghost"}
              size="sm"
              onClick={() => setStatusFilter(s)}
              className={`text-xs ${statusFilter === s ? "" : "text-[var(--on-surface-variant)]"}`}
            >
              {s ? s.replace(/_/g, " ") : "All"}
            </Button>
          ))}
        </div>

        <div className="flex gap-1 flex-wrap items-center">
          {PRIORITY_FILTERS.map((p) => (
            <Button
              key={p}
              variant={priorityFilter === p ? "default" : "ghost"}
              size="sm"
              onClick={() => setPriorityFilter(p)}
              className={`text-xs ${priorityFilter === p ? "" : "text-[var(--on-surface-variant)]"}`}
            >
              {p ? p.charAt(0).toUpperCase() + p.slice(1) : "All Priority"}
            </Button>
          ))}
        </div>

        <div className="flex gap-1 items-center">
          <Button
            variant={assignedToMe ? "default" : "ghost"}
            size="sm"
            onClick={() => { setAssignedToMe(!assignedToMe); setUnassigned(false); }}
            className={`flex items-center gap-1.5 text-xs ${assignedToMe ? "" : "text-[var(--on-surface-variant)]"}`}
          >
            <UserCheck size={14} /> Mine
          </Button>
          <Button
            variant={unassigned ? "default" : "ghost"}
            size="sm"
            onClick={() => { setUnassigned(!unassigned); setAssignedToMe(false); }}
            className={`flex items-center gap-1.5 text-xs ${unassigned ? "" : "text-[var(--on-surface-variant)]"}`}
          >
            <UserPlus size={14} /> Unassigned
          </Button>
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="py-1.5 px-2.5 rounded-lg bg-white/5 border border-[var(--outline-variant)]/50 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/15 transition-all cursor-pointer"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id} className="bg-[#1a1a2e]">{c.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[var(--primary)]" />
        </div>
      ) : searched.length > 0 ? (
        <Card className="bg-white/5 border-white/10 backdrop-blur-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">ID</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Subject</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Priority</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)] hidden sm:table-cell">Category</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Created By</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Assigned To</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Updated</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {searched.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                  >
                    <td
                      className="py-3 px-4 font-mono text-xs text-[var(--primary)] cursor-pointer"
                      onClick={() => router.push(`/dashboard/tickets/${t.id}`)}
                    >
                      #{t.id.slice(0, 8)}
                    </td>
                    <td
                      className="py-3 px-4 font-medium group-hover:text-[var(--primary)] transition-colors text-white/90 cursor-pointer max-w-[200px] truncate"
                      onClick={() => router.push(`/dashboard/tickets/${t.id}`)}
                    >
                      {t.subject}
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={t.status} />
                    </td>
                    <td className="py-3 px-4">
                      <Badge priority={t.priority} />
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--on-surface-variant)] hidden sm:table-cell">
                      {t.category_id ? categories.find(c => c.id === t.category_id)?.name || <span className="italic text-[var(--on-surface-variant)]/50">Unknown</span> : <span className="italic text-[var(--on-surface-variant)]/50">None</span>}
                    </td>
                    <td className="py-3 px-4">
                      {t.created_by ? (
                        <span className="flex items-center gap-1.5 text-xs text-[var(--on-surface-variant)]">
                          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center text-white text-[7px] font-bold shrink-0">
                            {getInitials(t.created_by.name)}
                          </span>
                          {t.created_by.name}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--on-surface-variant)]/50 italic">Unknown</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {t.assigned_to ? (
                        <span className="flex items-center gap-1.5 text-xs text-[var(--on-surface-variant)]">
                          <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center text-white text-[7px] font-bold shrink-0">
                            {getInitials(t.assigned_to.name)}
                          </span>
                          {t.assigned_to.name}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--warning)] italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[var(--on-surface-variant)] text-xs whitespace-nowrap">
                      {timeAgo(t.updated_at)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!t.assigned_to_id && t.assigned_to_id !== user?.id && (
                          <button
                            onClick={async () => {
                              try {
                                await ticketsAPI.assign(t.id, { assigned_to_id: user!.id });
                                const refreshed = await ticketsAPI.getAll({ status: (statusFilter as TicketStatus) || undefined });
                                setTickets(refreshed);
                              } catch (e) { console.error(e); }
                            }}
                            className="p-1.5 rounded-md text-xs text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                            title="Assign to me"
                          >
                            <UserPlus size={14} />
                          </button>
                        )}
                        {t.status !== "closed" && (
                          <button
                            onClick={async () => {
                              try {
                                await ticketsAPI.update(t.id, { status: "closed" } as any);
                                const refreshed = await ticketsAPI.getAll({ status: (statusFilter as TicketStatus) || undefined });
                                setTickets(refreshed);
                              } catch (e) { console.error(e); }
                            }}
                            className="p-1.5 rounded-md text-xs text-[var(--success)] hover:bg-[var(--success)]/10 transition-colors"
                            title="Close ticket"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/dashboard/tickets/${t.id}`)}
                          className="p-1.5 rounded-md text-xs text-[var(--on-surface-variant)] hover:text-white hover:bg-white/10 transition-colors"
                          title="View details"
                        >
                          <ArrowUpDown size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="bg-white/5 border-white/10 backdrop-blur-md">
          <EmptyState
            icon={TIcon}
            title="No tickets found"
            description={
              search
                ? "No tickets match your filters. Try different criteria."
                : "No tickets have been created yet."
            }
          />
        </Card>
      )}
    </div>
  );
}
