import express from 'express';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const API_URL = process.env.API_URL || 'https://iftar-api.adntgv.com';
const BOT_USERNAME = process.env.BOT_USERNAME || 'iftar_coordinator_bot';
const RAMADAN_START = new Date('2026-02-19');

// Load font
let fontData;
try {
  fontData = readFileSync(join(__dirname, 'NotoSans-Bold.ttf'));
  console.log('Font loaded successfully');
} catch (e) {
  console.error('Font load error:', e);
  fontData = null;
}

function getRamadanDay(date) {
  const diff = date.getTime() - RAMADAN_START.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
}

function formatDate(date) {
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  return {
    full: `${date.getDate()} ${months[date.getMonth()]}`,
    day: days[date.getDay()],
    short: `${date.getDate()} ${months[date.getMonth()].slice(0, 3)}`
  };
}

// Fetch event from the new API
async function fetchEvent(eventId) {
  const response = await fetch(`${API_URL}/api/events/${eventId}`);
  if (!response.ok) return null;
  return response.json();
}

// Generate OG image using satori
app.get('/og/:eventId.png', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await fetchEvent(eventId);

    if (!event) {
      return res.status(404).send('Event not found');
    }

    const eventDate = new Date(event.date);
    const ramadanDay = getRamadanDay(eventDate);
    const dateStr = formatDate(eventDate).short;
    const hostName = event.host?.first_name || 'Друг';
    const location = event.location || 'Место уточняется';
    const time = event.iftar_time?.slice(0, 5) || '18:00';

    if (!fontData) {
      const fontRes = await fetch('https://github.com/googlefonts/noto-fonts/raw/main/unhinted/ttf/NotoSans/NotoSans-Bold.ttf');
      fontData = Buffer.from(await fontRes.arrayBuffer());
    }

    const svg = await satori(
      {
        type: 'div',
        props: {
          style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0a1f0a 0%, #0f1f15 50%, #0a0f0a 100%)',
            fontFamily: 'Inter',
            padding: '40px',
          },
          children: [
            {
              type: 'div',
              props: {
                style: { position: 'absolute', top: '20px', right: '20px', fontSize: '60px' },
                children: '🌙',
              },
            },
            {
              type: 'div',
              props: {
                style: { color: '#d4af37', fontSize: '36px', fontWeight: 'bold', marginBottom: '10px' },
                children: 'ПРИГЛАШЕНИЕ НА ИФТАР',
              },
            },
            {
              type: 'div',
              props: {
                style: { color: '#888888', fontSize: '24px', marginBottom: '40px' },
                children: `${hostName} приглашает тебя`,
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  display: 'flex',
                  backgroundColor: 'rgba(212, 175, 55, 0.1)',
                  border: '2px solid rgba(212, 175, 55, 0.5)',
                  borderRadius: '20px',
                  padding: '40px',
                  gap: '60px',
                },
                children: [
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
                      children: [
                        { type: 'div', props: { style: { color: '#d4af37', fontSize: '100px', fontWeight: 'bold', lineHeight: '1' }, children: String(ramadanDay) } },
                        { type: 'div', props: { style: { color: '#d4af37', fontSize: '28px', fontWeight: 'bold' }, children: 'РАМАДАН' } },
                        { type: 'div', props: { style: { color: '#888888', fontSize: '20px', marginTop: '5px' }, children: dateStr } },
                      ],
                    },
                  },
                  { type: 'div', props: { style: { width: '2px', backgroundColor: 'rgba(212, 175, 55, 0.3)' } } },
                  {
                    type: 'div',
                    props: {
                      style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '20px' },
                      children: [
                        { type: 'div', props: { style: { color: '#ffffff', fontSize: '28px' }, children: `⏰ ${time}` } },
                        { type: 'div', props: { style: { color: '#ffffff', fontSize: '28px' }, children: `📍 ${location.length > 20 ? location.slice(0, 20) + '...' : location}` } },
                      ],
                    },
                  },
                ],
              },
            },
            {
              type: 'div',
              props: {
                style: { color: '#22c55e', fontSize: '24px', fontWeight: 'bold', marginTop: '40px' },
                children: '👆 Нажми чтобы ответить',
              },
            },
          ],
        },
      },
      { width: 1200, height: 630, fonts: [{ name: 'Inter', data: fontData, weight: 700, style: 'normal' }] }
    );

    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
    const pngBuffer = resvg.render().asPng();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(pngBuffer);
    
  } catch (error) {
    console.error('OG generation error:', error);
    res.status(500).send('Error generating image: ' + error.message);
  }
});

// Beautiful invite page
app.get('/invite/:eventId', async (req, res) => {
  const { eventId } = req.params;
  
  const event = await fetchEvent(eventId);

  if (!event) {
    return res.redirect(`https://t.me/${BOT_USERNAME}`);
  }

  const eventDate = new Date(event.date);
  const ramadanDay = getRamadanDay(eventDate);
  const { full: dateStr, day: dayName } = formatDate(eventDate);
  const hostName = event.host?.first_name || 'Друг';
  const hostAvatar = event.host?.first_name?.[0]?.toUpperCase() || '?';
  const location = event.location || '';
  const address = event.address || '';
  const time = event.iftar_time?.slice(0, 5) || '18:00';
  const notes = event.notes || '';
  
  const title = `Приглашение на ифтар от ${hostName}`;
  const description = `${ramadanDay} Рамадан · ${dateStr} · ${location || 'Место уточняется'}`;
  const ogImage = `https://iftar.adntgv.com/og/${eventId}.png`;

  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>🌙 ${title}</title>
  
  <meta property="og:type" content="website">
  <meta property="og:title" content="🌙 ${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="https://iftar.adntgv.com/invite/${eventId}">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="🌙 ${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImage}">
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script defer src="https://umami.adntgv.com/script.js" data-website-id="e2b0e90c-3cee-474d-8d8a-2fc585e66d99"></script>
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    :root {
      --gold: #d4af37;
      --gold-dim: rgba(212, 175, 55, 0.2);
      --green: #22c55e;
      --green-dim: rgba(34, 197, 94, 0.15);
      --red: #ef4444;
      --bg: #0a0f0a;
      --card: #111811;
      --text: #ffffff;
      --muted: #6b7280;
    }
    
    body {
      font-family: 'Noto Sans', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      min-height: 100dvh;
      overflow-x: hidden;
    }
    
    .bg-pattern {
      position: fixed;
      inset: 0;
      background: 
        radial-gradient(ellipse at 50% 0%, rgba(212, 175, 55, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(34, 197, 94, 0.05) 0%, transparent 40%);
      pointer-events: none;
    }
    
    .container {
      position: relative;
      max-width: 440px;
      margin: 0 auto;
      padding: 24px 20px 40px;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
    }
    
    /* Header with moon */
    .header {
      text-align: center;
      padding: 20px 0 32px;
    }
    
    .moon {
      font-size: 64px;
      line-height: 1;
      margin-bottom: 16px;
      animation: float 4s ease-in-out infinite;
    }
    
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    
    .header h1 {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 8px;
    }
    
    .header .subtitle {
      font-size: 15px;
      color: var(--muted);
    }
    
    /* Host card */
    .host-card {
      display: flex;
      align-items: center;
      gap: 14px;
      background: var(--card);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 16px 18px;
      margin-bottom: 20px;
    }
    
    .avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--gold) 0%, #b8942d 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 700;
      color: #0a0f0a;
      flex-shrink: 0;
    }
    
    .host-info {
      flex: 1;
    }
    
    .host-name {
      font-size: 17px;
      font-weight: 600;
      margin-bottom: 2px;
    }
    
    .host-label {
      font-size: 13px;
      color: var(--muted);
    }
    
    /* Event card */
    .event-card {
      background: var(--card);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 20px;
      overflow: hidden;
      margin-bottom: 20px;
    }
    
    .ramadan-header {
      background: var(--gold-dim);
      padding: 28px 24px;
      text-align: center;
      border-bottom: 1px solid rgba(212, 175, 55, 0.15);
    }
    
    .ramadan-day {
      font-size: 72px;
      font-weight: 700;
      color: var(--gold);
      line-height: 1;
      margin-bottom: 4px;
    }
    
    .ramadan-label {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--gold);
      opacity: 0.8;
    }
    
    .event-details {
      padding: 20px 24px;
    }
    
    .detail-row {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 14px 0;
    }
    
    .detail-row:not(:last-child) {
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    
    .detail-icon {
      font-size: 20px;
      width: 28px;
      text-align: center;
      flex-shrink: 0;
    }
    
    .detail-content {
      flex: 1;
    }
    
    .detail-label {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 3px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .detail-value {
      font-size: 16px;
      font-weight: 500;
    }
    
    .detail-sub {
      font-size: 14px;
      color: var(--muted);
      margin-top: 2px;
    }
    
    /* Notes */
    .notes {
      background: rgba(255,255,255,0.03);
      border-radius: 12px;
      padding: 14px 16px;
      margin: 0 24px 20px;
      font-size: 14px;
      color: var(--muted);
      font-style: italic;
      line-height: 1.5;
    }
    
    .notes::before {
      content: '"';
      color: var(--gold);
      font-size: 20px;
      margin-right: 4px;
    }
    
    .notes::after {
      content: '"';
      color: var(--gold);
      font-size: 20px;
      margin-left: 4px;
    }
    
    /* RSVP section */
    .rsvp-section {
      margin-top: auto;
      padding-top: 20px;
    }
    
    .rsvp-title {
      text-align: center;
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    
    .rsvp-buttons {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .rsvp-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 16px 24px;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      border: none;
    }
    
    .rsvp-btn.primary {
      background: var(--green);
      color: white;
    }
    
    .rsvp-btn.primary:active {
      transform: scale(0.98);
      background: #1da34d;
    }
    
    .rsvp-btn.secondary {
      background: var(--card);
      color: var(--text);
      border: 1px solid rgba(255,255,255,0.1);
    }
    
    .rsvp-btn.secondary:active {
      background: rgba(255,255,255,0.05);
    }
    
    /* Guest count selector */
    .guest-select {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
    }
    
    .guest-option {
      flex: 1;
      padding: 14px 8px;
      background: var(--card);
      border: 2px solid transparent;
      border-radius: 12px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .guest-option.selected {
      border-color: var(--green);
      background: var(--green-dim);
    }
    
    .guest-option:active {
      transform: scale(0.97);
    }
    
    .guest-option .icon {
      font-size: 24px;
      margin-bottom: 4px;
    }
    
    .guest-option .label {
      font-size: 12px;
      color: var(--muted);
    }
    
    .guest-option.selected .label {
      color: var(--green);
    }
    
    /* Footer */
    .footer {
      text-align: center;
      padding: 24px 0 0;
      font-size: 12px;
      color: var(--muted);
    }
    
    .footer a {
      color: var(--gold);
      text-decoration: none;
    }
    
    /* Animations */
    .fade-in {
      animation: fadeIn 0.6s ease-out;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .delay-1 { animation-delay: 0.1s; animation-fill-mode: both; }
    .delay-2 { animation-delay: 0.2s; animation-fill-mode: both; }
    .delay-3 { animation-delay: 0.3s; animation-fill-mode: both; }
  </style>
</head>
<body>
  <div class="bg-pattern"></div>
  
  <div class="container">
    <div class="header fade-in">
      <div class="moon">🌙</div>
      <h1>Приглашение на ифтар</h1>
      <p class="subtitle">Рамадан 1447 / 2026</p>
    </div>
    
    <div class="host-card fade-in delay-1">
      <div class="avatar">${hostAvatar}</div>
      <div class="host-info">
        <div class="host-name">${hostName}</div>
        <div class="host-label">приглашает тебя разделить ифтар</div>
      </div>
    </div>
    
    <div class="event-card fade-in delay-2">
      <div class="ramadan-header">
        <div class="ramadan-day">${ramadanDay}</div>
        <div class="ramadan-label">Рамадан</div>
      </div>
      
      <div class="event-details">
        <div class="detail-row">
          <span class="detail-icon">📅</span>
          <div class="detail-content">
            <div class="detail-label">Дата</div>
            <div class="detail-value">${dateStr}</div>
            <div class="detail-sub">${dayName}</div>
          </div>
        </div>
        
        <div class="detail-row">
          <span class="detail-icon">⏰</span>
          <div class="detail-content">
            <div class="detail-label">Время ифтара</div>
            <div class="detail-value">${time}</div>
          </div>
        </div>
        
        ${location ? `
        <div class="detail-row">
          <span class="detail-icon">📍</span>
          <div class="detail-content">
            <div class="detail-label">Место</div>
            <div class="detail-value">${location}</div>
            ${address ? `<div class="detail-sub">${address}</div>` : ''}
          </div>
        </div>
        ` : ''}
      </div>
      
      ${notes ? `<div class="notes">${notes}</div>` : ''}
    </div>
    
    <div class="rsvp-section fade-in delay-3">
      <div class="rsvp-title">Ты придёшь?</div>
      
      <div class="guest-select" id="guestSelect">
        <div class="guest-option selected" data-count="1" onclick="selectGuests(1)">
          <div class="icon">🙋</div>
          <div class="label">Один</div>
        </div>
        <div class="guest-option" data-count="2" onclick="selectGuests(2)">
          <div class="icon">👥</div>
          <div class="label">Вдвоём</div>
        </div>
        <div class="guest-option" data-count="3" onclick="selectGuests(3)">
          <div class="icon">👨‍👩‍👧</div>
          <div class="label">Семьёй</div>
        </div>
      </div>
      
      <div class="rsvp-buttons">
        <a href="#" class="rsvp-btn primary" id="acceptBtn" onclick="respond('accepted')">
          ✓ Приду
        </a>
        <a href="#" class="rsvp-btn secondary" onclick="respond('declined')">
          Не смогу
        </a>
      </div>
    </div>
    
    <div class="footer">
      <p>Создать своё приглашение →</p>
      <a href="https://t.me/${BOT_USERNAME}">@${BOT_USERNAME}</a>
    </div>
  </div>
  
  <script>
    let guestCount = 1;
    const eventId = '${eventId}';
    
    function selectGuests(count) {
      guestCount = count;
      document.querySelectorAll('.guest-option').forEach(el => {
        el.classList.toggle('selected', parseInt(el.dataset.count) === count);
      });
    }
    
    function respond(status) {
      event.preventDefault();
      // Format: rsvp_{eventId}_{status}_{guestCount}
      const botLink = 'https://t.me/${BOT_USERNAME}?start=rsvp_' + eventId + '_' + status + '_' + guestCount;
      window.location.href = botLink;
    }
  </script>
</body>
</html>`);
});

// Health check
app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => {
  console.log(`OG API running on port ${PORT}`);
  console.log(`Fetching events from: ${API_URL}`);
});
