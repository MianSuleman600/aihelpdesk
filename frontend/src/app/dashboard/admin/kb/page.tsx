"use client";
/* Admin KB Management — CRUD articles */
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { kbAPI } from "@/lib/api";
import { timeAgo, truncate } from "@/lib/utils";
import type { KBArticle } from "@/types";
import { Plus, Edit, Trash2, Eye, EyeOff, Loader2, BookOpen, Search } from "lucide-react";

export default function AdminKBPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KBArticle|null>(null);
  const [form, setForm] = useState({title:"",body:"",tags:"",is_published:false});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role!=="admin"&&user?.role!=="agent") { router.replace("/dashboard"); return; }
    loadArticles();
  }, [user, router]);

  const loadArticles = async () => {
    setLoading(true);
    try { setArticles(await kbAPI.getArticles({limit:100})); } catch {} finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!form.title||!form.body) return;
    setSaving(true);
    try {
      const payload = {title:form.title, body:form.body, tags:form.tags.split(",").map(t=>t.trim()).filter(Boolean), is_published:form.is_published};
      if (editingArticle) { await kbAPI.updateArticle(editingArticle.id, payload); }
      else { await kbAPI.createArticle(payload); }
      setShowEditor(false); setEditingArticle(null); setForm({title:"",body:"",tags:"",is_published:false});
      await loadArticles();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    try { await kbAPI.deleteArticle(id); setArticles(p=>p.filter(a=>a.id!==id)); } catch {}
  };

  const handleEdit = (a: KBArticle) => {
    setEditingArticle(a); setForm({title:a.title,body:a.body,tags:a.tags.join(", "),is_published:a.is_published}); setShowEditor(true);
  };

  const filtered = search ? articles.filter(a=>a.title.toLowerCase().includes(search.toLowerCase())) : articles;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold">Manage Knowledge Base</h1><p className="text-sm text-[var(--on-surface-variant)] mt-1">{articles.length} articles</p></div>
        <button onClick={()=>{setEditingArticle(null);setForm({title:"",body:"",tags:"",is_published:false});setShowEditor(true);}} className="btn-primary"><Plus size={16}/>New Article</button>
      </div>

      {/* Editor modal */}
      {showEditor&&(
        <div className="glass-card p-6 space-y-4 animate-fade-in border border-[var(--indigo)]/20">
          <h2 className="text-lg font-semibold">{editingArticle?"Edit Article":"New Article"}</h2>
          <input type="text" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Article title" className="input-field"/>
          <textarea value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Article content (Markdown supported)…" className="input-field" rows={8}/>
          <input type="text" value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="Tags (comma separated)" className="input-field"/>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_published} onChange={e=>setForm({...form,is_published:e.target.checked})} className="w-4 h-4 rounded border-[var(--outline-variant)]"/><span className="text-sm">Publish immediately</span></label>
          <div className="flex justify-end gap-3">
            <button onClick={()=>setShowEditor(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving||!form.title||!form.body} className="btn-primary">{saving?<Loader2 size={16} className="animate-spin"/>:null}{saving?"Saving…":"Save Article"}</button>
          </div>
        </div>
      )}

      <div className="relative max-w-md"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]"/><input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search articles…" className="input-field pl-10"/></div>

      {loading?<div className="space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="skeleton h-16 w-full"/>)}</div>:
      filtered.length>0?(
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="border-b border-white/5 text-[var(--on-surface-variant)] text-xs uppercase tracking-wider">
            <th className="text-left py-3 px-5 font-semibold">Title</th><th className="text-left py-3 px-5 font-semibold">Status</th><th className="text-left py-3 px-5 font-semibold">Views</th><th className="text-left py-3 px-5 font-semibold">Updated</th><th className="text-right py-3 px-5 font-semibold">Actions</th>
          </tr></thead><tbody>{filtered.map(a=>(
            <tr key={a.id} className="border-b border-white/3 hover:bg-white/3 transition-colors">
              <td className="py-3 px-5 font-medium">{truncate(a.title,50)}</td>
              <td className="py-3 px-5">{a.is_published?<span className="badge bg-emerald-500/20 text-emerald-400"><Eye size={10}/>Published</span>:<span className="badge bg-[var(--outline)]/20 text-[var(--on-surface-variant)]"><EyeOff size={10}/>Draft</span>}</td>
              <td className="py-3 px-5 text-[var(--on-surface-variant)]">{a.view_count}</td>
              <td className="py-3 px-5 text-[var(--on-surface-variant)]">{timeAgo(a.updated_at)}</td>
              <td className="py-3 px-5 text-right"><div className="flex items-center justify-end gap-2"><button onClick={()=>handleEdit(a)} className="p-2 rounded hover:bg-white/5 text-[var(--primary)]"><Edit size={14}/></button><button onClick={()=>handleDelete(a.id)} className="p-2 rounded hover:bg-[var(--rose)]/10 text-[var(--rose)]"><Trash2 size={14}/></button></div></td>
            </tr>
          ))}</tbody></table>
        </div>
      ):<div className="glass-card p-16 text-center"><BookOpen size={48} className="mx-auto mb-4 text-[var(--on-surface-variant)]"/><h3 className="text-lg font-semibold mb-2">No articles yet</h3><button onClick={()=>setShowEditor(true)} className="btn-primary mt-2"><Plus size={16}/>Create first article</button></div>}
    </div>
  );
}
