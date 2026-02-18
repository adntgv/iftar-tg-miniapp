// One-shot reminder script - runs sendReminders() then exits
import { Bot } from 'grammy';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, gte, inArray, asc } from 'drizzle-orm';
import { pgTable, uuid, bigint, text, timestamp, date, time, integer } from 'drizzle-orm/pg-core';
import fetch from 'node-fetch';

const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  telegram_id: bigint('telegram_id', { mode: 'number' }).notNull().unique(),
  username: text('username'),
  first_name: text('first_name'),
  last_name: text('last_name'),
  avatar_url: text('avatar_url'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  host_id: uuid('host_id'),
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
  event_id: uuid('event_id'),
  guest_id: uuid('guest_id'),
  guest_username: text('guest_username'),
  status: text('status').default('pending'),
  guest_count: integer('guest_count').default(1),
  responded_at: timestamp('responded_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = postgres(DATABASE_URL);
const db = drizzle(sql);
const bot = new Bot(process.env.BOT_TOKEN!);
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://iftar.adntgv.com';

async function sendReminders() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  console.log(`Checking reminders for ${tomorrowStr}...`);
  
  const tomorrowEvents = await db.select().from(events).where(eq(events.date, tomorrowStr));
  
  if (tomorrowEvents.length === 0) {
    console.log('No events tomorrow.');
    return;
  }
  
  for (const event of tomorrowEvents) {
    const eventInvitations = await db.select().from(invitations).where(eq(invitations.event_id, event.id));
    const acceptedGuests = eventInvitations.filter(i => i.status === 'accepted');
    
    // Get guest user records
    const guestIds = acceptedGuests.map(i => i.guest_id).filter(Boolean) as string[];
    let guestUsers: any[] = [];
    if (guestIds.length > 0) {
      guestUsers = await db.select().from(users).where(inArray(users.id, guestIds));
    }
    
    // Send reminder to accepted guests
    for (const guest of guestUsers) {
      try {
        await bot.api.sendMessage(guest.telegram_id, 
          `🌙 Напоминание: завтра ифтар!\n\n📍 ${event.location || 'Не указано'}\n🕐 ${event.iftar_time || 'Время не указано'}\n${event.notes ? `📝 ${event.notes}` : ''}\n\nОткрыть: ${MINI_APP_URL}`
        );
        console.log(`Reminder sent to ${guest.telegram_id}`);
      } catch (e) {
        console.error(`Failed to send reminder to ${guest.telegram_id}:`, e);
      }
    }
    
    // Send reminder to host
    if (event.host_id) {
      const [host] = await db.select().from(users).where(eq(users.id, event.host_id));
      if (host) {
        try {
          const guestCount = acceptedGuests.reduce((sum, i) => sum + (i.guest_count || 1), 0);
          await bot.api.sendMessage(host.telegram_id,
            `🌙 Напоминание: завтра ваш ифтар!\n\n📍 ${event.location || 'Не указано'}\n🕐 ${event.iftar_time || 'Время не указано'}\n👥 Подтвердили: ${guestCount} гостей\n\nОткрыть: ${MINI_APP_URL}`
          );
          console.log(`Host reminder sent to ${host.telegram_id}`);
        } catch (e) {
          console.error(`Failed to send host reminder:`, e);
        }
      }
    }
  }
}

sendReminders()
  .then(() => { console.log('Done.'); process.exit(0); })
  .catch((e) => { console.error(e); process.exit(1); });
