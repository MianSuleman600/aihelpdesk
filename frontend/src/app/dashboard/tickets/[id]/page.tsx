"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ticketsAPI, aiAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { timeAgo, formatDateTime, getInitials } from "@/lib/utils";
import { TICKET_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/constants";
import type { Ticket, TicketMessage } from "@/types";
import { ArrowLeft, Send, Sparkles, Loader2, MessageSquare, Clock, AlertCircle } from "lucide-react";

export default function TicketDetailPage() {
  const { id } = useParams<{id:string}>();
  const { user } = useAuth();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket|null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const isAgent = user?.role==="agent"||user?.role==="admin";

  useEffect(() => {
    const load = async () => {
      try {
        const [t,m] = await Promise.all([ticketsAPI.getById(id), ticketsAPI.getMessages(id)]);
        setTicket(t); setMessages(m);
      } catch { setError("Ticket not found."); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      const msg = await ticketsAPI.addMessage(id, { message: newMsg });
      setMessages(p=>[...p,msg]); setNewMsg("");
    } catch { setError("Failed to send message."); }
    finally { setSending(false); }
  };

  const handleSummarize = async () => {
    setAiLoading(true); setSummary("");
    try { const r = await aiAPI.summarize(id); setSummary(r.summary); }
    catch { setSummary("Failed to generate summary."); }
    finally { setAiLoading(false); }
  };

  const handleDraftReply = async () => {
    setAiLoading(true);
    try { const r = await aiAPI.draftReply(id); setNewMsg(r.draft); }
    catch { setError("Failed to generate draft."); }
    finally { setAiLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[var(--primary)]"/></div>;
  if (error&&!ticket) return <div className="glass-card p-16 text-center max-w-lg mx-auto"><h2 className="text-xl font-semibold mb-2">Not Found</h2><p className="text-[var(--on-surface-variant)] mb-4">{error}</p><button onClick={()=>router.back()} className="btn-secondary"><ArrowLeft size={16}/>Go Back</button></div>;
  if (!ticket) return null;

  const st = TICKET_STATUS_CONFIG[ticket.status];
  const pr = PRIORITY_CONFIG[ticket.priority];

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={()=>router.back()} className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)] hover:text-[var(--primary)] transition-colors mb-6"><ArrowLeft size={16}/>Back to Tickets</button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          <div className="glass-card p-6 animate-fade-in">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div><p className="text-xs font-mono text-[var(--primary)] mb-1">#{ticket.id.slice(0,8)}</p><h1 className="text-xl font-bold">{ticket.subject}</h1></div>
              <span className={`badge ${st.bgClass} ${st.colorClass}`}>{st.label}</span>
            </div>
            <p className="text-[var(--on-surface-variant)] text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
            <div className="flex items-center gap-4 mt-4 text-xs text-[var(--on-surface-variant)]/70"><Clock size={12}/>{formatDateTime(ticket.created_at)}</div>
          </div>

          {/* AI Summary */}
          {summary&&<div className="glass-card p-5 border-l-2 border-[var(--violet)] animate-fade-in"><p className="text-xs font-semibold text-[var(--primary)] mb-2 flex items-center gap-1"><Sparkles size={12}/>AI Summary</p><p className="text-sm leading-relaxed whitespace-pre-wrap">{summary}</p></div>}

          {/* Messages */}
          <div className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2"><MessageSquare size={18}/>Conversation ({messages.length})</h2>
            </div>
            <div className="divide-y divide-white/3">
              {messages.length===0?<div className="p-8 text-center text-[var(--on-surface-variant)]">No messages yet.</div>:
              messages.map(m=>(
                <div key={m.id} className="px-6 py-4 hover:bg-white/2 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold">{getInitials(m.sender_id.slice(0,4))}</div>
                    <div className="flex-1"><span className="text-sm font-medium">{m.sender_id===user?.id?"You":"Agent"}</span>{m.is_ai_draft&&<span className="ml-2 badge bg-[var(--violet)]/15 text-[var(--secondary)] text-xs">AI Draft</span>}{m.is_internal&&<span className="ml-2 badge bg-[var(--amber)]/15 text-[var(--amber)] text-xs">Internal</span>}</div>
                    <span className="text-xs text-[var(--on-surface-variant)]">{timeAgo(m.created_at)}</span>
                  </div>
                  <p className="text-sm leading-relaxed pl-10 whitespace-pre-wrap">{m.message}</p>
                </div>
              ))}
            </div>

            {/* Reply form */}
            <div className="px-6 py-4 border-t border-white/5">
              {error&&<div className="flex items-center gap-2 p-2 mb-3 rounded-lg bg-[var(--rose)]/10 text-[var(--rose)] text-xs"><AlertCircle size={14}/>{error}</div>}
              <form onSubmit={sendMessage} className="flex gap-3">
                <textarea value={newMsg} onChange={e=>setNewMsg(e.target.value)} placeholder="Type your reply…" rows={2} className="input-field flex-1 resize-none"/>
                <button type="submit" disabled={sending||!newMsg.trim()} className="btn-primary self-end">{sending?<Loader2 size={16} className="animate-spin"/>:<Send size={16}/>}</button>
              </form>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="glass-card p-5 space-y-4 animate-fade-in">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--on-surface-variant)]/60">Details</h3>
            <div><p className="text-xs text-[var(--on-surface-variant)] mb-1">Status</p><span className={`badge ${st.bgClass} ${st.colorClass}`}>{st.label}</span></div>
            <div><p className="text-xs text-[var(--on-surface-variant)] mb-1">Priority</p><span className={`badge ${pr.bgClass} ${pr.colorClass}`}>{pr.label}</span></div>
            <div><p className="text-xs text-[var(--on-surface-variant)] mb-1">Created</p><p className="text-sm">{formatDateTime(ticket.created_at)}</p></div>
            {ticket.resolved_at&&<div><p className="text-xs text-[var(--on-surface-variant)] mb-1">Resolved</p><p className="text-sm">{formatDateTime(ticket.resolved_at)}</p></div>}
          </div>

          {isAgent&&(
            <div className="glass-card p-5 space-y-3 animate-fade-in">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--on-surface-variant)]/60 flex items-center gap-1"><Sparkles size={14} className="text-[var(--primary)]"/>AI Assist</h3>
              <button onClick={handleSummarize} disabled={aiLoading} className="btn-secondary w-full justify-center text-sm">{aiLoading?<Loader2 size={14} className="animate-spin"/>:<Sparkles size={14}/>}Summarize Thread</button>
              <button onClick={handleDraftReply} disabled={aiLoading} className="btn-secondary w-full justify-center text-sm">{aiLoading?<Loader2 size={14} className="animate-spin"/>:<Sparkles size={14}/>}Draft Reply</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
