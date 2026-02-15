import { useState, useEffect, useCallback } from 'react';
import { Calendar } from './components/Calendar';
import { CreateEventModal } from './components/CreateEventModal';
import { EventDetails } from './components/EventDetails';
import { useToast } from './components/Toast';
import { 
  getOrCreateUser, 
  getUserEvents, 
  getEventDetails,
  ensureInvitation,
  updateUserCity,
  type User, 
  type Event 
} from './lib/supabase';
import { Moon, Settings, ChevronDown } from 'lucide-react';
import { CITIES, getCityById } from './lib/iftarTimes';
import './index.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<(Event & { invitations?: any[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [cityId, setCityId] = useState('astana');
  const [showCityPicker, setShowCityPicker] = useState(false);
  const { showToast, showError, ToastContainer } = useToast();

  // Handle deep links
  const handleDeepLink = useCallback(async (eventId: string, guestId?: string) => {
    try {
      if (guestId) {
        await ensureInvitation(eventId, guestId);
      }
      const details = await getEventDetails(eventId);
      if (details) {
        setSelectedEvent(details);
        
        // Track invitation view
        window.umami?.track('invitation_viewed', { eventId, hasGuestId: !!guestId });
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
        
        let currentUser: User | null = null;

        if (tg) {
          tg.ready();
          tg.expand();
          
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
            // Telegram environment
            try { tg.requestFullscreen?.(); } catch (e) { /* ignore */ }
            try { tg.disableVerticalSwipes?.(); } catch (e) { /* ignore */ }

            const telegramUser = initData.user;
            const dbUser = await getOrCreateUser({
              id: telegramUser.id,
              username: telegramUser.username,
              first_name: telegramUser.first_name,
              last_name: telegramUser.last_name,
              photo_url: telegramUser.photo_url,
            });
            currentUser = dbUser;
            setUser(dbUser);
            if (dbUser.city) setCityId(dbUser.city);
          } else {
            // Web (non-telegram)
            try {
              const mockUser = await getOrCreateUser({
                id: 123456789,
                username: 'dev_user',
                first_name: 'Developer',
              });
              currentUser = mockUser;
              setUser(mockUser);
            } catch (e) {
              const fallbackUser = {
                id: 'local-test-user',
                telegram_id: 123456789,
                username: 'dev_user',
                first_name: 'Developer',
                last_name: null,
                avatar_url: null,
                created_at: new Date().toISOString(),
              } as User;
              currentUser = fallbackUser;
              setUser(fallbackUser);
            }
          }

          // Handle Telegram start_param deep link
          const startParam = initData?.start_param;
          if (startParam?.startsWith('event_')) {
            const eventId = startParam.replace('event_', '');
            await handleDeepLink(eventId, currentUser?.id);
          }
        } else {
          // Development mode
          try {
            const mockUser = await getOrCreateUser({
              id: 123456789,
              username: 'dev_user',
              first_name: 'Developer',
            });
            currentUser = mockUser;
            setUser(mockUser);
          } catch (e) {
            const fallbackUser = {
              id: 'local-test-user',
              telegram_id: 123456789,
              username: 'dev_user',
              first_name: 'Developer',
              last_name: null,
              avatar_url: null,
              created_at: new Date().toISOString(),
            } as User;
            currentUser = fallbackUser;
            setUser(fallbackUser);
          }
        }

        // Handle URL query param deep link
        const params = new URLSearchParams(window.location.search);
        const eventId = params.get('event');
        if (eventId) {
          await handleDeepLink(eventId, currentUser?.id || user?.id);
        }

        // Handle /invite/:id path
        const match = window.location.pathname.match(/^\/invite\/(.+)$/);
        if (match?.[1]) {
          await handleDeepLink(match[1], currentUser?.id || user?.id);
        }

        if (params.get('create') === '1') {
          setSelectedDate(new Date('2026-02-17'));
          setIsCreateModalOpen(true);
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
        showError('Ошибка инициализации');
      } finally {
        setIsLoading(false);
      }
    };

    initTelegram();
  }, [handleDeepLink, showError]);

  const loadEvents = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsBusy(true);
      const userEvents = await getUserEvents(user.id);
      setEvents(userEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
      showError('Ошибка загрузки событий');
    } finally {
      setIsBusy(false);
    }
  }, [user, showError]);

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
        setIsBusy(true);
        const details = await getEventDetails(eventOnDate.id);
        if (details) {
          setSelectedEvent(details);
        }
      } catch (error) {
        console.error('Failed to load event details:', error);
        showError('Ошибка загрузки события');
      } finally {
        setIsBusy(false);
      }
    } else {
      setIsCreateModalOpen(true);
    }
  };

  const handleEventCreated = () => {
    loadEvents();
    // Don't close modal yet - let success screen show first
    // Modal will close itself when user taps "Close" or "Share"
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
    <div className="bg-dark app-root">
      <div className="app-content">
        {/* Main content */}
        <main style={{ padding: '12px' }}>
        {/* City selector */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button
            onClick={() => setShowCityPicker(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <Settings size={14} className="text-muted" />
            <span>{getCityById(cityId)?.name || 'Астана'}</span>
            <ChevronDown size={14} className="text-muted" />
          </button>
        </div>

        <Calendar
          events={events}
          onDateSelect={handleDateSelect}
          selectedDate={selectedDate}
          cityId={cityId}
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

          {/* City picker modal */}
        {showCityPicker && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setShowCityPicker(false)}
          >
            <div
              style={{
                backgroundColor: 'var(--color-card)',
                borderRadius: '16px 16px 0 0',
                padding: '20px',
                width: '100%',
                maxWidth: '500px',
                maxHeight: '70vh',
                overflowY: 'auto',
              }}
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', textAlign: 'center' }}>
                Выберите город
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {CITIES.map(city => (
                  <button
                    key={city.id}
                    onClick={async () => {
                      setCityId(city.id);
                      setShowCityPicker(false);
                      if (user) {
                        try {
                          await updateUserCity(user.id, city.id);
                          showToast(`Город: ${city.name}`, 'success');
                        } catch {
                          showToast('Ошибка сохранения', 'error');
                        }
                      }
                    }}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: city.id === cityId ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                      color: 'var(--color-text)',
                      fontSize: '15px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{city.name}</span>
                    {city.id === cityId && <span className="text-gold">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

          {/* Toast notifications */}
        <ToastContainer />

        {isBusy && (
          <div className="fullscreen-loader">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div className="animate-spin" style={{ width: 28, height: 28, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%' }} />
              <div className="text-muted" style={{ fontSize: '13px' }}>Загружаю...</div>
            </div>
          </div>
        )}
      </div>
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
