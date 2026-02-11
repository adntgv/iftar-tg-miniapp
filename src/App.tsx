import { useState, useEffect, useCallback } from 'react';
import { Calendar } from './components/Calendar';
import { CreateEventModal } from './components/CreateEventModal';
import { EventDetails } from './components/EventDetails';
import { useToast } from './components/Toast';
import { 
  getOrCreateUser, 
  getUserEvents, 
  getEventDetails,
  type User, 
  type Event 
} from './lib/supabase';
import { Moon } from 'lucide-react';
import './index.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<(Event & { invitations?: any[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToast, ToastContainer } = useToast();

  // Handle deep links
  const handleDeepLink = useCallback(async (eventId: string) => {
    try {
      const details = await getEventDetails(eventId);
      if (details) {
        setSelectedEvent(details);
      } else {
        showToast('Приглашение не найдено', 'error');
      }
    } catch (error) {
      console.error('Failed to load event:', error);
      showToast('Ошибка загрузки', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    const initTelegram = async () => {
      try {
        const tg = window.Telegram?.WebApp;
        
        if (tg) {
          tg.ready();
          tg.expand();
          tg.requestFullscreen?.();
          tg.disableVerticalSwipes?.();
          
          // Set CSS variables for Telegram safe areas
          const tgAny = tg as any;
          const setSafeAreaVars = () => {
            const safeArea = tgAny.safeAreaInset || { top: 0, bottom: 0, left: 0, right: 0 };
            const contentSafeArea = tgAny.contentSafeAreaInset || { top: 0, bottom: 0, left: 0, right: 0 };
            
            document.documentElement.style.setProperty('--tg-safe-area-inset-top', `${safeArea.top}px`);
            document.documentElement.style.setProperty('--tg-safe-area-inset-bottom', `${safeArea.bottom}px`);
            document.documentElement.style.setProperty('--tg-content-safe-area-inset-top', `${contentSafeArea.top}px`);
            document.documentElement.style.setProperty('--tg-content-safe-area-inset-bottom', `${contentSafeArea.bottom}px`);
          };
          
          setSafeAreaVars();
          
          // Listen for viewport changes
          tgAny.onEvent?.('viewportChanged', setSafeAreaVars);
          tgAny.onEvent?.('safeAreaChanged', setSafeAreaVars);
          tgAny.onEvent?.('contentSafeAreaChanged', setSafeAreaVars);

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

          // Handle Telegram start_param deep link
          const startParam = initData?.start_param;
          if (startParam?.startsWith('event_')) {
            const eventId = startParam.replace('event_', '');
            await handleDeepLink(eventId);
          }
        } else {
          // Development mode
          const mockUser = await getOrCreateUser({
            id: 123456789,
            username: 'dev_user',
            first_name: 'Developer',
          });
          setUser(mockUser);
        }

        // Handle URL query param deep link
        const params = new URLSearchParams(window.location.search);
        const eventId = params.get('event');
        if (eventId) {
          await handleDeepLink(eventId);
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
        showToast('Ошибка инициализации', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    initTelegram();
  }, [handleDeepLink, showToast]);

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

  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date);
    
    const eventOnDate = events.find(
      e => new Date(e.date).toDateString() === date.toDateString()
    );
    
    if (eventOnDate) {
      try {
        const details = await getEventDetails(eventOnDate.id);
        if (details) {
          setSelectedEvent(details);
        }
      } catch (error) {
        console.error('Failed to load event details:', error);
        showToast('Ошибка загрузки события', 'error');
      }
    } else {
      setIsCreateModalOpen(true);
    }
  };

  const handleEventCreated = () => {
    loadEvents();
    setSelectedDate(null);
    showToast('Ифтар создан! 🌙', 'success');
  };

  const handleEventUpdated = () => {
    loadEvents();
    if (selectedEvent) {
      getEventDetails(selectedEvent.id).then(details => {
        if (details) setSelectedEvent(details);
      });
    }
  };

  const handleRSVP = (status: string) => {
    handleEventUpdated();
    const messages: Record<string, string> = {
      accepted: 'Отлично! Ты придёшь 🎉',
      declined: 'Понял, не сможешь',
      maybe: 'Записал как "может быть"',
    };
    showToast(messages[status] || 'Ответ записан', 'success');
  };

  if (isLoading) {
    return (
      <div className="bg-dark" style={{ 
        minHeight: '100dvh',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '24px',
        padding: '24px'
      }}>
        <img 
          src="/bismillah.svg" 
          alt="بسم الله الرحمن الرحيم" 
          style={{ 
            width: '280px', 
            maxWidth: '80%',
            animation: 'fadeInScale 1s ease-out'
          }} 
        />
        <div style={{ textAlign: 'center' }}>
          <Moon size={32} className="text-gold animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark" style={{ minHeight: '100dvh' }}>
      {/* Spacer for Telegram header buttons */}
      <div style={{ height: 'calc(var(--tg-content-safe-area-inset-top, 0px) + var(--tg-safe-area-inset-top, 0px))' }} />

      {/* Main content */}
      <main style={{ padding: '12px' }}>
        <Calendar
          events={events}
          onDateSelect={handleDateSelect}
          selectedDate={selectedDate}
        />

        {/* Upcoming events */}
        {events.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h2 className="text-muted" style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>
              Ближайшие ифтары
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {events
                .filter(e => new Date(e.date) >= new Date())
                .slice(0, 3)
                .map(event => (
                  <div
                    key={event.id}
                    onClick={() => getEventDetails(event.id).then(details => details && setSelectedEvent(details))}
                    className="event-card"
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {new Date(event.date).toLocaleDateString('ru-RU', { 
                          day: 'numeric', 
                          month: 'long' 
                        })}
                      </div>
                      <div className="text-muted" style={{ fontSize: '14px' }}>
                        {event.location || 'Место не указано'}
                      </div>
                    </div>
                    <span className={`badge ${
                      event.host_id === user?.id ? 'badge-primary' : 
                      event.invitation_status === 'accepted' ? 'badge-primary' :
                      event.invitation_status === 'pending' ? 'badge-gold' :
                      'badge-indigo'
                    }`}>
                      {event.host_id === user?.id ? 'Хозяин' : 
                       event.invitation_status === 'accepted' ? 'Иду' :
                       event.invitation_status === 'pending' ? 'Ожидает' :
                       'Может быть'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {events.length === 0 && (
          <div className="empty-state">
            <Moon size={64} />
            <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>Пока пусто</h2>
            <p className="text-muted" style={{ fontSize: '14px' }}>
              Выберите дату чтобы создать приглашение на ифтар
            </p>
          </div>
        )}
      </main>

      {/* Modals */}
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

      {selectedEvent && user && (
        <EventDetails
          event={selectedEvent}
          currentUser={user}
          onClose={() => setSelectedEvent(null)}
          onUpdate={handleEventUpdated}
          onRSVP={handleRSVP}
          isHost={selectedEvent.host_id === user.id}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        requestFullscreen?: () => void;
        disableVerticalSwipes?: () => void;
        openTelegramLink: (url: string) => void;
        themeParams: {
          bg_color?: string;
          text_color?: string;
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
