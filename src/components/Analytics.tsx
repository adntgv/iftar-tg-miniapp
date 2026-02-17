import { useState, useEffect, useRef } from 'react';

interface Stats {
  counts: {
    total_users: number;
    total_events: number;
    unique_hosts: number;
    total_invitations: number;
    accepted_rsvps: number;
  };
  user_growth: Array<{ day: string; new_users: number }>;
  recent_events: Array<{
    date: string;
    location: string;
    created_at: string;
    host_name: string;
    host_username: string;
  }>;
}

function GrowthChart({ data }: { data: Array<{ day: string; new_users: number }> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    // Compute cumulative totals
    let cumulative = 0;
    const points = data.map(d => {
      cumulative += Number(d.new_users);
      return { day: d.day, total: cumulative };
    });

    const maxVal = Math.max(...points.map(p => p.total), 1);
    const padTop = 24, padBot = 40, padLeft = 36, padRight = 12;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBot;

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    const gridLines = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.font = '10px system-ui';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridLines; i++) {
      const y = padTop + chartH - (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(W - padRight, y);
      ctx.stroke();
      ctx.fillText(String(Math.round((i / gridLines) * maxVal)), padLeft - 6, y + 3);
    }

    if (points.length < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.font = '13px system-ui';
      ctx.fillText('Недостаточно данных', W / 2, H / 2);
      return;
    }

    // Draw area + line
    const xStep = chartW / (points.length - 1);
    const getX = (i: number) => padLeft + i * xStep;
    const getY = (v: number) => padTop + chartH - (v / maxVal) * chartH;

    // Area fill
    const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
    gradient.addColorStop(0, 'rgba(212, 175, 55, 0.3)');
    gradient.addColorStop(1, 'rgba(212, 175, 55, 0.02)');
    ctx.beginPath();
    ctx.moveTo(getX(0), padTop + chartH);
    points.forEach((p, i) => ctx.lineTo(getX(i), getY(p.total)));
    ctx.lineTo(getX(points.length - 1), padTop + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = getX(i), y = getY(p.total);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(getX(i), getY(p.total), 3, 0, Math.PI * 2);
      ctx.fillStyle = '#d4af37';
      ctx.fill();
    });

    // X-axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    const labelEvery = Math.max(1, Math.floor(points.length / 6));
    points.forEach((p, i) => {
      if (i % labelEvery === 0 || i === points.length - 1) {
        const d = new Date(p.day);
        ctx.fillText(`${d.getDate()}/${d.getMonth() + 1}`, getX(i), H - padBot + 16);
      }
    });
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: 200, display: 'block' }}
    />
  );
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

        {/* User growth chart */}
        <Section title="📈 Рост пользователей">
          <div style={{ backgroundColor: 'var(--color-card)', borderRadius: 12, padding: '16px 12px', border: '1px solid var(--color-border)' }}>
            <GrowthChart data={stats.user_growth || []} />
          </div>
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
