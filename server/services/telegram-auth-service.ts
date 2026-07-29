import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

let authBot: TelegramBot | null = null;
let botUsername: string | null = null;

export async function getBotUsername(): Promise<string | null> {
  if (botUsername) return botUsername;
  if (!TELEGRAM_BOT_TOKEN) return null;

  try {
    const tempBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
    const me = await tempBot.getMe();
    botUsername = me.username || null;
    return botUsername;
  } catch (err) {
    console.error('[TelegramAuth] Failed to get bot username:', err);
    return null;
  }
}

export async function startAuthListener(): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('[TelegramAuth] No TELEGRAM_BOT_TOKEN — auth listener not started');
    return;
  }

  // Only poll in production — dev server shares the same bot token with production
  // and Telegram only allows one polling instance per token
  if (process.env.NODE_ENV !== 'production') {
    console.log('[TelegramAuth] Dev mode — polling skipped (only runs in production)');
    // Still fetch bot username for the /init endpoint
    try {
      const tempBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
      const me = await tempBot.getMe();
      botUsername = me.username || null;
      console.log(`[TelegramAuth] Bot username cached: @${botUsername}`);
    } catch (e) {
      console.error('[TelegramAuth] Failed to get bot username:', e);
    }
    return;
  }

  if (authBot) {
    console.log('[TelegramAuth] Auth listener already running');
    return;
  }

  try {
    authBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

    authBot.on('message', async (msg) => {
      const text = msg.text || '';
      const chatId = msg.chat.id;
      const from = msg.from;

      if (!from) return;

      const telegramId = String(from.id);
      const telegramUsername = from.username || null;
      const telegramFirstName = from.first_name || '';
      const telegramLastName = from.last_name || null;

      // Handle /start TOKEN command
      if (text.startsWith('/start ')) {
        const token = text.slice(7).trim();
        if (!token) return;

        try {
          const authRequest = await storage.getTelegramAuthRequest(token);
          if (!authRequest) {
            await authBot!.sendMessage(chatId,
              '❌ Ссылка недействительна. Попробуйте снова в приложении.\n\n' +
              '❌ Havola noto\'g\'ri. Ilovada qaytadan urinib ko\'ring.');
            return;
          }

          // Check expiry
          if (new Date() > authRequest.expiresAt) {
            await storage.updateTelegramAuthRequest(token, { status: 'expired' });
            await authBot!.sendMessage(chatId,
              '⏰ Время ссылки истекло. Запросите новую в приложении.\n\n' +
              '⏰ Havola muddati tugagan. Ilovada yangi so\'rov yuboring.');
            return;
          }

          // Find user by telegramId
          const existingUser = await storage.getUserByTelegramId(telegramId);

          if (existingUser) {
            // User found — mark as completed login
            await storage.updateTelegramAuthRequest(token, {
              status: 'completed',
              telegramId,
              telegramUsername,
              telegramFirstName,
              telegramLastName,
              userId: existingUser.id,
            });

            await authBot!.sendMessage(chatId,
              `✅ Авторизация подтверждена! Добро пожаловать, ${telegramFirstName}!\n` +
              'Вернитесь в приложение Yukbozor.\n\n' +
              `✅ Tasdiqlandi! Xush kelibsiz, ${telegramFirstName}!\n` +
              'Yukbozor ilovasiga qayting.');
          } else {
            // User not found — mark as not_registered with telegram data
            await storage.updateTelegramAuthRequest(token, {
              status: 'not_registered',
              telegramId,
              telegramUsername,
              telegramFirstName,
              telegramLastName,
            });

            await authBot!.sendMessage(chatId,
              `👋 Привет, ${telegramFirstName}! Аккаунт не найден.\n` +
              'Вернитесь в приложение для регистрации.\n\n' +
              `👋 Salom, ${telegramFirstName}! Akkaunt topilmadi.\n` +
              'Ro\'yxatdan o\'tish uchun ilovaga qayting.');
          }
        } catch (err) {
          console.error('[TelegramAuth] Error handling /start command:', err);
        }
        return;
      }

      // Default message — tell user to use the app
      if (text === '/start') {
        await authBot!.sendMessage(chatId,
          'Yukbozor ilovasida "Telegram orqali kirish" tugmasini bosing.\n\n' +
          'Нажмите кнопку "Войти через Telegram" в приложении Yukbozor.');
      }
    });

    authBot.on('polling_error', (err) => {
      console.error('[TelegramAuth] Polling error:', err.message);
    });

    // Pre-fetch bot username
    const me = await authBot.getMe();
    botUsername = me.username || null;

    console.log(`[TelegramAuth] Auth listener started. Bot: @${botUsername}`);
  } catch (err) {
    console.error('[TelegramAuth] Failed to start auth listener:', err);
    authBot = null;
  }
}

export function stopAuthListener(): void {
  if (authBot) {
    authBot.stopPolling();
    authBot = null;
    console.log('[TelegramAuth] Auth listener stopped');
  }
}
