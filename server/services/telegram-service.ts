import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';
import type { Order } from '@shared/schema';
import { getRegionDisplayName, getDistrictDisplayName } from '@shared/uzbekistan-regions';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEFAULT_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '@yukbozor_uz';
const APP_URL = process.env.APP_URL || 'https://yukbozor.uz';

let bot: TelegramBot | null = null;

console.log('[Telegram] Service initialized:', {
  hasToken: !!TELEGRAM_BOT_TOKEN,
  defaultChannelId: DEFAULT_CHANNEL_ID,
  appUrl: APP_URL
});

// Get all active order channels from database, fallback to default channel if none
async function getActiveOrderChannels(): Promise<string[]> {
  const channels = await storage.getActiveTelegramChannels('orders');
  if (channels.length > 0) {
    return channels.map(c => c.chatId);
  }
  // Fallback to default channel from environment
  return [DEFAULT_CHANNEL_ID];
}

function getBotInstance(): TelegramBot | null {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log('[Telegram] Bot token not configured');
    return null;
  }
  
  if (!bot) {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
  }
  
  return bot;
}

const transportTypeNames: Record<string, string> = {
  'labo': 'Labo',
  'bongo': 'Bongo',
  'furgon': 'Furgon',
  'isuzu5': 'Isuzu 5t',
  'isuzu10': 'Isuzu 10t',
  'gruzovik': 'Gruzovik',
  'fura_tent': 'Fura (tent)',
  'fura_ref': 'Fura (ref)',
  'paravoz': 'Paravoz',
  'shalanda': 'Shalanda',
  'traller': 'Traller',
  'tonar': 'Tonar',
  'other': 'Boshqa'
};

const orderStatusNames: Record<string, string> = {
  'new': "Yangi",
  'assigned': "Buyurtma yopildi",
  'completed': "Bajarilgan",
  'cancelled': "Bekor qilingan"
};

function formatMoney(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const formatter = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatter.format(num).replace(/\s/g, ' ');
}

function formatPriceWithVat(priceWithVat: number | string): string {
  const num = typeof priceWithVat === 'string' ? parseFloat(priceWithVat) : priceWithVat;
  return formatMoney(num) + " so'm (QQS bilan)";
}

function formatPriceWithoutVat(priceWithVat: number | string, isVatPayer: boolean): string {
  const num = typeof priceWithVat === 'string' ? parseFloat(priceWithVat) : priceWithVat;
  // If customer is VAT payer, calculate price without VAT; otherwise they are equal
  const priceWithoutVat = isVatPayer ? num / 1.12 : num;
  return formatMoney(priceWithoutVat) + " so'm (QQS siz)";
}

function getRouteDescription(order: Order): string {
  const originRegion = getRegionDisplayName(order.originRegion, 'uz');
  const destRegion = getRegionDisplayName(order.destinationRegion, 'uz');
  
  const originDistricts = Array.isArray(order.originDistrict) 
    ? order.originDistrict.map(d => getDistrictDisplayName(order.originRegion, d, 'uz')).join(', ')
    : '';
  const destDistricts = Array.isArray(order.destinationDistrict)
    ? order.destinationDistrict.map(d => getDistrictDisplayName(order.destinationRegion, d, 'uz')).join(', ')
    : '';
  
  let origin = originRegion;
  if (originDistricts) {
    origin += ` (${originDistricts})`;
  }
  
  let dest = destRegion;
  if (destDistricts) {
    dest += ` (${destDistricts})`;
  }
  
  return `${origin} → ${dest}`;
}

function formatOrderMessage(order: Order, isVatPayer: boolean): string {
  const transportType = transportTypeNames[order.transportType] || order.transportType;
  const status = orderStatusNames[order.status] || order.status;
  const route = getRouteDescription(order);
  
  let message = `🚛 *YANGI BUYURTMA #${order.id}*\n\n`;
  message += `📦 *Yuk:* ${escapeMarkdown(order.title)}\n`;
  message += `📍 *Yo'nalish:* ${escapeMarkdown(route)}\n`;
  message += `🚗 *Transport turi:* ${escapeMarkdown(transportType)}\n`;
  message += `⚖️ *Vazn:* ${order.weightTons} tonna\n`;
  message += `📅 *Yuklash sanasi:* ${formatDate(order.loadDate)}\n`;
  message += `🕐 *Yuklash vaqti:* ${escapeMarkdown(order.loadingTime)}\n\n`;
  
  message += `💰 *Narx:*\n`;
  message += `   ${escapeMarkdown(formatPriceWithVat(order.priceWithVat))}\n`;
  message += `   ${escapeMarkdown(formatPriceWithoutVat(order.priceWithVat, isVatPayer))}\n\n`;
  
  if (order.notes) {
    message += `📝 *Izoh:* ${escapeMarkdown(order.notes)}\n\n`;
  }
  
  message += `📊 *Holat:* ${escapeMarkdown(status)}\n\n`;
  message += `📢 Ko'proq yuklar uchun kanalga obuna bo'ling: https://t.me/yukbozor\\_uz`;
  
  return message;
}

function formatOrderUpdateMessage(order: Order, eventType: 'status_changed' | 'offer_received'): string {
  const status = orderStatusNames[order.status] || order.status;
  const route = getRouteDescription(order);
  
  let message = `🚛 *BUYURTMA #${order.id}*\n\n`;
  message += `📦 *Yuk:* ${escapeMarkdown(order.title)}\n`;
  message += `📍 *Yo'nalish:* ${escapeMarkdown(route)}\n`;
  message += `💰 *Narx:* ${escapeMarkdown(formatPriceWithVat(order.priceWithVat))}\n\n`;
  
  if (eventType === 'status_changed') {
    message += `📊 *Yangi holat:* ${escapeMarkdown(status)}`;
  } else if (eventType === 'offer_received') {
    message += `✅ *Takliflar mavjud!*`;
  }
  
  return message;
}

function escapeMarkdown(text: string): string {
  // For Markdown (not MarkdownV2), only escape: _ * ` [
  return text.replace(/([_*`\[])/g, '\\$1');
}

function formatDate(dateStr: string): string {
  // Convert YYYY-MM-DD to DD.MM.YYYY
  if (dateStr && dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
  }
  return dateStr;
}

function getInlineKeyboard(orderId: number) {
  return {
    inline_keyboard: [
      [
        { 
          text: "📋 Batafsil ko'rish", 
          url: `${APP_URL}/carrier?tab=orders&order=${orderId}`
        }
      ]
    ]
  };
}

export async function sendOrderNotification(order: Order): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const botInstance = getBotInstance();
  
  if (!botInstance) {
    console.log('[Telegram] Bot not configured, skipping notification for order', order.id);
    return { success: false, error: 'Bot not configured' };
  }
  
  try {
    // Get customer profile to check VAT payer status
    const customerProfile = await storage.getProfileByUserId(order.customerId);
    const isVatPayer = customerProfile?.ndsPayer ?? false;
    
    const message = formatOrderMessage(order, isVatPayer);
    const keyboard = getInlineKeyboard(order.id);
    
    // Get all active order channels
    const channels = await getActiveOrderChannels();
    console.log('[Telegram] Sending order notification for order', order.id, 'to', channels.length, 'channels');
    
    let lastMessageId: number | undefined;
    let successCount = 0;
    
    for (const channelId of channels) {
      try {
        const result = await botInstance.sendMessage(channelId, message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
        
        console.log('[Telegram] Message sent to', channelId, 'messageId:', result.message_id);
        
        await storage.createTelegramNotification({
          orderId: order.id,
          chatId: channelId,
          messageId: result.message_id,
          lastStatus: order.status
        });
        
        lastMessageId = result.message_id;
        successCount++;
      } catch (channelError: any) {
        console.error('[Telegram] Error sending to channel', channelId, ':', channelError.message);
      }
    }
    
    if (successCount > 0) {
      return { success: true, messageId: lastMessageId };
    }
    return { success: false, error: 'Failed to send to any channel' };
  } catch (error: any) {
    console.error('[Telegram] Error sending notification:', error.message);
    return { success: false, error: error.message };
  }
}

export async function updateOrderNotification(order: Order, eventType: 'status_changed' | 'offer_received' | 'data_changed' = 'status_changed'): Promise<{ success: boolean; error?: string }> {
  const botInstance = getBotInstance();
  
  if (!botInstance) {
    console.log('[Telegram] Bot not configured, skipping update for order', order.id);
    return { success: false, error: 'Bot not configured' };
  }
  
  try {
    // Get customer profile to check VAT payer status
    const customerProfile = await storage.getProfileByUserId(order.customerId);
    const isVatPayer = customerProfile?.ndsPayer ?? false;
    
    // Use full message format for data changes, shortened format for status changes
    const message = eventType === 'data_changed' 
      ? formatOrderMessage(order, isVatPayer) 
      : formatOrderUpdateMessage(order, eventType);
    const keyboard = getInlineKeyboard(order.id);
    
    // Get all active order channels
    const channels = await getActiveOrderChannels();
    console.log('[Telegram] Updating notification for order', order.id, 'in', channels.length, 'channels');
    
    let successCount = 0;
    
    for (const channelId of channels) {
      try {
        const existingNotification = await storage.getTelegramNotificationByOrderId(order.id, channelId);
        
        if (!existingNotification) {
          // Send new notification to this channel
          const result = await botInstance.sendMessage(channelId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
          
          await storage.createTelegramNotification({
            orderId: order.id,
            chatId: channelId,
            messageId: result.message_id,
            lastStatus: order.status
          });
          
          console.log('[Telegram] New message sent to', channelId, 'messageId:', result.message_id);
          successCount++;
        } else {
          // Update existing notification
          await botInstance.editMessageText(message, {
            chat_id: channelId,
            message_id: existingNotification.messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
          });
          
          await storage.updateTelegramNotification(order.id, channelId, {
            lastStatus: order.status
          });
          
          console.log('[Telegram] Message updated in', channelId);
          successCount++;
        }
      } catch (channelError: any) {
        if (channelError.message?.includes('message is not modified')) {
          console.log('[Telegram] Message not modified in', channelId);
          successCount++;
        } else if (
          channelError.message?.includes('message to edit not found') ||
          channelError.message?.includes('MESSAGE_ID_INVALID') ||
          channelError.message?.includes('message can\'t be edited')
        ) {
          // Message was deleted or invalid - send new message and update/create record
          console.log('[Telegram] Original message not found in', channelId, '- sending new message');
          try {
            const result = await botInstance.sendMessage(channelId, message, {
              parse_mode: 'Markdown',
              reply_markup: keyboard
            });
            
            // Try to update the notification record with new messageId
            const updated = await storage.updateTelegramNotification(order.id, channelId, {
              messageId: result.message_id,
              lastStatus: order.status
            });
            
            // If update failed (record doesn't exist), create new record
            if (!updated) {
              await storage.createTelegramNotification({
                orderId: order.id,
                chatId: channelId,
                messageId: result.message_id,
                lastStatus: order.status
              });
              console.log('[Telegram] Created new notification record for', channelId);
            }
            
            console.log('[Telegram] New message sent to', channelId, 'messageId:', result.message_id);
            successCount++;
          } catch (resendError: any) {
            console.error('[Telegram] Error resending to channel', channelId, ':', resendError.message);
          }
        } else if (channelError.message?.includes('Too Many Requests')) {
          // Rate limited - log but count as partial success to avoid repeated retries
          console.log('[Telegram] Rate limited in', channelId, '- will retry on next update');
        } else {
          console.error('[Telegram] Error updating in channel', channelId, ':', channelError.message);
        }
      }
    }
    
    if (successCount > 0) {
      return { success: true };
    }
    return { success: false, error: 'Failed to update in any channel' };
  } catch (error: any) {
    console.error('[Telegram] Error updating notification:', error.message);
    return { success: false, error: error.message };
  }
}

export async function sendOrderCancelledNotification(order: Order): Promise<{ success: boolean; error?: string }> {
  return updateOrderNotification({ ...order, status: 'cancelled' }, 'status_changed');
}

export async function sendOrderAssignedNotification(order: Order): Promise<{ success: boolean; error?: string }> {
  return updateOrderNotification({ ...order, status: 'assigned' }, 'status_changed');
}

