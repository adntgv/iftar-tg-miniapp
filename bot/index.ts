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

    const hostName = event.host?.first_name || event.host?.username || 'Кто-то';
    const location = event.location || 'Уточняется';
    const time = event.iftar_time ? event.iftar_time.slice(0, 5) : '';

    const keyboard = new InlineKeyboard()
      .text('✅ Приду', `rsvp:${eventId}:accepted`)
      .text('❌ Не смогу', `rsvp:${eventId}:declined`)
      .row()
      .text('🤔 Может быть', `rsvp:${eventId}:maybe`)
      .row()
      .webApp('📅 Открыть календарь', MINI_APP_URL);

    await ctx.reply(
      `🌙 *Приглашение на ифтар*\n\n` +
      `👤 От: ${hostName}\n` +
      `📅 Дата: ${dateStr}\n` +
      `${time ? `🕐 Время: ${time}\n` : ''}` +
      `📍 Место: ${location}\n` +
      `${event.notes ? `\n📝 ${event.notes}` : ''}\n\n` +
      `Ты пойдёшь?`,
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
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

export { bot };
