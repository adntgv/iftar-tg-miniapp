import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X, MapPin, Clock, User, Check, X as XIcon, HelpCircle, Share2 } from 'lucide-react';
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
    const botUsername = import.meta.env.VITE_BOT_USERNAME || 'iftar_coordinator_bot';
    const shareUrl = `https://t.me/${botUsername}?start=event_${event.id}`;
    const shareText = `🌙 Приглашение на ифтар\n📅 ${format(new Date(event.date), 'd MMMM', { locale: ru })}\n📍 ${event.location || 'Уточняется'}`;
    
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`
      );
    }
  };

  const acceptedCount = event.invitations?.filter(i => i.status === 'accepted').length || 0;
  const pendingCount = event.invitations?.filter(i => i.status === 'pending').length || 0;

  return (
    <div className="modal-overlay">
      <div className="modal-content safe-area-bottom">
        {/* Header */}
        <div className="header" style={{ borderRadius: '24px 24px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
            {isHost ? 'Мой ифтар' : 'Приглашение'}
          </h2>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '8px' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Date & Time */}
          <div style={{ 
            backgroundColor: 'rgba(22, 101, 52, 0.2)', 
            borderRadius: '16px', 
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div className="text-gold" style={{ fontSize: '14px' }}>Дата</div>
              <div style={{ fontSize: '20px', fontWeight: 600, marginTop: '4px' }}>
                {format(new Date(event.date), 'd MMMM yyyy', { locale: ru })}
              </div>
            </div>
            {event.iftar_time && (
              <div style={{ textAlign: 'right' }}>
                <div className="text-gold" style={{ fontSize: '14px' }}>Ифтар</div>
                <div style={{ fontSize: '20px', fontWeight: 600, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={20} />
                  {event.iftar_time.slice(0, 5)}
                </div>
              </div>
            )}
          </div>

          {/* Host */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'var(--color-border)', borderRadius: '12px' }}>
            <div className="avatar">
              <User size={20} />
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: '12px' }}>Хозяин</div>
              <div style={{ fontWeight: 500 }}>
                {event.host?.first_name || event.host?.username || 'Неизвестно'}
              </div>
            </div>
          </div>

          {/* Location */}
          {(event.location || event.address) && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', backgroundColor: 'var(--color-border)', borderRadius: '12px' }}>
              <MapPin size={20} className="text-gold" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                {event.location && <div style={{ fontWeight: 500 }}>{event.location}</div>}
                {event.address && <div className="text-muted" style={{ fontSize: '14px' }}>{event.address}</div>}
              </div>
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <div style={{ padding: '12px', backgroundColor: 'var(--color-border)', borderRadius: '12px' }}>
              <div className="text-muted" style={{ fontSize: '12px', marginBottom: '4px' }}>Заметки</div>
              <div>{event.notes}</div>
            </div>
          )}

          {/* Guest list (for host) */}
          {isHost && event.invitations && event.invitations.length > 0 && (
            <div>
              <div className="text-muted" style={{ fontSize: '14px', display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span>Гости</span>
                <span>{acceptedCount} придут • {pendingCount} ожидают</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {event.invitations.map(invitation => (
                  <div 
                    key={invitation.id}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '12px', 
                      backgroundColor: 'var(--color-border)', 
                      borderRadius: '12px' 
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ 
                        width: '32px', 
                        height: '32px', 
                        borderRadius: '50%', 
                        backgroundColor: 'var(--color-card)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        fontSize: '14px',
                        fontWeight: 600
                      }}>
                        {(invitation.guest?.first_name?.[0] || invitation.guest?.username?.[0] || '?').toUpperCase()}
                      </div>
                      <span>
                        {invitation.guest?.first_name || invitation.guest?.username}
                      </span>
                    </div>
                    <span className={`badge ${
                      invitation.status === 'accepted' ? 'badge-primary' : 
                      invitation.status === 'pending' ? 'badge-gold' : 
                      invitation.status === 'maybe' ? 'badge-indigo' : 'badge-red'
                    }`}>
                      {invitation.status === 'accepted' ? 'Придёт' : 
                       invitation.status === 'pending' ? 'Ожидает' : 
                       invitation.status === 'maybe' ? 'Может' : 'Не придёт'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Response buttons (for guest) */}
          {!isHost && myInvitation && (
            <div>
              <div className="text-muted" style={{ fontSize: '14px', marginBottom: '12px' }}>Ваш ответ</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <button
                  onClick={() => handleResponse('accepted')}
                  disabled={isResponding}
                  className="btn"
                  style={{ 
                    flexDirection: 'column', 
                    padding: '16px',
                    backgroundColor: myInvitation.status === 'accepted' ? 'var(--color-primary)' : 'var(--color-border)'
                  }}
                >
                  <Check size={20} />
                  <span style={{ fontSize: '14px' }}>Приду</span>
                </button>
                
                <button
                  onClick={() => handleResponse('maybe')}
                  disabled={isResponding}
                  className="btn"
                  style={{ 
                    flexDirection: 'column', 
                    padding: '16px',
                    backgroundColor: myInvitation.status === 'maybe' ? '#6366f1' : 'var(--color-border)'
                  }}
                >
                  <HelpCircle size={20} />
                  <span style={{ fontSize: '14px' }}>Может</span>
                </button>
                
                <button
                  onClick={() => handleResponse('declined')}
                  disabled={isResponding}
                  className="btn"
                  style={{ 
                    flexDirection: 'column', 
                    padding: '16px',
                    backgroundColor: myInvitation.status === 'declined' ? '#dc2626' : 'var(--color-border)'
                  }}
                >
                  <XIcon size={20} />
                  <span style={{ fontSize: '14px' }}>Не смогу</span>
                </button>
              </div>
            </div>
          )}

          {/* Share button */}
          {isHost && (
            <button
              onClick={shareEvent}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              <Share2 size={20} />
              Поделиться приглашением
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
