'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { authAPI } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{background:'linear-gradient(135deg, var(--primary), var(--primary-hover))'}}>
            <Mail size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{background:'linear-gradient(135deg, var(--primary-light), var(--primary))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>Forgot Password</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--on-surface-variant)' }}>Enter your email to receive a reset link</p>
        </div>
        <div className="glass-card p-10">
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <CheckCircle2 size={30} style={{ color: 'var(--emerald)' }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--on-surface)' }}>Check your email</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--on-surface-variant)' }}>We've sent a password reset link to <strong>{email}</strong></p>
              <Link href="/auth/login" className="w-full justify-center py-3 rounded-lg text-sm font-bold text-white text-center block shadow-lg" style={{background:'linear-gradient(135deg, var(--primary), var(--primary-hover))'}}>Back to Login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--on-surface-variant)' }}>Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--on-surface-variant)', opacity: 0.7 }} />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="input-field" required />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full justify-center py-3 rounded-lg text-sm font-bold text-white transition-all shadow-lg hover:-translate-y-0.5 flex items-center gap-2" style={{background:'linear-gradient(135deg, var(--primary), var(--primary-hover))'}}>
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          )}
          <Link href="/auth/login" className="flex items-center justify-center gap-1.5 text-sm mt-4 hover:underline" style={{ color: 'var(--on-surface-variant)' }}>
            <ArrowLeft size={14} /> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}