"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { kbAPI } from "@/lib/api";
import { formatDateTime, timeAgo } from "@/lib/utils";
import type { KBArticle } from "@/types";
import { ArrowLeft, Clock, Eye, Tag, User, Loader2 } from "lucide-react";

export default function KBArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [article, setArticle] = useState<KBArticle|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try { const a = await kbAPI.getArticle(id); setArticle(a); }
      catch { setError("Article not found."); }
      finally { setLoading(false); }
    };
    load();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[var(--primary)]"/></div>;
  if (error||!article) return (
    <div className="glass-card p-16 text-center max-w-lg mx-auto">
      <h2 className="text-xl font-semibold mb-2">Article Not Found</h2>
      <p className="text-[var(--on-surface-variant)] mb-4">{error}</p>
      <button onClick={()=>router.back()} className="btn-secondary"><ArrowLeft size={16}/>Go Back</button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={()=>router.back()} className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)] hover:text-[var(--primary)] transition-colors mb-6">
        <ArrowLeft size={16}/> Back to Knowledge Base
      </button>
      <article className="glass-card p-8 animate-fade-in">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {article.tags.map(t=><span key={t} className="badge bg-[var(--primary)]/15 text-[var(--primary)]"><Tag size={10}/>{t}</span>)}
        </div>
        <h1 className="text-3xl font-bold mb-4 leading-tight">{article.title}</h1>
        <div className="flex items-center gap-4 text-sm text-[var(--on-surface-variant)] mb-8 pb-6 border-b border-white/5">
          <span className="flex items-center gap-1"><Clock size={14}/>{formatDateTime(article.created_at)}</span>
          <span className="flex items-center gap-1"><Eye size={14}/>{article.view_count} views</span>
          <span className="flex items-center gap-1"><User size={14}/>Updated {timeAgo(article.updated_at)}</span>
        </div>
        <div className="prose prose-invert max-w-none text-[var(--on-surface)] leading-relaxed whitespace-pre-wrap">{article.body}</div>
      </article>
    </div>
  );
}
