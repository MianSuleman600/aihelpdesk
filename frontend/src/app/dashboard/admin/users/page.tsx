"use client";
/* Admin Users page — placeholder */
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Users, Shield, UserCheck, UserX } from "lucide-react";

export default function AdminUsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => { if (user?.role!=="admin") router.replace("/dashboard"); }, [user, router]);

  const demoUsers = [
    {name:"Ayesha Shahid",email:"ayesha@test.com",role:"admin",active:true},
    {name:"Saba Zaheer",email:"saba@test.com",role:"agent",active:true},
    {name:"Demo User",email:"user@test.com",role:"user",active:true},
    {name:"Inactive User",email:"inactive@test.com",role:"user",active:false},
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold">Manage Users</h1><p className="text-sm text-[var(--on-surface-variant)] mt-1">View and manage user accounts</p></div>
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm"><thead><tr className="border-b border-white/5 text-[var(--on-surface-variant)] text-xs uppercase tracking-wider">
          <th className="text-left py-3 px-5 font-semibold">User</th><th className="text-left py-3 px-5 font-semibold">Role</th><th className="text-left py-3 px-5 font-semibold">Status</th>
        </tr></thead><tbody>{demoUsers.map((u,i)=>(
          <tr key={i} className="border-b border-white/3 hover:bg-white/3 transition-colors">
            <td className="py-3 px-5"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold">{u.name.split(" ").map(w=>w[0]).join("")}</div><div><p className="font-medium">{u.name}</p><p className="text-xs text-[var(--on-surface-variant)]">{u.email}</p></div></div></td>
            <td className="py-3 px-5"><span className={`badge ${u.role==="admin"?"bg-[var(--violet)]/15 text-[var(--secondary)]":u.role==="agent"?"bg-[var(--indigo)]/15 text-[var(--primary)]":"bg-white/5 text-[var(--on-surface-variant)]"}`}><Shield size={10}/>{u.role}</span></td>
            <td className="py-3 px-5">{u.active?<span className="flex items-center gap-1 text-[var(--emerald)]"><UserCheck size={14}/>Active</span>:<span className="flex items-center gap-1 text-[var(--on-surface-variant)]"><UserX size={14}/>Inactive</span>}</td>
          </tr>
        ))}</tbody></table>
      </div>
    </div>
  );
}
