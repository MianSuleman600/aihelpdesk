"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ticketsAPI, kbAPI } from "@/lib/api"
import { ApiError } from "@/lib/apiClient"
import type { Category, Priority } from "@/types"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Send, Loader2, AlertCircle } from "lucide-react"

interface Props {
  open: boolean
  onClose: () => void
}

export function CreateTicketModal({ open, onClose }: Props) {
  const router = useRouter()
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState<Priority>("medium")
  const [categoryId, setCategoryId] = useState("")
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) {
      setSubject("")
      setDescription("")
      setPriority("medium")
      setCategoryId("")
      setError("")
      kbAPI.getCategories().then(setCategories).catch((e) => console.error(e))
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !description.trim()) {
      setError("Please fill in all required fields.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const ticket = await ticketsAPI.create({
        subject,
        description,
        priority,
        category_id: categoryId || undefined,
      })
      onClose()
      router.push(`/dashboard/tickets/${ticket.id}`)
    } catch (err: unknown) {
      setError(
        err instanceof ApiError ? err.message : "Failed to create ticket."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent title="Create Support Ticket" onClose={onClose}>
        {error && (
          <div className="flex items-center gap-2 p-3 mb-5 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-[var(--danger)] text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of your issue"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description *</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide details about your issue…"
              className="flex w-full rounded-lg border border-[var(--outline-variant)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)]/50 outline-none transition-all focus:border-[var(--primary)]/50 focus:bg-[rgba(var(--primary-rgb),0.06)] focus:shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.15)] resize-none"
              rows={4}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Category</Label>
              <Select
                id="category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {loading ? "Creating…" : "Create Ticket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
