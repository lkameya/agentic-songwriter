'use client';

import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const agents = [
    {
      id: 'songwriter',
      name: 'Songwriter Agent',
      description: 'Create lyrics and song structures from emotions and themes',
      icon: '🎵',
      href: '/agents/songwriter',
      color: 'var(--text-primary)',
    },
    {
      id: 'melody',
      name: 'Melody Agent',
      description: 'Generate MIDI melodies that match your lyrics',
      icon: '🎹',
      href: '/agents/melody',
      color: 'var(--text-primary)',
    },
    {
      id: 'songs',
      name: 'Songs',
      description: 'Browse and manage your saved songs',
      icon: '📝',
      href: '/songs',
      color: 'var(--text-primary)',
    },
  ];

  return (
    <main className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1>Songsmith</h1>
          <p className="subtitle">Crafting songs with intelligent agents</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {status === 'loading' ? (
            <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Loading...</span>
          ) : session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {session.user?.name || session.user?.email}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  Signed in
                </div>
              </div>
              <button
                onClick={() => signOut()}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-secondary)',
                  color: 'var(--text-secondary)',
                  padding: '0.75rem 1.5rem',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontFamily: 'Space Grotesk, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-primary)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-secondary)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn('google')}
              className="submit-button"
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.75rem',
                width: 'auto',
              }}
            >
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>

      <div className="dashboard-grid">
        {agents.map((agent) => (
          <Link key={agent.id} href={agent.href} className="agent-card">
            <div className="agent-card-icon" style={{ color: agent.color }}>
              {agent.icon}
            </div>
            <h2 className="agent-card-title">{agent.name}</h2>
            <p className="agent-card-description">{agent.description}</p>
            <div className="agent-card-action">
              <span>Launch →</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
