import express from 'express';
import { createClient } from '@supabase/supabase-js';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const BOT_USERNAME = process.env.BOT_USERNAME || 'iftar_coordinator_bot';
const RAMADAN_START = new Date('2026-02-17');

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
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}

// Generate OG image using satori
app.get('/og/:eventId.png', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const { data: event } = await supabase
      .from('events')
      .select('*, host:users(*)')
      .eq('id', eventId)
      .single();

    if (!event) {
      return res.status(404).send('Event not found');
    }

    const eventDate = new Date(event.date);
    const ramadanDay = getRamadanDay(eventDate);
    const dateStr = formatDate(eventDate);
    const hostName = event.host?.first_name || 'Друг';
    const location = event.location || 'Место уточняется';
    const time = event.iftar_time?.slice(0, 5) || '18:00';

    // Fetch font if not local
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
            // Top decoration
            {
              type: 'div',
              props: {
                style: {
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  fontSize: '60px',
                },
                children: '🌙',
              },
            },
            // Title
            {
              type: 'div',
              props: {
                style: {
                  color: '#d4af37',
                  fontSize: '36px',
                  fontWeight: 'bold',
                  marginBottom: '10px',
                },
                children: 'ПРИГЛАШЕНИЕ НА ИФТАР',
              },
            },
            // Subtitle
            {
              type: 'div',
              props: {
                style: {
                  color: '#888888',
                  fontSize: '24px',
                  marginBottom: '40px',
                },
                children: `${hostName} приглашает тебя`,
              },
            },
            // Main content box
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
                  // Left: Ramadan day
                  {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                      },
                      children: [
                        {
                          type: 'div',
                          props: {
                            style: {
                              color: '#d4af37',
                              fontSize: '100px',
                              fontWeight: 'bold',
                              lineHeight: '1',
                            },
                            children: String(ramadanDay),
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            style: {
                              color: '#d4af37',
                              fontSize: '28px',
                              fontWeight: 'bold',
                            },
                            children: 'РАМАДАН',
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            style: {
                              color: '#888888',
                              fontSize: '20px',
                              marginTop: '5px',
                            },
                            children: dateStr,
                          },
                        },
                      ],
                    },
                  },
                  // Divider
                  {
                    type: 'div',
                    props: {
                      style: {
                        width: '2px',
                        backgroundColor: 'rgba(212, 175, 55, 0.3)',
                      },
                    },
                  },
                  // Right: Time and location
                  {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: '20px',
                      },
                      children: [
                        {
                          type: 'div',
                          props: {
                            style: {
                              color: '#ffffff',
                              fontSize: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                            },
                            children: `⏰ ${time}`,
                          },
                        },
                        {
                          type: 'div',
                          props: {
                            style: {
                              color: '#ffffff',
                              fontSize: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                            },
                            children: `📍 ${location.length > 20 ? location.slice(0, 20) + '...' : location}`,
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
            // CTA
            {
              type: 'div',
              props: {
                style: {
                  color: '#22c55e',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  marginTop: '40px',
                },
                children: '👆 Нажми чтобы ответить',
              },
            },
          ],
        },
      },
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: 'Inter',
            data: fontData,
            weight: 700,
            style: 'normal',
          },
        ],
      }
    );

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: 1200 },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(pngBuffer);
    
  } catch (error) {
    console.error('OG generation error:', error);
    res.status(500).send('Error generating image: ' + error.message);
  }
});

// Invite page with OG meta tags
app.get('/invite/:eventId', async (req, res) => {
  const { eventId } = req.params;
  
  const { data: event } = await supabase
    .from('events')
    .select('*, host:users(*)')
    .eq('id', eventId)
    .single();

  if (!event) {
    return res.redirect(`https://t.me/${BOT_USERNAME}`);
  }

  const eventDate = new Date(event.date);
  const ramadanDay = getRamadanDay(eventDate);
  const hostName = event.host?.first_name || 'Друг';
  const title = `🌙 Приглашение на ифтар от ${hostName}`;
  const description = `${ramadanDay} Рамадан • ${formatDate(eventDate)} • ${event.location || 'Место уточняется'}`;
  const ogImage = `https://iftar.adntgv.com/og/${eventId}.png`;
  const botLink = `https://t.me/${BOT_USERNAME}?start=event_${eventId}`;

  res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="https://iftar.adntgv.com/invite/${eventId}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImage}">
  
  <style>
    body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0a1f0a 0%, #0f1f15 50%, #0a0f0a 100%);
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      color: white;
    }
    .container { text-align: center; padding: 40px; }
    h1 { color: #d4af37; font-size: 24px; margin-bottom: 20px; }
    p { color: #888; margin-bottom: 30px; }
    .btn {
      display: inline-block;
      background: #22c55e;
      color: white;
      padding: 16px 32px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: bold;
    }
  </style>
  <script>setTimeout(() => { window.location.href = '${botLink}'; }, 1500);</script>
</head>
<body>
  <div class="container">
    <h1>🌙 Приглашение на ифтар</h1>
    <p>Переходим в Telegram...</p>
    <a href="${botLink}" class="btn">Открыть в Telegram</a>
  </div>
</body>
</html>
  `);
});

// Health check
app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => {
  console.log(`OG API running on port ${PORT}`);
});
