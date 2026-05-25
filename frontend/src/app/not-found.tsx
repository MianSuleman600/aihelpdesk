import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--surface)' }}>
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold mb-4" style={{background:'linear-gradient(135deg, var(--primary-light), var(--primary))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>404</h1>
        <h2 className="text-xl font-semibold mb-2">Page not found</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--on-surface-variant)' }}>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-bold text-white shadow-lg" style={{background:'linear-gradient(135deg, var(--primary), var(--primary-hover))'}}>Go to Dashboard</Link>
      </div>
    </div>
  );
}
