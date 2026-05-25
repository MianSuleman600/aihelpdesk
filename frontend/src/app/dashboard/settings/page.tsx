'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { authAPI, settingsAPI } from '@/lib/api';
import type { UserSettings } from '@/types';
import {
  User, Bell, Shield, Save, Eye, EyeOff,
  Trash2, Key,
  Check, X, Loader2,
} from 'lucide-react';

type Feedback = { type: 'success' | 'error'; message: string } | null;

export default function SettingsPage() {
  const { user } = useAuth();

  /* ── Profile ───────────────────────────────────────────── */
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  /* ── Security ──────────────────────────────────────────── */
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  /* ── Notifications ─────────────────────────────────────── */
  const [settings, setSettings] = useState<UserSettings>({
    notification_email: true,
    notification_browser: true,
    notification_ticket_updates: false,
  });

  /* ── UI State ──────────────────────────────────────────── */
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setEmail(user.email || '');
    (async () => {
      try {
        const s = await settingsAPI.get();
        setSettings(s);
      } catch { /* defaults */ } finally {
        setLoadingSettings(false);
      }
    })();
  }, [user]);

  const flash = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  /* ── Handlers ──────────────────────────────────────────── */

  const handleSaveProfile = async () => {
    setSaving('profile');
    try {
      await authAPI.updateProfile({
        name,
        email: email !== user?.email ? email : undefined,
      });
      flash('success', 'Profile updated');
    } catch (e: any) {
      flash('error', e?.message || 'Failed to update profile');
    } finally {
      setSaving(null);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      flash('error', 'Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      flash('error', 'Password must be at least 8 characters');
      return;
    }
    if (newPassword === oldPassword) {
      flash('error', 'New password must be different from current password');
      return;
    }
    setSaving('password');
    try {
      await authAPI.changePassword(oldPassword, newPassword);
      flash('success', 'Password changed');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      flash('error', e?.message || 'Failed to change password');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveSettings = async () => {
    setSaving('settings');
    try {
      const updated = await settingsAPI.update(settings);
      setSettings(updated);
      flash('success', 'Settings saved');
    } catch (e: any) {
      flash('error', e?.message || 'Failed to save settings');
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await authAPI.deleteAccount();
      authAPI.logout();
      window.location.href = '/';
    } catch (e: any) {
      flash('error', e?.message || 'Failed to delete account');
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  };

  /* ── Render Helpers ────────────────────────────────────── */

  const toggleSwitch = (key: 'notification_email' | 'notification_browser' | 'notification_ticket_updates') => (
    <button
      type="button"
      role="switch"
      aria-checked={settings[key]}
      onClick={() => setSettings((prev) => ({ ...prev, [key]: !prev[key] }))}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
        settings[key] ? 'bg-[var(--primary)]' : 'bg-[var(--outline-variant)]'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm ${
          settings[key] ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  const btnClass = "btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed";

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--on-surface-variant)] mt-1">
          Manage your account, security, and preferences
        </p>
      </div>

      {feedback && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium animate-fade-in flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-[var(--success)]/15 text-[var(--success)] border border-[var(--success)]/20'
              : 'bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/20'
          }`}
        >
          {feedback.type === 'success' ? <Check size={16} /> : <X size={16} />}
          {feedback.message}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          PROFILE
         ══════════════════════════════════════════════════════ */}
      <div className="glass-card p-6 space-y-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--primary)]/15">
            <User size={18} className="text-[var(--primary)]" />
          </div>
          <div>
            <h2 className="font-semibold">Profile</h2>
            <p className="text-xs text-[var(--on-surface-variant)]">Your personal information</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-[var(--on-surface-variant)]/60 uppercase tracking-wider font-medium mb-1.5">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/30 border border-[var(--outline-variant)] bg-[var(--surface-container-low)] focus:border-[var(--primary)]/40 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs text-[var(--on-surface-variant)]/60 uppercase tracking-wider font-medium mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/30 border border-[var(--outline-variant)] bg-[var(--surface-container-low)] focus:border-[var(--primary)]/40 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
            />
          </div>

          {/* Role (read-only) */}
          <div className="p-4 rounded-xl bg-[var(--surface-container-low)] space-y-1">
            <p className="text-xs text-[var(--on-surface-variant)]/60 uppercase tracking-wider font-medium">Role</p>
            <p className="text-sm font-medium capitalize">{user.role}</p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={saving === 'profile'}
              className={btnClass}
            >
              <Save size={16} />
              {saving === 'profile' ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          SECURITY – Change Password
         ══════════════════════════════════════════════════════ */}
      <div className="glass-card p-6 space-y-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--warning)]/15">
            <Key size={18} className="text-[var(--warning)]" />
          </div>
          <div>
            <h2 className="font-semibold">Security</h2>
            <p className="text-xs text-[var(--on-surface-variant)]">Change your password</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--on-surface-variant)]/60 uppercase tracking-wider font-medium mb-1.5">Current Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full h-10 pl-3 pr-10 rounded-lg text-sm outline-none text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/30 border border-[var(--outline-variant)] bg-[var(--surface-container-low)] focus:border-[var(--primary)]/40 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--on-surface-variant)]/50 hover:text-[var(--on-surface-variant)]"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--on-surface-variant)]/60 uppercase tracking-wider font-medium mb-1.5">New Password</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 chars, upper, lower, number, special"
              className="w-full h-10 px-3 rounded-lg text-sm outline-none text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/30 border border-[var(--outline-variant)] bg-[var(--surface-container-low)] focus:border-[var(--primary)]/40 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--on-surface-variant)]/60 uppercase tracking-wider font-medium mb-1.5">Confirm New Password</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-lg text-sm outline-none text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/30 border border-[var(--outline-variant)] bg-[var(--surface-container-low)] focus:border-[var(--primary)]/40 focus:ring-2 focus:ring-[var(--primary)]/10 transition-all"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-[var(--danger)] mt-1">Passwords do not match</p>
            )}
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleChangePassword}
              disabled={saving === 'password' || !oldPassword || !newPassword || !confirmPassword}
              className={btnClass}
            >
              <Save size={16} />
              {saving === 'password' ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          NOTIFICATIONS
         ══════════════════════════════════════════════════════ */}
      <div className="glass-card p-6 space-y-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--primary)]/15">
            <Bell size={18} className="text-[var(--primary)]" />
          </div>
          <div>
            <h2 className="font-semibold">Notifications</h2>
            <p className="text-xs text-[var(--on-surface-variant)]">Configure how you receive alerts</p>
          </div>
        </div>

        {loadingSettings ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-[var(--surface-container-low)] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {([
              { key: 'notification_email' as const, label: 'Email Notifications', desc: 'Receive updates via email' },
              { key: 'notification_browser' as const, label: 'Browser Notifications', desc: 'Receive push notifications in browser' },
              { key: 'notification_ticket_updates' as const, label: 'Ticket Updates', desc: 'Get notified when your tickets change' },
            ]).map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-container-low)]">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-[var(--on-surface-variant)]/70 mt-0.5">{desc}</p>
                </div>
                {toggleSwitch(key)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          ACCOUNT – Delete
         ══════════════════════════════════════════════════════ */}
      <div className="glass-card p-6 space-y-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--danger)]/15">
            <Shield size={18} className="text-[var(--danger)]" />
          </div>
          <div>
            <h2 className="font-semibold">Account</h2>
            <p className="text-xs text-[var(--on-surface-variant)]">Dangerous actions</p>
          </div>
        </div>

        {!showDeleteConfirm ? (
          <div className="p-4 rounded-xl bg-[var(--surface-container-low)] flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-xs text-[var(--on-surface-variant)]/70 mt-0.5">
                Permanently remove your account and all associated data
              </p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--danger)] bg-[var(--danger)]/10 border border-[var(--danger)]/25 hover:bg-[var(--danger)]/20 transition-colors"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[var(--danger)]/5 border border-[var(--danger)]/20 space-y-3">
            <p className="text-sm font-medium text-[var(--danger)]">Are you absolutely sure?</p>
            <p className="text-xs text-[var(--on-surface-variant)]/80">
              This action cannot be undone. All your data will be permanently deleted.
              Type <strong className="text-[var(--on-surface)]">delete my account</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder='Type "delete my account" to confirm'
              className="w-full h-10 px-3 rounded-lg text-sm outline-none text-[var(--on-surface)] placeholder-[var(--on-surface-variant)]/30 border border-[var(--danger)]/30 bg-[var(--surface-container-low)] focus:border-[var(--danger)]/60 focus:ring-2 focus:ring-[var(--danger)]/10 transition-all"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] border border-[var(--outline-variant)] hover:bg-[var(--surface-container-high)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'delete my account'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--danger)] hover:bg-[var(--danger)]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} />
                Permanently Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          SAVE SETTINGS (Notifications)
         ══════════════════════════════════════════════════════ */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveSettings}
          disabled={saving === 'settings'}
          className={btnClass}
        >
          <Save size={16} />
          {saving === 'settings' ? 'Saving...' : 'Save Notification Settings'}
        </button>
      </div>
    </div>
  );
}
