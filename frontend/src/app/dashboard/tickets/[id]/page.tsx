"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ticketsAPI, aiAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { timeAgo, formatDateTime, getInitials } from "@/lib/utils";
import { TICKET_STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/constants";
import type { Ticket, TicketMessage, UserBrief } from "@/types";
import {
  ArrowLeft, Send, Sparkles, Loader2, MessageSquare, Clock,
  AlertCircle, UserCheck, UserPlus, X, Check, Lock,
  FileEdit, Ban, RotateCcw, ChevronDown
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";

type StatusAction = "close" | "reopen";

const FSM_ACTIONS: Record<string, { label: string; next: string; icon: typeof X; color: string }[]> = {
  open: [
    { label: "Mark In Progress", next: "in_progress", icon: UserCheck, color: "text-[var(--primary)]" },
    { label: "Close", next: "closed", icon: Ban, color: "text-[var(--danger)]" },
  ],
  in_progress: [
    { label: "Wait on Customer", next: "waiting", icon: Clock, color: "text-[var(--warning)]" },
    { label: "Resolve", next: "resolved", icon: Check, color: "text-[var(--success)]" },
    { label: "Close", next: "closed", icon: Ban, color: "text-[var(--danger)]" },
  ],
  waiting: [
    { label: "Mark In Progress", next: "in_progress", icon: UserCheck, color: "text-[var(--primary)]" },
    { label: "Close", next: "closed", icon: Ban, color: "text-[var(--danger)]" },
  ],
  resolved: [
    { label: "Close", next: "closed", icon: Ban, color: "text-[var(--danger)]" },
  ],
};

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
  const [isInternal, setIsInternal] = useState(false);
  const [statusActionLoading, setStatusActionLoading] = useState<string|null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [agents, setAgents] = useState<UserBrief[]>([]);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);

  const isAgent = user?.role === "agent" || user?.role === "admin";
  const isOwner = ticket?.created_by_id === user?.id;
  const isClosed = ticket?.status === "closed";
  const canAssign = isAgent && !isClosed;

  const loadTicket = useCallback(async () => {
    try {
      const [t, m] = await Promise.all([ticketsAPI.getById(id), ticketsAPI.getMessages(id)]);
      setTicket(t); setMessages(m);
    } catch { setError("Ticket not found."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadTicket(); }, [loadTicket]);

  useEffect(() => {
    if (isAgent && showAssignDropdown && agents.length === 0) {
      apiClient.get<UserBrief[]>("/admin/users?role=agent")
        .then(setAgents)
        .catch(() => {});
    }
  }, [isAgent, showAssignDropdown, agents.length]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      const msg = await ticketsAPI.addMessage(id, { message: newMsg, is_internal: isInternal });
      setMessages(p=>[...p,msg]); setNewMsg("");
    } catch (err: unknown) {
      const detail = (err as {status?: number; message?: string})?.message || "Failed to send message.";
      setError(detail);
    }
    finally { setSending(false); }
  };

  const handleStatusAction = async (action: string) => {
    setStatusActionLoading(action);
    setError("");
    try {
      let updated: Ticket;
      if (action === "close") {
        updated = await ticketsAPI.close(id);
      } else {
        updated = await ticketsAPI.update(id, { status: action as Ticket["status"] });
      }
      setTicket(updated);
    } catch (err: unknown) {
      const detail = (err as {status?: number; message?: string})?.message || "Action failed.";
      setError(detail);
    }
    finally { setStatusActionLoading(null); }
  };

  const handleReopen = async () => {
    setStatusActionLoading("reopen");
    setError("");
    try {
      const updated = await ticketsAPI.reopen(id);
      setTicket(updated);
    } catch (err: unknown) {
      const detail = (err as {status?: number; message?: string})?.message || "Failed to reopen ticket.";
      setError(detail);
    }
    finally { setStatusActionLoading(null); }
  };

  const handleAssign = async (userId: string) => {
    setAssignLoading(true);
    setError("");
    try {
      const updated = await ticketsAPI.assign(id, { assigned_to_id: userId });
      setTicket(updated);
      setShowAssignDropdown(false);
    } catch (err: unknown) {
      const detail = (err as {status?: number; message?: string})?.message || "Assignment failed.";
      setError(detail);
    }
    finally { setAssignLoading(false); }
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
  if (error && !ticket) return (
    <div className="glass-card p-8 md:p-16 text-center max-w-lg mx-auto mt-8 md:mt-12">
      <h2 className="text-xl font-semibold mb-2">Not Found</h2>
      <p className="text-[var(--on-surface-variant)] mb-4">{error}</p>
      <button onClick={()=>router.back()} className="btn-secondary"><ArrowLeft size={16}/>Go Back</button>
    </div>
  );
  if (!ticket) return null;

  const st = TICKET_STATUS_CONFIG[ticket.status];
  const pr = PRIORITY_CONFIG[ticket.priority];

  return (
    <div className="max-w-6xl mx-auto">
      <button onClick={()=>router.back()} className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)] hover:text-[var(--primary)] transition-colors mb-6"><ArrowLeft size={16}/>Back to Tickets</button>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-5 rounded-xl bg-[var(--rose)]/10 border border-[var(--rose)]/20 text-[var(--rose)] text-sm">
          <AlertCircle size={16}/>
          <span className="flex-1">{error}</span>
          <button onClick={()=>setError("")}><X size={14}/></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">

        {/* Main content */}
        <div className="lg:col-span-2 space-y-4 md:space-y-5">

          {/* Ticket header */}
          <div className="glass-card p-6 animate-fade-in">
            <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
              <div>
                <p className="text-xs font-mono text-[var(--primary)] mb-1">#{ticket.id.slice(0,8)}</p>
                <h1 className="text-xl font-bold text-white">{ticket.subject}</h1>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`badge ${st.bgClass} ${st.colorClass}`}>{st.label}</span>
                <span className={`badge ${pr.bgClass} ${pr.colorClass}`}>{pr.label}</span>
              </div>
            </div>

            <p className="text-[var(--on-surface-variant)] text-sm leading-relaxed whitespace-pre-wrap">{ticket.description}</p>

            <div className="flex items-center gap-4 mt-4 text-xs text-[var(--on-surface-variant)]/70 flex-wrap">
              <span className="flex items-center gap-1"><Clock size={12}/>{formatDateTime(ticket.created_at)}</span>
              {ticket.created_by && (
                <span className="flex items-center gap-1">
                  <UserCheck size={12}/> Created by {ticket.created_by.name}
                </span>
              )}
              {ticket.assigned_to && (
                <span className="flex items-center gap-1">
                  <UserPlus size={12}/> Assigned to {ticket.assigned_to.name}
                </span>
              )}
            </div>
          </div>

          {/* AI Summary */}
          {summary && (
            <div className="glass-card p-5 border-l-2 border-[var(--primary-hover)] animate-fade-in">
              <p className="text-xs font-semibold text-[var(--primary)] mb-2 flex items-center gap-1">
                <Sparkles size={12}/>AI Summary
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--on-surface)]">{summary}</p>
            </div>
          )}

          {/* Messages */}
          <div className="glass-card overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2 text-white">
                <MessageSquare size={18}/> Conversation ({messages.length})
              </h2>
            </div>
            <div className="divide-y divide-white/3">
              {messages.length === 0 ? (
                <div className="p-8 text-center text-[var(--on-surface-variant)]">No messages yet.</div>
              ) : messages.map(m => {
                const isMine = m.sender_id === user?.id;
                const showInternal = m.is_internal && isAgent;
                if (m.is_internal && !isAgent) return null;
                return (
                  <div key={m.id} className={`px-4 md:px-6 py-4 hover:bg-white/2 transition-colors ${showInternal ? "bg-[var(--warning)]/5 border-l-2 border-[var(--warning)]/30" : ""}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {m.sender_name ? getInitials(m.sender_name) : "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-white">
                          {isMine ? "You" : (m.sender_name || "Unknown")}
                        </span>
                        {m.is_ai_draft && (
                          <span className="ml-2 badge bg-[var(--primary-hover)]/15 text-[var(--primary-light)] text-[10px]">AI Draft</span>
                        )}
                        {m.is_internal && (
                          <span className="ml-2 badge bg-[var(--warning)]/15 text-[var(--warning)] text-[10px]">Internal</span>
                        )}
                      </div>
                      <span className="text-xs text-[var(--on-surface-variant)] shrink-0">{timeAgo(m.created_at)}</span>
                    </div>
                    <p className="text-sm leading-relaxed pl-10 whitespace-pre-wrap text-[var(--on-surface)]">{m.message}</p>
                  </div>
                );
              })}
            </div>

            {/* Reply form */}
            <div className="px-6 py-4 border-t border-white/5">
              {isClosed ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/20 text-[var(--warning)] text-sm flex-wrap">
                  <Lock size={14}/>
                  <span>This ticket is closed. {isOwner && <button onClick={handleReopen} className="underline hover:text-[var(--primary-light)] font-medium">Reopen it</button>} to reply.</span>
                </div>
              ) : (
                <form onSubmit={sendMessage} className="space-y-3">
                  {isAgent && (
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="w-4 h-4 rounded border-[var(--outline-variant)] accent-[var(--primary)]"
                      />
                      <span className="text-xs text-[var(--on-surface-variant)] flex items-center gap-1">
                        <Lock size={12}/> Internal note (only visible to agents)
                      </span>
                    </label>
                  )}
                  <div className="flex gap-3">
                    <textarea
                      value={newMsg}
                      onChange={e=>setNewMsg(e.target.value)}
                      placeholder={isInternal ? "Add an internal note…" : "Type your reply…"}
                      rows={2}
                      className="input-field flex-1 resize-none"
                    />
                    <button
                      type="submit"
                      disabled={sending || !newMsg.trim()}
                      className="btn-primary self-end"
                    >
                      {sending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 md:space-y-5">
          {/* Details */}
          <div className="glass-card p-5 space-y-4 animate-fade-in">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--on-surface-variant)]/60">Details</h3>
            <div>
              <p className="text-xs text-[var(--on-surface-variant)] mb-1">Status</p>
              <span className={`badge ${st.bgClass} ${st.colorClass}`}>{st.label}</span>
            </div>
            <div>
              <p className="text-xs text-[var(--on-surface-variant)] mb-1">Priority</p>
              <span className={`badge ${pr.bgClass} ${pr.colorClass}`}>{pr.label}</span>
            </div>
            <div>
              <p className="text-xs text-[var(--on-surface-variant)] mb-1">Created</p>
              <p className="text-sm text-white">{formatDateTime(ticket.created_at)}</p>
            </div>
            {ticket.resolved_at && (
              <div>
                <p className="text-xs text-[var(--on-surface-variant)] mb-1">Resolved</p>
                <p className="text-sm text-white">{formatDateTime(ticket.resolved_at)}</p>
              </div>
            )}
          </div>

          {/* Status actions */}
          {isAgent && !isClosed && FSM_ACTIONS[ticket.status] && (
            <div className="glass-card p-5 space-y-2 animate-fade-in">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--on-surface-variant)]/60">Actions</h3>
              <div className="space-y-1.5">
                {FSM_ACTIONS[ticket.status].map(a => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.next}
                      onClick={() => handleStatusAction(a.next)}
                      disabled={statusActionLoading !== null}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all disabled:opacity-50"
                    >
                      {statusActionLoading === a.next ? (
                        <Loader2 size={15} className="animate-spin"/>
                      ) : (
                        <Icon size={15} className={a.color}/>
                      )}
                      <span className="text-white">{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* User close/reopen */}
          {!isAgent && isOwner && (
            <div className="glass-card p-5 space-y-2 animate-fade-in">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--on-surface-variant)]/60">Actions</h3>
              {isClosed ? (
                <button
                  onClick={handleReopen}
                  disabled={statusActionLoading !== null}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all disabled:opacity-50"
                >
                  {statusActionLoading === "reopen" ? (
                    <Loader2 size={15} className="animate-spin"/>
                  ) : (
                    <RotateCcw size={15} className="text-primary"/>
                  )}
                  <span className="text-white">Reopen Ticket</span>
                </button>
              ) : (
                <button
                  onClick={() => handleStatusAction("close")}
                  disabled={statusActionLoading !== null}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-[var(--danger)]/10 border border-[var(--danger)]/20 hover:bg-[var(--danger)]/20 transition-all disabled:opacity-50"
                >
                  {statusActionLoading === "close" ? (
                    <Loader2 size={15} className="animate-spin"/>
                  ) : (
                    <Ban size={15} className="text-[var(--danger)]"/>
                  )}
                  <span className="text-[var(--danger)]/80">Close Ticket</span>
                </button>
              )}
            </div>
          )}

          {/* Assignment */}
          {canAssign && (
            <div className="glass-card p-5 space-y-3 animate-fade-in">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--on-surface-variant)]/60">Assignment</h3>
              {ticket.assigned_to ? (
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    {getInitials(ticket.assigned_to.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{ticket.assigned_to.name}</p>
                    <p className="text-[10px] text-[var(--on-surface-variant)] capitalize">{ticket.assigned_to.role}</p>
                  </div>
                  <button
                    onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--on-surface-variant)]"
                  >
                    <FileEdit size={14}/>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-dashed border-white/10 hover:border-white/30 transition-all"
                >
                  <UserPlus size={15} className="text-[var(--on-surface-variant)]"/>
                  <span className="text-[var(--on-surface-variant)]">Assign to agent</span>
                </button>
              )}

              {showAssignDropdown && (
                <div className="glass-card max-h-48 overflow-y-auto space-y-0.5 p-1 border border-white/10">
                  {agents.length === 0 ? (
                    <p className="text-xs text-[var(--on-surface-variant)] p-2 text-center">Loading agents...</p>
                  ) : (
                    agents.map(a => (
                      <button
                        key={a.id}
                        onClick={() => handleAssign(a.id)}
                        disabled={assignLoading}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors text-left disabled:opacity-50"
                      >
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                          {getInitials(a.name)}
                        </span>
                        <span className="text-white">{a.name}</span>
                        {ticket.assigned_to_id === a.id && (
                          <Check size={14} className="text-[var(--primary)] ml-auto"/>
                        )}
                      </button>
                    ))
                  )}
                  {isAgent && (
                    <button
                      onClick={() => handleAssign(user?.id || "")}
                      disabled={assignLoading}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
                    >
                      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                        {user?.name ? getInitials(user.name) : "U"}
                      </span>
                      <span className="text-white">Assign to me</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI Assist */}
          {isAgent && (
            <div className="glass-card p-5 space-y-3 animate-fade-in">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--on-surface-variant)]/60 flex items-center gap-1">
                <Sparkles size={14} className="text-[var(--primary)]"/>AI Assist
              </h3>
              <button
                onClick={handleSummarize}
                disabled={aiLoading}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all disabled:opacity-50"
              >
                {aiLoading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14} className="text-[var(--primary)]"/>}
                <span className="text-white">Summarize Thread</span>
              </button>
              <button
                onClick={handleDraftReply}
                disabled={aiLoading}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all disabled:opacity-50"
              >
                {aiLoading ? <Loader2 size={14} className="animate-spin"/> : <FileEdit size={14} className="text-[var(--primary)]"/>}
                <span className="text-white">Draft Reply</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
