import express from 'express';
import cors from 'cors';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, gte, inArray, asc } from 'drizzle-orm';
import { pgTable, uuid, bigint, text, timestamp, date, time, integer, unique, boolean } from 'drizzle-orm/pg-core';

// Schema
const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  telegram_id: bigint('telegram_id', { mode: 'number' }).notNull().unique(),
  username: text('username'),
  first_name: text('first_name'),
  last_name: text('last_name'),
  avatar_url: text('avatar_url'),
  city: text('city').default('Астана'),
  city_lat: text('city_lat'),
  city_lng: text('city_lng'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  host_id: uuid('host_id').references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  iftar_time: time('iftar_time'),
  location: text('location'),
  address: text('address'),
  notes: text('notes'),
  is_host_mode: boolean('is_host_mode').default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  event_id: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }),
  guest_id: uuid('guest_id').references(() => users.id, { onDelete: 'cascade' }),
  guest_username: text('guest_username'),
  status: text('status').default('pending'),
  guest_count: integer('guest_count').default(1),
  responded_at: timestamp('responded_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Database connection
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://iftar_user:iftar_secure_pass_2026@io4gs04gskogggg40g8s0s00:5432/iftar_db';
const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

const app = express();
app.use(cors());
app.use(express.json());

// Request timing middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - ${duration}ms`);
  });
  next();
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Get or create user
app.post('/api/users', async (req, res) => {
  try {
    const { id: telegramId, username, first_name, last_name, photo_url } = req.body;

    let [existing] = await db.select().from(users).where(eq(users.telegram_id, telegramId)).limit(1);

    if (existing) {
      const [updated] = await db.update(users).set({
        username,
        first_name,
        last_name,
        avatar_url: photo_url,
        updated_at: new Date(),
      }).where(eq(users.id, existing.id)).returning();
      return res.json(updated || existing);
    }

    const [newUser] = await db.insert(users).values({
      telegram_id: telegramId,
      username,
      first_name,
      last_name,
      avatar_url: photo_url,
    }).returning();

    res.json(newUser);
  } catch (err) {
    console.error('Error in POST /api/users:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get user by username
app.get('/api/users/by-username/:username', async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.username, req.params.username.toLowerCase())).limit(1);
    res.json(user || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user events
app.get('/api/users/:userId/events', async (req, res) => {
  try {
    const { userId } = req.params;
    const today = new Date().toISOString().split('T')[0];

    // Hosted events
    const hosted = await db.select({
      event: events,
      host: users,
    }).from(events)
      .leftJoin(users, eq(events.host_id, users.id))
      .where(and(eq(events.host_id, userId), gte(events.date, today)))
      .orderBy(asc(events.date));

    // Invited events
    const invited = await db.select({
      invitation: invitations,
      event: events,
      host: users,
    }).from(invitations)
      .leftJoin(events, eq(invitations.event_id, events.id))
      .leftJoin(users, eq(events.host_id, users.id))
      .where(eq(invitations.guest_id, userId))
      .orderBy(asc(invitations.created_at));

    const hostedEvents = hosted.map(h => ({ ...h.event, host: h.host }));
    const invitedEvents = invited.filter(i => i.event).map(i => ({
      ...i.event,
      host: i.host,
      invitation_status: i.invitation.status,
      invitation_id: i.invitation.id,
    }));

    const allEvents = [...hostedEvents, ...invitedEvents];
    const uniqueEvents = Array.from(new Map(allEvents.map(e => [e.id, e])).values());
    uniqueEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.json(uniqueEvents);
  } catch (err) {
    console.error('Error in GET /api/users/:userId/events:', err);
    res.status(500).json({ error: err.message });
  }
});

// Check collisions
app.post('/api/check-collisions', async (req, res) => {
  try {
    const { usernames, date: eventDate } = req.body;
    const collisions = [];

    for (const username of usernames) {
      const [user] = await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1);

      if (user) {
        const invites = await db.select({
          invitation: invitations,
          event: events,
          host: users,
        }).from(invitations)
          .leftJoin(events, eq(invitations.event_id, events.id))
          .leftJoin(users, eq(events.host_id, users.id))
          .where(and(
            eq(invitations.guest_id, user.id),
            inArray(invitations.status, ['accepted', 'pending', 'maybe'])
          ));

        const collision = invites.find(i => i.event && i.event.date === eventDate);
        if (collision && collision.event) {
          collisions.push({
            username,
            host_username: collision.host?.username || 'кто-то',
            status: collision.invitation.status,
          });
        }
      }
    }

    res.json(collisions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create event
app.post('/api/events', async (req, res) => {
  try {
    const { host_id, date: eventDate, iftar_time, location, address, notes, is_host_mode } = req.body;

    const [event] = await db.insert(events).values({
      host_id,
      date: eventDate,
      iftar_time,
      location,
      address,
      notes,
      is_host_mode: is_host_mode !== false,
    }).returning();

    const [host] = await db.select().from(users).where(eq(users.id, host_id)).limit(1);

    res.json({ ...event, host });
  } catch (err) {
    console.error('Error in POST /api/events:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get event details
app.get('/api/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    const [eventResult] = await db.select({
      event: events,
      host: users,
    }).from(events)
      .leftJoin(users, eq(events.host_id, users.id))
      .where(eq(events.id, eventId))
      .limit(1);

    if (!eventResult) return res.json(null);

    const eventInvitations = await db.select({
      invitation: invitations,
      guest: users,
    }).from(invitations)
      .leftJoin(users, eq(invitations.guest_id, users.id))
      .where(eq(invitations.event_id, eventId));

    res.json({
      ...eventResult.event,
      host: eventResult.host,
      invitations: eventInvitations.map(i => ({ ...i.invitation, guest: i.guest })),
    });
  } catch (err) {
    console.error('Error in GET /api/events/:eventId:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete event
app.delete('/api/events/:eventId', async (req, res) => {
  try {
    await db.delete(events).where(eq(events.id, req.params.eventId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create invitations by username
app.post('/api/events/:eventId/invite', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { usernames } = req.body;

    for (const username of usernames) {
      const [user] = await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1);

      if (user) {
        await db.insert(invitations).values({
          event_id: eventId,
          guest_id: user.id,
          status: 'pending',
        }).onConflictDoNothing();
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ensure invitation (create if not exists)
app.post('/api/events/:eventId/ensure-invitation', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { guest_id } = req.body;

    await db.insert(invitations).values({
      event_id: eventId,
      guest_id,
      status: 'pending',
      guest_count: 1,
    }).onConflictDoNothing();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Respond to invitation
app.patch('/api/invitations/:invitationId', async (req, res) => {
  try {
    const { invitationId } = req.params;
    const { status } = req.body;

    const [updated] = await db.update(invitations).set({
      status,
      responded_at: new Date(),
    }).where(eq(invitations.id, invitationId)).returning();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove invitation
app.delete('/api/invitations/:invitationId', async (req, res) => {
  try {
    await db.delete(invitations).where(eq(invitations.id, req.params.invitationId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get users by telegram IDs
app.post('/api/users/by-telegram-ids', async (req, res) => {
  try {
    const { telegram_ids } = req.body;
    if (!telegram_ids?.length) return res.json([]);
    
    const result = await db.select().from(users).where(inArray(users.telegram_id, telegram_ids));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== Muftyat.kz API proxy with caching =====
const prayerTimesCache = new Map(); // key: "year/lat/lng" -> { data, ts }
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

// Major KZ cities (pre-cached for fast selection)
// Exact coords from muftyat.kz cities API (must match exactly for prayer-times to work)
const MAJOR_CITIES = [
  { id: '3', title: 'Астана', lat: '51.133333', lng: '71.433333' },
  { id: '72', title: 'Алматы', lat: '43.238293', lng: '76.945465' },
  { id: '57', title: 'Шымкент', lat: '42.368009', lng: '69.612769' },
  { id: '20', title: 'Ақтөбе', lat: '50.300377', lng: '57.154555' },
  { id: '11357', title: 'Ақтау', lat: '50.995589', lng: '50.179948' },
  { id: '18', title: 'Атырау', lat: '47.116667', lng: '51.883333' },
  { id: '39', title: 'Қарағанды', lat: '49.806406', lng: '73.085485' },
  { id: '42', title: 'Қостанай', lat: '53.219333', lng: '63.634194' },
  { id: '53', title: 'Павлодар', lat: '52.315556', lng: '76.956389' },
  { id: '32', title: 'Семей', lat: '50.404976', lng: '80.249235' },
  { id: '7', title: 'Орал', lat: '51.204019', lng: '51.370537' },
  { id: '30', title: 'Өскемен', lat: '49.948325', lng: '82.627848' },
  { id: '35', title: 'Тараз', lat: '42.883333', lng: '71.366667' },
  { id: '162', title: 'Талдықорған', lat: '45.017837', lng: '78.382123' },
  { id: '58', title: 'Түркістан', lat: '43.302025', lng: '68.268979' },
  { id: '46', title: 'Қызылорда', lat: '44.842544', lng: '65.502563' },
  { id: '51', title: 'Петропавл', lat: '54.862222', lng: '69.140833' },
  { id: '17', title: 'Көкшетау', lat: '53.291667', lng: '69.391667' },
];

async function fetchPrayerTimes(year, lat, lng) {
  const key = `${year}/${lat}/${lng}`;
  const cached = prayerTimesCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const url = `https://api.muftyat.kz/prayer-times/${year}/${lat}/${lng}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Muftyat API error: ${resp.status}`);
  const json = await resp.json();
  const data = json.result || [];
  prayerTimesCache.set(key, { data, ts: Date.now() });
  return data;
}

// Get major cities list
app.get('/api/cities', (req, res) => {
  res.json(MAJOR_CITIES);
});

// Search cities from muftyat API
let allCitiesCache = null;
let allCitiesCacheTs = 0;

app.get('/api/cities/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase().trim();
    if (!q || q.length < 2) return res.json(MAJOR_CITIES);

    // Check major cities first
    const majorMatches = MAJOR_CITIES.filter(c => c.title.toLowerCase().includes(q));
    if (majorMatches.length > 0) return res.json(majorMatches);

    // Fetch full list from muftyat (cached 24h)
    if (!allCitiesCache || Date.now() - allCitiesCacheTs > CACHE_TTL) {
      let all = [];
      let url = 'https://api.muftyat.kz/cities/';
      while (url) {
        const resp = await fetch(url);
        const json = await resp.json();
        all = all.concat(json.results || []);
        url = json.next;
      }
      allCitiesCache = all;
      allCitiesCacheTs = Date.now();
    }

    const matches = allCitiesCache
      .filter(c => c.title.toLowerCase().includes(q))
      .slice(0, 20)
      .map(c => ({ id: String(c.id), title: c.title, lat: c.lat, lng: c.lng, region: c.region }));

    res.json(matches);
  } catch (err) {
    console.error('City search error:', err);
    res.json(MAJOR_CITIES);
  }
});

// Get prayer times for coordinates
app.get('/api/prayer-times/:lat/:lng', async (req, res) => {
  try {
    const { lat, lng } = req.params;
    const year = req.query.year || new Date().getFullYear();
    const data = await fetchPrayerTimes(year, lat, lng);
    res.json(data);
  } catch (err) {
    console.error('Prayer times error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update user city (now accepts city name + lat/lng)
app.patch('/api/users/:userId/city', async (req, res) => {
  try {
    const { userId } = req.params;
    const { city, lat, lng } = req.body;
    if (!city) return res.status(400).json({ error: 'City required' });

    const [updated] = await db.update(users).set({
      city,
      city_lat: lat || null,
      city_lng: lng || null,
      updated_at: new Date(),
    }).where(eq(users.id, userId)).returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Analytics stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const [counts] = await sql`
      SELECT
        (SELECT count(*) FROM users) AS total_users,
        (SELECT count(*) FROM events) AS total_events,
        (SELECT count(DISTINCT host_id) FROM events) AS unique_hosts,
        (SELECT count(*) FROM invitations) AS total_invitations,
        (SELECT count(*) FROM invitations WHERE status = 'accepted') AS accepted_rsvps
    `;

    const upcoming_events = await sql`
      SELECT e.id, e.date, e.location, e.iftar_time, e.is_host_mode,
             u.first_name AS host_name, u.username AS host_username,
             (SELECT count(*) FROM invitations i WHERE i.event_id = e.id) AS invite_count,
             (SELECT count(*) FROM invitations i WHERE i.event_id = e.id AND i.status = 'accepted') AS accepted_count
      FROM events e
      LEFT JOIN users u ON e.host_id = u.id
      WHERE e.date >= CURRENT_DATE
      ORDER BY e.date ASC
      LIMIT 20
    `;

    const recent_users = await sql`
      SELECT first_name, username, created_at FROM users ORDER BY created_at DESC LIMIT 10
    `;

    const recent_events = await sql`
      SELECT e.date, e.location, e.created_at, u.first_name AS host_name, u.username AS host_username
      FROM events e LEFT JOIN users u ON e.host_id = u.id
      ORDER BY e.created_at DESC LIMIT 10
    `;

    res.json({ counts, upcoming_events, recent_users, recent_events });
  } catch (err) {
    console.error('Error in GET /api/stats:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Iftar API running on port ${PORT}`);
});
