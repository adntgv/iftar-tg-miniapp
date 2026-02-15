import { pgTable, uuid, bigint, text, timestamp, date, time, integer, unique } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
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

export const events = pgTable('events', {
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

export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  event_id: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }),
  guest_id: uuid('guest_id').references(() => users.id, { onDelete: 'cascade' }),
  guest_username: text('guest_username'),
  status: text('status').default('pending'),
  guest_count: integer('guest_count').default(1),
  responded_at: timestamp('responded_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.event_id, t.guest_id),
]);

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
