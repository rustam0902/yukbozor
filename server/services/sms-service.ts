import { eq, and, gt, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import { db } from "../db";

const SMS_API_URL = process.env.SMS_API_URL;
const SMS_API_LOGIN = process.env.SMS_API_LOGIN;
const SMS_API_PASSWORD = process.env.SMS_API_PASSWORD;
const SMS_ORIGINATOR = process.env.SMS_ORIGINATOR || 'Yukbozor';

console.log('[SMS] Service initialized, configured:', {
  hasApiUrl: !!SMS_API_URL,
  hasLogin: !!SMS_API_LOGIN,
  hasPassword: !!SMS_API_PASSWORD,
  originator: SMS_ORIGINATOR
});

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_FAILED_CODE_REQUESTS = 3; // After 3 failed code requests, lockout
const LOCKOUT_DURATION_MINUTES = 15; // 15-minute lockout after max failed requests

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  if (!cleaned.startsWith('998')) {
    if (cleaned.length === 9) {
      cleaned = '998' + cleaned;
    }
  }
  return cleaned;
}

function generateMessageId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 6);
  return `ybz${timestamp}${randomPart}`.substring(0, 20);
}

export async function sendSms(phone: string, text: string): Promise<{ success: boolean; error?: string }> {
  console.log('[SMS] sendSms called for phone:', phone);
  
  if (!SMS_API_URL || !SMS_API_LOGIN || !SMS_API_PASSWORD) {
    console.log('[SMS] Credentials not configured, SMS sending disabled');
    console.log(`[SMS] Would send to ${phone}: ${text}`);
    return { success: true };
  }
  
  console.log('[SMS] Credentials configured, attempting to send via API');

  const normalizedPhone = normalizePhone(phone);
  const messageId = generateMessageId();
  
  const requestBody = {
    messages: [
      {
        recipient: normalizedPhone,
        "message-id": messageId,
        sms: {
          originator: SMS_ORIGINATOR,
          content: {
            text: text
          }
        }
      }
    ]
  };

  try {
    const authHeader = Buffer.from(`${SMS_API_LOGIN}:${SMS_API_PASSWORD}`).toString('base64');
    // Don't append /send if the URL already ends with it
    const apiUrl = SMS_API_URL!.endsWith('/send') ? SMS_API_URL! : `${SMS_API_URL}/send`;
    
    console.log('[SMS] Sending request to:', apiUrl);
    console.log('[SMS] Auth login:', SMS_API_LOGIN);
    console.log('[SMS] Auth header (first 20 chars):', `Basic ${authHeader.substring(0, 20)}...`);
    console.log('[SMS] Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Authorization': `Basic ${authHeader}`
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    console.log('[SMS] API Response status:', response.status);
    console.log('[SMS] API Response body:', responseText);

    if (!response.ok) {
      console.error('[SMS] API Error:', response.status, responseText);
      // Return clean user-friendly message, not technical details
      return { success: false, error: 'SMS_SEND_FAILED' };
    }

    console.log(`[SMS] Successfully sent to ${normalizedPhone}`);
    return { success: true };
  } catch (error) {
    console.error('[SMS] Send error:', error);
    // Return clean user-friendly message, not technical details
    return { success: false, error: 'SMS_SEND_FAILED' };
  }
}

export async function sendWelcomeSms(phone: string): Promise<{ success: boolean; error?: string }> {
  const message = `Siz Yukbozor.uz raqamli platformasida muvaffaqiyatli ro'yxatdan o'tdingiz. Vy uspeshno zaregistrirovalis' na cifrovoy platforme Yukbozor.uz`;
  return sendSms(phone, message);
}

export async function sendOtp(
  phone: string, 
  purpose: 'registration' | 'login' | 'phone_change' | 'password_change' | 'profile_edit' | 'contract_sign' | 'withdrawal',
  language: 'ru' | 'uz' = 'ru'
): Promise<{ success: boolean; error?: string; cooldownRemaining?: number; lockoutRemaining?: number }> {
  const normalizedPhone = normalizePhone(phone);
  
  // Check for lockout: count unverified code requests in last 10 minutes
  // If user sent 3 codes that weren't verified, they must wait 10 minutes
  const lockoutWindow = new Date(Date.now() - LOCKOUT_DURATION_MINUTES * 60 * 1000);
  const unverifiedCodeRequests = await db.select()
    .from(schema.smsVerifications)
    .where(
      and(
        eq(schema.smsVerifications.phone, normalizedPhone),
        eq(schema.smsVerifications.purpose, purpose),
        eq(schema.smsVerifications.verified, false),
        gt(schema.smsVerifications.createdAt, lockoutWindow)
      )
    )
    .orderBy(desc(schema.smsVerifications.createdAt));

  if (unverifiedCodeRequests.length >= MAX_FAILED_CODE_REQUESTS) {
    // Find the oldest unverified request in this window to calculate remaining lockout time
    const oldestUnverified = unverifiedCodeRequests[unverifiedCodeRequests.length - 1];
    const lockoutEndTime = new Date(oldestUnverified.createdAt).getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000;
    const lockoutRemaining = Math.ceil((lockoutEndTime - Date.now()) / 1000);
    
    if (lockoutRemaining > 0) {
      const minutesRemaining = Math.ceil(lockoutRemaining / 60);
      const errorMsg = language === 'uz'
        ? `Juda ko'p muvaffaqiyatsiz urinishlar. ${minutesRemaining} daqiqa kuting.`
        : `Слишком много неудачных попыток. Подождите ${minutesRemaining} мин.`;
      return { 
        success: false, 
        error: errorMsg,
        lockoutRemaining 
      };
    }
  }
  
  const recentVerification = await db.select()
    .from(schema.smsVerifications)
    .where(
      and(
        eq(schema.smsVerifications.phone, normalizedPhone),
        eq(schema.smsVerifications.purpose, purpose),
        gt(schema.smsVerifications.createdAt, new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000))
      )
    )
    .orderBy(desc(schema.smsVerifications.createdAt))
    .limit(1);

  if (recentVerification.length > 0) {
    const timeSinceCreation = (Date.now() - new Date(recentVerification[0].createdAt).getTime()) / 1000;
    const cooldownRemaining = Math.ceil(RESEND_COOLDOWN_SECONDS - timeSinceCreation);
    
    if (cooldownRemaining > 0) {
      const errorMsg = language === 'uz'
        ? `Qayta yuborishdan oldin ${cooldownRemaining} soniya kuting.`
        : `Подождите ${cooldownRemaining} сек.`;
      return { 
        success: false, 
        error: errorMsg,
        cooldownRemaining 
      };
    }
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(schema.smsVerifications).values({
    phone: normalizedPhone,
    code,
    purpose,
    attempts: 0,
    verified: false,
    expiresAt
  });

  // Bilingual message templates (Uzbek first, then Russian)
  const messages = {
    registration: `Yukbozor.uz - Sizning ro'yhatdan o'tish uchun kodingiz: ${code}. Kod podtverzhdeniya dlya registracii: ${code}`,
    login: `Yukbozor.uz - Shaxsiy kabinetga kirish uchun tasdiqlash kodi: ${code}. Kod podtverzhdeniya dlya vhoda v personal'nyy kabinet: ${code}`,
    phone_change: `Yukbozor.uz - Telefon raqamingizni o'zgartirish uchun kod: ${code}. Kod dlya izmeneniya telefonnogo nomera: ${code}`,
    password_change: `Yukbozor.uz - Shaxsiy kabinetga kirish parolingizni o'zgartirish uchun kod: ${code}. Kod dlya izmeneniya parolya vhoda v lichnyy kabinet: ${code}`,
    profile_edit: `Yukbozor.uz - Profilni tahrirlash uchun tasdiqlash kodi: ${code}. Kod dlya redaktirovaniya profilya: ${code}`,
    contract_sign: `Yukbozor.uz - Shartnomani imzolash uchun tasdiqlash kodi: ${code}. Kod dlya podpisaniya dogovora: ${code}`,
    withdrawal: `Yukbozor.uz - Mablag' yechib olish uchun tasdiqlash kodi: ${code}. Kod dlya podtverzhdeniya vyvoda sredstv: ${code}`
  };

  const message = messages[purpose];
  const result = await sendSms(normalizedPhone, message);
  
  // Translate internal error code to user-friendly message
  if (!result.success && result.error === 'SMS_SEND_FAILED') {
    const errorMsg = language === 'uz'
      ? 'SMS yuborishda xatolik yuz berdi. Qayta urinib ko\'ring.'
      : 'Ошибка отправки SMS. Попробуйте снова.';
    return { success: false, error: errorMsg };
  }
  
  return result;
}

export async function verifyOtp(
  phone: string,
  code: string,
  purpose: 'registration' | 'login' | 'phone_change' | 'password_change' | 'profile_edit' | 'contract_sign' | 'withdrawal',
  language: 'ru' | 'uz' = 'ru'
): Promise<{ success: boolean; error?: string; attemptsRemaining?: number }> {
  const normalizedPhone = normalizePhone(phone);
  
  const verification = await db.select()
    .from(schema.smsVerifications)
    .where(
      and(
        eq(schema.smsVerifications.phone, normalizedPhone),
        eq(schema.smsVerifications.purpose, purpose),
        eq(schema.smsVerifications.verified, false),
        gt(schema.smsVerifications.expiresAt, new Date())
      )
    )
    .orderBy(desc(schema.smsVerifications.createdAt))
    .limit(1);

  if (verification.length === 0) {
    const errorMsg = language === 'uz'
      ? 'Kod topilmadi yoki muddati tugagan. Yangi kod so\'rang.'
      : 'Код не найден или истёк. Запросите новый.';
    return { 
      success: false, 
      error: errorMsg
    };
  }

  const verificationRecord = verification[0];

  if (verificationRecord.attempts >= MAX_ATTEMPTS) {
    const errorMsg = language === 'uz'
      ? 'Maksimal urinishlar soni oshib ketdi. Yangi kod so\'rang.'
      : 'Превышено макс. количество попыток. Запросите новый код.';
    return { 
      success: false, 
      error: errorMsg
    };
  }

  await db.update(schema.smsVerifications)
    .set({ attempts: verificationRecord.attempts + 1 })
    .where(eq(schema.smsVerifications.id, verificationRecord.id));

  if (verificationRecord.code !== code) {
    const remainingAttempts = MAX_ATTEMPTS - verificationRecord.attempts - 1;
    const errorMsg = language === 'uz'
      ? `Noto'g'ri kod. Qolgan urinishlar: ${remainingAttempts}`
      : `Неверный код. Осталось попыток: ${remainingAttempts}`;
    return { 
      success: false, 
      error: errorMsg,
      attemptsRemaining: remainingAttempts
    };
  }

  await db.update(schema.smsVerifications)
    .set({ verified: true })
    .where(eq(schema.smsVerifications.id, verificationRecord.id));

  return { success: true };
}

export async function isPhoneVerified(
  phone: string,
  purpose: 'registration' | 'login' | 'phone_change' | 'password_change' | 'profile_edit' | 'contract_sign' | 'withdrawal'
): Promise<boolean> {
  const normalizedPhone = normalizePhone(phone);
  
  const verification = await db.select()
    .from(schema.smsVerifications)
    .where(
      and(
        eq(schema.smsVerifications.phone, normalizedPhone),
        eq(schema.smsVerifications.purpose, purpose),
        eq(schema.smsVerifications.verified, true),
        gt(schema.smsVerifications.expiresAt, new Date())
      )
    )
    .orderBy(desc(schema.smsVerifications.createdAt))
    .limit(1);

  return verification.length > 0;
}

export function isSmsConfigured(): boolean {
  return !!(SMS_API_URL && SMS_API_LOGIN && SMS_API_PASSWORD);
}
