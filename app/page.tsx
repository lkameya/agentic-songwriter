'use client';

import Link from 'next/link';

export default function Dashboard() {
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
  ];

  return (
    <main className="container">
      <h1>Songsmith</h1>
      <p className="subtitle">Crafting songs with intelligent agents</p>

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
