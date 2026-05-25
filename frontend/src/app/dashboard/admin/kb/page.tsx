"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import { kbAPI } from "@/lib/api"
import { timeAgo, truncate } from "@/lib/utils"
import type { KBArticle } from "@/types"
import {
  Plus, Edit, Trash2, Eye, EyeOff, Loader2, BookOpen, Search, X
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export default function AdminKBPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [articles, setArticles] = useState<KBArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showEditor, setShowEditor] = useState(false)
  const [editingArticle, setEditingArticle] = useState<KBArticle|null>(null)
  const [form, setForm] = useState({title:"",body:"",tags:"",is_published:false})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user?.role!=="admin"&&user?.role!=="agent") { router.replace("/dashboard"); return; }
    loadArticles()
  }, [user, router])

  const loadArticles = async () => {
    setLoading(true)
    try { setArticles(await kbAPI.getArticles({limit:100})) } catch {} finally { setLoading(false) }
  }

  const handleSave = async () => {
    if (!form.title||!form.body) return
    setSaving(true)
    try {
      const payload = {title:form.title, body:form.body, tags:form.tags.split(",").map(t=>t.trim()).filter(Boolean), is_published:form.is_published}
      if (editingArticle) { await kbAPI.updateArticle(editingArticle.id, payload) }
      else { await kbAPI.createArticle(payload) }
      setShowEditor(false); setEditingArticle(null); setForm({title:"",body:"",tags:"",is_published:false})
      await loadArticles()
    } catch {} finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this article?")) return
    try { await kbAPI.deleteArticle(id); setArticles(p=>p.filter(a=>a.id!==id)) } catch {}
  }

  const handleEdit = (a: KBArticle) => {
    setEditingArticle(a); setForm({title:a.title,body:a.body,tags:a.tags.join(", "),is_published:a.is_published}); setShowEditor(true)
  }

  const filtered = search ? articles.filter(a=>a.title.toLowerCase().includes(search.toLowerCase())) : articles

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Manage Knowledge Base</h1>
          <p className="text-sm text-[var(--on-surface-variant)] mt-1">{articles.length} articles</p>
        </div>
        <Button onClick={()=>{setEditingArticle(null);setForm({title:"",body:"",tags:"",is_published:false});setShowEditor(true)}}>
          <Plus size={16}/>New Article
        </Button>
      </div>

      {showEditor && (
        <Dialog open={showEditor} onClose={() => setShowEditor(false)}>
          <DialogContent title={editingArticle ? "Edit Article" : "New Article"} onClose={() => setShowEditor(false)}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Article title" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="body">Content</Label>
                <textarea
                  id="body"
                  value={form.body}
                  onChange={e=>setForm({...form,body:e.target.value})}
                  placeholder="Article content (Markdown supported)…"
                  className="flex w-full rounded-lg border border-[var(--outline-variant)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)]/50 outline-none transition-all focus:border-[var(--primary)]/50 focus:bg-[rgba(var(--primary-rgb),0.06)] focus:shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.15)] resize-none"
                  rows={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tags">Tags</Label>
                <Input id="tags" value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})} placeholder="Tags (comma separated)" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={e=>setForm({...form,is_published:e.target.checked})}
                  className="w-4 h-4 rounded border-[var(--outline-variant)] accent-[var(--primary)]"
                />
                <span className="text-sm text-[var(--on-surface-variant)]">Publish immediately</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={()=>setShowEditor(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving||!form.title||!form.body}>
                  {saving ? <Loader2 size={16} className="animate-spin"/> : null}
                  {saving ? "Saving…" : "Save Article"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div className="relative max-w-md w-full">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]" />
        <Input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="Search articles…"
          className="pl-9"
        />
        {search && (
          <button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)] hover:text-white transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({length:5}).map((_,i)=>(
            <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <Card glass className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[var(--on-surface-variant)] text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4 md:px-5 font-semibold">Title</th>
                  <th className="text-left py-3 px-4 md:px-5 font-semibold hidden sm:table-cell">Status</th>
                  <th className="text-left py-3 px-4 md:px-5 font-semibold hidden md:table-cell">Views</th>
                  <th className="text-left py-3 px-4 md:px-5 font-semibold hidden sm:table-cell">Updated</th>
                  <th className="text-right py-3 px-4 md:px-5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a=>(
                  <tr key={a.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 md:px-5 font-medium text-white">{truncate(a.title,40)}</td>
                    <td className="py-3 px-4 md:px-5 hidden sm:table-cell">
                      {a.is_published
                        ? <Badge variant="success"><Eye size={10}/>Published</Badge>
                        : <Badge variant="outline"><EyeOff size={10}/>Draft</Badge>
                      }
                    </td>
                    <td className="py-3 px-4 md:px-5 text-[var(--on-surface-variant)] hidden md:table-cell">{a.view_count}</td>
                    <td className="py-3 px-4 md:px-5 text-[var(--on-surface-variant)] hidden sm:table-cell text-xs">{timeAgo(a.updated_at)}</td>
                    <td className="py-3 px-4 md:px-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={()=>handleEdit(a)} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--primary)] transition-colors"><Edit size={14}/></button>
                        <button onClick={()=>handleDelete(a.id)} className="p-1.5 rounded-lg hover:bg-[var(--danger)]/10 text-[var(--danger)] transition-colors"><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card glass className="p-12 md:p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-4">
            <BookOpen size={24} className="text-[var(--primary)]" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No articles yet</h3>
          <p className="text-sm text-[var(--on-surface-variant)] mb-5">Create your first knowledge base article to get started.</p>
          <Button onClick={()=>{setEditingArticle(null);setForm({title:"",body:"",tags:"",is_published:false});setShowEditor(true)}}>
            <Plus size={16}/>Create first article
          </Button>
        </Card>
      )}
    </div>
  )
}
