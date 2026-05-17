"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import {
  Sparkles, Send, ThumbsUp, ThumbsDown, BookOpen,
  Ticket, Loader2, Plus, MessageSquare, Info,
  Bot, RotateCcw, Copy, Check, ChevronDown,
} from "lucide-react";
import { aiAPI } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { timeAgo, getInitials, cn } from "@/lib/utils";
import Link from "next/link";
import type { AIChatSource } from "@/types";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

/* ── Types ── */
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: AIChatSource[];
  confidence?: number;
  suggestTicket?: boolean;
  timestamp: Date;
  feedbackGiven?: "helpful" | "unhelpful" | null;
  streaming?: boolean;
}

/* ── Typing animation for streaming effect ── */
function useTypingAnimation(text: string, enabled: boolean, speed = 12) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDisplayed(text);
      setDone(true);
      return;
    }
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, enabled, speed]);

  return { displayed, done };
}

/* ── Typing indicator dots ── */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-[var(--primary)]/60"
            style={{
              animation: `typing-bounce 1.4s infinite ease-in-out`,
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
      <span className="text-sm text-[var(--on-surface-variant)] ml-2">Thinking…</span>
    </div>
  );
}

/* ── Single message bubble ── */
function MessageBubble({
  msg,
  userName,
  onFeedback,
}: {
  msg: Message;
  userName: string;
  onFeedback: (id: string, rating: "helpful" | "unhelpful") => void;
}) {
  const { displayed, done } = useTypingAnimation(
    msg.content,
    msg.role === "assistant" && !!msg.streaming
  );
  const [copied, setCopied] = useState(false);
  const content = msg.streaming ? displayed : msg.content;

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (msg.role === "user") {
    return (
      <div className="flex justify-end gap-3 animate-fade-in">
        <div className="max-w-[75%]">
          <div className="px-4 py-3 rounded-2xl rounded-br-md bg-[var(--primary)] text-white">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          </div>
          <p className="text-[10px] text-[var(--on-surface-variant)]/50 mt-1.5 text-right">
            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Avatar size="sm">
          <AvatarFallback>{getInitials(userName)}</AvatarFallback>
        </Avatar>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-in group">
      <Avatar size="sm" className="mt-1">
        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600">
          <Bot size={16} />
        </AvatarFallback>
      </Avatar>

      <div className="max-w-[80%] space-y-2">
        {/* Main content */}
        <div className="relative">
          <Card className="overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={12} className="text-[var(--primary)]" />
                <span className="text-xs font-semibold text-[var(--primary)]">HelpDesk AI</span>
              </div>

              <div className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--on-surface)]">
                {content}
                {msg.streaming && !done && (
                  <span className="inline-block w-0.5 h-4 bg-[var(--primary)] ml-0.5 animate-pulse align-text-bottom" />
                )}
              </div>

              {/* Suggest ticket */}
              {msg.suggestTicket && done && (
                <div className="mt-3 p-3 rounded-lg bg-amber-500/8 border border-amber-500/15">
                  <div className="flex items-start gap-2.5">
                    <Info size={15} className="text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-amber-300/90">
                        I&apos;m not fully confident about this answer.
                      </p>
                      <Link
                        href="/dashboard/tickets/new"
                        className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        <Ticket size={13} /> Create a support ticket
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && done && (
                <>
                  <Separator className="my-3" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]/60 mb-2">
                      Sources
                    </p>
                    <div className="space-y-1.5">
                      {msg.sources.map((src) => (
                        <Link
                          key={src.article_id}
                          href={`/dashboard/kb/${src.article_id}`}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition-colors group/src"
                        >
                          <BookOpen size={13} className="text-[var(--primary)] shrink-0" />
                          <span className="text-sm font-medium flex-1 truncate group-hover/src:text-[var(--primary)] transition-colors">
                            {src.title}
                          </span>
                          <Badge variant="default" className="text-[10px] px-2 py-0">
                            {Math.round(src.relevance_score * 100)}%
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Actions toolbar */}
          {done && (
            <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.06)] text-[var(--on-surface-variant)] transition-colors"
                title="Copy"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>

              {msg.feedbackGiven === null || msg.feedbackGiven === undefined ? (
                <>
                  <button
                    onClick={() => onFeedback(msg.id, "helpful")}
                    className="p-1.5 rounded-md hover:bg-emerald-500/10 hover:text-emerald-400 text-[var(--on-surface-variant)] transition-colors"
                    title="Helpful"
                  >
                    <ThumbsUp size={13} />
                  </button>
                  <button
                    onClick={() => onFeedback(msg.id, "unhelpful")}
                    className="p-1.5 rounded-md hover:bg-rose-500/10 hover:text-rose-400 text-[var(--on-surface-variant)] transition-colors"
                    title="Not helpful"
                  >
                    <ThumbsDown size={13} />
                  </button>
                </>
              ) : (
                <span className="text-xs text-[var(--on-surface-variant)] ml-1">
                  {msg.feedbackGiven === "helpful" ? "Thanks for the feedback!" : "We'll improve."}
                </span>
              )}

              <span className="text-[10px] text-[var(--on-surface-variant)]/40 ml-auto">
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Suggested prompts ── */
const SUGGESTED_PROMPTS = [
  "How do I reset my password?",
  "What is the leave policy?",
  "VPN setup guide",
  "How to submit an expense report?",
];

/* ── Main Page ── */
export default function AIChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, autoScroll]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: q,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setAutoScroll(true);

    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      const res = await aiAPI.chat(q, sessionId || undefined);
      setSessionId(res.session_id);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: res.answer,
          sources: res.sources,
          confidence: res.confidence,
          suggestTicket: res.suggest_ticket,
          timestamp: new Date(),
          feedbackGiven: null,
          streaming: true,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again or create a support ticket for help.",
          suggestTicket: true,
          timestamp: new Date(),
          streaming: true,
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleFeedback = async (msgId: string, rating: "helpful" | "unhelpful") => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedbackGiven: rating } : m))
    );
    try {
      await aiAPI.submitFeedback({ context_type: "chat", query: "", response: "", rating });
    } catch {
      // silent
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  return (
    <div className="flex h-[calc(100vh-var(--header-height)-48px)] gap-4 -m-6 p-6">
      {/* ── Sidebar: Chat History ── */}
      <div className="w-64 shrink-0 flex flex-col">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3">
            <Button onClick={handleNewChat} className="w-full justify-center gap-2" size="sm">
              <Plus size={15} /> New Chat
            </Button>
          </div>

          <Separator />

          <div className="px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--on-surface-variant)]/50">
              Recent Chats
            </p>
          </div>

          <ScrollArea className="flex-1 px-2 pb-3">
            {[
              { t: "Password reset process", d: Date.now() - 7200000 },
              { t: "VPN setup guide", d: Date.now() - 86400000 },
              { t: "Leave policy questions", d: Date.now() - 259200000 },
            ].map((h, i) => (
              <button
                key={i}
                className="w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left hover:bg-[rgba(255,255,255,0.05)] transition-colors mb-0.5"
              >
                <MessageSquare size={14} className="mt-1 text-[var(--on-surface-variant)]/60 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate leading-snug">{h.t}</p>
                  <p className="text-[10px] text-[var(--on-surface-variant)]/50 mt-0.5">
                    {timeAgo(new Date(h.d).toISOString())}
                  </p>
                </div>
              </button>
            ))}
          </ScrollArea>
        </Card>
      </div>

      {/* ── Main Chat Area ── */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Sparkles size={17} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">AI Assistant</h2>
              <p className="text-[11px] text-[var(--on-surface-variant)]">
                Powered by Knowledge Base
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleNewChat}>
              <RotateCcw size={14} /> New Chat
            </Button>
          )}
        </div>

        {/* Messages */}
        <ScrollArea
          className="flex-1 px-5 py-5 space-y-5"
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
            setAutoScroll(atBottom);
          }}
        >
          {messages.length === 0 ? (
            /* ── Empty State ── */
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center mb-6 shadow-xl shadow-violet-500/25">
                <Sparkles size={34} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">How can I help you?</h3>
              <p className="text-[var(--on-surface-variant)] max-w-md mb-8 text-sm leading-relaxed">
                Ask me anything about your organization&apos;s knowledge base.
                I&apos;ll search our articles to give you the best answer.
              </p>

              <div className="grid grid-cols-2 gap-2.5 w-full max-w-lg">
                {SUGGESTED_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                      inputRef.current?.focus();
                    }}
                    className="px-4 py-3 rounded-xl text-sm text-left bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.07)] hover:border-[var(--primary)]/30 transition-all duration-200 text-[var(--on-surface-variant)] leading-snug"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  userName={user?.name || "User"}
                  onFeedback={handleFeedback}
                />
              ))}

              {loading && (
                <div className="flex gap-3 animate-fade-in">
                  <Avatar size="sm">
                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600">
                      <Bot size={16} />
                    </AvatarFallback>
                  </Avatar>
                  <Card className="overflow-hidden">
                    <TypingIndicator />
                  </Card>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Scroll to bottom button */}
        {!autoScroll && messages.length > 0 && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
                setAutoScroll(true);
              }}
              className="rounded-full shadow-lg"
            >
              <ChevronDown size={14} /> Scroll to bottom
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="px-5 pb-4 pt-2 border-t border-[rgba(255,255,255,0.06)]">
          <form onSubmit={handleSend} className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about our knowledge base…"
              rows={1}
              disabled={loading}
              className="w-full py-3.5 pl-4 pr-14 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[var(--outline-variant)]/50 text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/50 outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/15 transition-all text-sm resize-none disabled:opacity-50"
              style={{ maxHeight: 160 }}
            />
            <Button
              type="submit"
              disabled={!input.trim() || loading}
              size="icon"
              className="absolute right-2.5 bottom-2.5 h-8 w-8 rounded-lg"
            >
              <Send size={15} />
            </Button>
          </form>
          <p className="text-center text-[10px] text-[var(--on-surface-variant)]/40 mt-2">
            AI answers are based on your organization&apos;s knowledge base and may not always be accurate
          </p>
        </div>
      </Card>

      {/* CSS for typing dots */}
      <style jsx>{`
        @keyframes typing-bounce {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
