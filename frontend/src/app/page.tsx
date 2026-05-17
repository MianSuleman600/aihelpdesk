"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? "/dashboard" : "/auth/login");
    }
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--surface)" }}>
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="w-12 h-12 border-4 border-[var(--indigo)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--on-surface-variant)]">Loading HelpDesk AI…</p>
      </div>
    </div>
  );
}
