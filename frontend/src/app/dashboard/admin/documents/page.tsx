"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import { documentsAPI } from "@/lib/api"
import { timeAgo, cn } from "@/lib/utils"
import type { UploadedDocument } from "@/types"
import {
  Upload, FileText, Trash2, RefreshCw, Loader2, FileWarning,
  CheckCircle, XCircle, Clock, AlertCircle, Search, ChevronLeft, ChevronRight,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const PER_PAGE = 10

const STATUS_CONFIG: Record<string, { label: string; variant: string; icon: any }> = {
  processing: { label: "Processing", variant: "warning", icon: Clock },
  ready:      { label: "Ready",      variant: "success", icon: CheckCircle },
  failed:     { label: "Failed",     variant: "danger",  icon: XCircle },
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AdminDocumentsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [reindexingId, setReindexingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [maxDocs, setMaxDocs] = useState(50)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user?.role !== "admin" && user?.role !== "agent") {
      router.replace("/dashboard")
      return
    }
  }, [user, router])

  useEffect(() => {
    loadDocuments()
  }, [search, page])

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const res = await documentsAPI.list({ search: search || undefined, skip: page * PER_PAGE, limit: PER_PAGE })
      setDocuments(res.documents)
      setTotal(res.total)
      setMaxDocs(res.max_documents)
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadError("")

    try {
      const res = await documentsAPI.upload(file)
      setDocuments((prev) => [res.document, ...prev])
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed. Check file type and size limits.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document? It will be removed from the RAG index.")) return
    try {
      await documentsAPI.delete(id)
      setDocuments((prev) => prev.filter((d) => d.id !== id))
      setTotal(p => p - 1)
    } catch (e) {
      console.error(e);
    }
  }

  const handleReindex = async (id: string) => {
    setReindexingId(id)
    try {
      const res = await documentsAPI.reindex(id)
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, status: res.status as any, chunk_count: res.chunk_count }
            : d,
        ),
      )
    } catch (e) {
      console.error(e);
    } finally {
      setReindexingId(null)
    }
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Document Uploads</h1>
          <p className="text-sm text-[var(--on-surface-variant)] mt-1">
            Upload documents for AI training — {total}/{maxDocs} used
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleUpload}
            className="hidden"
            id="doc-upload"
          />
          <label
            htmlFor="doc-upload"
            className={cn(
              "btn-primary cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm",
              uploading && "opacity-50 pointer-events-none",
            )}
          >
            {uploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            {uploading ? "Uploading..." : "Upload Document"}
          </label>
        </div>
      </div>

      {uploadError && (
        <div className="p-4 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-[var(--danger)] text-sm flex items-start gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {uploadError}
        </div>
      )}

      <div className="relative max-w-md w-full">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          placeholder="Search documents..."
          className="w-full h-10 pl-9 pr-4 rounded-xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)] text-sm text-[var(--on-surface)] outline-none transition-all focus:border-[var(--primary)]/50 focus:shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.15)]"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : documents.length > 0 ? (
        <>
          <Card glass className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[var(--on-surface-variant)] text-xs uppercase tracking-wider">
                    <th className="text-left py-3 px-4 md:px-5 font-semibold">Document</th>
                    <th className="text-left py-3 px-4 md:px-5 font-semibold hidden sm:table-cell">Size</th>
                    <th className="text-left py-3 px-4 md:px-5 font-semibold hidden md:table-cell">Chunks</th>
                    <th className="text-left py-3 px-4 md:px-5 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 md:px-5 font-semibold hidden sm:table-cell">Uploaded</th>
                    <th className="text-right py-3 px-4 md:px-5 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => {
                    const cfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.failed
                    const StatusIcon = cfg.icon
                    return (
                      <tr key={doc.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 md:px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
                              <FileText size={15} className="text-[var(--primary)]" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-white truncate max-w-[200px]">{doc.title}</p>
                              <p className="text-xs text-[var(--on-surface-variant)] truncate">{doc.filename}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 md:px-5 text-[var(--on-surface-variant)] hidden sm:table-cell">
                          {formatSize(doc.file_size)}
                        </td>
                        <td className="py-3 px-4 md:px-5 text-[var(--on-surface-variant)] hidden md:table-cell">
                          {doc.chunk_count > 0 ? doc.chunk_count : "—"}
                        </td>
                        <td className="py-3 px-4 md:px-5">
                          <Badge variant={cfg.variant as any}>
                            <StatusIcon size={10} />
                            {cfg.label}
                          </Badge>
                          {doc.error_message && (
                            <p className="text-[10px] text-[var(--danger)] mt-1 max-w-[200px] truncate" title={doc.error_message}>
                              {doc.error_message}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 md:px-5 text-[var(--on-surface-variant)] text-xs hidden sm:table-cell">
                          {timeAgo(doc.created_at)}
                        </td>
                        <td className="py-3 px-4 md:px-5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleReindex(doc.id)}
                              disabled={reindexingId === doc.id}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--primary)] transition-colors disabled:opacity-50"
                              title="Re-index"
                            >
                              {reindexingId === doc.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <RefreshCw size={14} />
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="p-1.5 rounded-lg hover:bg-[var(--danger)]/10 text-[var(--danger)] transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="flex items-center justify-between">
            <p className="text-sm text-[var(--on-surface-variant)]">
              Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={16} /> Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <Card glass className="p-12 md:p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 flex items-center justify-center mx-auto mb-4">
            <Upload size={24} className="text-[var(--primary)]" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No documents uploaded</h3>
          <p className="text-sm text-[var(--on-surface-variant)] mb-5">
            Upload PDF, DOCX, or TXT files to train the AI assistant.
          </p>
          <label htmlFor="doc-upload-empty" className="btn-primary cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm">
            <Upload size={16} />
            Upload your first document
          </label>
          <input
            id="doc-upload-empty"
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleUpload}
            className="hidden"
          />
        </Card>
      )}

      {/* Info card */}
      <div className="glass-card p-5 text-sm text-[var(--on-surface-variant)] space-y-2">
        <h4 className="font-semibold text-white">About Document Uploads</h4>
        <ul className="space-y-1 text-[13px] list-disc list-inside">
          <li>Supported formats: <strong>PDF</strong>, <strong>DOCX</strong>, <strong>TXT</strong></li>
          <li>Maximum file size: <strong>{10} MB</strong></li>
          <li>Maximum documents: <strong>{maxDocs}</strong> per admin</li>
          <li>Documents are chunked, embedded, and indexed into Pinecone for RAG</li>
          <li>The AI assistant will automatically use uploaded documents as context</li>
          <li>If a document fails to index, check the error message and try re-indexing</li>
        </ul>
      </div>
    </div>
  )
}
