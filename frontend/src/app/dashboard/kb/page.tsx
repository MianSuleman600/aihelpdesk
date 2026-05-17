"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { kbAPI } from "@/lib/api";
import { timeAgo, truncate, stripHtml } from "@/lib/utils";
import type { KBArticle, Category } from "@/types";
import { Search, BookOpen, Eye, Clock, Tag, Filter, X } from "lucide-react";

export default function KBBrowsePage() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [arts, cats] = await Promise.allSettled([
          kbAPI.getArticles({ search: search||undefined, category_id: selectedCategory||undefined, limit: 50 }),
          kbAPI.getCategories(),
        ]);
        if (arts.status === "fulfilled") setArticles(arts.value);
        if (cats.status === "fulfilled") setCategories(cats.value);
      } catch {} finally { setLoading(false); }
    };
    load();
  }, [search, selectedCategory]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Knowledge Base</h1><p className="text-[var(--on-surface-variant)] text-sm mt-1">Browse articles, guides, and documentation</p></div>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[300px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]"/>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search articles…" className="input-field pl-10 pr-10"/>
          {search&&<button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] hover:text-white"><X size={16}/></button>}
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]"/>
          <select value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value)} className="input-field pl-9 pr-8 appearance-none cursor-pointer" style={{minWidth:180}}>
            <option value="">All Categories</option>
            {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({length:6}).map((_,i)=><div key={i} className="glass-card p-5"><div className="skeleton h-5 w-24 mb-3"/><div className="skeleton h-6 w-full mb-2"/><div className="skeleton h-4 w-full mb-1"/><div className="skeleton h-4 w-3/4"/></div>)}
        </div>
      ) : articles.length > 0 ? (
        <>
          <p className="text-sm text-[var(--on-surface-variant)]">{articles.length} article{articles.length!==1?"s":""} found</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map((a,i)=>(
              <Link key={a.id} href={`/dashboard/kb/${a.id}`} className="glass-card p-5 group animate-fade-in" style={{animationDelay:`${i*50}ms`}}>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {a.tags.slice(0,2).map(t=><span key={t} className="badge bg-[var(--indigo)]/15 text-[var(--primary)]"><Tag size={10}/>{t}</span>)}
                </div>
                <h3 className="font-semibold mb-2 line-clamp-2 group-hover:text-[var(--primary)] transition-colors">{a.title}</h3>
                <p className="text-sm text-[var(--on-surface-variant)] line-clamp-3">{truncate(stripHtml(a.body),120)}</p>
                <div className="flex items-center gap-4 mt-4 text-xs text-[var(--on-surface-variant)]/70">
                  <span className="flex items-center gap-1"><Eye size={12}/>{a.view_count} views</span>
                  <span className="flex items-center gap-1"><Clock size={12}/>{timeAgo(a.updated_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="glass-card p-16 text-center">
          <BookOpen size={48} className="mx-auto mb-4 text-[var(--on-surface-variant)]"/>
          <h3 className="text-lg font-semibold mb-2">No articles found</h3>
          <p className="text-[var(--on-surface-variant)]">{search?"Try a different search term.":"The knowledge base is empty."}</p>
        </div>
      )}
    </div>
  );
}
