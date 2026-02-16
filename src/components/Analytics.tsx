import { useState, useEffect } from 'react';

interface Stats {
  counts: {
    total_users: number;
    total_events: number;
    unique_hosts: number;
    total_invitations: number;
    accepted_rsvps: number;
  };
  upcoming_events: Array<{
    id: string;
    date: string;
    location: string;
    iftar_time: string;
    host_name: string;
    host_username: string;
    invite_count: number;
    accepted_count: number;
  }>;
  recent_users: Array<{
    first_name: string;
    username: string;
    created_at: string;
  }>;
  recent_events: Array<{
    date: string;
    location: string;
    created_at: string;
    host_name: string;
    host_username: string;
  }>;
}

export function Analytics() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => setError('Ошибка загрузки'));
    
    const interval = setInterval(() => {
      fetch('/api/stats').then(r => r.json()).then(setStats).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (error) return <div style={{ padding: 24, textAlign: 'center', color: '#ef4444' }}>{error}</div>;
  if (!stats) return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div className="animate-spin" style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', margin: '0 auto' }} />
    </div>
  );

  const { counts } = stats;

  const statCards = [
    { label: 'Пользователей', value: counts.total_users, emoji: '👥' },
    { label: 'Ифтаров', value: counts.total_events, emoji: '🌙' },
    { label: 'Хозяев', value: counts.unique_hosts, emoji: '🏠' },
    { label: 'Приглашений', value: counts.total_invitations, emoji: '💌' },
    { label: 'Принято', value: counts.accepted_rsvps, emoji: '✅' },
  ];

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'только что';
    if (mins < 60) return `${mins} мин назад`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}ч назад`;
    return `${Math.floor(hrs / 24)}д назад`;
  };

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, textAlign: 'center' }}>📊 Аналитика</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 20 }}>Обновляется каждые 30 сек</p>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, marginBottom: 28 }}>
          {statCards.map(s => (
            <div key={s.label} style={{ backgroundColor: 'var(--color-card)', borderRadius: 12, padding: '14px 10px', textAlign: 'center', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: 24 }}>{s.emoji}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-gold)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Upcoming events */}
        <Section title="🗓 Ближайшие ифтары">
          {stats.upcoming_events.length === 0 && <Muted>Нет предстоящих</Muted>}
          {stats.upcoming_events.map(e => (
            <Row key={e.id}>
              <div>
                <div style={{ fontWeight: 500 }}>{new Date(e.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} {e.iftar_time && `• ${e.iftar_time.slice(0, 5)}`}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  {e.location || 'Место не указано'} — {e.host_name || e.host_username || '?'}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                ✅ {e.accepted_count}/{e.invite_count}
              </div>
            </Row>
          ))}
        </Section>

        {/* Recent signups */}
        <Section title="🆕 Новые пользователи">
          {stats.recent_users.map((u, i) => (
            <Row key={i}>
              <span>{u.first_name || u.username || 'Аноним'}{u.username && <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}> @{u.username}</span>}</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{timeAgo(u.created_at)}</span>
            </Row>
          ))}
        </Section>

        {/* Recent events */}
        <Section title="🌟 Последние ифтары">
          {stats.recent_events.map((e, i) => (
            <Row key={i}>
              <div>
                <span>{new Date(e.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}> — {e.host_name || e.host_username || '?'}</span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{timeAgo(e.created_at)}</span>
            </Row>
          ))}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, color: 'var(--color-text-muted)' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'var(--color-card)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      {children}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ color: 'var(--color-text-muted)', fontSize: 14, textAlign: 'center', padding: 16 }}>{children}</div>;
}
