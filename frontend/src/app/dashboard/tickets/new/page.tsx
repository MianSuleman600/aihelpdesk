"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ticketsAPI, kbAPI } from "@/lib/api";
import type { Category, Priority } from "@/types";
import { ArrowLeft, Send, Loader2, AlertCircle } from "lucide-react";

export default function NewTicketPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    kbAPI.getCategories().then(setCategories).catch(()=>{});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()||!description.trim()) { setError("Please fill in all required fields."); return; }
    setLoading(true); setError("");
    try {
      const ticket = await ticketsAPI.create({ subject, description, priority, category_id: categoryId||undefined });
      router.push(`/dashboard/tickets/${ticket.id}`);
    } catch (err: unknown) {
      setError((err as {response?:{data?:{detail?:string}}})?.response?.data?.detail||"Failed to create ticket.");
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={()=>router.back()} className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)] hover:text-[var(--primary)] transition-colors mb-6"><ArrowLeft size={16}/>Back to Tickets</button>
      <div className="glass-card p-8 animate-fade-in">
        <h1 className="text-2xl font-bold mb-6">Create Support Ticket</h1>
        {error&&<div className="flex items-center gap-2 p-3 mb-6 rounded-lg bg-[var(--rose)]/10 border border-[var(--rose)]/20 text-[var(--rose)] text-sm"><AlertCircle size={16}/><span>{error}</span></div>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--on-surface-variant)]">Subject *</label>
            <input type="text" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Brief description of your issue" className="input-field" required/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--on-surface-variant)]">Description *</label>
            <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Provide details about your issue…" className="input-field" rows={5} required/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--on-surface-variant)]">Priority</label>
              <select value={priority} onChange={e=>setPriority(e.target.value as Priority)} className="input-field appearance-none cursor-pointer">
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--on-surface-variant)]">Category</label>
              <select value={categoryId} onChange={e=>setCategoryId(e.target.value)} className="input-field appearance-none cursor-pointer">
                <option value="">Select category</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={()=>router.back()} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading?<Loader2 size={16} className="animate-spin"/>:<Send size={16}/>}{loading?"Creating…":"Create Ticket"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
