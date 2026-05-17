"use client";
import { useState, useRef, useEffect, FormEvent } from "react";
import { Sparkles, Send, ThumbsUp, ThumbsDown, BookOpen, Ticket, Loader2, Plus, MessageSquare, Info } from "lucide-react";
import { aiAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { timeAgo, getInitials } from "@/lib/utils";
import Link from "next/link";
import type { AIChatSource } from "@/types";

interface Message {
  id: string; role: "user"|"assistant"; content: string;
  sources?: AIChatSource[]; confidence?: number; suggestTicket?: boolean;
  timestamp: Date; feedbackGiven?: "helpful"|"unhelpful"|null;
}

export default function AIChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string|null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const q = input.trim(); if (!q||loading) return;
    setMessages(p=>[...p,{id:crypto.randomUUID(),role:"user",content:q,timestamp:new Date()}]);
    setInput(""); setLoading(true);
    try {
      const res = await aiAPI.chat(q, sessionId||undefined);
      setSessionId(res.session_id);
      setMessages(p=>[...p,{id:crypto.randomUUID(),role:"assistant",content:res.answer,sources:res.sources,confidence:res.confidence,suggestTicket:res.suggest_ticket,timestamp:new Date(),feedbackGiven:null}]);
    } catch { setMessages(p=>[...p,{id:crypto.randomUUID(),role:"assistant",content:"Sorry, I encountered an error. Please try again.",suggestTicket:true,timestamp:new Date()}]); }
    finally { setLoading(false); inputRef.current?.focus(); }
  };

  const handleFeedback = async (msgId: string, rating: "helpful"|"unhelpful") => {
    setMessages(p=>p.map(m=>m.id===msgId?{...m,feedbackGiven:rating}:m));
    try { await aiAPI.submitFeedback({context_type:"chat",query:"",response:"",rating}); } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();handleSend(e);} };

  return (
    <div className="flex h-[calc(100vh-var(--header-height)-48px)] gap-5 -m-6 p-6">
      {/* Chat History */}
      <div className="w-64 shrink-0 glass-card p-4 flex flex-col">
        <button onClick={()=>{setMessages([]);setSessionId(null);}} className="btn-primary w-full justify-center mb-4 text-sm"><Plus size={16}/> New Chat</button>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]/60 mb-3 px-1">Recent</p>
        <div className="flex-1 overflow-y-auto space-y-1">
          {[{t:"Password reset process",d:Date.now()-7200000},{t:"VPN setup guide",d:Date.now()-86400000},{t:"Leave policy",d:Date.now()-259200000}].map((h,i)=>(
            <button key={i} className="w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left hover:bg-white/5 transition-colors">
              <MessageSquare size={16} className="mt-0.5 text-[var(--on-surface-variant)] shrink-0"/>
              <div className="min-w-0"><p className="text-sm font-medium truncate">{h.t}</p><p className="text-xs text-[var(--on-surface-variant)]/60">{timeAgo(new Date(h.d).toISOString())}</p></div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col glass-card overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center"><Sparkles size={18} className="text-white"/></div>
          <div><h2 className="font-semibold">AI Assistant</h2><p className="text-xs text-[var(--on-surface-variant)]">Powered by Knowledge Base</p></div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.length===0&&(
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center mb-6 animate-pulse-glow"><Sparkles size={36} className="text-white"/></div>
              <h3 className="text-xl font-semibold mb-2">How can I help you?</h3>
              <p className="text-[var(--on-surface-variant)] max-w-md mb-6">Ask me anything about your organization&apos;s knowledge base.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {["How do I reset my password?","What is the leave policy?","VPN setup guide"].map(q=>(
                  <button key={q} onClick={()=>{setInput(q);inputRef.current?.focus();}} className="px-4 py-2 rounded-full text-sm glass hover:bg-white/8 transition-colors text-[var(--on-surface-variant)]">{q}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg=>(
            <div key={msg.id} className={`flex gap-3 ${msg.role==="user"?"justify-end":""} animate-fade-in`}>
              {msg.role==="assistant"&&<div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0 mt-1"><Sparkles size={16} className="text-white"/></div>}
              <div className={`max-w-[70%]`}>
                {msg.role==="user"?(
                  <div className="px-5 py-3 rounded-2xl rounded-tr-sm" style={{background:"var(--indigo)"}}><p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p></div>
                ):(
                  <div className="space-y-3">
                    <div className="glass-card p-5 gradient-border" style={{transform:"none"}}>
                      <p className="text-xs font-semibold text-[var(--primary)] mb-2 flex items-center gap-1"><Sparkles size={12}/> HelpDesk AI</p>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                      {msg.suggestTicket&&(
                        <div className="mt-4 p-3 rounded-lg bg-[var(--amber)]/10 border border-[var(--amber)]/20 flex items-start gap-2">
                          <Info size={16} className="text-[var(--amber)] mt-0.5 shrink-0"/>
                          <div><p className="text-sm text-[var(--amber)]">I&apos;m not fully confident about this answer.</p>
                          <Link href="/dashboard/tickets/new" className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-[var(--amber)] hover:underline"><Ticket size={14}/> Create a support ticket</Link></div>
                        </div>
                      )}
                      {msg.sources&&msg.sources.length>0&&(
                        <div className="mt-4 pt-3 border-t border-white/5">
                          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]/60 mb-2">Sources</p>
                          {msg.sources.map(src=>(
                            <Link key={src.article_id} href={`/dashboard/kb/${src.article_id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                              <BookOpen size={14} className="text-[var(--primary)]"/><span className="text-sm font-medium flex-1">{src.title}</span>
                              <span className="text-xs badge bg-[var(--indigo)]/15 text-[var(--primary)]">{Math.round(src.relevance_score*100)}%</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                    {msg.feedbackGiven===null?(
                      <div className="flex items-center gap-2 text-xs text-[var(--on-surface-variant)]"><span>Was this helpful?</span>
                        <button onClick={()=>handleFeedback(msg.id,"helpful")} className="p-1.5 rounded hover:bg-[var(--emerald)]/10 hover:text-[var(--emerald)] transition-colors"><ThumbsUp size={14}/></button>
                        <button onClick={()=>handleFeedback(msg.id,"unhelpful")} className="p-1.5 rounded hover:bg-[var(--rose)]/10 hover:text-[var(--rose)] transition-colors"><ThumbsDown size={14}/></button>
                      </div>
                    ):(<p className="text-xs text-[var(--on-surface-variant)]">{msg.feedbackGiven==="helpful"?"✅ Thanks!":"📝 We'll improve."}</p>)}
                  </div>
                )}
              </div>
              {msg.role==="user"&&<div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center shrink-0 mt-1 text-white text-xs font-bold">{getInitials(user?.name||"U")}</div>}
            </div>
          ))}
          {loading&&(<div className="flex gap-3 animate-fade-in"><div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0"><Sparkles size={16} className="text-white"/></div><div className="glass-card p-5 flex items-center gap-3" style={{transform:"none"}}><Loader2 size={16} className="animate-spin text-[var(--primary)]"/><span className="text-sm text-[var(--on-surface-variant)]">Searching knowledge base…</span></div></div>)}
          <div ref={chatEndRef}/>
        </div>

        <div className="px-6 pb-5 pt-2">
          <form onSubmit={handleSend} className="relative">
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask anything about our knowledge base…" rows={1} className="input-field pr-14 py-3.5 resize-none" disabled={loading}/>
            <button type="submit" disabled={!input.trim()||loading} className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg gradient-primary flex items-center justify-center text-white disabled:opacity-40"><Send size={16}/></button>
          </form>
          <p className="text-center text-xs text-[var(--on-surface-variant)]/50 mt-2">AI answers are based on your organization&apos;s knowledge base</p>
        </div>
      </div>
    </div>
  );
}
