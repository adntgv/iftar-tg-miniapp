import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X, MapPin, Clock, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { createEvent, ensureInvitation, getEventDetails, respondToInvitation, type User } from '../lib/supabase';
import { getIftarTime, getRamadanDay, type DayTimes } from '../lib/iftarTimes';

function getInvitationTime(iftarTime: string): string {
  // Default invitation time = 1 hour before iftar
  const [h, m] = iftarTime.split(':').map(Number);
  const totalMin = h * 60 + m - 60;
  const nh = Math.floor(totalMin / 60);
  const nm = totalMin % 60;
  return `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`;
}

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  currentUser: User;
  onEventCreated: () => void;
  prayerTimes?: DayTimes[];
}

export function CreateEventModal({ 
  isOpen, 
  onClose, 
  selectedDate, 
  currentUser,
  onEventCreated,
  prayerTimes = [],
}: CreateEventModalProps) {
  const [location, setLocation] = useState('');
  const [address] = useState('');
  const [notes, setNotes] = useState('');
  const [isHost, setIsHost] = useState(true);
  const getActualIftarTime = (date: Date): string => {
    const dateStr = date.toISOString().split('T')[0];
    const dayTimes = prayerTimes.find(t => t.date === dateStr || (t as any).Date === dateStr);
    return dayTimes?.maghrib || getIftarTime(date);
  };

  const [iftarTime, setIftarTime] = useState(() => getInvitationTime(getActualIftarTime(selectedDate)));
  const [isLoading, setIsLoading] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);

  // Update iftar time when date changes (1h before iftar)
  useEffect(() => {
    setIftarTime(getInvitationTime(getActualIftarTime(selectedDate)));
  }, [selectedDate, prayerTimes]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
      return () => document.body.classList.remove('modal-open');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (isHost && !location.trim()) return;
    
    setIsLoading(true);
    
    try {
      const event = await createEvent(
        currentUser.id,
        format(selectedDate, 'yyyy-MM-dd'),
        iftarTime,
        location || undefined,
        address || undefined,
        notes || undefined,
        isHost
      );

      // If user is invited (not hosting), add self as accepted guest
      if (!isHost) {
        try {
          await ensureInvitation(event.id, currentUser.id);
          // Auto-accept the invitation
          const details = await getEventDetails(event.id);
          const myInvite = details?.invitations?.find((i: any) => i.guest_id === currentUser.id);
          if (myInvite) {
            await respondToInvitation(myInvite.id, 'accepted');
          }
        } catch (e) {
          console.error('Failed to add self as guest:', e);
        }
      }

      setCreatedEventId(event.id);
      onEventCreated();
      
      // Track event creation
      window.umami?.track('event_created', { 
        date: format(selectedDate, 'yyyy-MM-dd'),
        hasAddress: !!address,
        hasNotes: !!notes,
        isHost,
      });
    } catch (error) {
      console.error('Failed to create event:', error);
      setIsLoading(false);
    }
  };

  const shareEvent = () => {
    if (!createdEventId) return;
    
    const inviteUrl = `https://iftar.adntgv.com/invite/${createdEventId}`;
    const tg = window.Telegram?.WebApp;
    const shareText = `🌙 Приглашаю на ифтар!\n📅 ${format(selectedDate, 'dd.MM.yyyy')}\n⏰ ${iftarTime}${location ? `\n📍 ${location}` : ''}`;
    
    // Track share
    window.umami?.track('event_shared', { eventId: createdEventId, source: 'create_modal' });
    
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(shareText)}`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  const ramadanDay = getRamadanDay(selectedDate);

  // Success screen after event creation
  if (createdEventId) {
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal-content" style={{ textAlign: 'center', padding: '32px 24px' }}>
          {/* Success animation */}
          <div style={{ 
            width: '80px', 
            height: '80px', 
            margin: '0 auto 20px',
            borderRadius: '50%',
            backgroundColor: 'rgba(22, 101, 52, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse 2s ease-in-out infinite'
          }}>
            <span style={{ fontSize: '40px' }}>🌙</span>
          </div>
          
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>
            Ифтар создан!
          </h2>
          
          <p className="text-muted" style={{ marginBottom: '24px' }}>
            {format(selectedDate, 'd MMMM', { locale: ru })} • {ramadanDay} Рамадан • {iftarTime}
          </p>

          <button
            onClick={shareEvent}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', marginBottom: '12px' }}
          >
            <Share2 size={20} />
            Пригласить друзей
          </button>
          
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ width: '100%', padding: '12px' }}
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content safe-area-bottom">
        {/* Compact header with Ramadan day */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)'
        }}>
          <div>
            <span style={{ fontSize: '16px', fontWeight: 600 }}>
              {ramadanDay} Рамадан
            </span>
            <span className="text-muted" style={{ fontSize: '14px', marginLeft: '8px' }}>
              {format(selectedDate, 'd MMM', { locale: ru })}
            </span>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Host / Invited toggle */}
          <div style={{
            display: 'flex', borderRadius: '10px', overflow: 'hidden',
            border: '1px solid var(--color-border)',
          }}>
            <button
              onClick={() => setIsHost(true)}
              style={{
                flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
                backgroundColor: isHost ? 'rgba(22, 101, 52, 0.4)' : 'transparent',
                color: 'var(--color-text)', fontSize: '14px', fontWeight: isHost ? 600 : 400,
              }}
            >
              🏠 Я хозяин
            </button>
            <button
              onClick={() => setIsHost(false)}
              style={{
                flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
                borderLeft: '1px solid var(--color-border)',
                backgroundColor: !isHost ? 'rgba(212, 175, 55, 0.3)' : 'transparent',
                color: 'var(--color-text)', fontSize: '14px', fontWeight: !isHost ? 600 : 400,
              }}
            >
              📨 Меня позвали
            </button>
          </div>

          {/* Essential: Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={20} className="text-muted" />
            <input
              type="time"
              value={iftarTime}
              onChange={e => setIftarTime(e.target.value)}
              className="input"
              style={{ flex: 1 }}
            />
          </div>

          {/* Essential: Location + Address combined */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <MapPin size={20} className="text-muted" />
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder={isHost ? "Место или адрес (обязательно)" : "Место или адрес (необязательно)"}
              className="input"
              style={{ flex: 1 }}
            />
          </div>

          {/* Collapsible additional options */}
          <button
            onClick={() => setShowAdditional(!showAdditional)}
            className="btn btn-ghost"
            style={{ 
              justifyContent: 'space-between', 
              padding: '12px',
              backgroundColor: 'transparent',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
            }}
          >
            <span className="text-muted" style={{ fontSize: '14px' }}>
              Дополнительно
            </span>
            {showAdditional ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {showAdditional && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px',
              padding: '12px',
              backgroundColor: 'var(--color-border)',
              borderRadius: '12px',
              marginTop: '-8px'
            }}>
              {/* Notes */}
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Заметки (например: плов будет!)"
                rows={2}
                className="input"
                style={{ resize: 'none' }}
              />
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={isLoading || (isHost && !location.trim())}
            className="btn btn-primary"
            style={{ 
              width: '100%', 
              padding: '14px', 
              fontSize: '16px',
              marginTop: '4px'
            }}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                Создаю...
              </span>
            ) : isHost ? 'Создать ифтар 🌙' : 'Записать приглашение 📨'}
          </button>
        </div>
      </div>
    </div>
  );
}
