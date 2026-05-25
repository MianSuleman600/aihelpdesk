"use client";
import { useState, useEffect } from "react";
import { notificationsAPI } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import type { Notification } from "@/types";
import { Bell, Check, CheckCheck, Loader2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all"|"unread">("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try { const n = await notificationsAPI.getAll(filter==="unread"); setNotifications(n); }
      catch (e) { console.error(e); } finally { setLoading(false); }
    };
    load();
  }, [filter]);

  const markRead = async (id: string) => {
    try { await notificationsAPI.markRead(id); setNotifications(p=>p.map(n=>n.id===id?{...n,is_read:true}:n)); } catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
    try { await notificationsAPI.markAllRead(); setNotifications(p=>p.map(n=>({...n,is_read:true}))); } catch (e) { console.error(e); }
  };

  const unreadCount = notifications.filter(n=>!n.is_read).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Notifications</h1><p className="text-sm text-[var(--on-surface-variant)] mt-1">{unreadCount} unread notification{unreadCount!==1?"s":""}</p></div>
        {unreadCount>0&&<button onClick={markAllRead} className="btn-secondary text-sm"><CheckCheck size={16}/>Mark all read</button>}
      </div>
      <div className="flex gap-2">
        {(["all","unread"] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${filter===f?"bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/20":"text-[var(--on-surface-variant)] hover:bg-white/5 border border-transparent"}`}>{f}</button>
        ))}
      </div>
      {loading ? (
        <div className="space-y-3">{Array.from({length:5}).map((_,i)=><div key={i} className="skeleton h-16 w-full"/>)}</div>
      ) : notifications.length > 0 ? (
        <div className="glass-card overflow-hidden divide-y divide-white/5">
          {notifications.map(n=>(
            <div key={n.id} className={`px-5 py-4 flex items-start gap-4 hover:bg-white/3 transition-colors cursor-pointer ${!n.is_read?"bg-[var(--primary)]/5":""}`}
              onClick={()=>{if(!n.is_read)markRead(n.id); if(n.link)router.push(n.link);}}>
              <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.is_read?"bg-transparent":"bg-[var(--primary)]"}`}/>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{n.title}</p>
                <p className="text-sm text-[var(--on-surface-variant)] mt-0.5">{n.message}</p>
                <p className="text-xs text-[var(--on-surface-variant)]/60 mt-1">{timeAgo(n.created_at)}</p>
              </div>
              {n.link&&<ExternalLink size={14} className="text-[var(--on-surface-variant)] mt-1 shrink-0"/>}
              {!n.is_read&&<button onClick={e=>{e.stopPropagation();markRead(n.id);}} className="p-1.5 rounded hover:bg-white/5 text-[var(--on-surface-variant)]" title="Mark as read"><Check size={14}/></button>}
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-16 text-center">
          <Bell size={48} className="mx-auto mb-4 text-[var(--on-surface-variant)]"/>
          <h3 className="text-lg font-semibold mb-2">No notifications</h3>
          <p className="text-[var(--on-surface-variant)]">You&apos;re all caught up!</p>
        </div>
      )}
    </div>
  );
}
