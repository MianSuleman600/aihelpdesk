"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { aiAPI, tokenUtils } from "@/lib/api";
import { API_BASE_URL } from "@/lib/constants";
import type { AIChatSource } from "@/types";
import { CreateTicketModal } from "@/components/tickets/CreateTicketModal";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: AIChatSource[];
  confidence?: number;
  suggest_ticket?: boolean;
  timestamp: string;
}

export default function AIChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingSources, setStreamingSources] = useState<AIChatSource[]>([]);
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

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const query = input.trim();
    setInput("");

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: query,
      timestamp: "Just now",
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setStreamingContent("");
    setStreamingSources([]);

    try {
      const res = await fetch(
        `${API_BASE_URL}/ai/chat/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenUtils.get()}`,
          },
          body: JSON.stringify({ query, session_id: sessionId }),
        }
      );
      if (!res.ok) throw new Error("Stream failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      let buffer = "";
      let fullContent = "";
      let finalSources: any[] = [];
      let streamSessionId = "";
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
            } catch { /* skip malformed */ }
          }
        }
      }
      if (streamSessionId) setSessionId(streamSessionId);
      const finalMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: fullContent,
        sources: finalSources,
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, finalMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, I encountered an error processing your request. Please try again or create a ticket if the issue persists.",
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setStreamingContent("");
      setStreamingSources([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 flex gap-bento-gap h-[calc(100vh-144px)] overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 glass-card flex flex-col h-full relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent h-32 pointer-events-none"></div>

        {/* Chat Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-surface/30 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-white text-[20px]">psychology</span>
            </div>
            <div>
              <h2 className="font-headline-md text-[18px] font-semibold text-on-surface">Support AI</h2>
              <p className="font-body-sm text-[12px] text-[var(--primary)] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse"></span>
                Online
              </p>
            </div>
          </div>
          <button
            onClick={() => { setMessages([]); setSessionId(null); }}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-white/5 rounded-lg transition-colors"
            title="New chat"
          >
            <span className="material-symbols-outlined">add</span>
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-container-padding flex flex-col gap-stack-lg z-10 custom-scrollbar">
          {messages.length === 0 && !isLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <span className="material-symbols-outlined text-white text-[32px]">psychology</span>
                </div>
                <h3 className="text-xl font-semibold text-on-surface mb-2">How can I help you today?</h3>
                <p className="text-sm text-on-surface-variant">
                  Ask questions about our knowledge base, get help with troubleshooting, or request information about our services.
                </p>
                <div className="flex flex-wrap gap-2 mt-6 justify-center">
                  {[
                    "How do I reset my password?",
                    "What are your support hours?",
                    "How to create a ticket?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus(); }}
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
            <div key={msg.id} className={`flex gap-4 max-w-[85%] ${msg.role === "user" ? "self-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 mt-2 shadow-sm">
                  <span className="material-symbols-outlined text-white text-[16px]">psychology</span>
                </div>
              )}

              {msg.role === "user" ? (
                <>
                  <div className="bg-primary text-on-primary p-4 rounded-2xl rounded-tr-sm shadow-md">
                    <p className="font-body-md text-body-md whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center shrink-0 mt-2 text-sm font-semibold text-on-surface">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2 min-w-0">
                  <div className="bg-surface-container-low border border-outline-variant text-on-surface p-4 rounded-2xl rounded-tl-sm shadow-sm">
                    <p className="font-body-md text-body-md whitespace-pre-wrap">{msg.content}</p>

                    {msg.suggest_ticket && (
                      <div className="mt-4 p-3 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20">
                        <p className="text-xs text-[var(--primary)] font-medium mb-1">Not enough information available</p>
                        <p className="text-xs text-on-surface-variant">
                          I couldn't find relevant information in the knowledge base. Please{" "}
                          <button onClick={() => setShowNewTicket(true)} className="text-primary hover:underline inline">
                            create a support ticket
                          </button>
                          {" "}and our team will assist you.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Feedback buttons */}
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      className="p-1.5 text-on-surface-variant hover:text-[var(--primary)] rounded-md transition-colors"
                      title="Helpful"
                      onClick={() => {
                        aiAPI.submitFeedback({
                          context_type: "chat",
                          query: messages.filter(m => m.role === "user").slice(-1)[0]?.content || "",
                          response: msg.content,
                          rating: "helpful",
                        }).catch(() => {});
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]">thumb_up</span>
                    </button>
                    <button
                      className="p-1.5 text-on-surface-variant hover:text-[var(--danger)] rounded-md transition-colors"
                      title="Not helpful"
                      onClick={() => {
                        aiAPI.submitFeedback({
                          context_type: "chat",
                          query: messages.filter(m => m.role === "user").slice(-1)[0]?.content || "",
                          response: msg.content,
                          rating: "unhelpful",
                        }).catch(() => {});
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]">thumb_down</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading / Streaming indicator */}
          {isLoading && (
            <div className="flex gap-4 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 mt-2 shadow-sm">
                <span className="material-symbols-outlined text-white text-[16px]">psychology</span>
              </div>
              <div className="bg-surface-container-low border border-outline-variant text-on-surface p-4 rounded-2xl rounded-tl-sm shadow-sm min-w-[100px]">
                {streamingContent ? (
                  <p className="font-body-md text-body-md whitespace-pre-wrap">{streamingContent}</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-white/5 bg-surface/50 backdrop-blur-md z-10">
          <form onSubmit={handleSend} className="relative flex items-end gap-2 bg-surface-container-low border border-outline-variant rounded-2xl p-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
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
              <span className="material-symbols-outlined text-[20px]">send</span>
            </button>
          </form>
          <div className="flex items-center gap-4 mt-3 px-2">
            <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">info</span> AI can make mistakes. Verify critical actions.
            </span>
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 hidden xl:flex flex-col gap-stack-md h-full">
        <div className="glass-card flex-1 p-container-padding flex flex-col gap-stack-md overflow-hidden">
          <h3 className="font-headline-md text-[18px] font-semibold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">source</span>
            Sources Cited
          </h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-unit pr-2">
            {streamingSources.length > 0
              ? streamingSources.map((src, i) => (
                  <div key={i} className="bg-surface-container-low border border-outline-variant p-3 rounded-xl hover:border-primary transition-colors">
                    <h4 className="font-body-sm text-body-sm font-semibold text-on-surface line-clamp-1">{src.title}</h4>
                    <p className="font-body-sm text-[12px] text-on-surface-variant mt-1 line-clamp-2">{src.snippet}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-on-surface-variant">{Math.round(src.relevance_score * 100)}% match</span>
                    </div>
                  </div>
                ))
              : messages
                  .filter((m) => m.role === "assistant" && m.sources && m.sources.length > 0)
                  .slice(-1)[0]
                  ?.sources?.map((src, i) => (
                    <a
                      key={i}
                      href={`/dashboard/kb/${src.article_id}`}
                      className="bg-surface-container-low border border-outline-variant p-3 rounded-xl hover:border-primary transition-colors group block"
                    >
                      <h4 className="font-body-sm text-body-sm font-semibold text-on-surface group-hover:text-primary transition-colors line-clamp-1">{src.title}</h4>
                      <p className="font-body-sm text-[12px] text-on-surface-variant mt-1 line-clamp-2">{src.snippet}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-on-surface-variant">{Math.round(src.relevance_score * 100)}% match</span>
                      </div>
                    </a>
                  ))}
            {messages.length === 0 && !isLoading && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-on-surface-variant text-center">Ask a question to see cited sources</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass-card h-48 p-container-padding flex flex-col gap-stack-md">
          <h3 className="font-headline-md text-[18px] font-semibold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[20px]">smart_toy</span>
            Actions
          </h3>
          <button
            onClick={() => setShowNewTicket(true)}
            className="w-full bg-surface-container-low hover:bg-surface-container-high border border-outline-variant hover:border-primary p-3 rounded-xl flex items-center gap-3 transition-all group text-left"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
            </div>
            <div>
              <h4 className="font-body-sm text-body-sm font-semibold text-on-surface">Create Ticket</h4>
              <p className="text-[11px] text-on-surface-variant">Need human assistance?</p>
            </div>
          </button>
        </div>
      </div>
      <CreateTicketModal open={showNewTicket} onClose={() => setShowNewTicket(false)} />
    </div>
  );
}
