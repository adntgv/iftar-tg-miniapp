import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X, MapPin, Clock, FileText, Users, AlertTriangle, Check, Loader } from 'lucide-react';
import { checkCollisions, createEvent, createInvitationsByUsername, type User } from '../lib/supabase';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  currentUser: User;
  onEventCreated: () => void;
}

interface GuestEntry {
  username: string;
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
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingCollisions, setIsCheckingCollisions] = useState(false);

  const addGuest = () => {
    if (!guestInput.trim()) return;
    
    const username = guestInput.trim().replace('@', '').toLowerCase();
    
    // Check if already added
    if (guests.find(g => g.username === username)) {
      setGuestInput('');
      return;
    }

    // Don't add self
    if (username === currentUser.username?.toLowerCase()) {
      setGuestInput('');
      return;
    }

    setGuests([...guests, { username, selected: true }]);
    setGuestInput('');
  };

  // Check collisions when guests change
  useEffect(() => {
    const checkGuestCollisions = async () => {
      const usernames = guests.filter(g => !g.collision).map(g => g.username);
      if (usernames.length === 0) return;
      
      setIsCheckingCollisions(true);
      
      try {
        const collisions = await checkCollisions(usernames, format(selectedDate, 'yyyy-MM-dd'));
        
        if (collisions.length > 0) {
          setGuests(prev => prev.map(g => {
            const collision = collisions.find(c => c.username === g.username);
            return collision ? { ...g, collision: { host_username: collision.host_username, status: collision.status } } : g;
          }));
        }
      } catch (error) {
        console.error('Failed to check collisions:', error);
      } finally {
        setIsCheckingCollisions(false);
      }
    };

    const timer = setTimeout(checkGuestCollisions, 500);
    return () => clearTimeout(timer);
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
      // Create event
      const event = await createEvent(
        currentUser.id,
        format(selectedDate, 'yyyy-MM-dd'),
        iftarTime,
        location || undefined,
        address || undefined,
        notes || undefined
      );

      // Create invitations for selected guests
      const selectedUsernames = guests.filter(g => g.selected).map(g => g.username);
      if (selectedUsernames.length > 0) {
        await createInvitationsByUsername(event.id, selectedUsernames);
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
  const selectedCount = guests.filter(g => g.selected).length;

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
              Гости {selectedCount > 0 && `(${selectedCount})`}
              {isCheckingCollisions && <Loader size={14} className="animate-spin" />}
            </label>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={guestInput}
                onChange={e => setGuestInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGuest())}
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
                        onClick={() => toggleGuest(guest.username)}
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
                      onClick={() => removeGuest(guest.username)}
                      className="btn btn-ghost"
                      style={{ padding: '4px' }}
                    >
                      <X size={16} className="text-muted" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-muted" style={{ fontSize: '12px', marginTop: '8px' }}>
              Добавь гостей по их Telegram username. После создания события поделись ссылкой.
            </p>
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
                Можешь убрать их из списка или пригласить всё равно.
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
            {isLoading ? 'Создаю...' : 'Создать ифтар 🌙'}
          </button>
        </div>
      </div>
    </div>
  );
}
