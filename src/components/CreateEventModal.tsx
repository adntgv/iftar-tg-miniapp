import { useState, useEffect } from 'react';
import { format } from 'date-fns';
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
  const [, setIsCheckingCollisions] = useState(false);

  // Parse guest usernames and check collisions
  const addGuest = async () => {
    if (!guestInput.trim()) return;
    
    const username = guestInput.trim().replace('@', '');
    
    // Check if already added
    if (guests.find(g => g.username === username)) {
      setGuestInput('');
      return;
    }

    // For now, add as placeholder - in real app would lookup via Telegram
    const newGuest: GuestWithCollision = {
      telegram_id: 0, // Would be resolved from Telegram
      username,
      first_name: username,
      selected: true,
    };

    setGuests([...guests, newGuest]);
    setGuestInput('');
  };

  // Check collisions when guests change
  useEffect(() => {
    const checkGuestCollisions = async () => {
      if (guests.length === 0) return;
      
      setIsCheckingCollisions(true);
      
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
      
      setIsCheckingCollisions(false);
    };

    checkGuestCollisions();
  }, [guests.length, selectedDate]);

  const toggleGuest = (telegramId: number) => {
    setGuests(prev => prev.map(g => 
      g.telegram_id === telegramId ? { ...g, selected: !g.selected } : g
    ));
  };

  const removeGuest = (telegramId: number) => {
    setGuests(prev => prev.filter(g => g.telegram_id !== telegramId));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    
    try {
      // Create event
      const event = await createEvent(
        currentUser.id,
        format(selectedDate, 'yyyy-MM-dd'),
        iftarTime,
        location,
        address,
        notes
      );

      // Get selected guests
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
    <div className="fixed inset-0 bg-black/60 flex items-end z-50">
      <div className="bg-dark-card w-full rounded-t-3xl max-h-[90vh] overflow-y-auto safe-area-bottom">
        {/* Header */}
        <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Новый ифтар</h2>
          <button onClick={onClose} className="p-2 hover:bg-dark-border rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Date display */}
          <div className="bg-primary-500/20 rounded-xl p-4 text-center">
            <div className="text-gold-500 text-sm">Дата ифтара</div>
            <div className="text-xl font-semibold mt-1">
              {format(selectedDate, 'd MMMM yyyy')}
            </div>
          </div>

          {/* Time */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              Время ифтара
            </label>
            <input
              type="time"
              value={iftarTime}
              onChange={e => setIftarTime(e.target.value)}
              className="w-full bg-dark-border rounded-xl px-4 py-3 text-white"
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <MapPin className="w-4 h-4" />
              Место
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Мой дом"
              className="w-full bg-dark-border rounded-xl px-4 py-3 text-white placeholder-gray-500"
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Адрес (опционально)"
              className="w-full bg-dark-border rounded-xl px-4 py-3 text-white placeholder-gray-500"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <FileText className="w-4 h-4" />
              Заметки
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Плов будет! 🍚"
              rows={2}
              className="w-full bg-dark-border rounded-xl px-4 py-3 text-white placeholder-gray-500 resize-none"
            />
          </div>

          {/* Guests */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <Users className="w-4 h-4" />
              Гости
            </label>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={guestInput}
                onChange={e => setGuestInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addGuest()}
                placeholder="@username"
                className="flex-1 bg-dark-border rounded-xl px-4 py-3 text-white placeholder-gray-500"
              />
              <button
                onClick={addGuest}
                className="px-4 py-3 bg-primary-500 rounded-xl font-medium"
              >
                +
              </button>
            </div>

            {/* Guest list */}
            {guests.length > 0 && (
              <div className="space-y-2 mt-3">
                {guests.map(guest => (
                  <div
                    key={guest.telegram_id || guest.username}
                    className={`
                      flex items-center justify-between p-3 rounded-xl
                      ${guest.collision ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-dark-border'}
                      ${!guest.selected ? 'opacity-50' : ''}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleGuest(guest.telegram_id)}
                        className={`
                          w-5 h-5 rounded border-2 flex items-center justify-center
                          ${guest.selected ? 'bg-primary-500 border-primary-500' : 'border-gray-500'}
                        `}
                      >
                        {guest.selected && <Check className="w-3 h-3" />}
                      </button>
                      
                      <div>
                        <div className="font-medium">
                          @{guest.username || guest.first_name}
                        </div>
                        {guest.collision && (
                          <div className="text-xs text-yellow-500 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            Идёт к @{guest.collision.host_username}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => removeGuest(guest.telegram_id)}
                      className="p-1 hover:bg-dark-bg rounded"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collision warning */}
          {hasCollisions && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-500">
                Некоторые гости уже приглашены на эту дату. 
                Вы можете убрать их из списка или отправить приглашение всё равно.
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 
                       rounded-xl py-4 font-semibold text-lg transition-colors"
          >
            {isLoading ? 'Создаю...' : 'Отправить приглашения'}
          </button>
        </div>
      </div>
    </div>
  );
}
