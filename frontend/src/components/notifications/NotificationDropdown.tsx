"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { notificationsAPI } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import type { Notification } from "@/types";
import { Bell, Loader2 } from "lucide-react";

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      notificationsAPI
        .getAll()
        .then(setNotifications)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors bg-white/5 border border-white/10 hover:bg-white/10"
      >
        <Bell size={15} className="text-white/50" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full text-[9px] font-bold text-white bg-danger">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 rounded-xl bg-surface-container border border-white/10 shadow-2xl animate-fade-in overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {notifications.length > 0 && (
              <Link
                href="/dashboard/notifications"
                onClick={() => setOpen(false)}
                className="text-xs text-[var(--primary)] hover:underline"
              >
                View all
              </Link>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-white/30" />
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-center text-sm text-white/30 py-8">
                No notifications yet
              </p>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <Link
                  key={n.id}
                  href={n.link || "#"}
                  onClick={() => setOpen(false)}
                  className={`block px-4 py-3 transition-colors hover:bg-white/5 ${
                    !n.is_read ? "bg-[var(--primary)]/5" : ""
                  }`}
                >
                  <p className="text-sm font-medium text-white/90 leading-snug">
                    {n.title}
                  </p>
                  {n.message && (
                    <p className="text-xs text-white/50 mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                  )}
                  <p className="text-[10px] text-white/30 mt-1">
                    {timeAgo(n.created_at)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
