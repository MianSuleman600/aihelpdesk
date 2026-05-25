'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { User, Bell, Shield, Save } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState({
    email: true,
    browser: true,
    ticket_updates: false,
  });

  const toggle = (key: keyof typeof notifications) =>
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSave = () => {
    // TODO: persist settings
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--on-surface-variant)] mt-1">
          Manage your account preferences
        </p>
      </div>

      {/* Profile */}
      <div className="glass-card p-6 space-y-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--primary)]/15">
            <User size={18} className="text-[var(--primary)]" />
          </div>
          <div>
            <h2 className="font-semibold">Profile</h2>
            <p className="text-xs text-[var(--on-surface-variant)]">
              Your personal information
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-white/3 space-y-1">
            <p className="text-xs text-[var(--on-surface-variant)]/60 uppercase tracking-wider font-medium">
              Name
            </p>
            <p className="text-sm font-medium">{user?.name || '—'}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/3 space-y-1">
            <p className="text-xs text-[var(--on-surface-variant)]/60 uppercase tracking-wider font-medium">
              Email
            </p>
            <p className="text-sm font-medium">{user?.email || '—'}</p>
          </div>
          <div className="p-4 rounded-xl bg-white/3 space-y-1">
            <p className="text-xs text-[var(--on-surface-variant)]/60 uppercase tracking-wider font-medium">
              Role
            </p>
            <p className="text-sm font-medium capitalize">{user?.role || '—'}</p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="glass-card p-6 space-y-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--primary)]/15">
            <Bell size={18} className="text-[var(--primary)]" />
          </div>
          <div>
            <h2 className="font-semibold">Notifications</h2>
            <p className="text-xs text-[var(--on-surface-variant)]">
              Configure how you receive alerts
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {(
            [
              { key: 'email' as const, label: 'Email Notifications', desc: 'Receive updates via email' },
              { key: 'browser' as const, label: 'Browser Notifications', desc: 'Receive push notifications in browser' },
              { key: 'ticket_updates' as const, label: 'Ticket Updates', desc: 'Get notified when your tickets change' },
            ] as const
          ).map(({ key, label, desc }) => (
            <div
              key={key}
              className="flex items-center justify-between p-4 rounded-xl bg-white/3"
            >
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-[var(--on-surface-variant)]/70 mt-0.5">
                  {desc}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifications[key]}
                onClick={() => toggle(key)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
                  notifications[key]
                    ? 'bg-[var(--primary)]'
                    : 'bg-white/10'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm ${
                    notifications[key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Account */}
      <div className="glass-card p-6 space-y-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--danger)]/15">
            <Shield size={18} className="text-[var(--danger)]" />
          </div>
          <div>
            <h2 className="font-semibold">Account</h2>
            <p className="text-xs text-[var(--on-surface-variant)]">
              Dangerous actions
            </p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white/3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Delete Account</p>
            <p className="text-xs text-[var(--on-surface-variant)]/70 mt-0.5">
              Permanently remove your account and all associated data
            </p>
          </div>
          <button className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--danger)]/20 border border-[var(--danger)]/30 hover:bg-[var(--danger)]/30 transition-colors">
            Delete
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm"
        >
          <Save size={16} />
          Save Changes
        </button>
      </div>
    </div>
  );
}
