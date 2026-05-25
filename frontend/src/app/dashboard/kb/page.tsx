"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { kbAPI } from "@/lib/api";
import { timeAgo, truncate, stripHtml } from "@/lib/utils";
import type { KBArticle, Category } from "@/types";
import { Search, BookOpen, Eye, Clock, Tag, Filter, X, ArrowUpRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

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
          kbAPI.getArticles({
            search: search || undefined,
            category_id: selectedCategory || undefined,
            limit: 50,
          }),
          kbAPI.getCategories(),
        ]);
        if (arts.status === "fulfilled") setArticles(arts.value);
        if (cats.status === "fulfilled") setCategories(cats.value);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [search, selectedCategory]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-[var(--on-surface-variant)] text-sm mt-1">
            Browse articles, guides, and documentation
          </p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[300px]">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]/50"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles…"
            className="w-full py-2.5 pl-10 pr-10 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[var(--outline-variant)]/50 text-sm text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/50 outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/15 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="relative">
          <Filter
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]/50"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="py-2.5 pl-9 pr-8 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[var(--outline-variant)]/50 text-sm text-[var(--on-surface)] outline-none focus:border-[var(--primary)]/50 focus:ring-2 focus:ring-[var(--primary)]/15 transition-all appearance-none cursor-pointer"
            style={{ minWidth: 180 }}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-4 mt-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : articles.length > 0 ? (
        <>
          <p className="text-sm text-[var(--on-surface-variant)]">
            {articles.length} article{articles.length !== 1 ? "s" : ""} found
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((a, i) => (
              <Link
                key={a.id}
                href={`/dashboard/kb/${a.id}`}
                className="animate-fade-in"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <Card className="h-full group hover:border-[var(--primary)]/25 transition-all duration-300 hover:shadow-lg hover:shadow-[var(--primary)]/5 cursor-pointer">
                  <CardContent className="p-5">
                    {/* Tags */}
                    <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                      {a.tags.slice(0, 2).map((t) => (
                        <Badge key={t} variant="default" className="text-[10px] gap-1">
                          <Tag size={9} />
                          {t}
                        </Badge>
                      ))}
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold mb-2 line-clamp-2 group-hover:text-[var(--primary)] transition-colors leading-snug">
                      {a.title}
                    </h3>

                    {/* Preview */}
                    <p className="text-sm text-[var(--on-surface-variant)] line-clamp-3 leading-relaxed">
                      {truncate(stripHtml(a.body), 120)}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-4 mt-4 text-xs text-[var(--on-surface-variant)]/60">
                      {(() => { const cat = categories.find(c => c.id === a.category_id); return cat ? <span className="text-[var(--primary)]/70">{cat.icon} {cat.name}</span> : null })()}
                      <span className="flex items-center gap-1">
                        <Eye size={11} />
                        {a.view_count} views
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {timeAgo(a.updated_at)}
                      </span>
                      <ArrowUpRight
                        size={13}
                        className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-[var(--primary)]"
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={BookOpen}
            title="No articles found"
            description={
              search
                ? "Try a different search term or clear your filters."
                : "The knowledge base is empty. Articles will appear here once published."
            }
          />
        </Card>
      )}
    </div>
  );
}
