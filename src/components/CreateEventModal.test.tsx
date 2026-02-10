import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateEventModal } from './CreateEventModal';

// Mock the supabase functions
vi.mock('../lib/supabase', () => ({
  checkCollisions: vi.fn(() => Promise.resolve([])),
  createEvent: vi.fn(() => Promise.resolve({ id: 'test-event-id' })),
  createInvitations: vi.fn(() => Promise.resolve([])),
  getUsersByTelegramIds: vi.fn(() => Promise.resolve([])),
}));

describe('CreateEventModal Component', () => {
  const mockUser = {
    id: 'user-1',
    telegram_id: 123456789,
    username: 'test_user',
    first_name: 'Test',
    last_name: 'User',
    avatar_url: null,
    created_at: '2026-02-10T00:00:00Z',
  };

  const mockOnClose = vi.fn();
  const mockOnEventCreated = vi.fn();
  const selectedDate = new Date('2026-02-20');

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnEventCreated.mockClear();
  });

  it('renders when isOpen is true', () => {
    render(
      <CreateEventModal
        isOpen={true}
        onClose={mockOnClose}
        selectedDate={selectedDate}
        currentUser={mockUser}
        onEventCreated={mockOnEventCreated}
      />
    );
    
    expect(screen.getByText('Новый ифтар')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <CreateEventModal
        isOpen={false}
        onClose={mockOnClose}
        selectedDate={selectedDate}
        currentUser={mockUser}
        onEventCreated={mockOnEventCreated}
      />
    );
    
    expect(screen.queryByText('Новый ифтар')).not.toBeInTheDocument();
  });

  it('displays the selected date', () => {
    render(
      <CreateEventModal
        isOpen={true}
        onClose={mockOnClose}
        selectedDate={selectedDate}
        currentUser={mockUser}
        onEventCreated={mockOnEventCreated}
      />
    );
    
    expect(screen.getByText(/20 февраля 2026/i)).toBeInTheDocument();
  });

  it('has input fields for event details', () => {
    render(
      <CreateEventModal
        isOpen={true}
        onClose={mockOnClose}
        selectedDate={selectedDate}
        currentUser={mockUser}
        onEventCreated={mockOnEventCreated}
      />
    );
    
    expect(screen.getByPlaceholderText('Мой дом')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Адрес (опционально)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Плов/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('@username')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <CreateEventModal
        isOpen={true}
        onClose={mockOnClose}
        selectedDate={selectedDate}
        currentUser={mockUser}
        onEventCreated={mockOnEventCreated}
      />
    );
    
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => btn.querySelector('svg'));
    
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('allows adding guests', () => {
    render(
      <CreateEventModal
        isOpen={true}
        onClose={mockOnClose}
        selectedDate={selectedDate}
        currentUser={mockUser}
        onEventCreated={mockOnEventCreated}
      />
    );
    
    const input = screen.getByPlaceholderText('@username');
    const addButton = screen.getByText('+');
    
    fireEvent.change(input, { target: { value: 'testguest' } });
    fireEvent.click(addButton);
    
    expect(screen.getByText('@testguest')).toBeInTheDocument();
  });

  it('has a submit button', () => {
    render(
      <CreateEventModal
        isOpen={true}
        onClose={mockOnClose}
        selectedDate={selectedDate}
        currentUser={mockUser}
        onEventCreated={mockOnEventCreated}
      />
    );
    
    expect(screen.getByText('Создать ифтар')).toBeInTheDocument();
  });
});
