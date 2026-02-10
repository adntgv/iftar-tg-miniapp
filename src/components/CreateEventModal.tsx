import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X, MapPin, Clock, FileText, Users, AlertTriangle, Check } from 'lucide-react';
import { checkCollisions, createEvent, createInvitations, getUsersByTelegramIds, type User } from '../lib/supabase';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  currentUser: User;
  onEventCreated: () => void;
}

interface GuestWithCollision {
  telegram_id: number;
  username?: string;
  first_name?: string;
  collision?: {
    host_username: string;
    status: string;
  };
  selected: boolean;
}

export function CreateEventModal({ 
  isOpen, 
  onClose, 
  selectedDate, 
  currentUser,
  onEventCreated 
}: CreateEventModalProps) {
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [iftarTime, setIftarTime] = useState('18:30');
  const [guestInput, setGuestInput] = useState('');
  const [guests, setGuests] = useState<GuestWithCollision[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addGuest = async () => {
    if (!guestInput.trim()) return;
    
    const username = guestInput.trim().replace('@', '');
    
    if (guests.find(g => g.username === username)) {
      setGuestInput('');
      return;
    }

    const newGuest: GuestWithCollision = {
      telegram_id: 0,
      username,
      first_name: username,
      selected: true,
    };

    setGuests([...guests, newGuest]);
    setGuestInput('');
  };

  useEffect(() => {
    const checkGuestCollisions = async () => {
      if (guests.length === 0) return;
      
      const telegramIds = guests.filter(g => g.telegram_id > 0).map(g => g.telegram_id);
      if (telegramIds.length > 0) {
        const collisions = await checkCollisions(telegramIds, format(selectedDate, 'yyyy-MM-dd'));
        
        setGuests(prev => prev.map(g => {
          const collision = collisions.find(c => c.telegram_id === g.telegram_id);
          return {
            ...g,
            collision: collision ? { 
              host_username: collision.host_username, 
              status: collision.status 
            } : undefined,
          };
        }));
      }
    };

    checkGuestCollisions();
  }, [guests.length, selectedDate]);

  const toggleGuest = (username: string) => {
    setGuests(prev => prev.map(g => 
      g.username === username ? { ...g, selected: !g.selected } : g
    ));
  };

  const removeGuest = (username: string) => {
    setGuests(prev => prev.filter(g => g.username !== username));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    
    try {
      const event = await createEvent(
        currentUser.id,
        format(selectedDate, 'yyyy-MM-dd'),
        iftarTime,
        location,
        address,
        notes
      );

      const selectedGuests = guests.filter(g => g.selected && g.telegram_id > 0);
      
      if (selectedGuests.length > 0) {
        const users = await getUsersByTelegramIds(selectedGuests.map(g => g.telegram_id));
        await createInvitations(event.id, users.map(u => u.id));
      }

      onEventCreated();
      onClose();
    } catch (error) {
      console.error('Failed to create event:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasCollisions = guests.some(g => g.collision && g.selected);

  return (
    <div className="modal-overlay">
      <div className="modal-content safe-area-bottom">
        {/* Header */}
        <div className="header" style={{ borderRadius: '24px 24px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Новый ифтар</h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '8px' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Date display */}
          <div style={{ 
            backgroundColor: 'rgba(22, 101, 52, 0.2)', 
            borderRadius: '16px', 
            padding: '20px', 
            textAlign: 'center' 
          }}>
            <div className="text-gold" style={{ fontSize: '14px' }}>Дата ифтара</div>
            <div style={{ fontSize: '20px', fontWeight: 600, marginTop: '4px' }}>
              {format(selectedDate, 'd MMMM yyyy', { locale: ru })}
            </div>
          </div>

          {/* Time */}
          <div>
            <label className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '8px' }}>
              <Clock size={16} />
              Время ифтара
            </label>
            <input
              type="time"
              value={iftarTime}
              onChange={e => setIftarTime(e.target.value)}
              className="input"
            />
          </div>

          {/* Location */}
          <div>
            <label className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '8px' }}>
              <MapPin size={16} />
              Место
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Мой дом"
              className="input"
            />
          </div>

          {/* Address */}
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Адрес (опционально)"
            className="input"
          />

          {/* Notes */}
          <div>
            <label className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '8px' }}>
              <FileText size={16} />
              Заметки
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Плов будет! 🍚"
              rows={2}
              className="input"
              style={{ resize: 'none' }}
            />
          </div>

          {/* Guests */}
          <div>
            <label className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '8px' }}>
              <Users size={16} />
              Гости
            </label>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={guestInput}
                onChange={e => setGuestInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addGuest()}
                placeholder="@username"
                className="input"
                style={{ flex: 1 }}
              />
              <button onClick={addGuest} className="btn btn-primary">
                +
              </button>
            </div>

            {/* Guest list */}
            {guests.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                {guests.map(guest => (
                  <div
                    key={guest.username}
                    className={`guest-item ${guest.collision ? 'collision' : ''} ${!guest.selected ? 'unselected' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        onClick={() => toggleGuest(guest.username!)}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          border: `2px solid ${guest.selected ? 'var(--color-primary)' : 'var(--color-text-muted)'}`,
                          backgroundColor: guest.selected ? 'var(--color-primary)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        {guest.selected && <Check size={12} color="white" />}
                      </button>
                      
                      <div>
                        <div style={{ fontWeight: 500 }}>@{guest.username}</div>
                        {guest.collision && (
                          <div style={{ fontSize: '12px', color: '#eab308', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <AlertTriangle size={12} />
                            Идёт к @{guest.collision.host_username}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => removeGuest(guest.username!)}
                      className="btn btn-ghost"
                      style={{ padding: '4px' }}
                    >
                      <X size={16} className="text-muted" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collision warning */}
          {hasCollisions && (
            <div style={{ 
              backgroundColor: 'rgba(234, 179, 8, 0.1)', 
              border: '1px solid rgba(234, 179, 8, 0.3)', 
              borderRadius: '12px', 
              padding: '12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <AlertTriangle size={20} color="#eab308" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '14px', color: '#eab308' }}>
                Некоторые гости уже приглашены на эту дату. 
                Вы можете убрать их из списка или отправить приглашение всё равно.
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '16px', fontSize: '16px' }}
          >
            {isLoading ? 'Создаю...' : 'Создать ифтар'}
          </button>
        </div>
      </div>
    </div>
  );
}
