import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Telegram WebApp
Object.defineProperty(window, 'Telegram', {
  value: {
    WebApp: {
      ready: vi.fn(),
      expand: vi.fn(),
      close: vi.fn(),
      openTelegramLink: vi.fn(),
      themeParams: {
        bg_color: '#0f1419',
        text_color: '#ffffff',
      },
      initDataUnsafe: {
        user: {
          id: 123456789,
          username: 'test_user',
          first_name: 'Test',
          last_name: 'User',
        },
      },
    },
  },
  writable: true,
});

// Mock environment variables
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');
vi.stubEnv('VITE_BOT_USERNAME', 'test_bot');
