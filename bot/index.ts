import { Bot, InlineKeyboard } from 'grammy';
import { createClient } from '@supabase/supabase-js';

const bot = new Bot(process.env.BOT_TOKEN!);
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const MINI_APP_URL = process.env.MINI_APP_URL || 'https://iftar.adntgv.com';

// /start command
bot.command('start', async (ctx) => {
  const startParam = ctx.match;
  
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
      .text('✅ Приду!', `rsvp:${eventId}:accepted`)
      .text('❌ Не смогу', `rsvp:${eventId}:declined`)
      .row()
      .text('🤔 Пока не знаю', `rsvp:${eventId}:maybe`)
      .row()
      .webApp('📅 Открыть календарь', MINI_APP_URL);

    // Beautiful invitation message
    const inviteMessage = 
      `╭─────────────────────╮\n` +
      `│    🌙 *ПРИГЛАШЕНИЕ*    │\n` +
      `│        *НА ИФТАР*        │\n` +
      `╰─────────────────────╯\n\n` +
      
      `✨ *${hostName}* приглашает тебя\n` +
      `разделить ифтар вместе!\n\n` +
      
      `┌───────────────────┐\n` +
      `│ 📅  *${ramadanDay} Рамадан*\n` +
      `│      ${dateStr}\n` +
      `│\n` +
      `│ ⏰  *${time || '—'}*\n` +
      `│\n` +
      `│ 📍  *${location}*\n` +
      `${address ? `│      ${address}\n` : ''}` +
      `└───────────────────┘\n` +
      
      `${event.notes ? `\n💬 _"${event.notes}"_\n` : ''}` +
      `\n` +
      `─────────────────────\n` +
      `      *Ты придёшь?* 👇`;

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
    const [, eventId, status] = data.split(':');
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
            responded_at: new Date().toISOString(),
          });
      }
    }

    const statusText: Record<string, string> = {
      accepted: '✅ Отлично! Ты отметился что придёшь.',
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
        
        const statusLabel: Record<string, string> = {
          accepted: 'придёт',
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

    // Update message to show response
    const keyboard = new InlineKeyboard()
      .text(status === 'accepted' ? '✅ Приду ✓' : '✅ Приду', `rsvp:${eventId}:accepted`)
      .text(status === 'declined' ? '❌ Не смогу ✓' : '❌ Не смогу', `rsvp:${eventId}:declined`)
      .row()
      .text(status === 'maybe' ? '🤔 Может быть ✓' : '🤔 Может быть', `rsvp:${eventId}:maybe`)
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
  
  if (!query) {
    await ctx.answerInlineQuery([]);
    return;
  }

  const { data: events } = await supabase
    .from('events')
    .select('*, host:users(*)')
    .ilike('location', `%${query}%`)
    .limit(5);

  const results = (events || []).map(event => ({
    type: 'article' as const,
    id: event.id,
    title: `Ифтар ${new Date(event.date).toLocaleDateString('ru-RU')}`,
    description: event.location || 'Место не указано',
    input_message_content: {
      message_text: `🌙 *Приглашение на ифтар*\n\n📅 ${new Date(event.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}\n📍 ${event.location || 'Место уточняется'}\n👤 ${event.host?.first_name || 'Хозяин'}`,
      parse_mode: 'Markdown' as const,
    },
    reply_markup: new InlineKeyboard()
      .url('Ответить', `https://t.me/iftar_coordinator_bot?start=event_${event.id}`),
  }));

  await ctx.answerInlineQuery(results);
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
    const acceptedCount = (event.invitations || []).filter((i: any) => i.status === 'accepted').length;
    const acceptedNames = (event.invitations || [])
      .filter((i: any) => i.status === 'accepted')
      .map((i: any) => i.guest?.first_name || i.guest?.username || 'Гость')
      .join(', ');

    if (event.host?.telegram_id) {
      try {
        await bot.api.sendMessage(
          event.host.telegram_id,
          `🔔 *Напоминание!*\n\n` +
          `Завтра твой ифтар!\n` +
          `📅 ${dateStr}\n` +
          `⏰ ${event.iftar_time || '18:00'}\n` +
          `👥 Придут (${acceptedCount}): ${acceptedNames || 'пока никто'}`,
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
})();

// Export for external cron trigger
export { bot, sendReminders };
