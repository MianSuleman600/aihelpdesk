'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('http://localhost:8000/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) throw new Error('Failed to reset password');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-8">
      {success ? (
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <CheckCircle2 size={30} style={{ color: 'var(--emerald)' }} />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--on-surface)' }}>Password updated!</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--on-surface-variant)' }}>Redirecting to login…</p>
          <Link href="/auth/login" className="btn-primary w-full justify-center py-3">Go to Login</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="alert alert-error">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--on-surface-variant)' }}>New Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--on-surface-variant)', opacity: 0.7 }} />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" style={{ paddingRight: '42px' }} required />
              <button type="button" className="pw-toggle" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--on-surface-variant)' }}>Confirm Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--on-surface-variant)', opacity: 0.7 }} />
              <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-field" style={{ paddingRight: '42px' }} required />
              <button type="button" className="pw-toggle" onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      )}
      <Link href="/auth/login" className="flex items-center justify-center gap-1.5 text-sm mt-4 hover:underline" style={{ color: 'var(--on-surface-variant)' }}>
        <ArrowLeft size={14} /> Back to login
      </Link>
    </div>
  );
}

function Loading() {
  return (
    <div className="glass-card p-8 flex items-center justify-center">
      <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--surface)' }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: 'var(--indigo)', filter: 'blur(120px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: 'var(--violet)', filter: 'blur(120px)' }} />
      </div>
      <div className="w-full max-w-md relative animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mb-4">
            <Lock size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Reset Password</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--on-surface-variant)' }}>Enter your new password</p>
        </div>
        <Suspense fallback={<Loading />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}