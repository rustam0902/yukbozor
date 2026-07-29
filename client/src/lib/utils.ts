import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Build a direct link to a Telegram message.
 * Supergroup/channel IDs like "-1001234567890" → t.me/c/1234567890/msgId
 * Username-based chats → t.me/username/msgId
 */
export function buildTelegramMessageLink(
  chatId: string | null | undefined,
  messageId: number | null | undefined,
): string | null {
  if (!chatId || !messageId) return null;
  const numericId = chatId.replace(/^-100/, '');
  if (/^\d+$/.test(numericId)) {
    return `https://t.me/c/${numericId}/${messageId}`;
  }
  return `https://t.me/${chatId.replace(/^@/, '')}/${messageId}`;
}

/**
 * Format monetary value with space as thousand separator (Uzbek format)
 * Handles both number and string inputs from database
 */
export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  
  // Format with spaces as thousand separators, no decimals for whole numbers
  const hasDecimals = num % 1 !== 0;
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(num).replace(/\s/g, ' '); // Ensure regular spaces
}
