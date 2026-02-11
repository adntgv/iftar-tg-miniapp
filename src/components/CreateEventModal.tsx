import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X, MapPin, Clock, ChevronDown, ChevronUp, AlertTriangle, Check, Loader } from 'lucide-react';
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
  const [showAdditional, setShowAdditional] = useState(false);

  const addGuest = () => {
    if (!guestInput.trim()) return;
    
    const username = guestInput.trim().replace('@', '').toLowerCase();
    
    if (guests.find(g => g.username === username)) {
      setGuestInput('');
      return;
    }

    if (username === currentUser.username?.toLowerCase()) {
      setGuestInput('');
      return;
    }

    setGuests([...guests, { username, selected: true }]);
    setGuestInput('');
  };

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
    if (!location.trim()) return;
    
    setIsLoading(true);
    
    try {
      const event = await createEvent(
        currentUser.id,
        format(selectedDate, 'yyyy-MM-dd'),
        iftarTime,
        location || undefined,
        address || undefined,
        notes || undefined
      );

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
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        {/* Compact header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)'
        }}>
          <span style={{ fontSize: '16px', fontWeight: 600 }}>
            {format(selectedDate, 'd MMMM', { locale: ru })}
          </span>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

          {/* Essential: Location */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <MapPin size={20} className="text-muted" />
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Место (обязательно)"
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
              backgroundColor: 'var(--color-border)',
              borderRadius: '12px'
            }}
          >
            <span className="text-muted" style={{ fontSize: '14px' }}>
              Дополнительно {selectedCount > 0 && `• ${selectedCount} гостей`}
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
              {/* Address */}
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Адрес"
                className="input"
              />

              {/* Notes */}
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Заметки (например: плов будет!)"
                rows={2}
                className="input"
                style={{ resize: 'none' }}
              />

              {/* Guests */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="text-muted" style={{ fontSize: '14px' }}>
                    Гости {isCheckingCollisions && <Loader size={12} className="animate-spin" style={{ display: 'inline' }} />}
                  </span>
                </div>
                
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
                  <button onClick={addGuest} className="btn btn-primary" style={{ padding: '10px 16px' }}>
                    +
                  </button>
                </div>

                {/* Guest list */}
                {guests.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                    {guests.map(guest => (
                      <div
                        key={guest.username}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          backgroundColor: guest.collision ? 'rgba(234, 179, 8, 0.1)' : 'var(--color-card)',
                          borderRadius: '8px',
                          opacity: guest.selected ? 1 : 0.5
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button
                            onClick={() => toggleGuest(guest.username)}
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              border: `2px solid ${guest.selected ? 'var(--color-primary)' : 'var(--color-text-muted)'}`,
                              backgroundColor: guest.selected ? 'var(--color-primary)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            {guest.selected && <Check size={10} color="white" />}
                          </button>
                          
                          <div>
                            <span style={{ fontSize: '14px' }}>@{guest.username}</span>
                            {guest.collision && (
                              <div style={{ fontSize: '11px', color: '#eab308', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AlertTriangle size={10} />
                                у @{guest.collision.host_username}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <button
                          onClick={() => removeGuest(guest.username)}
                          className="btn btn-ghost"
                          style={{ padding: '2px' }}
                        >
                          <X size={14} className="text-muted" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collision warning */}
          {hasCollisions && (
            <div style={{ 
              backgroundColor: 'rgba(234, 179, 8, 0.1)', 
              borderRadius: '8px', 
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13px',
              color: '#eab308'
            }}>
              <AlertTriangle size={16} />
              Некоторые гости уже заняты
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={isLoading || !location.trim()}
            className="btn btn-primary"
            style={{ 
              width: '100%', 
              padding: '14px', 
              fontSize: '16px',
              marginTop: '4px'
            }}
          >
            {isLoading ? 'Создаю...' : 'Создать 🌙'}
          </button>
        </div>
      </div>
    </div>
  );
}
