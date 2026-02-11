import { useMemo } from 'react';
import { format, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Moon } from 'lucide-react';
import type { Event } from '../lib/supabase';
import { RAMADAN_START, RAMADAN_END, getRamadanDay, getIftarTime } from '../lib/iftarTimes';

interface CalendarProps {
  events: Event[];
  onDateSelect: (date: Date) => void;
  selectedDate: Date | null;
}

export function Calendar({ events, onDateSelect, selectedDate }: CalendarProps) {
  // Get all Ramadan days
  const ramadanDays = useMemo(() => {
    return eachDayOfInterval({ start: RAMADAN_START, end: RAMADAN_END });
  }, []);

  const getEventsForDate = (date: Date) => {
    return events.filter(event => isSameDay(new Date(event.date), date));
  };

  const getDayStatus = (date: Date): string | null => {
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length === 0) return null;
    
    for (const event of dayEvents) {
      if (!event.invitation_status) return 'hosting';
    }
    for (const event of dayEvents) {
      if (event.invitation_status === 'accepted') return 'accepted';
    }
    for (const event of dayEvents) {
      if (event.invitation_status === 'pending') return 'pending';
    }
    for (const event of dayEvents) {
      if (event.invitation_status === 'maybe') return 'maybe';
    }
    return null;
  };

  return (
    <div className="card" style={{ padding: '12px' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        gap: '8px',
        marginBottom: '12px'
      }}>
        <Moon size={18} className="text-gold" />
        <span style={{ fontWeight: 600 }}>Рамадан 1447</span>
        <span className="text-muted" style={{ fontSize: '14px' }}>
          (17 фев — 18 мар)
        </span>
      </div>

      {/* Days grid - Ramadan days only */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(5, 1fr)', 
        gap: '6px' 
      }}>
        {ramadanDays.map(day => {
          const status = getDayStatus(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const hasEvents = getEventsForDate(day).length > 0;
          const ramadanDay = getRamadanDay(day);
          const iftarTime = getIftarTime(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              style={{
                padding: '8px 4px',
                borderRadius: '10px',
                border: isTodayDate ? '2px solid var(--color-gold)' : 'none',
                backgroundColor: status === 'hosting' ? 'rgba(22, 101, 52, 0.4)' :
                                status === 'accepted' ? 'rgba(34, 197, 94, 0.3)' :
                                status === 'pending' ? 'rgba(212, 175, 55, 0.3)' :
                                status === 'maybe' ? 'rgba(99, 102, 241, 0.3)' :
                                isSelected ? 'var(--color-border)' : 'transparent',
                boxShadow: isSelected ? '0 0 0 2px var(--color-gold)' : 
                           status ? '0 0 12px rgba(22, 101, 52, 0.3)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                position: 'relative',
                color: 'var(--color-text)',
              }}
            >
              {/* Ramadan day number */}
              <span style={{ fontSize: '16px', fontWeight: 600 }}>{ramadanDay}</span>
              
              {/* Gregorian date */}
              <span className="text-muted" style={{ fontSize: '10px' }}>
                {format(day, 'd MMM', { locale: ru })}
              </span>
              
              {/* Iftar time - smaller */}
              <span className="text-gold" style={{ fontSize: '9px' }}>
                {iftarTime}
              </span>
              
              {/* Event indicator */}
              {hasEvents && (
                <span style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: status === 'hosting' || status === 'accepted' ? '#22c55e' :
                                   status === 'pending' ? 'var(--color-gold)' : '#6366f1',
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend - compact */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center',
        gap: '12px', 
        marginTop: '12px', 
        fontSize: '11px' 
      }} className="text-muted">
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
          <span>Хозяин/Иду</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-gold)' }} />
          <span>Ожидает</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366f1' }} />
          <span>Может</span>
        </div>
      </div>
    </div>
  );
}
