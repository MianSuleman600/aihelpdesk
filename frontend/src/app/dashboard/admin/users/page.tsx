"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/apiClient"
import { Shield, UserCheck, UserX, Search, RefreshCw, Mail } from "lucide-react"
import type { User } from "@/types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"

export default function AdminUsersPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (user?.role !== "admin") { router.replace("/dashboard"); return; }
    fetchUsers()
  }, [user, router])

  const fetchUsers = async () => {
    setLoading(true)
    setError("")
    try {
      const data = await apiClient.get<User[]>("/admin/users", search ? { search } : undefined)
      setUsers(data)
    } catch {
      setError("Failed to load users")
    } finally {
      setLoading(false)
    }
  }

  const toggleStatus = async (userId: string) => {
    try {
      await apiClient.patch(`/admin/users/${userId}/toggle-status`, {})
      fetchUsers()
    } catch { /* ignore */ }
  }

  const changeRole = async (userId: string, role: string) => {
    try {
      await apiClient.patch(`/admin/users/${userId}/role?role=${role}`, {})
      fetchUsers()
    } catch { /* ignore */ }
  }

  const ROLE_COLORS: Record<string, string> = {
    admin: "bg-[var(--primary-hover)]/15 text-[var(--primary-light)]",
    agent: "bg-[var(--primary)]/15 text-[var(--primary)]",
    user: "bg-white/5 text-[var(--on-surface-variant)]",
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Manage Users</h1>
          <p className="text-sm text-[var(--on-surface-variant)] mt-1">View and manage user accounts</p>
        </div>
        <button
          onClick={fetchUsers}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors text-[var(--on-surface-variant)] hover:text-white"
          title="Refresh"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchUsers()}
          placeholder="Search users..."
          className="w-full h-10 pl-9 pr-4 rounded-xl bg-[var(--surface-container-low)] border border-[var(--outline-variant)] text-sm text-[var(--on-surface)] outline-none transition-all focus:border-[var(--primary)]/50 focus:shadow-[0_0_0_3px_rgba(var(--primary-rgb),0.15)]"
        />
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-[var(--danger)] text-sm">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/5 rounded w-1/3" />
                  <div className="h-3 bg-white/5 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card glass className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[var(--on-surface-variant)] text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4 md:px-5 font-semibold">User</th>
                  <th className="text-left py-3 px-4 md:px-5 font-semibold">Role</th>
                  <th className="text-left py-3 px-4 md:px-5 font-semibold hidden sm:table-cell">Status</th>
                  <th className="text-right py-3 px-4 md:px-5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-[var(--on-surface-variant)]">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 md:px-5">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} size="md" />
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{u.name}</p>
                            <p className="text-xs text-[var(--on-surface-variant)] flex items-center gap-1 truncate">
                              <Mail size={10} /> {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 md:px-5">
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u.id, e.target.value)}
                          disabled={u.id === user?.id}
                          className={`appearance-none cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide border-0 outline-none ${ROLE_COLORS[u.role] || ROLE_COLORS.user}`}
                        >
                          <option value="user">user</option>
                          <option value="agent">agent</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 md:px-5 hidden sm:table-cell">
                        {u.is_active ? (
                          <span className="flex items-center gap-1 text-xs text-[var(--success)]">
                            <UserCheck size={14} /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-[var(--on-surface-variant)]">
                            <UserX size={14} /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 md:px-5 text-right">
                        {u.id !== user?.id && (
                          <button
                            onClick={() => toggleStatus(u.id)}
                            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                              u.is_active
                                ? "bg-[var(--danger)]/10 text-[var(--danger)] hover:bg-[var(--danger)]/20"
                                : "bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20"
                            }`}
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
