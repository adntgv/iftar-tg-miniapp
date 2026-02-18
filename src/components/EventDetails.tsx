import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X, MapPin, Clock, User, Check, X as XIcon, HelpCircle, Share2, Trash2, Calendar } from 'lucide-react';
import type { Event, Invitation, User as UserType } from '../lib/supabase';
import { respondToInvitation, deleteEvent, removeInvitation } from '../lib/supabase';
import { useState, useEffect } from 'react';
import { getRamadanDay, getIftarTime } from '../lib/iftarTimes';

interface EventDetailsProps {
  event: Event & { invitations?: Invitation[] };
  currentUser: UserType;
  onClose: () => void;
  onUpdate: () => void;
  onRSVP?: (status: string) => void;
  isHost: boolean;
}

export function EventDetails({ event, currentUser, onClose, onUpdate, onRSVP, isHost }: EventDetailsProps) {
  const isCreator = event.host_id === currentUser.id;
  const [isResponding, setIsResponding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  const myInvitation = event.invitations?.find(
    inv => inv.guest_id === currentUser.id
  );
  
  // Use local status if set (optimistic update), otherwise use server status
  const currentStatus = localStatus || myInvitation?.status;
  
  // Reset local status when event prop updates
  useEffect(() => {
    setLocalStatus(null);
  }, [event]);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  const handleResponse = async (status: 'accepted' | 'declined' | 'maybe') => {
    if (!myInvitation) return;
    
    setIsResponding(true);
    setLocalStatus(status); // Optimistic update
    try {
      await respondToInvitation(myInvitation.id, status);
      onUpdate();
      onRSVP?.(status);
      
      // Track RSVP
      window.umami?.track(`rsvp_${status}`, { eventId: event.id });
    } catch (error) {
      console.error('Failed to respond:', error);
    } finally {
      setIsResponding(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteEvent(event.id);
      
      // Track deletion
      window.umami?.track('event_deleted', { eventId: event.id });
      
      onClose();
      onUpdate();
    } catch (error) {
      console.error('Failed to delete event:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRemoveGuest = async (invitationId: string) => {
    try {
      await removeInvitation(invitationId);
      onUpdate();
    } catch (error) {
      console.error('Failed to remove guest:', error);
    }
  };

  const shareEvent = () => {
    const inviteUrl = `https://iftar.adntgv.com/invite/${event.id}`;
    const tg = window.Telegram?.WebApp;
    const shareText = `🌙 Приглашаю на ифтар!\n📅 ${event.date}\n⏰ ${event.iftar_time?.slice(0, 5) || ''}${event.location ? `\n📍 ${event.location}` : ''}`;
    
    // Track share
    window.umami?.track('event_shared', { eventId: event.id, source: 'event_details' });
    
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(shareText)}`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const addToGoogleCalendar = () => {
    const eventDate = new Date(event.date);
    const iftarTime = event.iftar_time || getIftarTime(eventDate);
    const [hours, minutes] = iftarTime.split(':').map(Number);
    
    // Event starts at iftar time, ends 2 hours later
    const startDate = new Date(eventDate);
    startDate.setHours(hours, minutes, 0, 0);
    const endDate = new Date(startDate);
    endDate.setHours(hours + 2);
    
    // Format for Google Calendar: YYYYMMDDTHHMMSS
    const formatGoogleDate = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };
    
    const ramadanDay = getRamadanDay(eventDate);
    const title = `🌙 Ифтар (${ramadanDay} Рамадан)`;
    const details = `Приглашение от ${event.host?.first_name || 'друга'}${event.notes ? `\n\n${event.notes}` : ''}`;
    const location = event.address || event.location || '';
    
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(title)}` +
      `&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}` +
      `&details=${encodeURIComponent(details)}` +
      `&location=${encodeURIComponent(location)}` +
      `&ctz=Asia/Almaty`;
    
    // Track calendar export
    window.umami?.track('calendar_exported', { eventId: event.id });
    
    window.open(url, '_blank');
  };

  const acceptedInvitations = event.invitations?.filter(i => i.status === 'accepted') || [];
  const totalAcceptedGuests = acceptedInvitations.reduce((sum, i) => sum + (i.guest_count || 1), 0);
  const pendingCount = event.invitations?.filter(i => i.status === 'pending').length || 0;
  const maybeCount = event.invitations?.filter(i => i.status === 'maybe').length || 0;

  const statusColors: Record<string, string> = {
    accepted: 'badge-primary',
    pending: 'badge-gold',
    maybe: 'badge-indigo',
    declined: 'badge-red',
  };

  const statusLabels: Record<string, string> = {
    accepted: 'Придёт',
    pending: 'Ожидает',
    maybe: 'Может быть',
    declined: 'Не придёт',
  };

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
          {isHost && (
            <div>
              <div className="text-muted" style={{ fontSize: '14px', display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span>Гости</span>
                <span>
                  {totalAcceptedGuests > 0 ? `👥 ${totalAcceptedGuests} чел.` : '👥 0'}
                  {pendingCount > 0 && ` • ${pendingCount} ожидают`}
                  {maybeCount > 0 && ` • ${maybeCount} может`}
                </span>
              </div>
              
              {event.invitations && event.invitations.length > 0 ? (
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
                          {invitation.guest?.first_name || invitation.guest?.username || 'Гость'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {invitation.status === 'accepted' && invitation.guest_count > 1 && (
                          <span className="badge badge-primary" style={{ fontSize: '11px' }}>
                            +{invitation.guest_count - 1}
                          </span>
                        )}
                        <span className={`badge ${statusColors[invitation.status] || 'badge-gold'}`}>
                          {statusLabels[invitation.status] || invitation.status}
                        </span>
                        <button
                          onClick={() => handleRemoveGuest(invitation.id)}
                          className="btn btn-ghost"
                          style={{ padding: '4px' }}
                        >
                          <X size={14} className="text-muted" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted" style={{ fontSize: '13px', textAlign: 'center', padding: '12px 0' }}>
                  Пока никто не ответил
                </div>
              )}
            </div>
          )}

          {/* Response buttons (for guest) */}
          {!isHost && myInvitation && (
            <div>
              <div className="text-muted" style={{ fontSize: '14px', marginBottom: '12px' }}>
                Твой ответ {myInvitation.status !== 'pending' && `(сейчас: ${statusLabels[myInvitation.status]})`}
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <button
                  onClick={() => handleResponse('accepted')}
                  disabled={isResponding}
                  className="btn"
                  style={{ 
                    flexDirection: 'column', 
                    padding: '16px',
                    backgroundColor: currentStatus === 'accepted' ? 'var(--color-primary)' : 'var(--color-border)'
                  }}
                >
                  {isResponding && currentStatus !== 'accepted' ? (
                    <span className="animate-spin" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  ) : (
                    <Check size={20} />
                  )}
                  <span style={{ fontSize: '14px' }}>Приду</span>
                </button>
                
                <button
                  onClick={() => handleResponse('maybe')}
                  disabled={isResponding}
                  className="btn"
                  style={{ 
                    flexDirection: 'column', 
                    padding: '16px',
                    backgroundColor: currentStatus === 'maybe' ? '#6366f1' : 'var(--color-border)'
                  }}
                >
                  {isResponding && currentStatus !== 'maybe' ? (
                    <span className="animate-spin" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  ) : (
                    <HelpCircle size={20} />
                  )}
                  <span style={{ fontSize: '14px' }}>Может</span>
                </button>
                
                <button
                  onClick={() => handleResponse('declined')}
                  disabled={isResponding}
                  className="btn"
                  style={{ 
                    flexDirection: 'column', 
                    padding: '16px',
                    backgroundColor: currentStatus === 'declined' ? '#dc2626' : 'var(--color-border)'
                  }}
                >
                  {isResponding && currentStatus !== 'declined' ? (
                    <span className="animate-spin" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  ) : (
                    <XIcon size={20} />
                  )}
                  <span style={{ fontSize: '14px' }}>Не смогу</span>
                </button>
              </div>
            </div>
          )}

          {/* Add to Google Calendar */}
          <button
            onClick={addToGoogleCalendar}
            className="btn btn-secondary"
            style={{ width: '100%' }}
          >
            <Calendar size={20} />
            Добавить в Google Calendar
          </button>

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

          {/* Delete button (for creator — host or "меня позвали") */}
          {isCreator && (
            <>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn btn-ghost"
                  style={{ width: '100%', color: '#dc2626' }}
                >
                  <Trash2 size={20} />
                  Удалить событие
                </button>
              ) : (
                <div style={{ 
                  backgroundColor: 'rgba(220, 38, 38, 0.1)', 
                  border: '1px solid rgba(220, 38, 38, 0.3)', 
                  borderRadius: '12px', 
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <p style={{ fontSize: '14px', color: '#dc2626', textAlign: 'center' }}>
                    Удалить это событие? Все приглашения будут отменены.
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="btn btn-secondary"
                      style={{ flex: 1 }}
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="btn"
                      style={{ flex: 1, backgroundColor: '#dc2626' }}
                    >
                      {isDeleting ? 'Удаляю...' : 'Удалить'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
