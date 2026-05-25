"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Zap, Sparkles, Ticket, BookOpen, MessageSquare, Shield, ArrowRight, Menu, X, Clock, BarChart3, Star, ChevronRight } from "lucide-react";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setShown((p) => ({ ...p, [e.target.id]: true }));
        });
      },
      { threshold: 0.1 }
    );
    Object.values(refs.current).forEach((r) => r && obs.observe(r));
    return () => obs.disconnect();
  }, []);

  if (loading || user) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0a0a0a' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm" style={{ color: '#666' }}>Loading...</p>
        </div>
      </div>
    );
  }

  const features = [
    { icon: Sparkles, title: "AI Answers", desc: "Instant answers from your knowledge base with source citations.", accent: "from-emerald-500 to-yellow-500" },
    { icon: Ticket, title: "Smart Tickets", desc: "Submit and track requests with automated routing.", accent: "from-orange-500 to-red-500" },
    { icon: BookOpen, title: "Knowledge Base", desc: "Full-text search, categories, tags, and version history.", accent: "from-lime-500 to-green-500" },
    { icon: MessageSquare, title: "Team Chat", desc: "Threaded conversations with internal notes and real-time updates.", accent: "from-emerald-500 to-orange-500" },
    { icon: Shield, title: "Access Control", desc: "Admin, agent, and user roles with server-side authorization.", accent: "from-stone-500 to-neutral-500" },
    { icon: BarChart3, title: "Analytics", desc: "Track volumes, response times, and AI satisfaction rates.", accent: "from-yellow-500 to-emerald-500" },
  ];

  const stats = [
    { value: "99.9%", label: "Uptime", icon: Zap },
    { value: "<30s", label: "Avg Response", icon: Clock },
    { value: "10K+", label: "Resolved", icon: Ticket },
    { value: "4.9/5", label: "Rating", icon: Star },
  ];

  const steps = [
    { n: "01", title: "Ask", desc: "Type your question in plain language. Our AI understands intent instantly." },
    { n: "02", title: "Search", desc: "Your query is matched against your knowledge base using semantic search." },
    { n: "03", title: "Answer", desc: "Receive accurate answers with source citations. No invented facts." },
    { n: "04", title: "Escalate", desc: "If needed, create a ticket with full context for your team." },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f5f5f0' }}>
      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, insetInline: 0, zIndex: 50,
        background: scrolled ? 'rgba(10,10,10,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'all 0.3s'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={15} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
              HelpDesk <span style={{ color: 'var(--primary)' }}>AI</span>
            </span>
          </Link>

          <div style={{ display: 'none', alignItems: 'center', gap: 32 }} className="md:flex">
            <a href="#features" style={{ fontSize: 13, color: '#888', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = '#888'}>Features</a>
            <a href="#how" style={{ fontSize: 13, color: '#888', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = '#888'}>How It Works</a>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Link href="/auth/login" style={{ fontSize: 13, fontWeight: 500, color: '#aaa', textDecoration: 'none', padding: '8px 16px', transition: 'color 0.2s' }}>Sign In</Link>
              <Link href="/auth/register" style={{
                fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none',
                padding: '8px 20px', borderRadius: 10,
                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                transition: 'all 0.2s', boxShadow: '0 4px 16px rgba(var(--primary-rgb), 0.25)'
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(var(--primary-rgb), 0.35)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(var(--primary-rgb), 0.25)'; }}
              >Get Started</Link>
            </div>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden" style={{ padding: 8, color: menuOpen ? '#fff' : '#888', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8 }}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {menuOpen && (
          <div style={{ background: '#111', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px' }}>
            <a href="#features" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '10px 0', fontSize: 14, color: '#888', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>Features</a>
            <a href="#how" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '10px 0', fontSize: 14, color: '#888', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>How It Works</a>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <Link href="/auth/login" onClick={() => setMenuOpen(false)} style={{ flex: 1, textAlign: 'center', fontSize: 14, color: '#aaa', padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', textDecoration: 'none' }}>Sign In</Link>
              <Link href="/auth/register" onClick={() => setMenuOpen(false)} style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, color: '#fff', padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', textDecoration: 'none' }}>Get Started</Link>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: 60, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, borderRadius: '50%', background: 'rgba(var(--primary-rgb), 0.06)', filter: 'blur(100px)' }} />
          <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(217,119,6,0.04)', filter: 'blur(80px)' }} />
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 24px', position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 999, border: '1px solid rgba(var(--primary-rgb), 0.2)', background: 'rgba(var(--primary-rgb), 0.08)', color: 'var(--primary)', fontSize: 12, fontWeight: 600, marginBottom: 32 }}>
              <Sparkles size={13} />
              AI-Powered Support Platform
            </div>

            <h1 style={{ fontSize: 'clamp(2rem, 6vw, 4rem)', fontWeight: 800, lineHeight: 1.15, marginBottom: 20, letterSpacing: '-0.03em' }}>
              Support that
              <br />
              <span style={{ background: 'linear-gradient(135deg, var(--primary-light), var(--primary), var(--primary-hover))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                understands you
              </span>
            </h1>

            <p style={{ fontSize: 17, color: '#888', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.7 }}>
              AI helpdesk that learns from your knowledge base. Get instant answers, smart ticket routing, and insights.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 48 }} className="sm:flex-row sm:justify-center">
              <Link href="/auth/register" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 12,
                fontSize: 14, fontWeight: 700, color: '#fff', textDecoration: 'none',
                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                boxShadow: '0 8px 32px rgba(var(--primary-rgb), 0.3)',
                transition: 'all 0.2s'
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(var(--primary-rgb), 0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(var(--primary-rgb), 0.3)'; }}
              >
                Get Started Free
                <ArrowRight size={16} />
              </Link>
              <a href="#features" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 32px', borderRadius: 12, fontSize: 14, fontWeight: 500, color: '#aaa', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.08)', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              >
                Explore <ChevronRight size={14} />
              </a>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 24, fontSize: 13, color: '#666' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex' }}>
                  {['var(--primary)','var(--primary-hover)','#b45309','var(--primary-dark)','var(--primary-darker)'].map((c,i) => (
                    <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #0a0a0a', marginLeft: i > 0 ? -8 : 0, background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                      {String.fromCharCode(65+i)}
                    </div>
                  ))}
                </div>
                <span><strong style={{ color: '#ccc' }}>2,000+</strong> teams</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {[1,2,3,4,5].map(i => <Star key={i} size={13} style={{ fill: 'var(--primary)', color: 'var(--primary)' }} />)}
                <span style={{ marginLeft: 4 }}>4.9/5</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" ref={(el) => { refs.current.features = el; }} style={{ padding: '80px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, transition: 'all 0.6s', opacity: shown.features ? 1 : 0, transform: shown.features ? 'translateY(0)' : 'translateY(16px)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary)' }}>Features</span>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, marginTop: 8, marginBottom: 12 }}>What you get</h2>
            <p style={{ color: '#666', fontSize: 15, maxWidth: 480, margin: '0 auto' }}>Everything you need to provide fast, informed support to your users.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {features.map((f, i) => (
              <div
                key={i}
                style={{
                  padding: 24, borderRadius: 14, border: '1px solid rgba(255,255,255,0.04)',
                  background: 'rgba(255,255,255,0.015)',
                  transition: 'all 0.3s',
                  opacity: shown.features ? 1 : 0,
                  transform: shown.features ? 'translateY(0)' : 'translateY(12px)',
                  transitionDelay: `${i * 60}ms`,
                  cursor: 'default'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.015)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${f.accent.startsWith('from-') ? 'var(--primary)' : '#666'})`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <f.icon size={16} color="#fff" />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, color: '#f0f0ea' }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ padding: '60px 0', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(var(--primary-rgb), 0.03), transparent, rgba(var(--primary-rgb), 0.03))' }} />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {stats.map((s, i) => (
              <div key={i} style={{ textAlign: 'center', opacity: shown.features ? 1 : 0, transform: shown.features ? 'translateY(0)' : 'translateY(12px)', transition: 'all 0.4s', transitionDelay: `${300 + i * 80}ms` }}>
                <s.icon size={18} style={{ color: 'var(--primary)', margin: '0 auto 8px' }} />
                <div style={{ fontSize: 28, fontWeight: 800, color: '#f0f0ea', marginBottom: 2 }}>{s.value}</div>
                <div style={{ fontSize: 13, color: '#666' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" ref={(el) => { refs.current.how = el; }} style={{ padding: '80px 0' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48, transition: 'all 0.6s', opacity: shown.how ? 1 : 0, transform: shown.how ? 'translateY(0)' : 'translateY(16px)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--primary)' }}>How It Works</span>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, marginTop: 8, marginBottom: 12 }}>Question to resolution</h2>
            <p style={{ color: '#666', fontSize: 15 }}>Four simple steps powered by AI.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {steps.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', gap: 20, alignItems: 'flex-start', padding: 20, borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.04)',
                  transition: 'all 0.4s',
                  opacity: shown.how ? 1 : 0,
                  transform: shown.how ? 'translateX(0)' : 'translateX(-12px)',
                  transitionDelay: `${i * 80}ms`
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.12)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'}
              >
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{s.n}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: '#f0f0ea' }}>{s.title}</h3>
                  <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 0', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, height: 400, borderRadius: '50%', background: 'rgba(var(--primary-rgb), 0.05)', filter: 'blur(80px)' }} />
        </div>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px', textAlign: 'center', position: 'relative' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, marginBottom: 12 }}>Ready to get started?</h2>
          <p style={{ fontSize: 15, color: '#666', marginBottom: 28 }}>Join thousands of teams using AI-powered support.</p>
          <Link href="/auth/register" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '14px 36px', borderRadius: 12,
            fontSize: 14, fontWeight: 700, color: '#fff', textDecoration: 'none',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
            boxShadow: '0 8px 32px rgba(var(--primary-rgb), 0.3)',
            transition: 'all 0.2s'
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(var(--primary-rgb), 0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(var(--primary-rgb), 0.3)'; }}
          >
            Start Free Trial <ArrowRight size={16} />
          </Link>
          <p style={{ fontSize: 12, color: '#555', marginTop: 12 }}>No credit card. Free for small teams.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '24px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }} className="md:flex-row md:justify-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={11} color="#fff" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ccc' }}>HelpDesk AI</span>
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 12 }}>
            <a href="#features" style={{ color: '#555', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#aaa'} onMouseLeave={e => e.currentTarget.style.color = '#555'}>Features</a>
            <a href="#how" style={{ color: '#555', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#aaa'} onMouseLeave={e => e.currentTarget.style.color = '#555'}>How It Works</a>
            <Link href="/auth/login" style={{ color: '#555', textDecoration: 'none', transition: 'color 0.2s' }}>Sign In</Link>
            <Link href="/auth/register" style={{ color: '#555', textDecoration: 'none', transition: 'color 0.2s' }}>Register</Link>
          </div>
          <p style={{ fontSize: 11, color: '#444' }}>&copy; 2026 HelpDesk AI</p>
        </div>
      </footer>
    </div>
  );
}
