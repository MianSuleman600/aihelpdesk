"use client";
/* Admin Analytics Dashboard — matches Stitch Design 3 */
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { analyticsAPI } from "@/lib/api";
import type { AnalyticsOverview } from "@/types";
import { BarChart3, Ticket, Clock, ThumbsUp, TrendingUp, TrendingDown, Loader2, BookOpen, Users } from "lucide-react";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsOverview|null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30d");

  useEffect(() => {
    if (user?.role !== "admin") { router.replace("/dashboard"); return; }
    analyticsAPI.getOverview(period).then(setData).catch((e) => console.error(e)).finally(()=>setLoading(false));
  }, [user, router, period]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-[var(--primary)]"/></div>;

  const d = data || { total_tickets:0, open_tickets:0, resolved_tickets:0, avg_resolution_hours:0, total_articles:0, ai_satisfaction_percent:0, tickets_by_status:{}, tickets_by_category:{}, ai_feedback_summary:{helpful:0,unhelpful:0} };
  const totalFeedback = d.ai_feedback_summary.helpful + d.ai_feedback_summary.unhelpful;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold">Analytics Dashboard</h1><p className="text-sm text-[var(--on-surface-variant)] mt-1">Overview of helpdesk operations and AI performance</p></div>
        <div className="flex gap-2">
          {[{l:"7 Days",v:"7d"},{l:"30 Days",v:"30d"},{l:"90 Days",v:"90d"}].map(p=>(
            <button key={p.v} onClick={()=>setPeriod(p.v)} className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${period===p.v?"bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/20":"text-[var(--on-surface-variant)] hover:bg-white/5 border border-transparent"}`}>{p.l}</button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {label:"Total Tickets",value:d.total_tickets,icon:Ticket,trend:"+12%",trendUp:true,color:"var(--primary)"},
          {label:"Open Tickets",value:d.open_tickets,icon:BarChart3,trend:null,trendUp:false,color:"var(--primary-light)"},
          {label:"Avg Resolution",value:`${d.avg_resolution_hours}h`,icon:Clock,trend:"-18%",trendUp:true,color:"var(--primary)"},
          {label:"AI Satisfaction",value:`${d.ai_satisfaction_percent}%`,icon:ThumbsUp,trend:null,trendUp:true,color:"var(--primary-hover)"},
        ].map((card,i)=>(
          <div key={i} className="glass-card p-5 animate-fade-in" style={{animationDelay:`${i*80}ms`}}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:`${card.color}20`}}>
                <card.icon size={20} style={{color:card.color}}/>
              </div>
              {card.trend&&(
                <span className={`flex items-center gap-1 text-xs font-semibold ${card.trendUp?"text-[var(--primary)]":"text-[var(--danger)]"}`}>
                  {card.trendUp?<TrendingUp size={14}/>:<TrendingDown size={14}/>}{card.trend}
                </span>
              )}
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs text-[var(--on-surface-variant)] mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Tickets by Status */}
        <div className="lg:col-span-2 glass-card p-6 animate-fade-in">
          <h3 className="font-semibold mb-4">Tickets by Status</h3>
          <div className="space-y-3">
            {Object.entries(d.tickets_by_status).length>0?Object.entries(d.tickets_by_status).map(([s,count])=>{
              const pct = d.total_tickets>0?Math.round((count as number)/d.total_tickets*100):0;
              const colors:Record<string,string> = {open:"var(--primary)",in_progress:"var(--primary-light)",waiting:"var(--secondary)",resolved:"var(--success)",closed:"var(--outline)"};
              return (
                <div key={s}>
                  <div className="flex justify-between text-sm mb-1"><span className="capitalize">{s.replace("_"," ")}</span><span className="font-semibold">{count as number} ({pct}%)</span></div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`,background:colors[s]||"var(--primary)"}}/></div>
                </div>
              );
            }):<p className="text-[var(--on-surface-variant)] text-sm">No ticket data available yet.</p>}
          </div>
        </div>

        {/* AI Feedback */}
        <div className="glass-card p-6 animate-fade-in">
          <h3 className="font-semibold mb-4">AI Performance</h3>
          <div className="flex items-center justify-center mb-6">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3"/>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--primary)" strokeWidth="3" strokeDasharray={`${d.ai_satisfaction_percent}, 100`} strokeLinecap="round"/>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-bold">{d.ai_satisfaction_percent}%</span><span className="text-xs text-[var(--on-surface-variant)]">Helpful</span></div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-[var(--primary)]">👍 Helpful</span><span className="font-semibold">{d.ai_feedback_summary.helpful}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[var(--danger)]">👎 Unhelpful</span><span className="font-semibold">{d.ai_feedback_summary.unhelpful}</span></div>
            <div className="flex justify-between text-sm pt-2 border-t border-white/5"><span className="text-[var(--on-surface-variant)]">Total Feedback</span><span className="font-semibold">{totalFeedback}</span></div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-card p-6 animate-fade-in">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><BookOpen size={18}/>Knowledge Base Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/3"><p className="text-2xl font-bold">{d.total_articles}</p><p className="text-xs text-[var(--on-surface-variant)]">Total Articles</p></div>
            <div className="p-4 rounded-xl bg-white/3"><p className="text-2xl font-bold">{d.resolved_tickets}</p><p className="text-xs text-[var(--on-surface-variant)]">Resolved Tickets</p></div>
          </div>
        </div>
        <div className="glass-card p-6 animate-fade-in">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Users size={18}/>Quick Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/3"><p className="text-2xl font-bold">{d.total_tickets>0?Math.round(d.resolved_tickets/d.total_tickets*100):0}%</p><p className="text-xs text-[var(--on-surface-variant)]">Resolution Rate</p></div>
            <div className="p-4 rounded-xl bg-white/3"><p className="text-2xl font-bold">{totalFeedback>0?Math.round(d.ai_feedback_summary.helpful/totalFeedback*100):0}%</p><p className="text-xs text-[var(--on-surface-variant)]">AI Deflection</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
