'use client';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--surface)' }}>
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--danger)' }}>Something went wrong</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--on-surface-variant)' }}>{error.message || 'An unexpected error occurred.'}</p>
        <button onClick={reset} className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold text-white shadow-lg" style={{background:'linear-gradient(135deg, var(--primary), var(--primary-hover))'}}>Try again</button>
      </div>
    </div>
  );
}
