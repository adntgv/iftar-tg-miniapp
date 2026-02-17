import { Bot, InlineKeyboard } from 'grammy';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, gte, inArray, asc } from 'drizzle-orm';
import { pgTable, uuid, bigint, text, timestamp, date, time, integer } from 'drizzle-orm/pg-core';
import fetch from 'node-fetch';

// Schema
const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  telegram_id: bigint('telegram_id', { mode: 'number' }).notNull().unique(),
  username: text('username'),
  first_name: text('first_name'),
  last_name: text('last_name'),
  avatar_url: text('avatar_url'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  host_id: uuid('host_id'),
  date: date('date').notNull(),
  iftar_time: time('iftar_time'),
  location: text('location'),
  address: text('address'),
  notes: text('notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  event_id: uuid('event_id'),
  guest_id: uuid('guest_id'),
  guest_username: text('guest_username'),
  status: text('status').default('pending'),
  guest_count: integer('guest_count').default(1),
  responded_at: timestamp('responded_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// Database connection
const DATABASE_URL = process.env.DATABASE_URL!;
const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

const bot = new Bot(process.env.BOT_TOKEN!);

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

// Helper to get or create user
async function getOrCreateUser(telegramId: number, username?: string, firstName?: string, lastName?: string) {
  let [user] = await db.select().from(users).where(eq(users.telegram_id, telegramId)).limit(1);

  if (!user) {
    [user] = await db.insert(users).values({
      telegram_id: telegramId,
      username,
      first_name: firstName,
      last_name: lastName,
    }).returning();
  }

  return user;
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
      const status = parts[2];
      const guestCount = parseInt(parts[3]) || 1;
      
      const telegramId = ctx.from?.id;
      if (telegramId) {
        const user = await getOrCreateUser(telegramId, ctx.from?.username, ctx.from?.first_name, ctx.from?.last_name);

        if (user) {
          // Check for existing invitation
          const [existing] = await db.select().from(invitations)
            .where(and(eq(invitations.event_id, eventId), eq(invitations.guest_id, user.id))).limit(1);

          if (existing) {
            await db.update(invitations).set({
              status,
              guest_count: status === 'accepted' ? guestCount : 1,
              responded_at: new Date(),
            }).where(eq(invitations.id, existing.id));
          } else {
            await db.insert(invitations).values({
              event_id: eventId,
              guest_id: user.id,
              status,
              guest_count: status === 'accepted' ? guestCount : 1,
              responded_at: new Date(),
            });
          }
        }
      }

      // Fetch event for confirmation message
      const [eventResult] = await db.select({
        event: events,
        host: users,
      }).from(events)
        .leftJoin(users, eq(events.host_id, users.id))
        .where(eq(events.id, eventId))
        .limit(1);

      if (eventResult?.event) {
        const event = eventResult.event;
        const host = eventResult.host;
        const hostName = host?.first_name || 'друга';
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
        if (host?.telegram_id && host.telegram_id !== telegramId) {
          const guestName = ctx.from?.first_name || ctx.from?.username || 'Гость';
          const guestCountText = guestCount > 1 ? ` (${guestCount} чел.)` : '';
          const statusLabel = status === 'accepted' ? `придёт${guestCountText}` : 'не сможет';
          const emoji = status === 'accepted' ? '✅' : '❌';
          
          await bot.api.sendMessage(
            host.telegram_id,
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
    const [eventResult] = await db.select({
      event: events,
      host: users,
    }).from(events)
      .leftJoin(users, eq(events.host_id, users.id))
      .where(eq(events.id, eventId))
      .limit(1);

    if (!eventResult?.event) {
      await ctx.reply('❌ Приглашение не найдено или устарело.');
      return;
    }

    const event = eventResult.event;
    const host = eventResult.host;

    // Format date
    const eventDate = new Date(event.date);
    const dateStr = eventDate.toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'long' 
    });

    // Get or create user
    const telegramId = ctx.from?.id;
    
    if (telegramId) {
      const user = await getOrCreateUser(telegramId, ctx.from?.username, ctx.from?.first_name, ctx.from?.last_name);

      // Check if already invited
      const [existingInvite] = await db.select().from(invitations)
        .where(and(eq(invitations.event_id, eventId), eq(invitations.guest_id, user.id))).limit(1);

      if (!existingInvite) {
        // Create invitation
        await db.insert(invitations).values({
          event_id: eventId,
          guest_id: user.id,
          status: 'pending',
        });
      }
    }

    const hostName = host?.first_name || host?.username || 'Друг';
    const location = event.location || 'Уточняется';
    const eventTime = event.iftar_time ? event.iftar_time.slice(0, 5) : '';
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

    const inviteMessage = 
      `🌙 *Приглашение на ифтар*\n\n` +
      `*${hostName}* зовёт тебя разделить ифтар\n\n` +
      `📅  *${ramadanDay} Рамадан* · ${dateStr}\n` +
      `⏰  ${eventTime || '—'}\n` +
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
    
    const user = await getOrCreateUser(telegramId, ctx.from.username, ctx.from.first_name, ctx.from.last_name);

    let statusChanged = true;
    if (user) {
      const [existing] = await db.select().from(invitations)
        .where(and(eq(invitations.event_id, eventId), eq(invitations.guest_id, user.id))).limit(1);

      if (existing) {
        // Skip if same status and guest count (dedup)
        if (existing.status === status && (existing.guest_count || 1) === guestCount) {
          statusChanged = false;
        }
        await db.update(invitations).set({
          status,
          guest_count: status === 'accepted' ? guestCount : 1,
          responded_at: new Date(),
        }).where(eq(invitations.id, existing.id));
      } else {
        await db.insert(invitations).values({
          event_id: eventId,
          guest_id: user.id,
          status,
          guest_count: status === 'accepted' ? guestCount : 1,
          responded_at: new Date(),
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
      text: statusChanged ? (statusText[status] || 'Ответ записан') : 'Уже записано ✓',
      show_alert: statusChanged
    });

    // Notify host only if status actually changed
    if (!statusChanged) return;
    try {
      const [eventResult] = await db.select({
        event: events,
        host: users,
      }).from(events)
        .leftJoin(users, eq(events.host_id, users.id))
        .where(eq(events.id, eventId))
        .limit(1);

      if (eventResult?.host?.telegram_id && eventResult.host.telegram_id !== telegramId) {
        const guestName = ctx.from.first_name || ctx.from.username || 'Гость';
        const eventDate = new Date(eventResult.event.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        
        const statusEmoji: Record<string, string> = { accepted: '✅', declined: '❌', maybe: '🤔' };
        const guestCountText = guestCount > 1 ? ` (${guestCount} чел.)` : '';
        const statusLabel: Record<string, string> = {
          accepted: `придёт${guestCountText}`,
          declined: 'не сможет',
          maybe: 'пока не уверен',
        };
        
        await bot.api.sendMessage(
          eventResult.host.telegram_id,
          `${statusEmoji[status]} *${guestName}* ${statusLabel[status]}!\n\n` +
          `📅 Ифтар ${eventDate}\n` +
          `📍 ${eventResult.event.location || 'Место не указано'}`,
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
  
  const [user] = await db.select().from(users).where(eq(users.telegram_id, telegramId)).limit(1);

  if (!user) {
    await ctx.answerInlineQuery([]);
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const eventsList = await db.select().from(events)
    .where(and(eq(events.host_id, user.id), gte(events.date, today)))
    .orderBy(asc(events.date))
    .limit(10);

  const filtered = query
    ? eventsList.filter(e =>
        e.location?.toLowerCase().includes(query.toLowerCase()) ||
        e.date.includes(query)
      )
    : eventsList;

  const results = filtered.map(event => {
    const eventDate = new Date(event.date);
    const dateStr = eventDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const inviteUrl = `https://iftar.adntgv.com/invite/${event.id}`;
    
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

  const eventsList = await db.select({
    event: events,
    host: users,
  }).from(events)
    .leftJoin(users, eq(events.host_id, users.id))
    .where(eq(events.date, tomorrowStr));

  if (eventsList.length === 0) {
    console.log('No events tomorrow');
    return;
  }

  for (const { event, host } of eventsList) {
    const eventDate = new Date(event.date);
    const dateStr = eventDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const hostName = host?.first_name || 'Хозяин';

    // Get event invitations
    const eventInvitations = await db.select({
      invitation: invitations,
      guest: users,
    }).from(invitations)
      .leftJoin(users, eq(invitations.guest_id, users.id))
      .where(eq(invitations.event_id, event.id));

    // Send reminder to accepted guests
    for (const { invitation, guest } of eventInvitations) {
      if (invitation.status === 'accepted' && guest?.telegram_id) {
        try {
          await bot.api.sendMessage(
            guest.telegram_id,
            `🔔 *Напоминание!*\n\n` +
            `Завтра ифтар у ${hostName}!\n` +
            `📅 ${dateStr}\n` +
            `⏰ ${event.iftar_time || '18:00'}\n` +
            `📍 ${event.location || 'Место уточняется'}`,
            { parse_mode: 'Markdown' }
          );
          console.log(`Reminder sent to ${guest.telegram_id}`);
        } catch (e) {
          console.error(`Failed to send reminder to ${guest.telegram_id}:`, e);
        }
      }
    }

    // Send reminder to host about who's coming
    const acceptedInvitations = eventInvitations.filter(i => i.invitation.status === 'accepted');
    const totalGuests = acceptedInvitations.reduce((sum, i) => sum + (i.invitation.guest_count || 1), 0);
    const acceptedNames = acceptedInvitations
      .map(i => {
        const name = i.guest?.first_name || i.guest?.username || 'Гость';
        return i.invitation.guest_count > 1 ? `${name} (+${i.invitation.guest_count - 1})` : name;
      })
      .join(', ');

    if (host?.telegram_id) {
      try {
        await bot.api.sendMessage(
          host.telegram_id,
          `🔔 *Напоминание!*\n\n` +
          `Завтра твой ифтар!\n` +
          `📅 ${dateStr}\n` +
          `⏰ ${event.iftar_time || '18:00'}\n` +
          `👥 Придут (${totalGuests} чел.): ${acceptedNames || 'пока никто'}`,
          { parse_mode: 'Markdown' }
        );
        console.log(`Host reminder sent to ${host.telegram_id}`);
      } catch (e) {
        console.error(`Failed to send host reminder:`, e);
      }
    }
  }
}

// ===== Feedback system =====
const FEEDBACK_TOPIC_ID = 1636;
const BRIDGE_URL = 'http://127.0.0.1:18800';
const BRIDGE_TOKEN = 'X_K6rjUFN1YGNUHXWxRWlA1iCNwrD1sGoYD_OMQNMKM';
const WORKSPACE_CHAT_ID = '-1003728274124';
const ADMIN_IDS = [289310951, 6454712844];

const feedbackWaiting = new Set<number>(); // telegram IDs waiting for feedback text

bot.command('feedback', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  feedbackWaiting.add(telegramId);
  await ctx.reply('Напишите или запишите голосовое сообщение с отзывом 📝🎤');
  trackEvent('feedback_start', { from: telegramId });
});

// Helper: send text header to feedback topic via Bridge
async function sendFeedbackToTopic(text: string) {
  await fetch(`${BRIDGE_URL}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BRIDGE_TOKEN}`,
    },
    body: JSON.stringify({
      chat_id: WORKSPACE_CHAT_ID,
      text,
      reply_to_message_id: FEEDBACK_TOPIC_ID,
    }),
  });
}

// Handle feedback: text messages
bot.on('message:text', async (ctx, next) => {
  const telegramId = ctx.from?.id;
  if (!telegramId || !feedbackWaiting.has(telegramId)) {
    return next();
  }
  feedbackWaiting.delete(telegramId);

  const feedbackText = ctx.message.text;
  await getOrCreateUser(telegramId, ctx.from?.username, ctx.from?.first_name, ctx.from?.last_name);

  try {
    await sql`INSERT INTO feedback (user_id, text) VALUES (${telegramId}, ${feedbackText})`;
  } catch (e) {
    console.error('Failed to save feedback:', e);
  }

  await ctx.reply('Спасибо за отзыв! 🤲');

  const firstName = ctx.from?.first_name || '';
  const username = ctx.from?.username ? `@${ctx.from.username}` : 'без username';
  try {
    await sendFeedbackToTopic(`💬 Отзыв от ${firstName} (${username}):\n\n${feedbackText}`);
  } catch (e) {
    console.error('Failed to forward feedback:', e);
  }

  trackEvent('feedback_submitted', { from: telegramId });
});

// Handle feedback: voice/audio messages
bot.on(['message:voice', 'message:audio'], async (ctx, next) => {
  const telegramId = ctx.from?.id;
  if (!telegramId || !feedbackWaiting.has(telegramId)) {
    return next();
  }
  feedbackWaiting.delete(telegramId);

  await getOrCreateUser(telegramId, ctx.from?.username, ctx.from?.first_name, ctx.from?.last_name);

  try {
    await sql`INSERT INTO feedback (user_id, text) VALUES (${telegramId}, ${'[голосовое сообщение]'})`;
  } catch (e) {
    console.error('Failed to save voice feedback:', e);
  }

  await ctx.reply('Спасибо за отзыв! 🤲');

  const firstName = ctx.from?.first_name || '';
  const username = ctx.from?.username ? `@${ctx.from.username}` : 'без username';
  try {
    // Send text header first
    await sendFeedbackToTopic(`💬 Голосовой отзыв от ${firstName} (${username})`);
    // Forward the voice message to the topic
    await bot.api.forwardMessage(
      Number(WORKSPACE_CHAT_ID),
      ctx.message.chat.id,
      ctx.message.message_id,
      { message_thread_id: FEEDBACK_TOPIC_ID }
    );
  } catch (e) {
    console.error('Failed to forward voice feedback:', e);
  }

  trackEvent('feedback_voice_submitted', { from: telegramId });
});

// ===== Broadcast command (admin only) =====
bot.command('broadcast', async (ctx) => {
  const telegramId = ctx.from?.id;
  if (!telegramId || !ADMIN_IDS.includes(telegramId)) return;

  const message = ctx.match;
  if (!message) {
    await ctx.reply('Использование: /broadcast <сообщение>');
    return;
  }

  const allUsers = await sql`SELECT telegram_id FROM users`;
  let sent = 0;
  let failed = 0;

  await ctx.reply(`📡 Рассылка начата для ${allUsers.length} пользователей...`);

  for (let i = 0; i < allUsers.length; i++) {
    try {
      await bot.api.sendMessage(allUsers[i].telegram_id, message, { parse_mode: 'Markdown' });
      sent++;
    } catch (e) {
      failed++;
    }
    // Rate limit: 30 msgs/sec
    if ((i + 1) % 30 === 0) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  await ctx.reply(`✅ Рассылка завершена!\n\n📨 Отправлено: ${sent}\n❌ Ошибок: ${failed}`);
  trackEvent('broadcast', { sent, failed, from: telegramId });
});

// Command to manually trigger reminders (for testing)
bot.command('send_reminders', async (ctx) => {
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
  console.log('Bot started in polling mode (using PostgreSQL with Drizzle)');
  trackEvent('bot_started');
})();

export { bot, sendReminders };
