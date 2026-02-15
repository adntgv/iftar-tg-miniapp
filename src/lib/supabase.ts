// API client for Iftar backend (migrated from Supabase to self-hosted PostgreSQL)

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

// Types
export interface User {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  city: string | null;
  city_lat: string | null;
  city_lng: string | null;
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
  guest_username: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'maybe';
  guest_count: number;
  responded_at: string | null;
  created_at: string;
  event?: Event;
  guest?: User;
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || 'API request failed');
  }
  
  return res.json();
}

// API functions
export async function getOrCreateUser(telegramUser: {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}): Promise<User> {
  return api<User>('/api/users', {
    method: 'POST',
    body: JSON.stringify(telegramUser),
  });
}

export async function getUserByUsername(username: string): Promise<User | null> {
  return api<User | null>(`/api/users/by-username/${encodeURIComponent(username)}`);
}

export async function getUserEvents(userId: string): Promise<Event[]> {
  return api<Event[]>(`/api/users/${userId}/events`);
}

export async function checkCollisions(
  usernames: string[],
  date: string
): Promise<{ username: string; host_username: string; status: string }[]> {
  return api<{ username: string; host_username: string; status: string }[]>('/api/check-collisions', {
    method: 'POST',
    body: JSON.stringify({ usernames, date }),
  });
}

export async function createEvent(
  hostId: string,
  date: string,
  iftarTime?: string,
  location?: string,
  address?: string,
  notes?: string
): Promise<Event> {
  return api<Event>('/api/events', {
    method: 'POST',
    body: JSON.stringify({
      host_id: hostId,
      date,
      iftar_time: iftarTime,
      location,
      address,
      notes,
    }),
  });
}

export async function createInvitationsByUsername(
  eventId: string,
  usernames: string[]
): Promise<void> {
  await api<{ success: boolean }>(`/api/events/${eventId}/invite`, {
    method: 'POST',
    body: JSON.stringify({ usernames }),
  });
}

export async function createInvitations(
  eventId: string,
  guestIds: string[]
): Promise<Invitation[]> {
  // Create invitations one by one
  for (const guestId of guestIds) {
    await api<{ success: boolean }>(`/api/events/${eventId}/ensure-invitation`, {
      method: 'POST',
      body: JSON.stringify({ guest_id: guestId }),
    });
  }
  // Fetch the event details to get the invitations
  const event = await getEventDetails(eventId);
  return event?.invitations || [];
}

export async function ensureInvitation(eventId: string, guestId: string): Promise<void> {
  await api<{ success: boolean }>(`/api/events/${eventId}/ensure-invitation`, {
    method: 'POST',
    body: JSON.stringify({ guest_id: guestId }),
  });
}

export async function respondToInvitation(
  invitationId: string,
  status: 'accepted' | 'declined' | 'maybe'
): Promise<Invitation> {
  return api<Invitation>(`/api/invitations/${invitationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function getEventDetails(eventId: string): Promise<(Event & { invitations: Invitation[] }) | null> {
  return api<(Event & { invitations: Invitation[] }) | null>(`/api/events/${eventId}`);
}

export async function getUsersByTelegramIds(telegramIds: number[]): Promise<User[]> {
  return api<User[]>('/api/users/by-telegram-ids', {
    method: 'POST',
    body: JSON.stringify({ telegram_ids: telegramIds }),
  });
}

export async function deleteEvent(eventId: string): Promise<void> {
  await api<{ success: boolean }>(`/api/events/${eventId}`, {
    method: 'DELETE',
  });
}

export async function removeInvitation(invitationId: string): Promise<void> {
  await api<{ success: boolean }>(`/api/invitations/${invitationId}`, {
    method: 'DELETE',
  });
}

export async function updateUserCity(userId: string, city: string, lat?: string, lng?: string): Promise<User> {
  return api<User>(`/api/users/${userId}/city`, {
    method: 'PATCH',
    body: JSON.stringify({ city, lat, lng }),
  });
}

// Legacy export for backward compatibility - no longer used but kept for safety
export const supabase = null;
