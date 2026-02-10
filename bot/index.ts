import { Bot, InlineKeyboard, webhookCallback } from 'grammy';
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
    // Deep link to specific event
    const eventId = startParam.replace('event_', '');
    const keyboard = new InlineKeyboard()
      .webApp('🌙 Открыть приглашение', `${MINI_APP_URL}?event=${eventId}`);
    
    await ctx.reply(
      '🌙 Вас пригласили на ифтар!\n\nНажмите кнопку ниже чтобы ответить на приглашение.',
      { reply_markup: keyboard }
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
      'Нажмите кнопку ниже чтобы начать 👇',
      { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
      }
    );
  }
});

// Handle inline queries for sharing events
bot.on('inline_query', async (ctx) => {
  const query = ctx.inlineQuery.query;
  
  if (!query) {
    await ctx.answerInlineQuery([]);
    return;
  }

  // Search for events
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
      .webApp('Ответить', `${MINI_APP_URL}?event=${event.id}`),
  }));

  await ctx.answerInlineQuery(results);
});

// Handle callback queries (RSVP buttons in chat)
bot.on('callback_query:data', async (ctx) => {
  const [action, eventId, status] = ctx.callbackQuery.data.split(':');
  
  if (action === 'rsvp') {
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
      // Update invitation
      await supabase
        .from('invitations')
        .update({ status, responded_at: new Date().toISOString() })
        .eq('event_id', eventId)
        .eq('guest_id', user.id);
    }

    const statusText = {
      accepted: '✅ Вы подтвердили участие!',
      declined: '❌ Вы отклонили приглашение',
      maybe: '🤔 Вы ответили "может быть"',
    }[status] || 'Ответ записан';

    await ctx.answerCallbackQuery({ text: statusText });
  }
});

// Webhook handler for production
export const handler = webhookCallback(bot, 'std/http');

// Start polling for development
if (process.env.NODE_ENV !== 'production') {
  bot.start();
  console.log('Bot started in polling mode');
}

export { bot };
