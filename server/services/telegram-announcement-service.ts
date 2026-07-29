import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';
import type { Announcement, User } from '@shared/schema';
import {
  STATUS_NAMES,
  BOT_FOOTER as ANNOUNCEMENT_FOOTER,
  escHtml,
  getRouteDescription as getRouteDescriptionShared,
  formatAnnouncementHtml as formatAnnouncementHtmlShared,
} from './announcement-format-helpers';

const TELEGRAM_ANNOUNCEMENTS_BOT_TOKEN = process.env.TELEGRAM_ANNOUNCEMENTS_BOT_TOKEN;
const DEFAULT_ANNOUNCEMENTS_CHANNEL_ID = process.env.TELEGRAM_ANNOUNCEMENTS_CHANNEL_ID || '@yukbozor_elon';
const APP_URL = process.env.APP_URL || 'https://yukbozor.uz';

let announcementsBot: TelegramBot | null = null;

console.log('[Telegram Announcements] Service initialized:', {
  hasToken: !!TELEGRAM_ANNOUNCEMENTS_BOT_TOKEN,
  defaultChannelId: DEFAULT_ANNOUNCEMENTS_CHANNEL_ID,
  appUrl: APP_URL
});

async function getActiveAnnouncementChannels(): Promise<string[]> {
  const channels = await storage.getActiveTelegramChannels('announcements');
  if (channels.length > 0) {
    return channels.map(c => c.chatId);
  }
  return [DEFAULT_ANNOUNCEMENTS_CHANNEL_ID];
}

function getAnnouncementsBotInstance(): TelegramBot | null {
  if (!TELEGRAM_ANNOUNCEMENTS_BOT_TOKEN) {
    console.log('[Telegram Announcements] Bot token not configured');
    return null;
  }
  
  if (!announcementsBot) {
    announcementsBot = new TelegramBot(TELEGRAM_ANNOUNCEMENTS_BOT_TOKEN, { polling: false });
  }
  
  return announcementsBot;
}

function formatAnnouncementMessage(announcement: Announcement, customerName?: string): string {
  return formatAnnouncementHtmlShared(announcement, { showStatus: true, showCustomer: customerName });
}

function formatClosedAnnouncementMessage(announcement: Announcement): string {
  const route = escHtml(getRouteDescriptionShared(announcement));
  const status = escHtml(STATUS_NAMES[announcement.status] || announcement.status);

  let message = `📢 <b>E'LON #${announcement.id}</b>\n\n`;
  message += `📦 <b>Yuk:</b> ${escHtml(announcement.title)}\n`;
  message += `📍 <b>Yo'nalish:</b> ${route}\n\n`;
  message += `📊 <b>Holati:</b> ${status}\n\n`;
  message += ANNOUNCEMENT_FOOTER;
  return message;
}

export async function sendAnnouncementNotification(
  announcement: Announcement,
  customer?: User
): Promise<{ success: boolean; error?: string; messageId?: number; chatId?: string }> {
  const botInstance = getAnnouncementsBotInstance();
  
  if (!botInstance) {
    console.log('[Telegram Announcements] Bot not configured, skipping notification for announcement', announcement.id);
    return { success: false, error: 'Bot not configured' };
  }
  
  try {
    const customerName = customer?.displayName || customer?.phone;
    const message = formatAnnouncementMessage(announcement, customerName);
    
    const channels = await getActiveAnnouncementChannels();
    console.log('[Telegram Announcements] Sending notification for announcement', announcement.id, 'to', channels.length, 'channels');
    
    let successCount = 0;
    let lastMessageId: number | undefined;
    let lastChatId: string | undefined;
    
    for (const channelId of channels) {
      try {
        const result = await botInstance.sendMessage(channelId, message, {
          parse_mode: 'HTML'
        });
        
        console.log('[Telegram Announcements] Message sent to', channelId, 'messageId:', result.message_id);
        lastMessageId = result.message_id;
        lastChatId = channelId;
        successCount++;
      } catch (channelError: any) {
        console.error('[Telegram Announcements] Error sending to channel', channelId, ':', channelError.message);
      }
    }
    
    if (successCount > 0) {
      return { success: true, messageId: lastMessageId, chatId: lastChatId };
    }
    return { success: false, error: 'Failed to send to any channel' };
  } catch (error: any) {
    console.error('[Telegram Announcements] Error sending notification:', error.message);
    return { success: false, error: error.message };
  }
}

export async function updateAnnouncementNotification(
  announcement: Announcement
): Promise<{ success: boolean; error?: string }> {
  const botInstance = getAnnouncementsBotInstance();
  
  if (!botInstance) {
    console.log('[Telegram Announcements] Bot not configured, skipping update for announcement', announcement.id);
    return { success: false, error: 'Bot not configured' };
  }
  
  if (!announcement.telegramMessageId || !announcement.telegramChatId) {
    console.log('[Telegram Announcements] No message ID stored for announcement', announcement.id);
    return { success: false, error: 'No message ID stored' };
  }
  
  try {
    const message = formatClosedAnnouncementMessage(announcement);
    
    await botInstance.editMessageText(message, {
      chat_id: announcement.telegramChatId,
      message_id: parseInt(announcement.telegramMessageId),
      parse_mode: 'HTML'
    });
    
    console.log('[Telegram Announcements] Message updated for announcement', announcement.id);
    return { success: true };
  } catch (error: any) {
    console.error('[Telegram Announcements] Error updating notification:', error.message);
    return { success: false, error: error.message };
  }
}
