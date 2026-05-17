"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ticketsAPI } from "@/lib/api";
import { timeAgo, truncate } from "@/lib/utils";
import { TICKET_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/constants";
import type { Ticket, TicketStatus } from "@/types";
import { Plus, Ticket as TIcon, Filter, Search, X } from "lucide-react";

export default function TicketsListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try { const t = await ticketsAPI.getAll({ status: statusFilter as TicketStatus||undefined }); setTickets(t); }
      catch {} finally { setLoading(false); }
    };
    load();
  }, [statusFilter]);

  const filtered = search ? tickets.filter(t=>t.subject.toLowerCase().includes(search.toLowerCase())||t.description.toLowerCase().includes(search.toLowerCase())) : tickets;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold">My Tickets</h1><p className="text-sm text-[var(--on-surface-variant)] mt-1">Track and manage your support requests</p></div>
        <Link href="/dashboard/tickets/new" className="btn-primary"><Plus size={16}/> New Ticket</Link>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[250px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]"/>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tickets…" className="input-field pl-10 pr-10"/>
          {search&&<button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] hover:text-white"><X size={16}/></button>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {["","open","in_progress","resolved","closed"].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter===s?"bg-[var(--indigo)]/15 text-[var(--primary)] border border-[var(--indigo)]/20":"text-[var(--on-surface-variant)] hover:bg-white/5 border border-transparent"}`}>
              {s?TICKET_STATUS_CONFIG[s]?.label:"All"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="skeleton h-16 w-full"/>)}</div>
      ) : filtered.length > 0 ? (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/5 text-[var(--on-surface-variant)] text-xs uppercase tracking-wider">
              <th className="text-left py-3 px-5 font-semibold">ID</th>
              <th className="text-left py-3 px-5 font-semibold">Subject</th>
              <th className="text-left py-3 px-5 font-semibold">Status</th>
              <th className="text-left py-3 px-5 font-semibold">Priority</th>
              <th className="text-left py-3 px-5 font-semibold">Updated</th>
            </tr></thead>
            <tbody>{filtered.map(t=>{
              const st=TICKET_STATUS_CONFIG[t.status]; const pr=PRIORITY_CONFIG[t.priority];
              return (
                <tr key={t.id} className="border-b border-white/3 hover:bg-white/3 transition-colors cursor-pointer" onClick={()=>window.location.href=`/dashboard/tickets/${t.id}`}>
                  <td className="py-3 px-5 font-mono text-xs text-[var(--primary)]">#{t.id.slice(0,8)}</td>
                  <td className="py-3 px-5 font-medium">{truncate(t.subject,50)}</td>
                  <td className="py-3 px-5"><span className={`badge ${st.bgClass} ${st.colorClass}`}>{st.label}</span></td>
                  <td className="py-3 px-5"><span className={`badge ${pr.bgClass} ${pr.colorClass}`}>{pr.label}</span></td>
                  <td className="py-3 px-5 text-[var(--on-surface-variant)]">{timeAgo(t.updated_at)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : (
        <div className="glass-card p-16 text-center">
          <TIcon size={48} className="mx-auto mb-4 text-[var(--on-surface-variant)]"/>
          <h3 className="text-lg font-semibold mb-2">No tickets found</h3>
          <p className="text-[var(--on-surface-variant)] mb-4">You haven&apos;t created any tickets yet.</p>
          <Link href="/dashboard/tickets/new" className="btn-primary"><Plus size={16}/>Create your first ticket</Link>
        </div>
      )}
    </div>
  );
}
