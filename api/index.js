import express from 'express';
import cors from 'cors';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, gte, inArray, asc } from 'drizzle-orm';
import { pgTable, uuid, bigint, text, timestamp, date, time, integer, unique } from 'drizzle-orm/pg-core';

// Schema
const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  telegram_id: bigint('telegram_id', { mode: 'number' }).notNull().unique(),
  username: text('username'),
  first_name: text('first_name'),
  last_name: text('last_name'),
  avatar_url: text('avatar_url'),
  city: text('city').default('astana'),
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
    const { host_id, date: eventDate, iftar_time, location, address, notes } = req.body;

    const [event] = await db.insert(events).values({
      host_id,
      date: eventDate,
      iftar_time,
      location,
      address,
      notes,
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

// Update user city
app.patch('/api/users/:userId/city', async (req, res) => {
  try {
    const { userId } = req.params;
    const { city } = req.body;
    const validCities = ['astana','almaty','shymkent','aktobe','aktau','atyrau','karaganda','kostanay','pavlodar','semey','oral','oskemen'];
    if (!validCities.includes(city)) {
      return res.status(400).json({ error: 'Invalid city' });
    }
    const [updated] = await db.update(users).set({ city, updated_at: new Date() }).where(eq(users.id, userId)).returning();
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Iftar API running on port ${PORT}`);
});
