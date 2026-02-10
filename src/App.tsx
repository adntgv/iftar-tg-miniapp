import { useState, useEffect, useCallback } from 'react';
import { Calendar } from './components/Calendar';
import { CreateEventModal } from './components/CreateEventModal';
import { EventDetails } from './components/EventDetails';
import { 
  getOrCreateUser, 
  getUserEvents, 
  getEventDetails,
  type User, 
  type Event 
} from './lib/supabase';
import { Plus, Moon, Calendar as CalendarIcon } from 'lucide-react';
import './index.css';

// Ramadan 2026 dates (approximate - would use actual Islamic calendar API)
const RAMADAN_2026_START = new Date('2026-02-17');
const RAMADAN_2026_END = new Date('2026-03-18');

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<(Event & { invitations?: any[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [iftarTime, setIftarTime] = useState<string>('18:30');

  // Initialize Telegram WebApp
  useEffect(() => {
    const initTelegram = async () => {
      try {
        // Get Telegram WebApp data
        const tg = window.Telegram?.WebApp;
        
        if (tg) {
          tg.ready();
          tg.expand();
          
          // Apply Telegram theme
          document.documentElement.style.setProperty(
            '--tg-theme-bg-color', 
            tg.themeParams.bg_color || '#0f1419'
          );
          document.documentElement.style.setProperty(
            '--tg-theme-text-color', 
            tg.themeParams.text_color || '#ffffff'
          );

          // Get user from initData
          const initData = tg.initDataUnsafe;
          if (initData?.user) {
            const telegramUser = initData.user;
            const dbUser = await getOrCreateUser({
              id: telegramUser.id,
              username: telegramUser.username,
              first_name: telegramUser.first_name,
              last_name: telegramUser.last_name,
              photo_url: telegramUser.photo_url,
            });
            setUser(dbUser);
          }
        } else {
          // Development mode - create mock user
          console.log('Development mode - no Telegram WebApp');
          const mockUser = await getOrCreateUser({
            id: 123456789,
            username: 'dev_user',
            first_name: 'Developer',
          });
          setUser(mockUser);
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initTelegram();
  }, []);

  // Load user events
  const loadEvents = useCallback(async () => {
    if (!user) return;
    
    try {
      const userEvents = await getUserEvents(user.id);
      setEvents(userEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  }, [user]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Handle date selection
  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date);
    
    // Check if there's an event on this date
    const eventOnDate = events.find(
      e => new Date(e.date).toDateString() === date.toDateString()
    );
    
    if (eventOnDate) {
      // Load full event details
      try {
        const details = await getEventDetails(eventOnDate.id);
        setSelectedEvent(details);
      } catch (error) {
        console.error('Failed to load event details:', error);
      }
    } else {
      // Open create modal for new event
      setIsCreateModalOpen(true);
    }
  };

  const handleEventCreated = () => {
    loadEvents();
    setSelectedDate(null);
  };

  const handleEventUpdated = () => {
    loadEvents();
    if (selectedEvent) {
      getEventDetails(selectedEvent.id).then(setSelectedEvent);
    }
  };

  // Calculate iftar time based on location (simplified)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (_position) => {
          // In real app, would call prayer times API with _position.coords
          // For now, use approximate time
          const month = new Date().getMonth();
          const baseTime = month >= 2 && month <= 4 ? 19 : 18;
          setIftarTime(`${baseTime}:30`);
        },
        () => {
          // Default time if geolocation fails
          setIftarTime('18:30');
        }
      );
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <Moon className="w-12 h-12 text-gold-500 mx-auto animate-pulse" />
          <p className="mt-4 text-gray-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <header className="p-4 border-b border-dark-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Moon className="w-6 h-6 text-gold-500" />
            <h1 className="text-lg font-semibold">Рамадан 2026</h1>
          </div>
          <div className="text-sm text-gray-400 flex items-center gap-1">
            <CalendarIcon className="w-4 h-4" />
            Ифтар: {iftarTime}
          </div>
        </div>
        
        {user && (
          <div className="mt-2 text-sm text-gray-400">
            Салам, {user.first_name || user.username}! 👋
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="p-4">
        <Calendar
          events={events}
          onDateSelect={handleDateSelect}
          selectedDate={selectedDate}
          ramadanStart={RAMADAN_2026_START}
          ramadanEnd={RAMADAN_2026_END}
        />

        {/* Upcoming events summary */}
        {events.length > 0 && (
          <div className="mt-4 space-y-2">
            <h2 className="text-sm text-gray-400 font-medium">Ближайшие ифтары</h2>
            {events
              .filter(e => new Date(e.date) >= new Date())
              .slice(0, 3)
              .map(event => (
                <button
                  key={event.id}
                  onClick={() => getEventDetails(event.id).then(setSelectedEvent)}
                  className="w-full p-3 bg-dark-card rounded-xl flex items-center justify-between
                             hover:bg-dark-border transition-colors text-left"
                >
                  <div>
                    <div className="font-medium">
                      {new Date(event.date).toLocaleDateString('ru-RU', { 
                        day: 'numeric', 
                        month: 'long' 
                      })}
                    </div>
                    <div className="text-sm text-gray-400">
                      {event.location || 'Место не указано'}
                    </div>
                  </div>
                  <div className={`
                    px-2 py-1 rounded-full text-xs
                    ${event.host_id === user?.id ? 'bg-primary-500' : 'bg-gold-500'}
                  `}>
                    {event.host_id === user?.id ? 'Хозяин' : 'Гость'}
                  </div>
                </button>
              ))}
          </div>
        )}

        {/* Empty state */}
        {events.length === 0 && (
          <div className="mt-8 text-center">
            <Moon className="w-16 h-16 text-gray-600 mx-auto" />
            <h2 className="mt-4 text-lg font-medium">Пока пусто</h2>
            <p className="mt-2 text-gray-400 text-sm">
              Выберите дату чтобы создать приглашение на ифтар
            </p>
          </div>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => {
          setSelectedDate(new Date());
          setIsCreateModalOpen(true);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary-500 rounded-full 
                   flex items-center justify-center shadow-lg hover:bg-primary-600 
                   transition-colors safe-area-bottom"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Create Event Modal */}
      {isCreateModalOpen && selectedDate && user && (
        <CreateEventModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setSelectedDate(null);
          }}
          selectedDate={selectedDate}
          currentUser={user}
          onEventCreated={handleEventCreated}
        />
      )}

      {/* Event Details Modal */}
      {selectedEvent && user && (
        <EventDetails
          event={selectedEvent}
          currentUser={user}
          onClose={() => setSelectedEvent(null)}
          onUpdate={handleEventUpdated}
          isHost={selectedEvent.host_id === user.id}
        />
      )}
    </div>
  );
}

// Telegram WebApp type declaration
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        openTelegramLink: (url: string) => void;
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          button_color?: string;
          button_text_color?: string;
        };
        initDataUnsafe: {
          user?: {
            id: number;
            username?: string;
            first_name?: string;
            last_name?: string;
            photo_url?: string;
          };
          start_param?: string;
        };
      };
    };
  }
}

export default App;
