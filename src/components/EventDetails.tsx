import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X, MapPin, Clock, User, Check, XIcon, HelpCircle, Share2 } from 'lucide-react';
import type { Event, Invitation, User as UserType } from '../lib/supabase';
import { respondToInvitation } from '../lib/supabase';
import { useState } from 'react';

interface EventDetailsProps {
  event: Event & { invitations?: Invitation[] };
  currentUser: UserType;
  onClose: () => void;
  onUpdate: () => void;
  isHost: boolean;
}

export function EventDetails({ event, currentUser, onClose, onUpdate, isHost }: EventDetailsProps) {
  const [isResponding, setIsResponding] = useState(false);

  const myInvitation = event.invitations?.find(
    inv => inv.guest_id === currentUser.id
  );

  const handleResponse = async (status: 'accepted' | 'declined' | 'maybe') => {
    if (!myInvitation) return;
    
    setIsResponding(true);
    try {
      await respondToInvitation(myInvitation.id, status);
      onUpdate();
    } catch (error) {
      console.error('Failed to respond:', error);
    } finally {
      setIsResponding(false);
    }
  };

  const shareEvent = () => {
    const botUsername = import.meta.env.VITE_BOT_USERNAME || 'iftar_app_bot';
    const shareUrl = `https://t.me/${botUsername}?start=event_${event.id}`;
    const shareText = `🌙 Приглашение на ифтар\n📅 ${format(new Date(event.date), 'd MMMM', { locale: ru })}\n📍 ${event.location || 'Уточняется'}`;
    
    // Use Telegram's native share
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`
      );
    }
  };

  const statusColors = {
    accepted: 'bg-primary-500',
    pending: 'bg-gold-500',
    maybe: 'bg-indigo-500',
    declined: 'bg-red-500',
  };

  const statusLabels = {
    accepted: 'Придёт',
    pending: 'Ожидает',
    maybe: 'Может быть',
    declined: 'Не придёт',
  };

  const acceptedCount = event.invitations?.filter(i => i.status === 'accepted').length || 0;
  const pendingCount = event.invitations?.filter(i => i.status === 'pending').length || 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50">
      <div className="bg-dark-card w-full rounded-t-3xl max-h-[90vh] overflow-y-auto safe-area-bottom">
        {/* Header */}
        <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isHost ? 'Мой ифтар' : 'Приглашение'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-dark-border rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Date & Time */}
          <div className="bg-primary-500/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gold-500 text-sm">Дата</div>
                <div className="text-xl font-semibold mt-1">
                  {format(new Date(event.date), 'd MMMM yyyy', { locale: ru })}
                </div>
              </div>
              {event.iftar_time && (
                <div className="text-right">
                  <div className="text-gold-500 text-sm">Ифтар</div>
                  <div className="text-xl font-semibold mt-1 flex items-center gap-1">
                    <Clock className="w-5 h-5" />
                    {event.iftar_time.slice(0, 5)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Host */}
          <div className="flex items-center gap-3 p-3 bg-dark-border rounded-xl">
            <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm text-gray-400">Хозяин</div>
              <div className="font-medium">
                {event.host?.first_name || event.host?.username || 'Неизвестно'}
              </div>
            </div>
          </div>

          {/* Location */}
          {(event.location || event.address) && (
            <div className="flex items-start gap-3 p-3 bg-dark-border rounded-xl">
              <MapPin className="w-5 h-5 text-gold-500 flex-shrink-0 mt-0.5" />
              <div>
                {event.location && <div className="font-medium">{event.location}</div>}
                {event.address && <div className="text-sm text-gray-400">{event.address}</div>}
              </div>
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <div className="p-3 bg-dark-border rounded-xl">
              <div className="text-sm text-gray-400 mb-1">Заметки</div>
              <div>{event.notes}</div>
            </div>
          )}

          {/* Guest list (for host) */}
          {isHost && event.invitations && event.invitations.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-gray-400 flex items-center justify-between">
                <span>Гости</span>
                <span>{acceptedCount} придут • {pendingCount} ожидают</span>
              </div>
              
              <div className="space-y-2">
                {event.invitations.map(invitation => (
                  <div 
                    key={invitation.id}
                    className="flex items-center justify-between p-3 bg-dark-border rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-sm">
                        {(invitation.guest?.first_name?.[0] || invitation.guest?.username?.[0] || '?').toUpperCase()}
                      </div>
                      <span>
                        {invitation.guest?.first_name || invitation.guest?.username}
                      </span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs ${statusColors[invitation.status]}`}>
                      {statusLabels[invitation.status]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Response buttons (for guest) */}
          {!isHost && myInvitation && (
            <div className="space-y-3">
              <div className="text-sm text-gray-400">Ваш ответ</div>
              
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleResponse('accepted')}
                  disabled={isResponding}
                  className={`
                    p-3 rounded-xl font-medium flex flex-col items-center gap-1
                    ${myInvitation.status === 'accepted' 
                      ? 'bg-primary-500 text-white' 
                      : 'bg-dark-border hover:bg-primary-500/30'}
                  `}
                >
                  <Check className="w-5 h-5" />
                  <span className="text-sm">Приду</span>
                </button>
                
                <button
                  onClick={() => handleResponse('maybe')}
                  disabled={isResponding}
                  className={`
                    p-3 rounded-xl font-medium flex flex-col items-center gap-1
                    ${myInvitation.status === 'maybe' 
                      ? 'bg-indigo-500 text-white' 
                      : 'bg-dark-border hover:bg-indigo-500/30'}
                  `}
                >
                  <HelpCircle className="w-5 h-5" />
                  <span className="text-sm">Может</span>
                </button>
                
                <button
                  onClick={() => handleResponse('declined')}
                  disabled={isResponding}
                  className={`
                    p-3 rounded-xl font-medium flex flex-col items-center gap-1
                    ${myInvitation.status === 'declined' 
                      ? 'bg-red-500 text-white' 
                      : 'bg-dark-border hover:bg-red-500/30'}
                  `}
                >
                  <XIcon className="w-5 h-5" />
                  <span className="text-sm">Не смогу</span>
                </button>
              </div>
            </div>
          )}

          {/* Share button */}
          {isHost && (
            <button
              onClick={shareEvent}
              className="w-full bg-dark-border hover:bg-dark-border/80 rounded-xl py-3 
                         font-medium flex items-center justify-center gap-2"
            >
              <Share2 className="w-5 h-5" />
              Поделиться приглашением
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
