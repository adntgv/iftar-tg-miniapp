import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
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
    
    // Check if user is host or guest
    const invitationStatus = (event as any).invitation_status;
    if (invitationStatus) {
      return invitationStatus; // guest
    }
    return 'hosting'; // host
  };

  const isInRamadan = (date: Date) => {
    if (!ramadanStart || !ramadanEnd) return true;
    return date >= ramadanStart && date <= ramadanEnd;
  };

  return (
    <div className="bg-dark-card rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 hover:bg-dark-border rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-2">
          <Moon className="w-5 h-5 text-gold-500" />
          <span className="font-semibold text-lg">
            {format(currentMonth, 'LLLL yyyy')}
          </span>
        </div>
        
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 hover:bg-dark-border rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Week days header */}
      <div className="calendar-grid mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="calendar-grid">
        {/* Empty cells for alignment */}
        {Array.from({ length: adjustedFirstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {/* Actual days */}
        {days.map(day => {
          const status = getDayStatus(day);
          const inRamadan = isInRamadan(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const today = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(day)}
              disabled={!inRamadan}
              className={`
                aspect-square rounded-xl flex flex-col items-center justify-center
                text-sm font-medium transition-all relative
                ${!inRamadan ? 'opacity-30 cursor-not-allowed' : 'hover:bg-dark-border'}
                ${isSelected ? 'ring-2 ring-gold-500 bg-dark-border' : ''}
                ${today ? 'border border-gold-500' : ''}
                ${status === 'hosting' ? 'bg-primary-500/30 glow-green' : ''}
                ${status === 'accepted' ? 'bg-primary-500/50' : ''}
                ${status === 'pending' ? 'bg-gold-500/30 glow-gold' : ''}
                ${status === 'maybe' ? 'bg-indigo-500/30' : ''}
              `}
            >
              <span>{format(day, 'd')}</span>
              {status && (
                <span className={`
                  absolute bottom-1 w-1.5 h-1.5 rounded-full
                  ${status === 'hosting' ? 'bg-primary-400' : ''}
                  ${status === 'accepted' ? 'bg-primary-500' : ''}
                  ${status === 'pending' ? 'bg-gold-500' : ''}
                  ${status === 'maybe' ? 'bg-indigo-500' : ''}
                `} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary-400" />
          <span>Приглашаю</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary-500" />
          <span>Иду</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gold-500" />
          <span>Ожидает</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <span>Может быть</span>
        </div>
      </div>
    </div>
  );
}
