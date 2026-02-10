# Iftar Mini App 🌙

Telegram Mini App для координации ифтаров во время Рамадана.

## Features

- 📅 Календарь Рамадана с отметками ифтаров
- ⚠️ Collision detection — видишь когда гости уже приглашены
- ✅ RSVP одним тапом прямо в Telegram
- 🔗 Шеринг приглашений через inline кнопки
- 🌙 Автоматическое время ифтара по геолокации

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Backend:** Supabase (Postgres + Auth + Realtime)
- **Bot:** Grammy.js
- **Deploy:** Docker + Coolify

## Setup

### 1. Supabase

1. Создай проект на [supabase.com](https://supabase.com)
2. Выполни `supabase/schema.sql` в SQL Editor
3. Скопируй URL и anon key в `.env`

### 2. Telegram Bot

1. Создай бота через [@BotFather](https://t.me/BotFather)
2. Включи inline mode и web app
3. Установи Menu Button → Web App URL

### 3. Development

```bash
npm install
npm run dev
```

### 4. Deploy

```bash
docker build -t iftar-miniapp .
docker run -p 3000:80 iftar-miniapp
```

## Environment Variables

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_BOT_USERNAME=iftar_app_bot
```

## Bot Commands

- `/start` — Главное меню с кнопкой Mini App
- `/start event_<id>` — Deep link на конкретное приглашение

## Schema

```
users        — Telegram users
events       — Iftar events (date, location, host)
invitations  — Guest RSVPs (pending/accepted/declined/maybe)
contacts     — Friend connections for calendar sharing
```

## API

```typescript
// Check if guests are busy on a date
checkCollisions(telegramIds: number[], date: string)

// Create event with invitations
createEvent(hostId, date, time, location)
createInvitations(eventId, guestIds)

// Respond to invitation
respondToInvitation(invitationId, status)
```

## License

MIT
