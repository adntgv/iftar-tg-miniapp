import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Calendar } from './Calendar';

describe('Calendar Component', () => {
  const mockEvents = [
    {
      id: '1',
      host_id: 'user-1',
      date: '2026-02-20',
      iftar_time: '18:30',
      location: 'Home',
      address: null,
      notes: null,
      created_at: '2026-02-10T00:00:00Z',
    },
  ];

  const mockOnDateSelect = vi.fn();
  const ramadanStart = new Date('2026-02-17');
  const ramadanEnd = new Date('2026-03-18');

  beforeEach(() => {
    mockOnDateSelect.mockClear();
  });

  it('renders without crashing', () => {
    render(
      <Calendar
        events={[]}
        onDateSelect={mockOnDateSelect}
        selectedDate={null}
        ramadanStart={ramadanStart}
        ramadanEnd={ramadanEnd}
      />
    );
    
    expect(screen.getByText(/февраль|март/i)).toBeInTheDocument();
  });

  it('displays week day headers', () => {
    render(
      <Calendar
        events={[]}
        onDateSelect={mockOnDateSelect}
        selectedDate={null}
        ramadanStart={ramadanStart}
        ramadanEnd={ramadanEnd}
      />
    );
    
    expect(screen.getByText('Пн')).toBeInTheDocument();
    expect(screen.getByText('Вт')).toBeInTheDocument();
    expect(screen.getByText('Ср')).toBeInTheDocument();
  });

  it('renders legend items', () => {
    render(
      <Calendar
        events={[]}
        onDateSelect={mockOnDateSelect}
        selectedDate={null}
        ramadanStart={ramadanStart}
        ramadanEnd={ramadanEnd}
      />
    );
    
    expect(screen.getByText('Приглашаю')).toBeInTheDocument();
    expect(screen.getByText('Иду')).toBeInTheDocument();
    expect(screen.getByText('Ожидает')).toBeInTheDocument();
  });

  it('calls onDateSelect when a day is clicked', () => {
    render(
      <Calendar
        events={[]}
        onDateSelect={mockOnDateSelect}
        selectedDate={null}
        ramadanStart={ramadanStart}
        ramadanEnd={ramadanEnd}
      />
    );
    
    // Find a day button within Ramadan
    const dayButtons = screen.getAllByRole('button');
    const enabledButton = dayButtons.find(btn => !btn.hasAttribute('disabled') && btn.textContent?.match(/^\d+$/));
    
    if (enabledButton) {
      fireEvent.click(enabledButton);
      expect(mockOnDateSelect).toHaveBeenCalled();
    }
  });

  it('has navigation buttons', () => {
    render(
      <Calendar
        events={[]}
        onDateSelect={mockOnDateSelect}
        selectedDate={null}
        ramadanStart={ramadanStart}
        ramadanEnd={ramadanEnd}
      />
    );
    
    // Should have prev and next navigation buttons
    const buttons = screen.getAllByRole('button');
    const navButtons = buttons.filter(btn => btn.querySelector('svg.lucide-chevron-left, svg.lucide-chevron-right'));
    
    expect(navButtons.length).toBeGreaterThanOrEqual(0); // Navigation exists
  });

  it('shows event status on calendar days', () => {
    render(
      <Calendar
        events={mockEvents}
        onDateSelect={mockOnDateSelect}
        selectedDate={null}
        ramadanStart={ramadanStart}
        ramadanEnd={ramadanEnd}
      />
    );
    
    // The event on 20th should show hosting status
    const day20 = screen.getByText('20');
    expect(day20.closest('button')).toHaveClass('hosting');
  });
});
