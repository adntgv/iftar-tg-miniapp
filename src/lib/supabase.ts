import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface User {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  host_id: string;
  date: string;
  iftar_time: string | null;
  location: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  host?: User;
  invitation_status?: string;
}

export interface Invitation {
  id: string;
  event_id: string;
  guest_id: string | null;
  guest_username: string | null; // For pending invites without user
  status: 'pending' | 'accepted' | 'declined' | 'maybe';
  responded_at: string | null;
  created_at: string;
  event?: Event;
  guest?: User;
}

// API functions
export async function getOrCreateUser(telegramUser: {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}): Promise<User> {
  // Try to get existing user
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramUser.id)
    .single();

  if (existing) {
    // Update user info if changed
    const { data: updated } = await supabase
      .from('users')
      .update({
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        avatar_url: telegramUser.photo_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();
    return updated || existing;
  }

  // Create new user
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      telegram_id: telegramUser.id,
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      avatar_url: telegramUser.photo_url,
    })
    .select()
    .single();

  if (error) throw error;
  return newUser;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('username', username.toLowerCase())
    .single();
  return data;
}

export async function getUserEvents(userId: string): Promise<Event[]> {
  // Get events where user is host
  const { data: hosted } = await supabase
    .from('events')
    .select('*, host:users(*)')
    .eq('host_id', userId)
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date', { ascending: true });

  // Get events where user is invited
  const { data: invited } = await supabase
    .from('invitations')
    .select('*, event:events(*, host:users(*))')
    .eq('guest_id', userId)
    .order('created_at', { ascending: true });

  const invitedEvents = (invited || [])
    .filter(i => i.event)
    .map(i => ({
      ...i.event,
      invitation_status: i.status,
      invitation_id: i.id,
    }));

  // Deduplicate by event id
  const allEvents = [...(hosted || []), ...invitedEvents];
  const uniqueEvents = Array.from(
    new Map(allEvents.map(e => [e.id, e])).values()
  );

  return uniqueEvents.sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

export async function checkCollisions(
  usernames: string[],
  date: string
): Promise<{ username: string; host_username: string; status: string }[]> {
  const collisions: { username: string; host_username: string; status: string }[] = [];

  for (const username of usernames) {
    // First try to find user by username
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase())
      .single();

    if (user) {
      // Check if user has invitations on this date
      const { data: invites } = await supabase
        .from('invitations')
        .select('status, event:events(date, host:users(username))')
        .eq('guest_id', user.id)
        .in('status', ['accepted', 'pending', 'maybe']);

      const collision = invites?.find(i => 
        i.event && (i.event as any).date === date
      );

      if (collision && collision.event) {
        collisions.push({
          username,
          host_username: (collision.event as any).host?.username || 'кто-то',
          status: collision.status,
        });
      }
    }
  }

  return collisions;
}

export async function createEvent(
  hostId: string,
  date: string,
  iftarTime?: string,
  location?: string,
  address?: string,
  notes?: string
): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      host_id: hostId,
      date,
      iftar_time: iftarTime,
      location,
      address,
      notes,
    })
    .select('*, host:users(*)')
    .single();

  if (error) throw error;
  return data;
}

export async function createInvitationsByUsername(
  eventId: string,
  usernames: string[]
): Promise<void> {
  for (const username of usernames) {
    // Try to find existing user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase())
      .single();

    if (user) {
      // User exists - create invitation with guest_id
      await supabase
        .from('invitations')
        .upsert({
          event_id: eventId,
          guest_id: user.id,
          status: 'pending',
        }, { onConflict: 'event_id,guest_id' });
    }
    // If user doesn't exist, they'll be invited when they open the link
  }
}

export async function createInvitations(
  eventId: string,
  guestIds: string[]
): Promise<Invitation[]> {
  const invitations = guestIds.map(guestId => ({
    event_id: eventId,
    guest_id: guestId,
  }));

  const { data, error } = await supabase
    .from('invitations')
    .insert(invitations)
    .select('*, guest:users(*)');

  if (error) throw error;
  return data;
}

export async function respondToInvitation(
  invitationId: string,
  status: 'accepted' | 'declined' | 'maybe'
): Promise<Invitation> {
  const { data, error } = await supabase
    .from('invitations')
    .update({
      status,
      responded_at: new Date().toISOString(),
    })
    .eq('id', invitationId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getEventDetails(eventId: string): Promise<(Event & { invitations: Invitation[] }) | null> {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*, host:users(*)')
    .eq('id', eventId)
    .single();

  if (eventError || !event) return null;

  const { data: invitations } = await supabase
    .from('invitations')
    .select('*, guest:users(*)')
    .eq('event_id', eventId);

  return { ...event, invitations: invitations || [] };
}

export async function getUsersByTelegramIds(telegramIds: number[]): Promise<User[]> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .in('telegram_id', telegramIds);
  
  return data || [];
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);
  
  if (error) throw error;
}

export async function removeInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from('invitations')
    .delete()
    .eq('id', invitationId);
  
  if (error) throw error;
}
