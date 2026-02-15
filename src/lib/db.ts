import { eq, and, gte, asc, inArray } from 'drizzle-orm';
import { users, events, invitations, type User, type Event, type Invitation } from './schema';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

// Re-export types
export type { User, Event, Invitation };

// Extended types with relations
export interface EventWithHost extends Event {
  host?: User | null;
  invitation_status?: string;
  invitation_id?: string;
}

export interface EventWithInvitations extends Event {
  host?: User | null;
  invitations: (Invitation & { guest?: User | null })[];
}

export interface InvitationWithRelations extends Invitation {
  event?: Event | null;
  guest?: User | null;
}

export function createDbFunctions(db: PostgresJsDatabase) {
  return {
    // User functions
    async getOrCreateUser(telegramUser: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
      photo_url?: string;
    }): Promise<User> {
      // Try to get existing user
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.telegram_id, telegramUser.id))
        .limit(1);

      if (existing) {
        // Update user info if changed
        const [updated] = await db
          .update(users)
          .set({
            username: telegramUser.username,
            first_name: telegramUser.first_name,
            last_name: telegramUser.last_name,
            avatar_url: telegramUser.photo_url,
            updated_at: new Date(),
          })
          .where(eq(users.id, existing.id))
          .returning();
        return updated || existing;
      }

      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          telegram_id: telegramUser.id,
          username: telegramUser.username,
          first_name: telegramUser.first_name,
          last_name: telegramUser.last_name,
          avatar_url: telegramUser.photo_url,
        })
        .returning();

      return newUser;
    },

    async getUserByUsername(username: string): Promise<User | null> {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username.toLowerCase()))
        .limit(1);
      return user || null;
    },

    async getUserById(userId: string): Promise<User | null> {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      return user || null;
    },

    async getUserByTelegramId(telegramId: number): Promise<User | null> {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.telegram_id, telegramId))
        .limit(1);
      return user || null;
    },

    async getUsersByTelegramIds(telegramIds: number[]): Promise<User[]> {
      if (telegramIds.length === 0) return [];
      return db
        .select()
        .from(users)
        .where(inArray(users.telegram_id, telegramIds));
    },

    // Event functions
    async getUserEvents(userId: string): Promise<EventWithHost[]> {
      const today = new Date().toISOString().split('T')[0];

      // Get events where user is host
      const hosted = await db
        .select({
          event: events,
          host: users,
        })
        .from(events)
        .leftJoin(users, eq(events.host_id, users.id))
        .where(and(
          eq(events.host_id, userId),
          gte(events.date, today)
        ))
        .orderBy(asc(events.date));

      // Get events where user is invited
      const invited = await db
        .select({
          invitation: invitations,
          event: events,
          host: users,
        })
        .from(invitations)
        .leftJoin(events, eq(invitations.event_id, events.id))
        .leftJoin(users, eq(events.host_id, users.id))
        .where(eq(invitations.guest_id, userId))
        .orderBy(asc(invitations.created_at));

      const hostedEvents: EventWithHost[] = hosted.map(h => ({
        ...h.event,
        host: h.host,
      }));

      const invitedEvents: EventWithHost[] = invited
        .filter(i => i.event)
        .map(i => ({
          ...i.event!,
          host: i.host,
          invitation_status: i.invitation.status || undefined,
          invitation_id: i.invitation.id,
        }));

      // Deduplicate by event id
      const allEvents = [...hostedEvents, ...invitedEvents];
      const uniqueEvents = Array.from(
        new Map(allEvents.map(e => [e.id, e])).values()
      );

      return uniqueEvents.sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    },

    async checkCollisions(
      usernames: string[],
      date: string
    ): Promise<{ username: string; host_username: string; status: string }[]> {
      const collisions: { username: string; host_username: string; status: string }[] = [];

      for (const username of usernames) {
        // Find user by username
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username.toLowerCase()))
          .limit(1);

        if (user) {
          // Check if user has invitations on this date
          const invites = await db
            .select({
              invitation: invitations,
              event: events,
              host: users,
            })
            .from(invitations)
            .leftJoin(events, eq(invitations.event_id, events.id))
            .leftJoin(users, eq(events.host_id, users.id))
            .where(and(
              eq(invitations.guest_id, user.id),
              inArray(invitations.status, ['accepted', 'pending', 'maybe'])
            ));

          const collision = invites.find(i =>
            i.event && i.event.date === date
          );

          if (collision && collision.event) {
            collisions.push({
              username,
              host_username: collision.host?.username || 'кто-то',
              status: collision.invitation.status || 'pending',
            });
          }
        }
      }

      return collisions;
    },

    async createEvent(
      hostId: string,
      date: string,
      iftarTime?: string,
      location?: string,
      address?: string,
      notes?: string
    ): Promise<EventWithHost> {
      const [event] = await db
        .insert(events)
        .values({
          host_id: hostId,
          date,
          iftar_time: iftarTime,
          location,
          address,
          notes,
        })
        .returning();

      const [host] = await db
        .select()
        .from(users)
        .where(eq(users.id, hostId))
        .limit(1);

      return { ...event, host };
    },

    async createInvitationsByUsername(
      eventId: string,
      usernames: string[]
    ): Promise<void> {
      for (const username of usernames) {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username.toLowerCase()))
          .limit(1);

        if (user) {
          await db
            .insert(invitations)
            .values({
              event_id: eventId,
              guest_id: user.id,
              status: 'pending',
            })
            .onConflictDoNothing();
        }
      }
    },

    async createInvitations(
      eventId: string,
      guestIds: string[]
    ): Promise<(Invitation & { guest?: User | null })[]> {
      const result: (Invitation & { guest?: User | null })[] = [];

      for (const guestId of guestIds) {
        const [invitation] = await db
          .insert(invitations)
          .values({
            event_id: eventId,
            guest_id: guestId,
          })
          .returning();

        const [guest] = await db
          .select()
          .from(users)
          .where(eq(users.id, guestId))
          .limit(1);

        result.push({ ...invitation, guest });
      }

      return result;
    },

    async ensureInvitation(eventId: string, guestId: string): Promise<void> {
      await db
        .insert(invitations)
        .values({
          event_id: eventId,
          guest_id: guestId,
          status: 'pending',
          guest_count: 1,
        })
        .onConflictDoNothing();
    },

    async respondToInvitation(
      invitationId: string,
      status: 'accepted' | 'declined' | 'maybe'
    ): Promise<Invitation> {
      const [updated] = await db
        .update(invitations)
        .set({
          status,
          responded_at: new Date(),
        })
        .where(eq(invitations.id, invitationId))
        .returning();

      return updated;
    },

    async updateInvitation(
      eventId: string,
      guestId: string,
      data: { status: string; guest_count?: number }
    ): Promise<void> {
      await db
        .update(invitations)
        .set({
          status: data.status,
          guest_count: data.status === 'accepted' ? (data.guest_count || 1) : 1,
          responded_at: new Date(),
        })
        .where(and(
          eq(invitations.event_id, eventId),
          eq(invitations.guest_id, guestId)
        ));
    },

    async getInvitation(eventId: string, guestId: string): Promise<Invitation | null> {
      const [invitation] = await db
        .select()
        .from(invitations)
        .where(and(
          eq(invitations.event_id, eventId),
          eq(invitations.guest_id, guestId)
        ))
        .limit(1);
      return invitation || null;
    },

    async createOrUpdateInvitation(
      eventId: string,
      guestId: string,
      status: string,
      guestCount: number = 1
    ): Promise<void> {
      const existing = await this.getInvitation(eventId, guestId);

      if (existing) {
        await db
          .update(invitations)
          .set({
            status,
            guest_count: status === 'accepted' ? guestCount : 1,
            responded_at: new Date(),
          })
          .where(eq(invitations.id, existing.id));
      } else {
        await db
          .insert(invitations)
          .values({
            event_id: eventId,
            guest_id: guestId,
            status,
            guest_count: status === 'accepted' ? guestCount : 1,
            responded_at: new Date(),
          });
      }
    },

    async getEventDetails(eventId: string): Promise<EventWithInvitations | null> {
      const [eventResult] = await db
        .select({
          event: events,
          host: users,
        })
        .from(events)
        .leftJoin(users, eq(events.host_id, users.id))
        .where(eq(events.id, eventId))
        .limit(1);

      if (!eventResult) return null;

      const eventInvitations = await db
        .select({
          invitation: invitations,
          guest: users,
        })
        .from(invitations)
        .leftJoin(users, eq(invitations.guest_id, users.id))
        .where(eq(invitations.event_id, eventId));

      return {
        ...eventResult.event,
        host: eventResult.host,
        invitations: eventInvitations.map(i => ({
          ...i.invitation,
          guest: i.guest,
        })),
      };
    },

    async getEventById(eventId: string): Promise<EventWithHost | null> {
      const [result] = await db
        .select({
          event: events,
          host: users,
        })
        .from(events)
        .leftJoin(users, eq(events.host_id, users.id))
        .where(eq(events.id, eventId))
        .limit(1);

      if (!result) return null;
      return { ...result.event, host: result.host };
    },

    async deleteEvent(eventId: string): Promise<void> {
      await db.delete(events).where(eq(events.id, eventId));
    },

    async removeInvitation(invitationId: string): Promise<void> {
      await db.delete(invitations).where(eq(invitations.id, invitationId));
    },

    async getEventsByDate(date: string): Promise<EventWithInvitations[]> {
      const eventsResult = await db
        .select({
          event: events,
          host: users,
        })
        .from(events)
        .leftJoin(users, eq(events.host_id, users.id))
        .where(eq(events.date, date));

      const result: EventWithInvitations[] = [];

      for (const e of eventsResult) {
        const eventInvitations = await db
          .select({
            invitation: invitations,
            guest: users,
          })
          .from(invitations)
          .leftJoin(users, eq(invitations.guest_id, users.id))
          .where(eq(invitations.event_id, e.event.id));

        result.push({
          ...e.event,
          host: e.host,
          invitations: eventInvitations.map(i => ({
            ...i.invitation,
            guest: i.guest,
          })),
        });
      }

      return result;
    },

    async getHostEvents(userId: string, limit: number = 10): Promise<EventWithHost[]> {
      const today = new Date().toISOString().split('T')[0];

      const results = await db
        .select({
          event: events,
          host: users,
        })
        .from(events)
        .leftJoin(users, eq(events.host_id, users.id))
        .where(and(
          eq(events.host_id, userId),
          gte(events.date, today)
        ))
        .orderBy(asc(events.date))
        .limit(limit);

      return results.map(r => ({ ...r.event, host: r.host }));
    },
  };
}
