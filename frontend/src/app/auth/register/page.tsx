'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { authAPI } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const getStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    const labels = ['Too weak', 'Weak', 'Fair', 'Strong'];
    const colors = ['var(--rose)', 'var(--amber)', '#84cc16', 'var(--emerald)'];
    return { score, label: labels[Math.min(score - 1, 3)] || '', color: colors[Math.min(score - 1, 3)] || 'var(--outline)' };
  };

  const strength = getStrength(password);
  const confirmOk = confirmPassword.length > 0 && confirmPassword === password;
  const confirmBad = confirmPassword.length > 0 && confirmPassword !== password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await authAPI.register(name, email, password);
      setSuccess(true);
      setTimeout(() => router.push('/auth/login?message=Account created successfully'), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--surface)' }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: 'var(--primary)', filter: 'blur(120px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: 'var(--primary-hover)', filter: 'blur(120px)' }} />
      </div>

      <div className="w-full max-w-md relative animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 animate-pulse-glow" style={{background:'linear-gradient(135deg, var(--primary), var(--primary-hover))'}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{background:'linear-gradient(135deg, var(--primary-light), var(--primary))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>AI Helpdesk</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--on-surface-variant)' }}>Create your account</p>
        </div>

        <div className="glass-card p-10">
          {success && (
            <div className="alert alert-success mb-6">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
              <span>Account created! Redirecting to login…</span>
            </div>
          )}

          {error && (
            <div className="alert alert-error mb-6">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--on-surface-variant)' }}>Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--on-surface-variant)', opacity: 0.7 }} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="input-field"
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--on-surface-variant)' }}>Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--on-surface-variant)', opacity: 0.7 }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="input-field"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--on-surface-variant)' }}>Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--on-surface-variant)', opacity: 0.7 }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="input-field"
                  style={{ paddingRight: '42px' }}
                  autoComplete="new-password"
                  required
                />
                <button type="button" className="pw-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password.length > 0 && (
                <div>
                  <div className="strength-meter">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className={`strength-bar ${strength.score >= n ? `s${strength.score}` : ''}`} />
                    ))}
                  </div>
                  <p className="text-xs mt-1 font-medium" style={{ color: strength.color }}>{strength.label}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--on-surface-variant)' }}>Confirm Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--on-surface-variant)', opacity: 0.7 }} />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className={`input-field ${confirmBad ? 'error' : ''} ${confirmOk ? 'success' : ''}`}
                  style={{ paddingRight: '42px' }}
                  autoComplete="new-password"
                  required
                />
                <button type="button" className="pw-toggle" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmBad && <p className="text-xs mt-1" style={{ color: 'var(--rose)' }}>Passwords don&apos;t match</p>}
              {confirmOk && <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--emerald)' }}><CheckCircle2 size={11} /> Passwords match</p>}
            </div>

            <button type="submit" disabled={loading || success} className="w-full justify-center py-3 rounded-lg text-sm font-bold text-white transition-all shadow-lg hover:-translate-y-0.5 flex items-center gap-2" style={{background:'linear-gradient(135deg, var(--primary), var(--primary-hover))'}}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="auth-divider my-6">or</div>

          <p className="text-center text-sm" style={{ color: 'var(--on-surface-variant)' }}>
            Already have an account?{' '}
            <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: 'var(--primary)' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}