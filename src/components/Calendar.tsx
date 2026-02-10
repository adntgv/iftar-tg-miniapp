import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Moon } from 'lucide-react';
import type { Event } from '../lib/supabase';

interface CalendarProps {
  events: Event[];
  onDateSelect: (date: Date) => void;
  selectedDate: Date | null;
  ramadanStart?: Date;
  ramadanEnd?: Date;
}

export function Calendar({ events, onDateSelect, selectedDate, ramadanStart, ramadanEnd }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(ramadanStart || new Date());

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const firstDayOfWeek = startOfMonth(currentMonth).getDay();
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // Adjust first day (Monday = 0)
  const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const getEventForDate = (date: Date) => {
    return events.find(event => isSameDay(new Date(event.date), date));
  };

  const getDayStatus = (date: Date) => {
    const event = getEventForDate(date);
    if (!event) return null;
    
    const invitationStatus = (event as any).invitation_status;
    if (invitationStatus) {
      return invitationStatus;
    }
    return 'hosting';
  };

  const isInRamadan = (date: Date) => {
    if (!ramadanStart || !ramadanEnd) return true;
    return date >= ramadanStart && date <= ramadanEnd;
  };

  return (
    <div className="card">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="btn btn-ghost"
          style={{ padding: '8px' }}
        >
          <ChevronLeft size={20} />
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Moon size={20} className="text-gold" />
          <span style={{ fontWeight: 600, fontSize: '18px' }}>
            {format(currentMonth, 'LLLL yyyy', { locale: ru })}
          </span>
        </div>
        
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="btn btn-ghost"
          style={{ padding: '8px' }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Week days header */}
      <div className="calendar-grid" style={{ marginBottom: '8px' }}>
        {weekDays.map(day => (
          <div key={day} className="text-muted" style={{ textAlign: 'center', fontSize: '12px', padding: '8px 0' }}>
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="calendar-grid">
        {/* Empty cells for alignment */}
        {Array.from({ length: adjustedFirstDay }).map((_, i) => (
          <div key={`empty-${i}`} style={{ aspectRatio: '1' }} />
        ))}

        {/* Actual days */}
        {days.map(day => {
          const status = getDayStatus(day);
          const inRamadan = isInRamadan(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          const classNames = [
            'day-cell',
            isTodayDate && 'today',
            isSelected && 'selected',
            status,
          ].filter(Boolean).join(' ');

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              disabled={!inRamadan}
              className={classNames}
            >
              <span>{format(day, 'd')}</span>
              {status && <span className={`status-dot ${status}`} />}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '16px', fontSize: '12px' }} className="text-muted">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
          <span>Приглашаю</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
          <span>Иду</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#d4af37' }} />
          <span>Ожидает</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1' }} />
          <span>Может быть</span>
        </div>
      </div>
    </div>
  );
}
