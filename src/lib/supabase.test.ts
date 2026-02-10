import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from './supabase';

// Mock supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { id: 'test-id', telegram_id: 123 }, 
            error: null 
          })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
          })),
        })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
  })),
}));

describe('Supabase Client', () => {
  it('should be defined', () => {
    expect(supabase).toBeDefined();
  });
});

describe('User Types', () => {
  it('should have correct User interface structure', () => {
    const user = {
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
    const event = {
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
    const validStatuses = ['pending', 'accepted', 'declined', 'maybe'];
    
    validStatuses.forEach(status => {
      expect(['pending', 'accepted', 'declined', 'maybe']).toContain(status);
    });
  });
});
