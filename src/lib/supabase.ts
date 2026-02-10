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
}

export interface Invitation {
  id: string;
  event_id: string;
  guest_id: string;
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

export async function getUserEvents(userId: string): Promise<Event[]> {
  // Get events where user is host or invited
  const { data: hosted } = await supabase
    .from('events')
    .select('*, host:users(*)')
    .eq('host_id', userId)
    .order('date', { ascending: true });

  const { data: invited } = await supabase
    .from('invitations')
    .select('*, event:events(*, host:users(*))')
    .eq('guest_id', userId)
    .order('created_at', { ascending: true });

  const invitedEvents = invited?.map(i => ({
    ...i.event,
    invitation_status: i.status,
  })) || [];

  // Deduplicate by event id
  const allEvents = [...(hosted || []), ...invitedEvents];
  const uniqueEvents = Array.from(
    new Map(allEvents.map(e => [e.id, e])).values()
  );

  return uniqueEvents;
}

export async function checkCollisions(
  guestTelegramIds: number[],
  date: string
): Promise<{ telegram_id: number; host_username: string; status: string }[]> {
  const collisions: { telegram_id: number; host_username: string; status: string }[] = [];

  for (const telegramId of guestTelegramIds) {
    const { data } = await supabase.rpc('check_guest_availability', {
      p_guest_telegram_id: telegramId,
      p_date: date,
    });

    if (data && data.length > 0) {
      collisions.push({
        telegram_id: telegramId,
        host_username: data[0].host_username,
        status: data[0].status,
      });
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

export async function getEventDetails(eventId: string): Promise<Event & { invitations: Invitation[] }> {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*, host:users(*)')
    .eq('id', eventId)
    .single();

  if (eventError) throw eventError;

  const { data: invitations } = await supabase
    .from('invitations')
    .select('*, guest:users(*)')
    .eq('event_id', eventId);

  return { ...event, invitations: invitations || [] };
}

// Get users by telegram IDs for inviting
export async function getUsersByTelegramIds(telegramIds: number[]): Promise<User[]> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .in('telegram_id', telegramIds);
  
  return data || [];
}
