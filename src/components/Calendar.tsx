import { useMemo } from 'react';
import { format, eachDayOfInterval, isSameDay, isToday, getDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Moon } from 'lucide-react';
import type { Event } from '../lib/supabase';
import { RAMADAN_START, RAMADAN_END, type DayTimes } from '../lib/iftarTimes';

interface CalendarProps {
  events: Event[];
  onDateSelect: (date: Date) => void;
  selectedDate: Date | null;
  prayerTimes: DayTimes[];
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function Calendar({ events, onDateSelect, selectedDate, prayerTimes }: CalendarProps) {
  const { ramadanDays, emptySlotsBefore } = useMemo(() => {
    const days = eachDayOfInterval({ start: RAMADAN_START, end: RAMADAN_END });
    const firstDayOfWeek = (getDay(RAMADAN_START) + 6) % 7;
    return { ramadanDays: days, emptySlotsBefore: firstDayOfWeek };
  }, []);

  // Index prayer times by date for fast lookup
  const timesByDate = useMemo(() => {
    const map = new Map<string, DayTimes>();
    for (const t of prayerTimes) {
      const d = (t as any).Date || t.date;
      if (d) map.set(d, t);
    }
    return map;
  }, [prayerTimes]);

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
      <div style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '8px', marginBottom: '12px'
      }}>
        <Moon size={18} className="text-gold" />
        <span style={{ fontWeight: 600 }}>Рамадан 1447</span>
        <span className="text-muted" style={{ fontSize: '14px' }}>(19 фев — 19 мар)</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
        {WEEKDAYS.map(day => (
          <div key={day} className="text-muted" style={{ textAlign: 'center', fontSize: '11px', fontWeight: 500, padding: '4px 0' }}>
            {day}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {Array.from({ length: emptySlotsBefore }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        
        {ramadanDays.map(day => {
          const status = getDayStatus(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);
          const hasEvents = getEventsForDate(day).length > 0;
          const dateStr = day.toISOString().split('T')[0];
          const times = timesByDate.get(dateStr);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              style={{
                padding: '6px 2px',
                borderRadius: '8px',
                border: isTodayDate ? '2px solid var(--color-gold)' : 'none',
                backgroundColor: status === 'hosting' ? 'rgba(22, 101, 52, 0.4)' :
                                status === 'accepted' ? 'rgba(34, 197, 94, 0.3)' :
                                status === 'pending' ? 'rgba(212, 175, 55, 0.3)' :
                                status === 'maybe' ? 'rgba(99, 102, 241, 0.3)' :
                                isSelected ? 'var(--color-border)' : 'transparent',
                boxShadow: isSelected ? '0 0 0 2px var(--color-gold)' : 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0px',
                position: 'relative',
                color: 'var(--color-text)',
                minHeight: '52px',
                minWidth: '0',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, lineHeight: '1.1' }}>
                {day.getDate()}
              </span>
              <span className="text-muted" style={{ fontSize: '9px', lineHeight: '1' }}>
                {format(day, 'MMM', { locale: ru }).replace('.', '')}
              </span>
              
              {times ? (
                <span className="text-gold" style={{ fontSize: '9px', fontWeight: 500 }}>
                  {times.maghrib}
                </span>
              ) : (
                <span className="text-muted" style={{ fontSize: '9px' }}>—</span>
              )}
              
              {hasEvents && (
                <span style={{
                  position: 'absolute', top: '3px', right: '3px',
                  width: '5px', height: '5px', borderRadius: '50%',
                  backgroundColor: status === 'hosting' || status === 'accepted' ? '#22c55e' :
                                   status === 'pending' ? 'var(--color-gold)' : '#6366f1',
                }} />
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px', fontSize: '11px' }} className="text-muted">
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
