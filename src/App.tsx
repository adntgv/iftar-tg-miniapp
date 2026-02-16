import { useState, useEffect, useCallback } from 'react';
import { Analytics } from './components/Analytics';
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
import { Moon, MapPin, ChevronDown, Search } from 'lucide-react';
import { 
  getMajorCities, searchCities, fetchPrayerTimes,
  DEFAULT_LAT, DEFAULT_LNG, type CityInfo, type DayTimes 
} from './lib/iftarTimes';
import './index.css';

function App() {
  // Simple path-based routing
  if (window.location.pathname === '/analytics') {
    return <Analytics />;
  }

  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<(Event & { invitations?: any[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  
  // City & prayer times
  const [cityName, setCityName] = useState('Астана');
  // Normalize legacy "astana" -> "Астана"
  const CITY_NAME_MAP: Record<string, string> = { astana: 'Астана', almaty: 'Алматы', shymkent: 'Шымкент' };
  const [cityLat, setCityLat] = useState(DEFAULT_LAT);
  const [cityLng, setCityLng] = useState(DEFAULT_LNG);
  const [prayerTimes, setPrayerTimes] = useState<DayTimes[]>([]);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [majorCities, setMajorCities] = useState<CityInfo[]>([]);
  const [searchResults, setSearchResults] = useState<CityInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { showToast, showError, ToastContainer } = useToast();

  // Load prayer times when city changes
  useEffect(() => {
    if (cityLat && cityLng) {
      fetchPrayerTimes(cityLat, cityLng).then(setPrayerTimes);
    }
  }, [cityLat, cityLng]);

  // Load major cities on mount
  useEffect(() => {
    getMajorCities().then(setMajorCities);
  }, []);

  // Search cities with debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchCities(searchQuery).then(setSearchResults);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const selectCity = async (city: CityInfo) => {
    setCityName(city.title);
    setCityLat(city.lat);
    setCityLng(city.lng);
    setShowCityPicker(false);
    setSearchQuery('');
    if (user) {
      try {
        await updateUserCity(user.id, city.title, city.lat, city.lng);
        showToast(`Город: ${city.title}`, 'success');
      } catch {
        showToast('Ошибка сохранения', 'error');
      }
    }
  };

  // Handle deep links
  const handleDeepLink = useCallback(async (eventId: string, guestId?: string) => {
    try {
      if (guestId) {
        await ensureInvitation(eventId, guestId);
      }
      const details = await getEventDetails(eventId);
      if (details) {
        setSelectedEvent(details);
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
          tgAny.onEvent?.('viewportChanged', setSafeAreaVars);
          tgAny.onEvent?.('safeAreaChanged', setSafeAreaVars);
          tgAny.onEvent?.('contentSafeAreaChanged', setSafeAreaVars);

          const initData = tg.initDataUnsafe;

          if (initData?.user) {
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
            if (dbUser.city) setCityName(CITY_NAME_MAP[dbUser.city] || dbUser.city);
            if (dbUser.city_lat) setCityLat(dbUser.city_lat);
            if (dbUser.city_lng) setCityLng(dbUser.city_lng);
          } else {
            try {
              const mockUser = await getOrCreateUser({ id: 123456789, username: 'dev_user', first_name: 'Developer' });
              currentUser = mockUser;
              setUser(mockUser);
              if (mockUser.city) setCityName(CITY_NAME_MAP[mockUser.city] || mockUser.city);
              if (mockUser.city_lat) setCityLat(mockUser.city_lat);
              if (mockUser.city_lng) setCityLng(mockUser.city_lng);
            } catch (e) {
              currentUser = { id: 'local-test-user', telegram_id: 123456789, username: 'dev_user', first_name: 'Developer', last_name: null, avatar_url: null, city: null, city_lat: null, city_lng: null, created_at: new Date().toISOString() } as User;
              setUser(currentUser);
            }
          }

          const startParam = initData?.start_param;
          if (startParam?.startsWith('event_')) {
            await handleDeepLink(startParam.replace('event_', ''), currentUser?.id);
          }
        } else {
          try {
            const mockUser = await getOrCreateUser({ id: 123456789, username: 'dev_user', first_name: 'Developer' });
            currentUser = mockUser;
            setUser(mockUser);
            if (mockUser.city) setCityName(CITY_NAME_MAP[mockUser.city] || mockUser.city);
            if (mockUser.city_lat) setCityLat(mockUser.city_lat);
            if (mockUser.city_lng) setCityLng(mockUser.city_lng);
          } catch (e) {
            currentUser = { id: 'local-test-user', telegram_id: 123456789, username: 'dev_user', first_name: 'Developer', last_name: null, avatar_url: null, city: null, city_lat: null, city_lng: null, created_at: new Date().toISOString() } as User;
            setUser(currentUser);
          }
        }

        const params = new URLSearchParams(window.location.search);
        const eventId = params.get('event');
        if (eventId) await handleDeepLink(eventId, currentUser?.id || user?.id);
        const match = window.location.pathname.match(/^\/invite\/(.+)$/);
        if (match?.[1]) await handleDeepLink(match[1], currentUser?.id || user?.id);
        if (params.get('create') === '1') { setSelectedDate(new Date('2026-02-19')); setIsCreateModalOpen(true); }
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

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date);
    const eventOnDate = events.find(e => new Date(e.date).toDateString() === date.toDateString());
    if (eventOnDate) {
      try {
        setIsBusy(true);
        const details = await getEventDetails(eventOnDate.id);
        if (details) setSelectedEvent(details);
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

  const handleEventCreated = () => { loadEvents(); };
  const handleEventUpdated = () => {
    loadEvents();
    if (selectedEvent) {
      getEventDetails(selectedEvent.id).then(details => { if (details) setSelectedEvent(details); });
    }
  };
  const handleRSVP = (status: string) => {
    handleEventUpdated();
    const messages: Record<string, string> = { accepted: 'Отлично! Ты придёшь 🎉', declined: 'Понял, не сможешь', maybe: 'Записал как "может быть"' };
    showToast(messages[status] || 'Ответ записан', 'success');
  };

  if (isLoading) {
    return (
      <div className="bg-dark" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '24px', padding: '24px' }}>
        <img src="/bismillah.svg" alt="بسم الله الرحمن الرحيم" style={{ width: '280px', maxWidth: '80%', animation: 'fadeInScale 1s ease-out' }} />
        <div style={{ textAlign: 'center' }}><Moon size={32} className="text-gold animate-pulse" /></div>
      </div>
    );
  }

  const cityList = searchQuery.length >= 2 ? searchResults : majorCities;

  return (
    <div className="bg-dark app-root">
      <div className="app-content">
        <main style={{ padding: '12px' }}>
          {/* City selector button */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <button
              onClick={() => setShowCityPicker(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '6px 12px', borderRadius: '8px',
                backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)',
                color: 'var(--color-text)', fontSize: '13px', cursor: 'pointer',
              }}
            >
              <MapPin size={14} className="text-gold" />
              <span>{cityName}</span>
              <ChevronDown size={14} className="text-muted" />
            </button>
          </div>

          <Calendar events={events} onDateSelect={handleDateSelect} selectedDate={selectedDate} prayerTimes={prayerTimes} />

          {events.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h2 className="text-muted" style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px' }}>Ближайшие ифтары</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '40vh', overflowY: 'auto' }}>
                {events.filter(e => new Date(e.date) >= new Date()).map(event => (
                  <div key={event.id} onClick={() => getEventDetails(event.id).then(details => details && setSelectedEvent(details))} className="event-card">
                    <div>
                      <div style={{ fontWeight: 500 }}>{new Date(event.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div>
                      <div className="text-muted" style={{ fontSize: '14px' }}>{event.location || 'Место не указано'}</div>
                    </div>
                    <span className={`badge ${event.host_id === user?.id && event.is_host_mode !== false ? 'badge-primary' : event.invitation_status === 'accepted' ? 'badge-primary' : event.invitation_status === 'pending' ? 'badge-gold' : 'badge-indigo'}`}>
                      {event.host_id === user?.id && event.is_host_mode !== false ? 'Хозяин' : event.invitation_status === 'accepted' ? 'Иду' : event.invitation_status === 'pending' ? 'Ожидает' : 'Может быть'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {events.length === 0 && (
            <div className="empty-state">
              <Moon size={64} />
              <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>Пока пусто</h2>
              <p className="text-muted" style={{ fontSize: '14px' }}>Выберите дату чтобы создать приглашение на ифтар</p>
            </div>
          )}
        </main>

        {isCreateModalOpen && selectedDate && user && (
          <CreateEventModal isOpen={isCreateModalOpen} onClose={() => { setIsCreateModalOpen(false); setSelectedDate(null); }} selectedDate={selectedDate} currentUser={user} onEventCreated={handleEventCreated} prayerTimes={prayerTimes} />
        )}

        {selectedEvent && user && (
          <EventDetails event={selectedEvent} currentUser={user} onClose={() => setSelectedEvent(null)} onUpdate={handleEventUpdated} onRSVP={handleRSVP} isHost={selectedEvent.is_host_mode !== false && selectedEvent.host_id === user.id} />
        )}

        {/* City picker bottom sheet */}
        {showCityPicker && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }} onClick={() => { setShowCityPicker(false); setSearchQuery(''); }}>
            <div style={{ backgroundColor: 'var(--color-card)', borderRadius: '16px 16px 0 0', padding: '20px', width: '100%', maxWidth: '500px', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', textAlign: 'center' }}>Выберите город</h3>
              
              {/* Search input */}
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} />
                <input
                  type="text"
                  placeholder="Поиск города..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px',
                    border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
                    color: 'var(--color-text)', fontSize: '15px', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ overflowY: 'auto', flex: 1 }}>
                {cityList.map(city => (
                  <button
                    key={city.id + city.lat}
                    onClick={() => selectCity(city)}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '10px', border: 'none',
                      backgroundColor: city.title === cityName ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                      color: 'var(--color-text)', fontSize: '15px', textAlign: 'left', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <div>
                      <span>{city.title}</span>
                      {city.region && <span className="text-muted" style={{ fontSize: '12px', marginLeft: '8px' }}>{city.region}</span>}
                    </div>
                    {city.title === cityName && <span className="text-gold">✓</span>}
                  </button>
                ))}
                {cityList.length === 0 && searchQuery.length >= 2 && (
                  <div className="text-muted" style={{ textAlign: 'center', padding: '20px', fontSize: '14px' }}>Ничего не найдено</div>
                )}
              </div>
            </div>
          </div>
        )}

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
        themeParams: { bg_color?: string; text_color?: string; };
        initDataUnsafe: {
          user?: { id: number; username?: string; first_name?: string; last_name?: string; photo_url?: string; };
          start_param?: string;
        };
      };
    };
  }
}

export default App;
