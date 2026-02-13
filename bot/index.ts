import { Bot, InlineKeyboard } from 'grammy';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const bot = new Bot(process.env.BOT_TOKEN!);
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const MINI_APP_URL = process.env.MINI_APP_URL || 'https://iftar.adntgv.com';
const UMAMI_URL = process.env.UMAMI_URL || 'https://umami.adntgv.com';
const UMAMI_WEBSITE_ID = process.env.UMAMI_WEBSITE_ID || 'e2b0e90c-3cee-474d-8d8a-2fc585e66d99';

async function trackEvent(name: string, data: Record<string, any> = {}) {
  try {
    await fetch(`${UMAMI_URL}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'event',
        payload: {
          website: UMAMI_WEBSITE_ID,
          name,
          data,
        },
      }),
    });
  } catch (e) {
    // ignore analytics errors
  }
}

// /start command
bot.command('start', async (ctx) => {
  trackEvent('bot_start', { from: ctx.from?.id });
  const startParam = ctx.match;
  
  // Handle RSVP from web page: rsvp_{eventId}_{status}_{guestCount}
  if (startParam?.startsWith('rsvp_')) {
    trackEvent('bot_rsvp_from_web', { startParam });
    const parts = startParam.split('_');
    if (parts.length >= 4) {
      const eventId = parts[1];
      const status = parts[2]; // accepted, declined
      const guestCount = parseInt(parts[3]) || 1;
      
      // Process the RSVP
      const telegramId = ctx.from?.id;
      if (telegramId) {
        // Get or create user
        let { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('telegram_id', telegramId)
          .single();

        if (!user) {
          const { data: newUser } = await supabase
            .from('users')
            .insert({
              telegram_id: telegramId,
              username: ctx.from?.username,
              first_name: ctx.from?.first_name,
              last_name: ctx.from?.last_name,
            })
            .select('id')
            .single();
          user = newUser;
        }

        if (user) {
          // Update or create invitation
          const { data: existing } = await supabase
            .from('invitations')
            .select('id')
            .eq('event_id', eventId)
            .eq('guest_id', user.id)
            .single();

          if (existing) {
            await supabase
              .from('invitations')
              .update({ 
                status, 
                guest_count: status === 'accepted' ? guestCount : 1,
                responded_at: new Date().toISOString() 
              })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('invitations')
              .insert({
                event_id: eventId,
                guest_id: user.id,
                status,
                guest_count: status === 'accepted' ? guestCount : 1,
                responded_at: new Date().toISOString(),
              });
          }
        }
      }

      // Fetch event for confirmation message
      const { data: event } = await supabase
        .from('events')
        .select('*, host:users(*)')
        .eq('id', eventId)
        .single();

      if (event) {
        const hostName = event.host?.first_name || 'друга';
        const eventDate = new Date(event.date);
        const dateStr = eventDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        
        if (status === 'accepted') {
          const guestText = guestCount === 1 ? '' : guestCount === 2 ? ' вдвоём' : ` (${guestCount} чел.)`;
          await ctx.reply(
            `✅ *Отлично!*\n\n` +
            `Ты${guestText} придёшь на ифтар к ${hostName}!\n\n` +
            `📅 ${dateStr}\n` +
            `📍 ${event.location || 'Место уточняется'}\n\n` +
            `_Хочешь создать своё приглашение?_`,
            { 
              parse_mode: 'Markdown',
              reply_markup: new InlineKeyboard()
                .webApp('🌙 Создать приглашение', MINI_APP_URL)
            }
          );
        } else {
          await ctx.reply(
            `😔 *Жаль!*\n\n` +
            `Ты не сможешь прийти на ифтар к ${hostName}.\n` +
            `Может в другой раз!\n\n` +
            `_Хочешь пригласить друзей к себе?_`,
            { 
              parse_mode: 'Markdown',
              reply_markup: new InlineKeyboard()
                .webApp('🌙 Создать приглашение', MINI_APP_URL)
            }
          );
        }

        // Notify host
        if (event.host?.telegram_id && event.host.telegram_id !== telegramId) {
          const guestName = ctx.from?.first_name || ctx.from?.username || 'Гость';
          const guestCountText = guestCount > 1 ? ` (${guestCount} чел.)` : '';
          const statusLabel = status === 'accepted' ? `придёт${guestCountText}` : 'не сможет';
          const emoji = status === 'accepted' ? '✅' : '❌';
          
          await bot.api.sendMessage(
            event.host.telegram_id,
            `${emoji} *${guestName}* ${statusLabel}!\n\n` +
            `📅 Ифтар ${dateStr}\n` +
            `📍 ${event.location || 'Место не указано'}`,
            { parse_mode: 'Markdown' }
          );
        }
      }
      return;
    }
  }
  
  if (startParam?.startsWith('event_')) {
    const eventId = startParam.replace('event_', '');
    
    // Fetch event details
    const { data: event } = await supabase
      .from('events')
      .select('*, host:users(*)')
      .eq('id', eventId)
      .single();

    if (!event) {
      await ctx.reply('❌ Приглашение не найдено или устарело.');
      return;
    }

    // Format date
    const eventDate = new Date(event.date);
    const dateStr = eventDate.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long' 
    });

    // Get or create user
    const telegramId = ctx.from?.id;
    let userId: string | null = null;
    
    if (telegramId) {
      let { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId)
        .single();

      if (!user) {
        const { data: newUser } = await supabase
          .from('users')
          .insert({
            telegram_id: telegramId,
            username: ctx.from?.username,
            first_name: ctx.from?.first_name,
            last_name: ctx.from?.last_name,
          })
          .select('id')
          .single();
        user = newUser;
      }
      userId = user?.id || null;

      // Check if already invited
      if (userId) {
        const { data: existingInvite } = await supabase
          .from('invitations')
          .select('id, status')
          .eq('event_id', eventId)
          .eq('guest_id', userId)
          .single();

        if (!existingInvite) {
          // Create invitation
          await supabase
            .from('invitations')
            .insert({
              event_id: eventId,
              guest_id: userId,
              status: 'pending',
            });
        }
      }
    }

    const hostName = event.host?.first_name || event.host?.username || 'Друг';
    const location = event.location || 'Уточняется';
    const time = event.iftar_time ? event.iftar_time.slice(0, 5) : '';
    const address = event.address || '';
    
    // Calculate Ramadan day (Feb 17, 2026 = 1 Ramadan)
    const ramadanStart = new Date('2026-02-17');
    const ramadanDay = Math.floor((eventDate.getTime() - ramadanStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;

    const keyboard = new InlineKeyboard()
      .text('✅ Приду (1)', `rsvp:${eventId}:accepted:1`)
      .text('👥 +1', `rsvp:${eventId}:accepted:2`)
      .text('👨‍👩‍👧 +2-3', `rsvp:${eventId}:accepted:3`)
      .row()
      .text('❌ Не смогу', `rsvp:${eventId}:declined:0`)
      .row()
      .webApp('📅 Открыть календарь', MINI_APP_URL);

    // Clean invitation message
    const inviteMessage = 
      `🌙 *Приглашение на ифтар*\n\n` +
      
      `*${hostName}* зовёт тебя разделить ифтар\n\n` +
      
      `📅  *${ramadanDay} Рамадан* · ${dateStr}\n` +
      `⏰  ${time || '—'}\n` +
      `📍  ${location}${address ? ` · ${address}` : ''}\n` +
      
      `${event.notes ? `\n💬 _${event.notes}_\n` : ''}` +
      `\n*Ты придёшь?*`;

    await ctx.reply(inviteMessage, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    });
  } else {
    // Regular start
    const keyboard = new InlineKeyboard()
      .webApp('🌙 Открыть Iftar App', MINI_APP_URL);
    
    await ctx.reply(
      '🌙 *Салам!*\n\n' +
      'Это приложение для координации ифтаров во время Рамадана.\n\n' +
      '✨ *Что можно делать:*\n' +
      '• Создавать приглашения на ифтар\n' +
      '• Видеть кто уже приглашён на какие даты\n' +
      '• Отвечать на приглашения одним тапом\n' +
      '• Не пересекаться с другими хозяевами\n\n' +
      'Нажми кнопку ниже чтобы начать 👇',
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
  }
});

// Handle RSVP callbacks
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  
  if (data.startsWith('rsvp:')) {
    trackEvent('bot_rsvp', { data });
    const [, eventId, status, guestCountStr] = data.split(':');
    const guestCount = parseInt(guestCountStr) || 1;
    const telegramId = ctx.from.id;
    
    // Get or create user
    let { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId)
      .single();

    if (!user) {
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          telegram_id: telegramId,
          username: ctx.from.username,
          first_name: ctx.from.first_name,
          last_name: ctx.from.last_name,
        })
        .select('id')
        .single();
      user = newUser;
    }

    if (user) {
      // Update or create invitation
      const { data: existing } = await supabase
        .from('invitations')
        .select('id')
        .eq('event_id', eventId)
        .eq('guest_id', user.id)
        .single();

      if (existing) {
        await supabase
          .from('invitations')
          .update({ 
            status, 
            guest_count: status === 'accepted' ? guestCount : 1,
            responded_at: new Date().toISOString() 
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('invitations')
          .insert({
            event_id: eventId,
            guest_id: user.id,
            status,
            guest_count: status === 'accepted' ? guestCount : 1,
            responded_at: new Date().toISOString(),
          });
      }
    }

    const guestLabel = guestCount === 1 ? '' : guestCount === 2 ? ' вдвоём' : ` (${guestCount} человека)`;
    const statusText: Record<string, string> = {
      accepted: `✅ Отлично! Ты придёшь${guestLabel}.`,
      declined: '❌ Понял, ты не сможешь.',
      maybe: '🤔 Окей, пока "может быть".',
    };

    await ctx.answerCallbackQuery({ 
      text: statusText[status] || 'Ответ записан',
      show_alert: true
    });

    // Notify host about the response
    try {
      const { data: event } = await supabase
        .from('events')
        .select('host:users(telegram_id, first_name), date, location')
        .eq('id', eventId)
        .single();

      if (event?.host?.telegram_id && event.host.telegram_id !== telegramId) {
        const guestName = ctx.from.first_name || ctx.from.username || 'Гость';
        const eventDate = new Date(event.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        
        const statusEmoji: Record<string, string> = {
          accepted: '✅',
          declined: '❌',
          maybe: '🤔',
        };
        
        const guestCountText = guestCount > 1 ? ` (${guestCount} чел.)` : '';
        const statusLabel: Record<string, string> = {
          accepted: `придёт${guestCountText}`,
          declined: 'не сможет',
          maybe: 'пока не уверен',
        };
        
        await bot.api.sendMessage(
          event.host.telegram_id,
          `${statusEmoji[status]} *${guestName}* ${statusLabel[status]}!\n\n` +
          `📅 Ифтар ${eventDate}\n` +
          `📍 ${event.location || 'Место не указано'}`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (e) {
      console.error('Failed to notify host:', e);
    }

    // Update message to show response with current selection
    const isAccepted = status === 'accepted';
    const keyboard = new InlineKeyboard()
      .text(isAccepted && guestCount === 1 ? '✅ (1) ✓' : '✅ Приду (1)', `rsvp:${eventId}:accepted:1`)
      .text(isAccepted && guestCount === 2 ? '👥 +1 ✓' : '👥 +1', `rsvp:${eventId}:accepted:2`)
      .text(isAccepted && guestCount >= 3 ? '👨‍👩‍👧 +2-3 ✓' : '👨‍👩‍👧 +2-3', `rsvp:${eventId}:accepted:3`)
      .row()
      .text(status === 'declined' ? '❌ Не смогу ✓' : '❌ Не смогу', `rsvp:${eventId}:declined:0`)
      .row()
      .webApp('📅 Открыть календарь', MINI_APP_URL);

    try {
      await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    } catch (e) {
      // Message might be too old to edit
    }
  }
});

// Handle inline queries for sharing events
bot.on('inline_query', async (ctx) => {
  const query = ctx.inlineQuery.query;
  const telegramId = ctx.from.id;
  
  // Get user's events (as host)
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramId)
    .single();

  if (!user) {
    await ctx.answerInlineQuery([]);
    return;
  }

  const { data: events } = await supabase
    .from('events')
    .select('*, host:users(*)')
    .eq('host_id', user.id)
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date', { ascending: true })
    .limit(10);

  // Filter by query if provided
  const filtered = query 
    ? (events || []).filter(e => 
        e.location?.toLowerCase().includes(query.toLowerCase()) ||
        e.date.includes(query)
      )
    : events || [];

  const results = filtered.map(event => {
    const eventDate = new Date(event.date);
    const dateStr = eventDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const inviteUrl = `https://iftar.adntgv.com/invite/${event.id}`;
    
    // Calculate Ramadan day
    const ramadanStart = new Date('2026-02-17');
    const ramadanDay = Math.floor((eventDate.getTime() - ramadanStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    
    return {
      type: 'article' as const,
      id: event.id,
      title: `🌙 Ифтар ${dateStr}`,
      description: `${ramadanDay} Рамадан • ${event.location || 'Место не указано'}`,
      thumbnail_url: 'https://iftar.adntgv.com/moon.svg',
      input_message_content: {
        message_text: inviteUrl,
        link_preview_options: {
          show_above_text: true,
          prefer_large_media: true,
        },
      },
    };
  });

  await ctx.answerInlineQuery(results, { cache_time: 10 });
  trackEvent('bot_inline_query', { query });
});

// Send reminders for events happening tomorrow
async function sendReminders() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  console.log(`Checking reminders for ${tomorrowStr}...`);

  // Get all events happening tomorrow
  const { data: events } = await supabase
    .from('events')
    .select('*, host:users(*), invitations(*, guest:users(*))')
    .eq('date', tomorrowStr);

  if (!events || events.length === 0) {
    console.log('No events tomorrow');
    return;
  }

  for (const event of events) {
    const eventDate = new Date(event.date);
    const dateStr = eventDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const hostName = event.host?.first_name || 'Хозяин';

    // Send reminder to accepted guests
    for (const inv of event.invitations || []) {
      if (inv.status === 'accepted' && inv.guest?.telegram_id) {
        try {
          await bot.api.sendMessage(
            inv.guest.telegram_id,
            `🔔 *Напоминание!*\n\n` +
            `Завтра ифтар у ${hostName}!\n` +
            `📅 ${dateStr}\n` +
            `⏰ ${event.iftar_time || '18:00'}\n` +
            `📍 ${event.location || 'Место уточняется'}`,
            { parse_mode: 'Markdown' }
          );
          console.log(`Reminder sent to ${inv.guest.telegram_id}`);
        } catch (e) {
          console.error(`Failed to send reminder to ${inv.guest.telegram_id}:`, e);
        }
      }
    }

    // Send reminder to host about who's coming
    const acceptedInvitations = (event.invitations || []).filter((i: any) => i.status === 'accepted');
    const totalGuests = acceptedInvitations.reduce((sum: number, i: any) => sum + (i.guest_count || 1), 0);
    const acceptedNames = acceptedInvitations
      .map((i: any) => {
        const name = i.guest?.first_name || i.guest?.username || 'Гость';
        return i.guest_count > 1 ? `${name} (+${i.guest_count - 1})` : name;
      })
      .join(', ');

    if (event.host?.telegram_id) {
      try {
        await bot.api.sendMessage(
          event.host.telegram_id,
          `🔔 *Напоминание!*\n\n` +
          `Завтра твой ифтар!\n` +
          `📅 ${dateStr}\n` +
          `⏰ ${event.iftar_time || '18:00'}\n` +
          `👥 Придут (${totalGuests} чел.): ${acceptedNames || 'пока никто'}`,
          { parse_mode: 'Markdown' }
        );
        console.log(`Host reminder sent to ${event.host.telegram_id}`);
      } catch (e) {
        console.error(`Failed to send host reminder:`, e);
      }
    }
  }
}

// Command to manually trigger reminders (for testing)
bot.command('send_reminders', async (ctx) => {
  // Only allow from specific admin user
  if (ctx.from?.id !== 289310951 && ctx.from?.id !== 6454712844) {
    return;
  }
  await sendReminders();
  await ctx.reply('✅ Напоминания отправлены');
});

// Start polling
(async () => {
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
  } catch (e) {
    // ignore
  }
  bot.start();
  console.log('Bot started in polling mode');
  trackEvent('bot_started');
})();

// Export for external cron trigger
export { bot, sendReminders };
