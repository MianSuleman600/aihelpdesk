"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { aiAPI, tokenUtils } from "@/lib/api";
import { apiClient } from "@/lib/apiClient";
import { API_BASE_URL } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import type { AIChatSource } from "@/types";
import { CreateTicketModal } from "@/components/tickets/CreateTicketModal";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  Plus,
  Trash2,
  MessageSquare,
  Bot,
  User,
  Send,
  Sparkles,
  Search,
  X,
} from "lucide-react";

interface ChatSessionType {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface ChatMessageResponse {
  id: string;
  session_id: string;
  role: string;
  content: string;
  sources?: AIChatSource[];
  created_at: string;
}

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: AIChatSource[];
  timestamp: string;
  createdAt: string;
}

export default function AIChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSessionType[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingSources, setStreamingSources] = useState<AIChatSource[]>([]);
  const [feedbackState, setFeedbackState] = useState<
    Record<string, "helpful" | "unhelpful" | null>
  >({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const fetchSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const data = await apiClient.get<ChatSessionType[]>("/ai/sessions");
      setSessions(data);
    } catch {
      // silently fail
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (!sessionsOpen) return;
    const close = () => setSessionsOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [sessionsOpen]);

  const loadSessionMessages = async (sid: string) => {
    try {
      setIsLoading(true);
      setSessionId(sid);
      setMessages([]);
      setStreamingContent("");
      setStreamingSources([]);
      const data = await apiClient.get<ChatMessageResponse[]>(
        "/ai/sessions/" + sid
      );
      const mapped: LocalMessage[] = data.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        sources: m.sources,
        timestamp: timeAgo(m.created_at),
        createdAt: m.created_at,
      }));
      setMessages(mapped);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(null);
    setStreamingContent("");
    setStreamingSources([]);
    setFeedbackState({});
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const query = input.trim();
    setInput("");

    const userMsg: LocalMessage = {
      id: "user-" + Date.now(),
      role: "user",
      content: query,
      timestamp: "Just now",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setStreamingContent("");
    setStreamingSources([]);

    try {
      const res = await fetch(`${API_BASE_URL}/ai/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenUtils.get()}`,
        },
        body: JSON.stringify({ query, session_id: sessionId }),
      });
      if (!res.ok) throw new Error("Stream failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      let buffer = "";
      let fullContent = "";
      let finalSources: AIChatSource[] = [];
      let streamSessionId = "";
      let sessionIsNew = !sessionId;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += new TextDecoder().decode(value);
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "meta") {
                if (parsed.session_id) streamSessionId = parsed.session_id;
                if (parsed.sources) {
                  finalSources = parsed.sources;
                  setStreamingSources(parsed.sources);
                }
                if (parsed.session_id) setSessionId(parsed.session_id);
              }
              if (parsed.type === "chunk" && parsed.content) {
                fullContent += parsed.content;
                setStreamingContent(fullContent);
              }
              if (parsed.type === "done") {
                if (parsed.session_id) streamSessionId = parsed.session_id;
              }
              if (parsed.type === "error") {
                throw new Error(parsed.detail || "Server error");
              }
            } catch {
              /* skip */
            }
          }
        }
      }
      if (streamSessionId) setSessionId(streamSessionId);
      if (streamSessionId && !fullContent) {
        throw new Error("Empty response from server");
      }
      const finalMsg: LocalMessage = {
        id: "assistant-" + Date.now(),
        role: "assistant",
        content: fullContent,
        sources: finalSources,
        timestamp: "Just now",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, finalMsg]);
      if (streamSessionId) {
        // Manually add new session to list so it appears immediately (backend commit is async)
        if (sessionIsNew) {
          setSessions((prev) => {
            if (prev.find((s) => s.id === streamSessionId)) return prev;
            return [
              {
                id: streamSessionId,
                title: query.slice(0, 100),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                message_count: 1,
              },
              ...prev,
            ];
          });
        }
        fetchSessions();
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: "error-" + Date.now(),
        role: "assistant",
        content:
          "I'm sorry, I encountered an error processing your request. Please try again or create a ticket if the issue persists.",
        timestamp: "Just now",
        createdAt: new Date().toISOString(),
      } as LocalMessage]);
    }
    setIsLoading(false);
    setStreamingContent("");
    setStreamingSources([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFeedback = async (
    msgId: string,
    rating: "helpful" | "unhelpful"
  ) => {
    setFeedbackState((prev) => {
      const current = prev[msgId];
      if (current === rating) {
        return { ...prev, [msgId]: null };
      }
      return { ...prev, [msgId]: rating };
    });

    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    const newRating =
      feedbackState[msgId] === rating ? null : rating;
    if (newRating === null) return;

    try {
      await aiAPI.submitFeedback({
        context_type: "chat",
        context_id: msgId,
        query:
          messages
            .slice(
              0,
              messages.findIndex((m) => m.id === msgId)
            )
            .filter((m) => m.role === "user")
            .pop()?.content || "",
        response: msg.content,
        rating: rating,
      });
    } catch (err) {
      console.error("Feedback submission failed:", err);
    }
  };

  const handleCopy = async (msgId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // silently fail
    }
  };

  const deleteSession = async (sid: string) => {
    if (!window.confirm("Delete this chat session?")) return;
    try {
      await apiClient.delete("/ai/sessions/" + sid);
      setSessions((prev) => prev.filter((s) => s.id !== sid));
      if (sessionId === sid) handleNewChat();
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const lastAssistantMsg = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.sources && m.sources.length > 0);

  const sourcesToShow =
    streamingSources.length > 0
      ? streamingSources
      : lastAssistantMsg?.sources || [];

  const activeSessionTitle =
    sessions.find((s) => s.id === sessionId)?.title || null;

  return (
    <div className="flex-1 flex gap-bento-gap h-[calc(100vh-144px)] overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 glass-card flex flex-col h-full relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent h-32 pointer-events-none"></div>

        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-surface/30 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
              <Bot className="text-white" size={20} />
            </div>
            <div>
              <h2 className="font-headline-md text-[18px] font-semibold text-on-surface">
                Support AI
              </h2>
              <p className="font-body-sm text-[12px] text-[var(--primary)] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse"></span>
                Online
              </p>
            </div>
          </div>
          {sessionId && (
            <button
              onClick={() => deleteSession(sessionId)}
              className="p-2 text-on-surface-variant hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              title="Delete current chat"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button
            onClick={handleNewChat}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-white/5 rounded-lg transition-colors"
            title="New chat"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-container-padding flex flex-col gap-stack-lg z-10 custom-scrollbar">
          {messages.length === 0 && !isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Sparkles className="text-white" size={32} />
                </div>
                <h3 className="text-xl font-semibold text-on-surface mb-2">
                  How can I help you today?
                </h3>
                <p className="text-sm text-on-surface-variant">
                  Ask questions about our knowledge base, get help with
                  troubleshooting, or request information about our services.
                </p>
                <div className="flex flex-wrap gap-2 mt-6 justify-center">
                  {[
                    "How do I reset my password?",
                    "What are your support hours?",
                    "How to create a ticket?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                        inputRef.current?.focus();
                      }}
                      className="px-4 py-2 rounded-xl bg-surface-container-low border border-outline-variant text-sm text-on-surface-variant hover:border-primary hover:text-primary transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-4 max-w-[85%] mb-5 ${msg.role === "user" ? "self-end" : ""}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 mt-2 shadow-sm">
                  <Bot className="text-white" size={16} />
                </div>
              )}

              {msg.role === "user" ? (
                <>
                  <div className="bg-primary text-on-primary p-4 rounded-2xl rounded-tr-sm shadow-md">
                    <p className="font-body-md text-body-md whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center shrink-0 mt-2 text-sm font-semibold text-on-surface">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                  <div className="bg-surface-container-low border border-outline-variant text-on-surface p-4 rounded-2xl rounded-tl-sm shadow-sm">
                    <div className="prose prose-invert max-w-none text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/5">
                        {msg.sources.map((src, i) => (
                          <span
                            key={i}
                            className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                          >
                            {src.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Message actions */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <button
                      className={`p-1.5 rounded-md transition-colors ${
                        feedbackState[msg.id] === "helpful"
                          ? "text-green-400 bg-green-400/10"
                          : "text-on-surface-variant hover:text-green-400 hover:bg-green-400/10"
                      }`}
                      title="Helpful"
                      onClick={() => handleFeedback(msg.id, "helpful")}
                    >
                      <ThumbsUp
                        size={14}
                        fill={
                          feedbackState[msg.id] === "helpful"
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>
                    <button
                      className={`p-1.5 rounded-md transition-colors ${
                        feedbackState[msg.id] === "unhelpful"
                          ? "text-red-400 bg-red-400/10"
                          : "text-on-surface-variant hover:text-red-400 hover:bg-red-400/10"
                      }`}
                      title="Not helpful"
                      onClick={() => handleFeedback(msg.id, "unhelpful")}
                    >
                      <ThumbsDown
                        size={14}
                        fill={
                          feedbackState[msg.id] === "unhelpful"
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>
                    <button
                      className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-md transition-colors"
                      title="Copy"
                      onClick={() => handleCopy(msg.id, msg.content)}
                    >
                      {copiedId === msg.id ? (
                        <Check size={14} className="text-green-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                    <span className="text-[11px] text-on-surface-variant ml-auto">
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Streaming indicator */}
          {isLoading && (
            <div className="flex gap-4 max-w-[85%] mb-5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 mt-2 shadow-sm">
                <Bot className="text-white" size={16} />
              </div>
              <div className="bg-surface-container-low border border-outline-variant text-on-surface p-4 rounded-2xl rounded-tl-sm shadow-sm min-w-[100px]">
                {streamingContent ? (
                  <div className="prose prose-invert max-w-none text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamingContent}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-white/5 bg-surface/50 backdrop-blur-md z-10">
          <form
            onSubmit={handleSend}
            className="relative flex items-end gap-2 bg-surface-container-low border border-outline-variant rounded-2xl p-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none text-body-md text-on-surface focus:outline-none focus:ring-0 resize-none max-h-[150px] min-h-[44px] py-2.5 px-3 placeholder:text-on-surface-variant/50"
              placeholder="Ask a question..."
              rows={1}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-on-primary rounded-xl transition-all shadow-md hover:shadow-lg shrink-0 mb-0.5"
            >
              <Send size={20} />
            </button>
          </form>
          <div className="flex items-center gap-4 mt-3 px-2">
            <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">info</span>{" "}
              AI can make mistakes. Verify critical actions.
            </span>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 hidden xl:flex flex-col gap-stack-md h-full">
        {/* Sessions Dropdown */}
        <div className="glass-card flex-shrink-0 p-container-padding relative z-20">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setSessionsOpen(!sessionsOpen); }}
              className="flex-1 flex items-center gap-2 p-2 rounded-xl bg-surface-container-low border border-outline-variant hover:border-primary/30 transition-all text-left"
            >
              <MessageSquare size={16} className="text-primary shrink-0" />
              <span className="text-sm truncate flex-1">
                {activeSessionTitle || "New Chat"}
              </span>
              <svg className={`w-4 h-4 text-on-surface-variant transition-transform ${sessionsOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={handleNewChat}
              className="p-2 bg-primary/10 text-primary hover:bg-primary hover:text-on-primary rounded-xl transition-colors shrink-0"
              title="New Chat"
            >
              <Plus size={16} />
            </button>
          </div>

          {sessionsOpen && (
            <div onClick={(e) => e.stopPropagation()} className="absolute left-0 right-0 top-full mt-2 mx-px bg-surface-container-high border border-outline-variant rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar z-30">
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <span className="text-xs text-on-surface-variant">Loading...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-xs text-on-surface-variant">No sessions yet</p>
                </div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => { loadSessionMessages(s.id); setSessionsOpen(false); }}
                    className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-all border-b border-white/5 last:border-0 ${
                      sessionId === s.id
                        ? "bg-primary/10 text-on-surface"
                        : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
                    }`}
                  >
                    <MessageSquare size={14} className="shrink-0" />
                    <span className="text-sm truncate flex-1">{s.title || "Untitled"}</span>
                    <span className="text-[10px] text-on-surface-variant shrink-0">{timeAgo(s.updated_at)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                      className="p-1 text-on-surface-variant hover:text-red-400 opacity-60 hover:opacity-100 transition-opacity shrink-0"
                      title="Delete session"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Sources */}
        <div className="glass-card flex-1 p-container-padding flex flex-col gap-stack-md overflow-hidden">
          <button
            onClick={() => setSourcesCollapsed(!sourcesCollapsed)}
            className="flex items-center justify-between w-full"
          >
            <h3 className="font-headline-md text-[18px] font-semibold text-on-surface flex items-center gap-2">
              <Search className="text-primary" size={20} />
              Sources
            </h3>
            <span className="text-on-surface-variant text-sm">
              {sourcesCollapsed ? (
                <Plus size={16} />
              ) : (
                <X size={16} />
              )}
            </span>
          </button>
          {!sourcesCollapsed && (
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-unit pr-2">
              {sourcesToShow.length > 0
                ? sourcesToShow.map((src, i) => (
                    <div
                      key={i}
                      className="bg-surface-container-low border border-outline-variant p-3 rounded-xl hover:border-primary transition-colors"
                    >
                      <h4 className="font-body-sm text-body-sm font-semibold text-on-surface line-clamp-1">
                        {src.title}
                      </h4>
                      <p className="font-body-sm text-[12px] text-on-surface-variant mt-1 line-clamp-2">
                        {src.snippet}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-on-surface-variant">
                          {Math.round(src.relevance_score * 100)}% match
                        </span>
                      </div>
                    </div>
                  ))
                : messages.filter(
                    (m) =>
                      m.role === "assistant" &&
                      m.sources &&
                      m.sources.length > 0
                  ).length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-xs text-on-surface-variant text-center">
                        Ask a question to see cited sources
                      </p>
                    </div>
                  )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="glass-card h-48 p-container-padding flex flex-col gap-stack-md">
          <h3 className="font-headline-md text-[18px] font-semibold text-on-surface flex items-center gap-2">
            <Bot className="text-secondary" size={20} />
            Actions
          </h3>
          <button
            onClick={() => setShowNewTicket(true)}
            className="w-full bg-surface-container-low hover:bg-surface-container-high border border-outline-variant hover:border-primary p-3 rounded-xl flex items-center gap-3 transition-all group text-left"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-on-surface transition-colors">
              <Plus size={16} />
            </div>
            <div>
              <h4 className="font-body-sm text-body-sm font-semibold text-on-surface">
                Create Ticket
              </h4>
              <p className="text-[11px] text-on-surface-variant">
                Need human assistance?
              </p>
            </div>
          </button>
        </div>
      </div>
      <CreateTicketModal
        open={showNewTicket}
        onClose={() => setShowNewTicket(false)}
      />
    </div>
  );
}
