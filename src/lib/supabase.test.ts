import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User, Event, Invitation } from './supabase';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockClear();
});

describe('API Client Types', () => {
  it('should have correct User interface structure', () => {
    const user: User = {
      id: 'uuid',
      telegram_id: 123456789,
      username: 'test',
      first_name: 'Test',
      last_name: 'User',
      avatar_url: null,
      created_at: new Date().toISOString(),
    };
    
    expect(user.id).toBeDefined();
    expect(user.telegram_id).toBeTypeOf('number');
    expect(user.username).toBeTypeOf('string');
  });
});

describe('Event Types', () => {
  it('should have correct Event interface structure', () => {
    const event: Event = {
      id: 'uuid',
      host_id: 'user-uuid',
      date: '2026-03-01',
      iftar_time: '18:30',
      location: 'Home',
      address: '123 Street',
      notes: 'Test notes',
      created_at: new Date().toISOString(),
    };
    
    expect(event.id).toBeDefined();
    expect(event.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Invitation Types', () => {
  it('should have valid status values', () => {
    const validStatuses: Invitation['status'][] = ['pending', 'accepted', 'declined', 'maybe'];
    
    validStatuses.forEach(status => {
      expect(['pending', 'accepted', 'declined', 'maybe']).toContain(status);
    });
  });
  
  it('should have correct Invitation interface structure', () => {
    const invitation: Invitation = {
      id: 'inv-uuid',
      event_id: 'event-uuid',
      guest_id: 'guest-uuid',
      guest_username: null,
      status: 'pending',
      guest_count: 1,
      responded_at: null,
      created_at: new Date().toISOString(),
    };
    
    expect(invitation.id).toBeDefined();
    expect(invitation.status).toBe('pending');
    expect(invitation.guest_count).toBe(1);
  });
});

describe('API Functions', () => {
  it('should call correct endpoint for getOrCreateUser', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 'user-123',
        telegram_id: 12345,
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
        avatar_url: null,
        created_at: new Date().toISOString(),
      }),
    });
    
    const { getOrCreateUser } = await import('./supabase');
    const result = await getOrCreateUser({
      id: 12345,
      username: 'testuser',
      first_name: 'Test',
    });
    
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.telegram_id).toBe(12345);
    expect(result.username).toBe('testuser');
  });
  
  it('should call correct endpoint for getUserEvents', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        {
          id: 'event-1',
          host_id: 'user-123',
          date: '2026-03-01',
          iftar_time: '18:30',
          location: 'Home',
          address: null,
          notes: null,
          created_at: new Date().toISOString(),
          host: {
            id: 'user-123',
            telegram_id: 12345,
            username: 'host',
            first_name: 'Host',
            last_name: null,
            avatar_url: null,
            created_at: new Date().toISOString(),
          },
        },
      ]),
    });
    
    const { getUserEvents } = await import('./supabase');
    const events = await getUserEvents('user-123');
    
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe('2026-03-01');
  });
  
  it('should call correct endpoint for createEvent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: 'new-event',
        host_id: 'user-123',
        date: '2026-03-15',
        iftar_time: '18:45',
        location: 'My Place',
        address: '123 Main St',
        notes: 'Bring food!',
        created_at: new Date().toISOString(),
      }),
    });
    
    const { createEvent } = await import('./supabase');
    const event = await createEvent(
      'user-123',
      '2026-03-15',
      '18:45',
      'My Place',
      '123 Main St',
      'Bring food!'
    );
    
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(event.location).toBe('My Place');
    expect(event.date).toBe('2026-03-15');
  });
  
  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Not found' }),
    });
    
    const { getEventDetails } = await import('./supabase');
    
    await expect(getEventDetails('invalid-id')).rejects.toThrow();
  });
});
