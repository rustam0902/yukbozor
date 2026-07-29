import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import WebSocket, { WebSocketServer } from 'ws';
import { randomBytes } from "crypto";
import path from "path";
import fs from "fs";
import multer from "multer";
import serveStatic from "serve-static";
import { storage } from "./storage";
import { db } from "./db";
import * as schema from "@shared/schema";
import { sql, and, eq, inArray, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { insertUserSchema, insertOrderSchema, insertOfferSchema, insertRatingSchema, insertDepositTransactionSchema, type Order } from "@shared/schema";
import { z } from "zod";
import { generateContractContent, generateDocumentHash } from "./services/contract-generator";
import { generateContractPdf, getContractPdfFilename } from "./services/pdf-contract-generator";
import { generateContractDocx, getContractFilename } from "./services/docx-contract-generator";
import { sendOtp, verifyOtp, isPhoneVerified, isSmsConfigured, sendWelcomeSms, sendSms } from "./services/sms-service";
import { sendOrderNotification, updateOrderNotification } from "./services/telegram-service";
import { sendAnnouncementNotification, updateAnnouncementNotification } from "./services/telegram-announcement-service";
import { startAuthListener, getBotUsername } from "./services/telegram-auth-service";
import { startOrderExpiryProcessor } from "./orderExpiryProcessor";
import { startPhoneChangeProcessor } from "./phoneChangeProcessor";
import { startTelegramSourceListener } from "./services/telegram-source-listener";
import { registerPushToken, unregisterPushToken, notifyNewAnnouncement, getPushMaxPerHour, setPushMaxPerHour, getBotPostToChannels, setBotPostToChannels } from "./services/push-notification-service";
import { startBroadcastScheduler } from "./services/broadcast-scheduler";
import { startPromoScheduler, peekNextPromoForChannel, sendTestPromoToChannel } from "./services/promo-scheduler";
import { startBotAnnouncementCloser } from "./services/bot-announcement-closer";
import { startChatCleanupProcessor } from "./chatCleanupProcessor";
import { eimzoService } from "./eimzo";
import OpenAI from "openai";

// Security: JWT secret must be provided via environment variable
if (!process.env.SESSION_SECRET) {
  throw new Error('CRITICAL: SESSION_SECRET environment variable is required for JWT signing');
}
const JWT_SECRET: string = process.env.SESSION_SECRET;

// Rate limiting for order creation (5 orders per minute per user)
const ORDER_RATE_LIMIT = 5;
const ORDER_RATE_WINDOW_MS = 60 * 1000; // 1 minute
const orderCreationRateLimit = new Map<number, { count: number; resetTime: number }>();

function checkOrderRateLimit(userId: number): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const userLimit = orderCreationRateLimit.get(userId);
  
  if (!userLimit || now >= userLimit.resetTime) {
    // Reset window
    orderCreationRateLimit.set(userId, { count: 1, resetTime: now + ORDER_RATE_WINDOW_MS });
    return { allowed: true, remaining: ORDER_RATE_LIMIT - 1, resetIn: ORDER_RATE_WINDOW_MS };
  }
  
  if (userLimit.count >= ORDER_RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetIn: userLimit.resetTime - now };
  }
  
  userLimit.count++;
  return { allowed: true, remaining: ORDER_RATE_LIMIT - userLimit.count, resetIn: userLimit.resetTime - now };
}

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of orderCreationRateLimit.entries()) {
    if (now >= data.resetTime) {
      orderCreationRateLimit.delete(userId);
    }
  }
}, 5 * 60 * 1000);

/**
 * Sanitize text input to prevent XSS and remove HTML/links
 * - Decodes HTML entities first
 * - Removes all HTML tags
 * - Removes URLs (http/https links)
 * - Removes script content
 * - Preserves plain text with trimmed whitespace
 */
function sanitizeTextInput(text: string | null | undefined): string | null {
  if (!text) return null;
  
  // Step 1: Decode HTML entities first (so we can strip the resulting tags)
  let decoded = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Step 2: Remove dangerous content after decoding
  let sanitized = decoded
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags and their content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove all HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove URLs (http, https, ftp)
    .replace(/(?:https?|ftp):\/\/[^\s<>"{}|\\^`\[\]]+/gi, '')
    // Remove www. links without protocol
    .replace(/www\.[^\s<>"{}|\\^`\[\]]+/gi, '')
    // Remove javascript: and data: URLs
    .replace(/(?:javascript|data):[^\s]*/gi, '')
    // Normalize multiple spaces/newlines
    .replace(/\s+/g, ' ')
    .trim();
  
  return sanitized || null;
}

// Admin phone number - only this phone can have admin role
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+998939698899';

/**
 * Security: Sanitize user roles before creating JWT token
 * - Only ADMIN_PHONE can have admin role
 * - Admin role is exclusive (no other roles)
 * - Non-admin users cannot have admin role
 */
function sanitizeRolesForToken(phone: string, roles: string[]): string[] {
  const normalizedPhone = normalizePhone(phone);
  const normalizedAdminPhone = normalizePhone(ADMIN_PHONE);
  
  if (normalizedPhone === normalizedAdminPhone) {
    // Admin phone: ALWAYS return admin role (exclusive)
    // This ensures admin gets admin role even if DB doesn't have it yet
    return ['admin'];
  } else {
    // Non-admin phone: strip admin role if present (security measure)
    return roles.filter(r => r !== 'admin');
  }
}

/**
 * Convert numeric/string values from Drizzle to number
 * Drizzle returns numeric columns as strings for precision
 */
function toNum(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return parseFloat(value) || 0;
}

/**
 * Get correct defaultRole based on sanitized roles
 * Admin users should always have defaultRole = 'admin'
 */
function getDefaultRoleForSanitizedRoles(
  sanitizedRoles: string[], 
  originalDefaultRole: string
): 'customer' | 'carrier' | 'partner' | 'admin' {
  // If user is admin (only has admin role), defaultRole must be admin
  if (sanitizedRoles.length === 1 && sanitizedRoles[0] === 'admin') {
    return 'admin';
  }
  // Otherwise use original defaultRole or first role
  return (originalDefaultRole as any) || sanitizedRoles[0] || 'customer';
}

interface AuthRequest extends Request {
  user?: {
    id: number;
    roles: string[];
  };
}

// Middleware to verify JWT token
const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '') || (req.query.token as string | undefined);
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Defensive: normalize legacy tokens (role → roles)
    const roles = Array.isArray(decoded.roles) 
      ? decoded.roles 
      : (decoded.role ? [decoded.role] : ['customer']);
    
    req.user = {
      id: decoded.id,
      roles: roles
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Role-based access control middleware
const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.roles.some(userRole => roles.includes(userRole))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};

// Carrier-specific authorization: checks both role and userType from database
const authorizeCarrier = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Fetch fresh user data from database to check both role and userType
  const user = await storage.getUserById(req.user.id);
  if (!user) {
    return res.status(403).json({ error: 'User not found' });
  }
  
  // Check if user has carrier role (from database, not JWT)
  if (!user.roles.includes('carrier')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Check if user is legal entity or IP (not individual)
  if (user.userType === 'individual') {
    return res.status(403).json({ error: 'Carriers must be legal entities or individual entrepreneurs' });
  }
  
  next();
};

// Normalize phone number: remove all non-digit characters except leading +
function normalizePhone(phone: string): string {
  if (!phone) return phone;
  // Keep only digits and leading +
  const cleaned = phone.replace(/[^\d+]/g, '');
  // Ensure it starts with + if it has 998 prefix
  if (cleaned.startsWith('998')) {
    return '+' + cleaned;
  }
  return cleaned;
}

// ── File Upload Setup ─────────────────────────────────────────────────────────
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_UPLOAD_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.jpg',
  'image/heif': '.jpg',
  'application/octet-stream': '.jpg', // some Android cameras send raw bytes
};

// Use memory storage so we can validate magic bytes before writing to disk
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10 MB, max 5 files
  fileFilter: (_req, file, cb) => {
    // First line of defense: check the declared MIME type
    if (ALLOWED_UPLOAD_MIME[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * Validate buffer by inspecting magic bytes (file signature).
 * Returns the safe extension (.jpg, .png, or .webp) or null if the buffer is not a recognised image.
 * This check is independent of any client-supplied MIME type or filename extension.
 */
function validateImageBuffer(buf: Buffer): '.jpg' | '.png' | '.webp' | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return '.jpg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
    buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A
  ) return '.png';
  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50 ("RIFF....WEBP")
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return '.webp';
  // HEIC/HEIF: ISO Base Media File Format — ftyp box at offset 4
  // "ftyp" = 66 74 79 70
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return '.jpg';
  return null;
}

/** Write a buffer to a new file under uploads/<userId>/<random><ext> and return the public URL path */
function writeUploadFile(userId: number | string, buf: Buffer, ext: string): string {
  const userDir = path.join(UPLOADS_DIR, String(userId));
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
  const filename = `${randomBytes(12).toString('hex')}${ext}`;
  const filePath = path.join(userDir, filename);
  fs.writeFileSync(filePath, buf);
  return `/uploads/${String(userId)}/${filename}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(cookieParser());
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
  });

  // Serve uploaded files as static assets
  const serveUploads = serveStatic(UPLOADS_DIR);
  app.use(
    '/uploads',
    (req: Request, res: Response, next: NextFunction) => {
      const requestedPath = path.normalize(req.path);
      if (requestedPath.includes('..')) {
        return res.status(400).json({ error: 'Invalid path' });
      }
      next();
    },
    (req: Request, res: Response, next: NextFunction) => {
      serveUploads(req, res, next);
    },
  );

  // ── File Upload Endpoint ────────────────────────────────────────────────────
  // POST /api/upload — upload up to 5 cargo images (auth required)
  // Files are validated via magic bytes before being written to disk.
  app.post('/api/upload', authenticate, (req: AuthRequest, res: Response, next: NextFunction) => {
    uploadMiddleware.array('photos', 5)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Upload failed' });
      }
      next();
    });
  }, (req: AuthRequest, res: Response) => {
    try {
      const files = req.files as (Express.Multer.File & { buffer: Buffer })[] | undefined;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const userId = req.user!.id;
      const urls: string[] = [];

      for (const file of files) {
        const buf = file.buffer;
        // Validate magic bytes — do not trust declared Content-Type
        const ext = validateImageBuffer(buf);
        if (!ext) {
          return res.status(400).json({ error: `File "${file.originalname}" is not a valid JPEG or PNG image` });
        }
        const url = writeUploadFile(userId, buf, ext);
        urls.push(url);
      }

      res.json({ urls });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Upload failed' });
    }
  });

  // Authentication routes
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { 
        phone: rawPhone, password, displayName, defaultRole, userType, referralCode, 
        lastName, firstName, middleName, language,
        // E-IMZO certificate data for legal entities and IPs
        eimzoCertSerial, eimzoCertIssuer, eimzoCertValidFrom, eimzoCertValidTo,
        eimzoCertCn, eimzoCertO, eimzoCertTin, eimzoCertPinfl,
        // Offer acceptance signature (PKCS#7)
        offerAcceptanceSignature, offerAcceptanceHash
      } = req.body;
      
      // Normalize phone number (remove formatting)
      // tg_ prefix phones are Telegram-only registrations — keep as-is
      const isTelegramPhone = typeof rawPhone === 'string' && rawPhone.startsWith('tg_');
      const phone = isTelegramPhone ? rawPhone : normalizePhone(rawPhone);
      
      const validatedUserType = userType || 'individual';
      
      // Business rule: Physical persons (individual) cannot be carriers
      // So they only get customer and partner roles
      const allRoles: ('customer' | 'carrier' | 'partner')[] = validatedUserType === 'individual'
        ? ['customer', 'partner']
        : ['customer', 'carrier', 'partner'];
      
      // Validate defaultRole
      const allowedDefaultRoles = ['customer', 'carrier', 'partner'];
      let validatedDefaultRole: 'customer' | 'carrier' | 'partner' = allowedDefaultRoles.includes(defaultRole) 
        ? defaultRole 
        : 'customer';
      
      // If user is individual and tries to set carrier as default role, change to customer
      if (validatedUserType === 'individual' && validatedDefaultRole === 'carrier') {
        validatedDefaultRole = 'customer';
      }
      
      // For Telegram-only registrations, skip phone uniqueness check
      if (!isTelegramPhone) {
        const existingUser = await storage.getUserByPhone(phone);
        if (existingUser) {
          return res.status(400).json({ error: 'Phone number already registered' });
        }
      }

      // Check INN/PINFL uniqueness (only if provided — fields are now optional at registration)
      if (validatedUserType === 'individual' || validatedUserType === 'ip') {
        // PINFL is optional at registration; check uniqueness only if provided
        if (req.body.pinfl && req.body.pinfl.trim() !== '') {
          const existingPinfl = await storage.getUserByPinflAndType(req.body.pinfl, validatedUserType);
          if (existingPinfl) {
            const errorMsg = language === 'uz'
              ? 'Bunday JSHSHIR bilan foydalanuvchi allaqachon ro\'yxatdan o\'tgan'
              : 'С таким ПИНФЛ пользователь уже зарегистрирован';
            return res.status(400).json({ error: errorMsg });
          }
        }
      } else if (validatedUserType === 'legal') {
        // INN is optional at registration; check uniqueness only if provided
        if (req.body.inn && req.body.inn.trim() !== '') {
          const existingInn = await storage.getUserByInn(req.body.inn);
          if (existingInn) {
            const errorMsg = language === 'uz' 
              ? 'Bunday STIR bilan foydalanuvchi allaqachon ro\'yxatdan o\'tgan'
              : 'С таким ИНН пользователь уже зарегистрирован';
            return res.status(400).json({ error: errorMsg });
          }
        }
      }
      
      // E-IMZO certificate is optional — users can add it later via profile settings

      // Validate referral code if provided
      let referringPartner = null;
      const trimmedReferralCode = referralCode?.trim();
      if (trimmedReferralCode) {
        referringPartner = await storage.getPartnerByReferralCode(trimmedReferralCode);
        if (!referringPartner) {
          return res.status(400).json({ error: 'Invalid referral code' });
        }
        
        // Check that user is not using their own referral code
        const partnerUser = await storage.getUserById(referringPartner.userId);
        if (partnerUser && partnerUser.phone === phone) {
          return res.status(400).json({ error: 'Cannot use your own referral code' });
        }
      }

      const effectivePassword = (password && password.trim()) ? password : randomBytes(16).toString('hex');
      const passwordHash = await bcrypt.hash(effectivePassword, 10);
      
      // ATOMIC registration: all operations in single transaction
      const user = await storage.registerUserWithReferral(
        {
          phone,
          passwordHash,
          displayName,
          lastName: lastName || null,
          firstName: firstName || null,
          middleName: middleName || null,
          roles: allRoles,
          defaultRole: validatedDefaultRole,
          userType: validatedUserType,
          email: req.body.email,
          referredByPartnerId: referringPartner?.id,
        },
        {
          companyName: req.body.companyName,
          inn: req.body.inn,
          pinfl: req.body.pinfl,
          passportSeries: req.body.passportSeries,
          passportNumber: req.body.passportNumber,
          bankAccount: req.body.bankAccount,
          bankName: req.body.bankName,
          bankCode: req.body.bankCode,
          ndsPayer: req.body.ndsPayer,
          registrationCodeNds: req.body.registrationCodeNds,
          // E-IMZO certificate data for legal entities and IPs
          eimzoCertSerial: eimzoCertSerial || null,
          eimzoCertIssuer: eimzoCertIssuer || null,
          eimzoCertValidFrom: eimzoCertValidFrom ? new Date(eimzoCertValidFrom) : null,
          eimzoCertValidTo: eimzoCertValidTo ? new Date(eimzoCertValidTo) : null,
          eimzoCertCn: eimzoCertCn || null,
          eimzoCertO: eimzoCertO || null,
          eimzoCertTin: eimzoCertTin || null,
          eimzoCertPinfl: eimzoCertPinfl || null,
          // Offer acceptance - set for all users during registration:
          // - Legal entities and IPs: E-IMZO certificate binding
          // - Individuals: SMS verification during registration constitutes offer acceptance
          // All users who complete registration have accepted the Public Offer
          offerAcceptedAt: new Date(),
          offerAcceptanceSignature: offerAcceptanceSignature || null,
          offerAcceptanceHash: offerAcceptanceHash || (eimzoCertSerial ? `EIMZO_CERT_${eimzoCertSerial}` : isTelegramPhone ? `TELEGRAM_${req.body.telegramId || 'AUTH'}` : 'SMS_VERIFIED'),
          offerVersion: '1.0',
        },
        referringPartner?.id
      );

      // Security: sanitize roles before creating token
      const sanitizedRoles = sanitizeRolesForToken(user.phone, user.roles);
      const token = jwt.sign({ id: user.id, roles: sanitizedRoles }, JWT_SECRET, { expiresIn: '7d' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'strict',
      });

      // Send welcome SMS after successful registration (skip for Telegram-only accounts)
      if (!isTelegramPhone) {
        sendWelcomeSms(phone).catch(err => {
          console.error('[SMS] Failed to send welcome SMS:', err);
        });
      }

      const effectiveDefaultRole = getDefaultRoleForSanitizedRoles(sanitizedRoles, user.defaultRole);

      // If registering via Telegram, link the telegramId immediately
      if (req.body.telegramId) {
        try {
          await storage.updateUser(user.id, { telegramId: req.body.telegramId });
        } catch (e) {
          console.error('[Register] Failed to link telegramId:', e);
        }
      }

      res.json({ user: { id: user.id, phone: user.phone, displayName: user.displayName, roles: sanitizedRoles, defaultRole: effectiveDefaultRole, userType: user.userType, email: user.email }, token });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // ── Telegram Auth Routes ──────────────────────────────────────────────────

  // Init a new Telegram auth session (returns token + bot username)
  app.post('/api/auth/telegram/init', async (req: Request, res: Response) => {
    try {
      const token = randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await storage.createTelegramAuthRequest(token, expiresAt);
      const username = await getBotUsername();
      res.json({ token, botUsername: username });
    } catch (error) {
      console.error('Telegram auth init error:', error);
      res.status(500).json({ error: 'Failed to init telegram auth' });
    }
  });

  // Poll the status of a Telegram auth session
  app.get('/api/auth/telegram/poll/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const authRequest = await storage.getTelegramAuthRequest(token);

      if (!authRequest) {
        return res.status(404).json({ status: 'not_found' });
      }

      if (authRequest.status === 'pending' && new Date() > authRequest.expiresAt) {
        await storage.updateTelegramAuthRequest(token, { status: 'expired' });
        return res.json({ status: 'expired' });
      }

      if (authRequest.status === 'pending') {
        return res.json({ status: 'pending' });
      }

      if (authRequest.status === 'expired') {
        return res.json({ status: 'expired' });
      }

      if (authRequest.status === 'not_registered') {
        return res.json({
          status: 'not_registered',
          telegramData: {
            telegramId: authRequest.telegramId,
            telegramUsername: authRequest.telegramUsername,
            telegramFirstName: authRequest.telegramFirstName,
            telegramLastName: authRequest.telegramLastName,
          },
        });
      }

      if (authRequest.status === 'completed' && authRequest.userId) {
        const user = await storage.getUserById(authRequest.userId);
        const profile = user ? await storage.getProfileByUserId(user.id) : null;

        if (!user) {
          return res.status(404).json({ status: 'not_found' });
        }

        const sanitizedRoles = sanitizeRolesForToken(user.phone, user.roles);
        const jwtToken = jwt.sign({ id: user.id, roles: sanitizedRoles }, JWT_SECRET, { expiresIn: '7d' });

        // Clean up the used auth request
        await storage.updateTelegramAuthRequest(token, { status: 'expired' });

        return res.json({
          status: 'completed',
          token: jwtToken,
          user: {
            id: user.id,
            phone: user.phone,
            displayName: user.displayName,
            roles: sanitizedRoles,
            defaultRole: user.defaultRole,
            userType: user.userType,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            middleName: user.middleName,
            ndsPayer: profile?.ndsPayer,
            profile,
          },
        });
      }

      return res.json({ status: authRequest.status });
    } catch (error) {
      console.error('Telegram auth poll error:', error);
      res.status(500).json({ error: 'Failed to poll telegram auth' });
    }
  });

  // Link Telegram ID to an existing authenticated account
  app.post('/api/auth/telegram/link', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { telegramId } = req.body;
      if (!telegramId) {
        return res.status(400).json({ error: 'telegramId is required' });
      }

      // Check if this telegramId is already used by another account
      const existing = await storage.getUserByTelegramId(telegramId);
      if (existing && existing.id !== req.user!.id) {
        return res.status(409).json({ error: 'This Telegram account is already linked to another user' });
      }

      await storage.updateUser(req.user!.id, { telegramId });
      res.json({ success: true });
    } catch (error) {
      console.error('Telegram link error:', error);
      res.status(500).json({ error: 'Failed to link telegram' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { phone: rawPhone, password } = req.body;
      
      // Normalize phone number (remove formatting)
      const phone = normalizePhone(rawPhone);
      console.log(`[LOGIN] Attempt for phone: ${phone}`);
      
      const user = await storage.getUserByPhone(phone);
      if (!user) {
        console.log(`[LOGIN] User not found for phone: ${phone}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      console.log(`[LOGIN] User found: id=${user.id}, phone=${user.phone}`);

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      console.log(`[LOGIN] Password valid: ${validPassword}`);
      if (!validPassword) {
        console.log(`[LOGIN] Invalid password for user: ${user.id}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // E-IMZO certificate check removed — users can log in without valid certificate
      // Certificate can be bound/updated later in Profile settings

      // Defensive: ensure users have all required roles based on userType
      let needsUpdate = false;
      const isLegalOrIp = user.userType && user.userType !== 'individual';
      const requiredRoles: ('customer' | 'carrier' | 'partner')[] = isLegalOrIp 
        ? ['customer', 'carrier', 'partner'] 
        : ['customer', 'partner'];
      
      // Initialize roles array if empty or invalid
      if (!Array.isArray(user.roles) || user.roles.length === 0) {
        user.roles = requiredRoles as any;
        needsUpdate = true;
      } else {
        // Add ALL missing required roles (preserving existing custom roles like 'admin')
        const missingRoles = requiredRoles.filter(role => !user.roles.includes(role as any));
        if (missingRoles.length > 0) {
          user.roles = [...user.roles, ...missingRoles] as any;
          needsUpdate = true;
          console.log(`[LOGIN] Adding missing roles for user ${user.id}: ${missingRoles.join(', ')}`);
        }
      }
      
      // Ensure defaultRole exists
      if (!user.defaultRole) {
        user.defaultRole = user.roles[0] || 'customer';
        needsUpdate = true;
      }
      
      // Persist changes to database if needed
      if (needsUpdate) {
        console.log(`[LOGIN] Persisting normalized roles for user ${user.id}: ${JSON.stringify(user.roles)}`);
        const updated = await storage.updateUser(user.id, { 
          roles: user.roles,
          defaultRole: user.defaultRole 
        });
        if (updated) {
          user.roles = updated.roles;
          user.defaultRole = updated.defaultRole;
        }
      }

      // Security: sanitize roles before creating token
      const sanitizedRoles = sanitizeRolesForToken(user.phone, user.roles);
      const token = jwt.sign({ id: user.id, roles: sanitizedRoles }, JWT_SECRET, { expiresIn: '7d' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'strict',
      });

      const loginProfile = await storage.getProfileByUserId(user.id);
      const effectiveDefaultRole = getDefaultRoleForSanitizedRoles(sanitizedRoles, user.defaultRole);
      res.json({ user: { id: user.id, phone: user.phone, displayName: user.displayName, roles: sanitizedRoles, defaultRole: effectiveDefaultRole, userType: user.userType, email: user.email, ndsPayer: loginProfile?.ndsPayer ?? false }, token });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  // Change password endpoint
  app.post('/api/auth/change-password', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword, language = 'ru' } = req.body;
      
      if (!currentPassword || !newPassword) {
        const errorMsg = language === 'uz'
          ? 'Joriy va yangi parol kiritilishi shart'
          : 'Необходимо указать текущий и новый пароль';
        return res.status(400).json({ error: errorMsg });
      }
      
      if (newPassword.length < 6) {
        const errorMsg = language === 'uz'
          ? 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak'
          : 'Новый пароль должен содержать минимум 6 символов';
        return res.status(400).json({ error: errorMsg });
      }
      
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!validPassword) {
        const errorMsg = language === 'uz'
          ? 'Joriy parol noto\'g\'ri'
          : 'Неверный текущий пароль';
        return res.status(401).json({ error: errorMsg });
      }
      
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(user.id, { passwordHash: newPasswordHash });
      
      const successMsg = language === 'uz'
        ? 'Parol muvaffaqiyatli o\'zgartirildi'
        : 'Пароль успешно изменён';
      
      res.json({ success: true, message: successMsg });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

  // SMS verification routes
  app.post('/api/sms/send-otp', async (req: Request, res: Response) => {
    console.log('[SMS Route] send-otp called with body:', JSON.stringify(req.body));
    const language = req.body?.language || 'ru';
    try {
      const { phone: rawPhone, purpose } = req.body;
      
      if (!rawPhone || !purpose) {
        const errorMsg = language === 'uz'
          ? 'Telefon raqami kiritilishi shart'
          : 'Необходимо указать телефон';
        return res.status(400).json({ error: errorMsg });
      }
      
      if (!['registration', 'login', 'phone_change', 'password_change'].includes(purpose)) {
        const errorMsg = language === 'uz'
          ? 'Noto\'g\'ri so\'rov turi'
          : 'Неверный тип запроса';
        return res.status(400).json({ error: errorMsg });
      }
      
      const phone = normalizePhone(rawPhone);
      
      // For password_change, check that phone exists and user is authenticated
      if (purpose === 'password_change') {
        const existingUser = await storage.getUserByPhone(phone);
        if (!existingUser) {
          const errorMsg = language === 'uz' 
            ? 'Bu telefon raqami ro\'yxatdan o\'tmagan'
            : 'Этот номер телефона не зарегистрирован';
          return res.status(400).json({ error: errorMsg });
        }
      }
      
      // For registration, check that phone is not already registered
      if (purpose === 'registration') {
        const existingUser = await storage.getUserByPhone(phone);
        if (existingUser) {
          const errorMsg = language === 'uz' 
            ? 'Bu telefon raqami allaqachon ro\'yxatdan o\'tgan'
            : 'Этот номер телефона уже зарегистрирован';
          return res.status(400).json({ error: errorMsg });
        }
      }
      
      // For login, check that phone exists
      if (purpose === 'login') {
        const existingUser = await storage.getUserByPhone(phone);
        if (!existingUser) {
          const errorMsg = language === 'uz' 
            ? 'Bu telefon raqami ro\'yxatdan o\'tmagan'
            : 'Этот номер телефона не зарегистрирован';
          return res.status(400).json({ error: errorMsg });
        }
      }
      
      const result = await sendOtp(phone, purpose, language);
      
      if (!result.success) {
        // Only include timing info, not in error message
        const response: { error: string; cooldownRemaining?: number; lockoutRemaining?: number } = { 
          error: result.error || ''
        };
        if (result.cooldownRemaining) {
          response.cooldownRemaining = result.cooldownRemaining;
        }
        if (result.lockoutRemaining) {
          response.lockoutRemaining = result.lockoutRemaining;
        }
        return res.status(400).json(response);
      }
      
      res.json({ 
        success: true, 
        message: language === 'uz' 
          ? 'Tasdiqlash kodi yuborildi' 
          : 'Код подтверждения отправлен',
        configured: isSmsConfigured()
      });
    } catch (error) {
      console.error('Send OTP error:', error);
      const errorMsg = language === 'uz'
        ? 'Xatolik yuz berdi. Qayta urinib ko\'ring.'
        : 'Произошла ошибка. Попробуйте снова.';
      res.status(500).json({ error: errorMsg });
    }
  });

  app.post('/api/sms/verify-otp', async (req: Request, res: Response) => {
    const language = req.body?.language || 'ru';
    try {
      const { phone: rawPhone, code, purpose } = req.body;
      
      if (!rawPhone || !code || !purpose) {
        const errorMsg = language === 'uz'
          ? 'Telefon raqami va kod kiritilishi shart'
          : 'Необходимо указать телефон и код';
        return res.status(400).json({ error: errorMsg });
      }
      
      if (!['registration', 'login', 'phone_change', 'password_change'].includes(purpose)) {
        const errorMsg = language === 'uz'
          ? 'Noto\'g\'ri so\'rov turi'
          : 'Неверный тип запроса';
        return res.status(400).json({ error: errorMsg });
      }
      
      const phone = normalizePhone(rawPhone);
      const result = await verifyOtp(phone, code, purpose, language);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ 
        success: true, 
        message: language === 'uz' ? 'Kod tasdiqlandi' : 'Код подтверждён'
      });
    } catch (error) {
      console.error('Verify OTP error:', error);
      const errorMsg = language === 'uz'
        ? 'Xatolik yuz berdi. Qayta urinib ko\'ring.'
        : 'Произошла ошибка. Попробуйте снова.';
      res.status(500).json({ error: errorMsg });
    }
  });

  // SMS login - login with verified SMS code
  app.post('/api/auth/login-sms', async (req: Request, res: Response) => {
    const language = req.body?.language || 'ru';
    try {
      const { phone: rawPhone, code } = req.body;
      
      if (!rawPhone || !code) {
        const errorMsg = language === 'uz'
          ? 'Telefon raqami va kod kiritilishi shart'
          : 'Необходимо указать телефон и код';
        return res.status(400).json({ error: errorMsg });
      }
      
      const phone = normalizePhone(rawPhone);
      
      // First verify the OTP code
      const verifyResult = await verifyOtp(phone, code, 'login', language);
      
      if (!verifyResult.success) {
        return res.status(400).json({ error: verifyResult.error });
      }
      
      // Find the user
      const user = await storage.getUserByPhone(phone);
      if (!user) {
        const errorMsg = language === 'uz' 
          ? 'Foydalanuvchi topilmadi'
          : 'Пользователь не найден';
        return res.status(400).json({ error: errorMsg });
      }
      
      // E-IMZO certificate check removed — users can log in without valid certificate
      // Certificate can be bound/updated later in Profile settings
      
      // Defensive: ensure users have all required roles based on userType
      let needsUpdate = false;
      const isLegalOrIp = user.userType && user.userType !== 'individual';
      const requiredRoles: ('customer' | 'carrier' | 'partner')[] = isLegalOrIp 
        ? ['customer', 'carrier', 'partner'] 
        : ['customer', 'partner'];
      
      if (!Array.isArray(user.roles) || user.roles.length === 0) {
        user.roles = requiredRoles as any;
        needsUpdate = true;
      } else {
        const missingRoles = requiredRoles.filter(role => !user.roles.includes(role as any));
        if (missingRoles.length > 0) {
          user.roles = [...user.roles, ...missingRoles] as any;
          needsUpdate = true;
        }
      }
      
      if (!user.defaultRole) {
        user.defaultRole = user.roles[0] || 'customer';
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        const updated = await storage.updateUser(user.id, { 
          roles: user.roles,
          defaultRole: user.defaultRole 
        });
        if (updated) {
          user.roles = updated.roles;
          user.defaultRole = updated.defaultRole;
        }
      }

      // Security: sanitize roles before creating token
      const sanitizedRoles = sanitizeRolesForToken(user.phone, user.roles);
      const token = jwt.sign({ id: user.id, roles: sanitizedRoles }, JWT_SECRET, { expiresIn: '7d' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'strict',
      });

      const smsLoginProfile = await storage.getProfileByUserId(user.id);
      const effectiveDefaultRole = getDefaultRoleForSanitizedRoles(sanitizedRoles, user.defaultRole);
      res.json({ 
        user: { 
          id: user.id, 
          phone: user.phone, 
          displayName: user.displayName, 
          roles: sanitizedRoles, 
          defaultRole: effectiveDefaultRole,
          userType: user.userType,
          email: user.email,
          ndsPayer: smsLoginProfile?.ndsPayer ?? false,
        }, 
        token 
      });
    } catch (error) {
      console.error('SMS login error:', error);
      const errorMsg = language === 'uz'
        ? 'Xatolik yuz berdi. Qayta urinib ko\'ring.'
        : 'Произошла ошибка. Попробуйте снова.';
      res.status(500).json({ error: errorMsg });
    }
  });

  // E-IMZO login - Step 1: Get challenge from E-IMZO server
  // According to E-IMZO docs: challenge must come from e-imzo-server via /frontend/challenge
  // The server stores the challenge and verifies it during /backend/auth
  app.post('/api/auth/login-eimzo/challenge', async (req: Request, res: Response) => {
    try {
      console.log('[E-IMZO Login] Requesting challenge from E-IMZO server...');
      
      // Get challenge from E-IMZO server (it stores the challenge internally)
      const result = await eimzoService.getChallenge();
      
      if (!result.success || !result.challenge) {
        console.error('[E-IMZO Login] Failed to get challenge from E-IMZO server:', result.error);
        return res.status(500).json({ 
          error: result.error || 'Не удалось получить challenge от E-IMZO сервера' 
        });
      }
      
      console.log('[E-IMZO Login] Got challenge from E-IMZO server, length:', result.challenge.length);
      
      // Return challenge to frontend - no need to store it ourselves
      // E-IMZO server stores and validates it during /backend/auth
      res.json({ 
        challenge: result.challenge,
        // No challengeId needed - E-IMZO server handles challenge validation
      });
    } catch (error) {
      console.error('E-IMZO challenge error:', error);
      res.status(500).json({ error: 'Failed to generate challenge' });
    }
  });

  // E-IMZO login - Step 2: Verify signature and login
  // According to E-IMZO docs: /backend/auth verifies both signature AND challenge
  // The challenge was stored by E-IMZO server during /frontend/challenge call
  app.post('/api/auth/login-eimzo', async (req: Request, res: Response) => {
    const language = req.body?.language || 'ru';
    try {
      const { pkcs7 } = req.body;
      
      if (!pkcs7) {
        const errorMsg = language === 'uz'
          ? 'ЭРИ imzosi talab qilinadi'
          : 'Требуется ЭЦП подпись';
        return res.status(400).json({ error: errorMsg });
      }

      console.log('[E-IMZO Login] Verifying PKCS7 signature via E-IMZO server...');
      console.log('[E-IMZO Login] PKCS7 length:', pkcs7.length);
      
      // Get client IP from request headers (nginx forwards the real IP)
      let clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                     (req.headers['x-real-ip'] as string) || 
                     req.socket.remoteAddress || 
                     '127.0.0.1';
      
      // Convert IPv6 localhost to IPv4 format
      if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
        clientIp = '127.0.0.1';
      }
      // Strip IPv6 prefix if present
      if (clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.substring(7);
      }
      
      console.log('[E-IMZO Login] Client IP:', clientIp);
      
      // Verify signature via E-IMZO server /backend/auth
      // This endpoint validates both the signature AND the challenge
      // (challenge was stored by E-IMZO server during /frontend/challenge)
      const verifyResult = await eimzoService.verifyAuth(pkcs7, clientIp);
      
      console.log('[E-IMZO Login] Verification result:', {
        success: verifyResult.success,
        status: verifyResult.status,
        error: verifyResult.error,
        hasPkcs7Info: !!verifyResult.pkcs7Info
      });
      
      if (!verifyResult.success || verifyResult.status !== 1) {
        console.error('[E-IMZO Login] Signature verification failed:', verifyResult.error);
        const errorMsg = language === 'uz'
          ? 'ЭРИ imzosini tekshirib bo\'lmadi. E-IMZO server xatosi.'
          : 'Не удалось проверить ЭЦП подпись. Ошибка E-IMZO сервера.';
        return res.status(400).json({ 
          error: errorMsg,
          details: verifyResult.error
        });
      }

      console.log('[E-IMZO Login] Signature verified successfully by E-IMZO server');
      
      // Extract signer info from verified response
      const signerInfo = eimzoService.extractSignerInfo(verifyResult.pkcs7Info);
      if (!signerInfo || (!signerInfo.TIN && !signerInfo.PINFL)) {
        console.error('[E-IMZO Login] Could not extract signer info');
        const errorMsg = language === 'uz'
          ? 'Imzo ma\'lumotlarini olishda xatolik'
          : 'Не удалось получить данные подписи';
        return res.status(400).json({ error: errorMsg });
      }
      
      console.log('[E-IMZO Login] Verified signer info:', {
        CN: signerInfo.CN,
        TIN: signerInfo.TIN,
        PINFL: signerInfo.PINFL,
        O: signerInfo.O
      });
      
      // Step 5: Determine certificate type and find user(s)
      // Certificate type detection based on Organization (O) field:
      // - IP (Individual Entrepreneur): O contains "Якка тартибдаги тадбиркор" or "YATT" or "ЯТТ" or similar
      // - Individual: O equals CN (person name) or O is empty
      // - Legal entity: O contains company name (MCHJ, МЧЖ, OOO, etc.) - different from person name
      let user = null;
      let profile = null;
      
      // Normalize TIN and PINFL for comparison (remove spaces, handle nulls)
      const normalizedTIN = signerInfo.TIN?.trim() || '';
      const normalizedPINFL = signerInfo.PINFL?.trim() || '';
      const normalizedO = signerInfo.O?.trim() || '';
      const normalizedCN = signerInfo.CN?.trim() || '';
      
      // IP detection: Check if O field indicates Individual Entrepreneur
      // In Uzbekistan, IP certificates have O field like "Якка тартибдаги тадбиркор" (Individual Entrepreneur in Uzbek)
      const ipIndicators = [
        'якка тартибдаги тадбиркор',  // Uzbek: Individual Entrepreneur
        'yatt',                         // Abbreviation
        'ятт',                          // Cyrillic abbreviation
        'individual entrepreneur',      // English
        'индивидуальный предприниматель', // Russian
        'ип'                            // Russian abbreviation
      ];
      
      const oLower = normalizedO.toLowerCase();
      const isIPCert = ipIndicators.some(indicator => oLower.includes(indicator));
      
      // Individual detection: O equals CN (just a person, not a company)
      // or O is empty
      const isIndividualCert = !normalizedO || 
        normalizedO.toLowerCase() === normalizedCN.toLowerCase();
      
      // Legal entity: Has O field that differs from CN and is not an IP indicator
      const isLegalEntityCert = normalizedO.length > 0 && 
        !isIPCert && 
        normalizedO.toLowerCase() !== normalizedCN.toLowerCase();
      
      // Determine certificate type string for logging
      let certType = 'unknown';
      let certReason = '';
      if (isIPCert) {
        certType = 'ip';
        certReason = `O field contains IP indicator: "${normalizedO}"`;
      } else if (isIndividualCert) {
        certType = 'individual';
        certReason = normalizedO ? `O equals CN: "${normalizedO}"` : 'O field is empty';
      } else if (isLegalEntityCert) {
        certType = 'legal_entity';
        certReason = `O field is company name: "${normalizedO}" (differs from CN)`;
      }
      
      console.log('[E-IMZO Login] Certificate type detection:', {
        O: signerInfo.O,
        CN: signerInfo.CN,
        TIN: signerInfo.TIN,
        PINFL: signerInfo.PINFL,
        normalizedTIN,
        normalizedPINFL,
        isIPCert,
        isIndividualCert,
        isLegalEntityCert,
        certType,
        reason: certReason
      });
      
      if (isIPCert) {
        // IP certificate - search by TIN (ИНН) first, then verify it's an IP account
        console.log('[E-IMZO Login] IP certificate detected, searching by TIN:', normalizedTIN);
        
        if (normalizedTIN) {
          profile = await storage.getProfileByInn(normalizedTIN);
          if (profile) {
            user = await storage.getUserById(profile.userId);
            console.log('[E-IMZO Login] Found user by TIN:', user?.id, user?.userType);
          }
        }
        
        // If not found by TIN, try PINFL (for backwards compatibility)
        if (!user && normalizedPINFL) {
          const allProfiles = await storage.getAllProfilesByPinfl(normalizedPINFL);
          // Find IP account specifically
          for (const p of allProfiles) {
            const u = await storage.getUserById(p.userId);
            if (u && u.userType === 'ip') {
              profile = p;
              user = u;
              console.log('[E-IMZO Login] Found IP user by PINFL:', user.id);
              break;
            }
          }
        }
        
        if (!user) {
          const errorMsg = language === 'uz'
            ? `ИП топилмади. ИНН ${normalizedTIN || 'йўқ'} ёки ПИНФЛ ${normalizedPINFL || 'йўқ'} тизимда рўйхатдан ўтмаган.`
            : `ИП не найден. ИНН ${normalizedTIN || 'отсутствует'} или ПИНФЛ ${normalizedPINFL || 'отсутствует'} не зарегистрирован в системе.`;
          return res.status(404).json({ 
            error: errorMsg,
            signerInfo: { CN: signerInfo.CN, TIN: signerInfo.TIN, PINFL: signerInfo.PINFL, O: signerInfo.O },
            certificateType: 'ip'
          });
        }
        
        // Verify the found account is actually an IP account
        if (user.userType !== 'ip') {
          console.error('[E-IMZO Login] Certificate type mismatch: IP cert trying to access non-IP account', {
            certType: 'ip',
            accountType: user.userType,
            userId: user.id
          });
          const errorMsg = language === 'uz'
            ? `ИП ключи билан фақат ИП кабинетига кириш мумкин. Топилган аккаунт: ${user.userType === 'legal' ? 'юридик шахс' : 'жисмоний шахс'}.`
            : `С ключом ИП можно войти только в кабинет ИП. Найденный аккаунт: ${user.userType === 'legal' ? 'юр.лицо' : 'физ.лицо'}.`;
          return res.status(403).json({ 
            error: errorMsg,
            signerInfo: { CN: signerInfo.CN, TIN: signerInfo.TIN, PINFL: signerInfo.PINFL, O: signerInfo.O },
            certificateType: 'ip',
            accountType: user.userType
          });
        }
      } else if (isLegalEntityCert) {
        // Legal entity certificate - search by TIN only
        console.log('[E-IMZO Login] Legal entity certificate detected, searching by TIN:', normalizedTIN);
        
        if (normalizedTIN) {
          profile = await storage.getProfileByInn(normalizedTIN);
          if (profile) {
            user = await storage.getUserById(profile.userId);
            console.log('[E-IMZO Login] Found user by TIN:', user?.id, user?.userType);
          }
        }
        
        if (!user) {
          const errorMsg = language === 'uz'
            ? `Юридик шахс топилмади. ИНН ${normalizedTIN} тизимда рўйхатдан ўтмаган.`
            : `Юр.лицо не найдено. ИНН ${normalizedTIN} не зарегистрирован в системе.`;
          return res.status(404).json({ 
            error: errorMsg,
            signerInfo: { CN: signerInfo.CN, TIN: signerInfo.TIN, PINFL: signerInfo.PINFL, O: signerInfo.O },
            certificateType: 'legal_entity'
          });
        }
        
        // Verify the found account is actually a legal entity account
        if (user.userType !== 'legal') {
          console.error('[E-IMZO Login] Certificate type mismatch: legal entity cert trying to access non-legal account', {
            certType: 'legal_entity',
            accountType: user.userType,
            userId: user.id
          });
          const errorMsg = language === 'uz'
            ? `Юр.лицо ключи билан фақат юр.лицо кабинетига кириш мумкин. Топилган аккаунт: ${user.userType === 'ip' ? 'ИП' : 'жисмоний шахс'}.`
            : `С ключом юр.лица можно войти только в кабинет юр.лица. Найденный аккаунт: ${user.userType === 'ip' ? 'ИП' : 'физ.лицо'}.`;
          return res.status(403).json({ 
            error: errorMsg,
            signerInfo: { CN: signerInfo.CN, TIN: signerInfo.TIN, PINFL: signerInfo.PINFL, O: signerInfo.O },
            certificateType: 'legal_entity',
            accountType: user.userType
          });
        }
      } else if (isIndividualCert && normalizedPINFL.length > 0) {
        // Individual certificate - search by PINFL for individual accounts only
        console.log('[E-IMZO Login] Individual certificate detected, searching by PINFL:', normalizedPINFL);
        const allProfiles = await storage.getAllProfilesByPinfl(normalizedPINFL);
        
        if (allProfiles.length === 0) {
          const errorMsg = language === 'uz'
            ? `Фойдаланувчи топилмади. ПИНФЛ ${normalizedPINFL} тизимда рўйхатдан ўтмаган.`
            : `Пользователь не найден. ПИНФЛ ${normalizedPINFL} не зарегистрирован в системе.`;
          return res.status(404).json({ 
            error: errorMsg,
            signerInfo: { CN: signerInfo.CN, TIN: signerInfo.TIN, PINFL: signerInfo.PINFL, O: signerInfo.O },
            certificateType: 'individual'
          });
        }
        
        // Filter to individual accounts only (individual certificate can only access individual accounts)
        const eligibleProfiles = [];
        for (const p of allProfiles) {
          const u = await storage.getUserById(p.userId);
          if (u && u.userType === 'individual') {
            eligibleProfiles.push({ profile: p, user: u });
          } else {
            console.log('[E-IMZO Login] Filtering out non-individual account from PINFL search:', {
              userId: p.userId,
              userType: u?.userType
            });
          }
        }
        
        if (eligibleProfiles.length === 0) {
          const errorMsg = language === 'uz'
            ? `ПИНФЛ ${normalizedPINFL} учун жисмоний шахс аккаунти топилмади. ИП/Юр.лицо кабинетига кириш учун тегишли ключни ишлатинг.`
            : `Для ПИНФЛ ${normalizedPINFL} не найден аккаунт физ.лица. Для входа в кабинет ИП/юр.лица используйте соответствующий ключ.`;
          return res.status(404).json({ 
            error: errorMsg,
            signerInfo: { CN: signerInfo.CN, TIN: signerInfo.TIN, PINFL: signerInfo.PINFL, O: signerInfo.O },
            certificateType: 'individual'
          });
        }
        
        if (eligibleProfiles.length === 1) {
          // Single eligible account - login directly
          profile = eligibleProfiles[0].profile;
          user = eligibleProfiles[0].user;
          console.log('[E-IMZO Login] Found single individual user by PINFL:', user?.id, user?.userType);
        } else {
          // Multiple individual accounts (rare but possible) - return list for selection
          console.log('[E-IMZO Login] Multiple individual accounts found for PINFL, returning selection list');
          const accounts = eligibleProfiles.map(({ profile: p, user: u }) => ({
            userId: p.userId,
            userType: u?.userType,
            companyName: p.companyName,
            inn: p.inn
          }));
          
          // Generate a secure selection token
          const selectionToken = jwt.sign({ 
            pinfl: normalizedPINFL,
            purpose: 'eimzo-account-selection',
            accounts: accounts.map(a => a.userId)
          }, JWT_SECRET, { expiresIn: '5m' });
          
          return res.status(200).json({
            needAccountSelection: true,
            accounts,
            signerInfo: { CN: signerInfo.CN, TIN: signerInfo.TIN, PINFL: signerInfo.PINFL, O: signerInfo.O },
            selectionToken
          });
        }
      } else {
        // No TIN and no PINFL - invalid certificate
        const errorMsg = language === 'uz'
          ? 'Сертификатда ИНН ёки ПИНФЛ топилмади.'
          : 'В сертификате не найден ИНН или ПИНФЛ.';
        return res.status(400).json({ error: errorMsg });
      }
      
      // Update user's certificate data in profile with new E-IMZO certificate
      // This is important for renewing expired certificates
      try {
        const signer = verifyResult.pkcs7Info?.signers?.[0];
        const certData = signer?.certificate;
        
        if (certData) {
          const profileUpdate: any = {
            eimzoCertSerial: signerInfo.serialNumber || null,
            eimzoCertCn: signerInfo.CN || null,
            eimzoCertO: signerInfo.O || null,
            eimzoCertTin: signerInfo.TIN || null,
            eimzoCertPinfl: signerInfo.PINFL || null,
          };
          
          // Parse and set certificate validity dates
          if (certData.validFrom) {
            profileUpdate.eimzoCertValidFrom = new Date(certData.validFrom);
          }
          if (certData.validTo) {
            profileUpdate.eimzoCertValidTo = new Date(certData.validTo);
          }
          
          await storage.updateProfile(user.id, profileUpdate);
          console.log('[E-IMZO Login] Updated certificate data for user:', user.id);
        }
      } catch (updateError) {
        // Log but don't fail login if certificate update fails
        console.error('[E-IMZO Login] Failed to update certificate data:', updateError);
      }
      
      // User found - generate token and login
      // Security: sanitize roles before creating token
      const sanitizedRoles = sanitizeRolesForToken(user.phone, user.roles);
      const token = jwt.sign({ id: user.id, roles: sanitizedRoles }, JWT_SECRET, { expiresIn: '7d' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'strict',
      });

      console.log('[E-IMZO Login] User logged in:', user.id, user.displayName);

      const effectiveDefaultRole = getDefaultRoleForSanitizedRoles(sanitizedRoles, user.defaultRole);
      res.json({ 
        user: { 
          id: user.id, 
          phone: user.phone, 
          displayName: user.displayName, 
          roles: sanitizedRoles, 
          defaultRole: effectiveDefaultRole,
          userType: user.userType,
          email: user.email
        }, 
        token,
        signerInfo: {
          CN: signerInfo.CN,
          TIN: signerInfo.TIN,
          PINFL: signerInfo.PINFL,
          O: signerInfo.O
        }
      });
    } catch (error) {
      console.error('E-IMZO login error:', error);
      const errorMsg = language === 'uz'
        ? 'Xatolik yuz berdi. Qayta urinib ko\'ring.'
        : 'Произошла ошибка. Попробуйте снова.';
      res.status(500).json({ error: errorMsg });
    }
  });

  // E-IMZO login - select account (when multiple accounts exist for same PINFL)
  app.post('/api/auth/eimzo-select-account', async (req: Request, res: Response) => {
    try {
      const language = req.headers['accept-language'] === 'uz' ? 'uz' : 'ru';
      const { userId, selectionToken } = req.body;
      
      if (!userId || !selectionToken) {
        const errorMsg = language === 'uz'
          ? 'Фойдаланувчи танланмаган'
          : 'Пользователь не выбран';
        return res.status(400).json({ error: errorMsg });
      }
      
      // Verify the selection token (signed by server during E-IMZO login)
      let tokenPayload: any;
      try {
        tokenPayload = jwt.verify(selectionToken, JWT_SECRET) as any;
      } catch (err) {
        console.error('[E-IMZO Select Account] Invalid selection token:', err);
        const errorMsg = language === 'uz'
          ? 'Ваколат муддати тугади. Қайта киринг.'
          : 'Сессия истекла. Войдите снова.';
        return res.status(403).json({ error: errorMsg });
      }
      
      // Verify token purpose
      if (tokenPayload.purpose !== 'eimzo-account-selection') {
        const errorMsg = language === 'uz'
          ? 'Нотўғри токен. Қайта уриниб кўринг.'
          : 'Неверный токен. Попробуйте снова.';
        return res.status(403).json({ error: errorMsg });
      }
      
      // Verify userId is in the list of allowed accounts from the token
      if (!tokenPayload.accounts || !tokenPayload.accounts.includes(userId)) {
        console.error('[E-IMZO Select Account] User ID not in allowed list:', userId, tokenPayload.accounts);
        const errorMsg = language === 'uz'
          ? 'Ушбу аккаунтни танлаш мумкин эмас.'
          : 'Нельзя выбрать этот аккаунт.';
        return res.status(403).json({ error: errorMsg });
      }
      
      // Additionally verify PINFL matches
      const profile = await storage.getProfileByUserId(userId);
      if (!profile || profile.pinfl !== tokenPayload.pinfl) {
        const errorMsg = language === 'uz'
          ? 'ПИНФЛ мос келмайди. Қайта уриниб кўринг.'
          : 'ПИНФЛ не совпадает. Попробуйте снова.';
        return res.status(403).json({ error: errorMsg });
      }
      
      const user = await storage.getUserById(userId);
      if (!user) {
        const errorMsg = language === 'uz'
          ? 'Фойдаланувчи топилмади'
          : 'Пользователь не найден';
        return res.status(404).json({ error: errorMsg });
      }
      
      // Security: sanitize roles before creating token
      const sanitizedRoles = sanitizeRolesForToken(user.phone, user.roles);
      const token = jwt.sign({ id: user.id, roles: sanitizedRoles }, JWT_SECRET, { expiresIn: '7d' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'strict',
      });

      console.log('[E-IMZO Select Account] User logged in:', user.id, user.displayName);

      const effectiveDefaultRole = getDefaultRoleForSanitizedRoles(sanitizedRoles, user.defaultRole);
      res.json({ 
        user: { 
          id: user.id, 
          phone: user.phone, 
          displayName: user.displayName, 
          roles: sanitizedRoles, 
          defaultRole: effectiveDefaultRole,
          userType: user.userType,
          email: user.email
        }, 
        token
      });
    } catch (error) {
      console.error('E-IMZO select account error:', error);
      const errorMsg = req.headers['accept-language'] === 'uz'
        ? 'Xatolik yuz berdi. Qayta urinib ko\'ring.'
        : 'Произошла ошибка. Попробуйте снова.';
      res.status(500).json({ error: errorMsg });
    }
  });

  // Check if phone is verified
  app.post('/api/sms/check-verified', async (req: Request, res: Response) => {
    try {
      const { phone: rawPhone, purpose } = req.body;
      
      if (!rawPhone || !purpose) {
        return res.status(400).json({ error: 'Phone and purpose are required' });
      }
      
      const phone = normalizePhone(rawPhone);
      const verified = await isPhoneVerified(phone, purpose);
      
      res.json({ verified });
    } catch (error) {
      console.error('Check verified error:', error);
      res.status(500).json({ error: 'Failed to check verification status' });
    }
  });

  app.get('/api/auth/me', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Defensive: ensure users have all required roles based on userType
      let needsUpdate = false;
      const isLegalOrIp = user.userType && user.userType !== 'individual';
      const requiredRoles: ('customer' | 'carrier' | 'partner' | 'admin')[] = isLegalOrIp 
        ? ['customer', 'carrier', 'partner'] 
        : ['customer', 'partner'];
      
      // Initialize roles array if empty or invalid
      if (!Array.isArray(user.roles) || user.roles.length === 0) {
        user.roles = requiredRoles;
        needsUpdate = true;
      } else {
        // Add ALL missing required roles (preserving existing custom roles like 'admin')
        const missingRoles = requiredRoles.filter(role => !user.roles.includes(role));
        if (missingRoles.length > 0) {
          user.roles = [...user.roles, ...missingRoles] as ('customer' | 'carrier' | 'partner' | 'admin')[];
          needsUpdate = true;
          console.log(`[AUTH ME] Adding missing roles for user ${user.id}: ${missingRoles.join(', ')}`);
        }
      }
      
      // Ensure defaultRole exists
      if (!user.defaultRole) {
        user.defaultRole = user.roles[0] || 'customer';
        needsUpdate = true;
      }
      
      // Persist changes to database if needed
      if (needsUpdate) {
        console.log(`[AUTH ME] Persisting normalized roles for user ${user.id}: ${JSON.stringify(user.roles)}`);
        const updated = await storage.updateUser(user.id, { 
          roles: user.roles,
          defaultRole: user.defaultRole 
        });
        if (updated) {
          user.roles = updated.roles;
          user.defaultRole = updated.defaultRole;
        }
      }
      
      // Reissue fresh JWT with roles array (refresh legacy tokens)
      // Security: sanitize roles before creating token
      const sanitizedRoles = sanitizeRolesForToken(user.phone, user.roles);
      const token = jwt.sign({ id: user.id, roles: sanitizedRoles }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'strict',
      });
      
      const profile = await storage.getProfileByUserId(user.id);

      // Fetch referral code for partner users
      let referralCode: string | null = null;
      if (user.roles?.includes('partner')) {
        try {
          const partner = await storage.getPartnerByUserId(user.id);
          referralCode = partner?.referralCode || null;
        } catch (_) { /* silent */ }
      }
      
      // Check E-IMZO certificate expiry for legal entities and IPs
      let eimzoCertExpired = false;
      let eimzoCertValidTo: Date | null = null;
      
      if (profile && (user.userType === 'legal' || user.userType === 'ip')) {
        if (profile.eimzoCertValidTo) {
          eimzoCertValidTo = new Date(profile.eimzoCertValidTo);
          // eimzoCertExpired intentionally NOT set — E-IMZO is not required for platform access
        }
      }
      
      const effectiveDefaultRole = getDefaultRoleForSanitizedRoles(sanitizedRoles, user.defaultRole);
      res.json({ 
        user: { 
          id: user.id, 
          phone: user.phone, 
          displayName: user.displayName, 
          roles: sanitizedRoles,
          defaultRole: effectiveDefaultRole,
          userType: user.userType,
          email: user.email,
          referralCode,
          ndsPayer: profile?.ndsPayer ?? false,
        },
        token,
        profile,
        eimzoCertExpired,
        eimzoCertValidTo: eimzoCertValidTo ? eimzoCertValidTo.toISOString() : null
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user data' });
    }
  });

  // Profile update endpoint
  app.patch('/api/profile/update', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { displayName, email, phone, firstName, lastName, middleName, companyName, inn, pinfl, passportSeries, passportNumber, bankAccount, bankName, bankCode, ndsPayer, registrationCodeNds } = req.body;
      
      // Update user data
      const userUpdates: Partial<any> = {};
      if (displayName !== undefined) userUpdates.displayName = displayName;
      if (email !== undefined) userUpdates.email = email;
      if (phone !== undefined) userUpdates.phone = normalizePhone(phone);
      if (firstName !== undefined) userUpdates.firstName = firstName;
      if (lastName !== undefined) userUpdates.lastName = lastName;
      if (middleName !== undefined) userUpdates.middleName = middleName;
      if (pinfl !== undefined) userUpdates.pinfl = pinfl;
      if (ndsPayer !== undefined) userUpdates.ndsPayer = ndsPayer;
      
      const updatedUser = await storage.updateUser(req.user!.id, userUpdates);
      
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update or create profile data
      let profile = await storage.getProfileByUserId(req.user!.id);
      
      const profileUpdates: Partial<any> = {};
      if (companyName !== undefined) profileUpdates.companyName = companyName;
      if (inn !== undefined) profileUpdates.inn = inn;
      if (passportSeries !== undefined) profileUpdates.passportSeries = passportSeries;
      if (passportNumber !== undefined) profileUpdates.passportNumber = passportNumber;
      if (bankAccount !== undefined) profileUpdates.bankAccount = bankAccount;
      if (bankName !== undefined) profileUpdates.bankName = bankName;
      if (bankCode !== undefined) profileUpdates.bankCode = bankCode;
      if (registrationCodeNds !== undefined) profileUpdates.registrationCodeNds = registrationCodeNds;
      
      if (profile) {
        profile = await storage.updateProfile(req.user!.id, profileUpdates) || profile;
      } else if (Object.keys(profileUpdates).length > 0) {
        profile = await storage.createProfile({ userId: req.user!.id, ...profileUpdates });
      }

      res.json({ 
        success: true,
        user: { 
          id: updatedUser.id, 
          phone: updatedUser.phone, 
          displayName: updatedUser.displayName, 
          roles: updatedUser.roles,
          defaultRole: updatedUser.defaultRole,
          userType: updatedUser.userType,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          middleName: updatedUser.middleName,
          pinfl: profile?.pinfl,
          ndsPayer: profile?.ndsPayer,
          companyName: profile?.companyName,
          inn: profile?.inn,
          passportSeries: profile?.passportSeries,
          passportNumber: profile?.passportNumber,
          bankAccount: profile?.bankAccount,
          bankName: profile?.bankName,
          bankCode: profile?.bankCode,
          registrationCodeNds: profile?.registrationCodeNds,
        },
        profile
      });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // Simple bank details update endpoint (for mobile app)
  app.put('/api/profile/bank-details', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { bankName, bankAccount, bankCode } = req.body;
      
      // Validate that at least one field is provided
      if (!bankName && !bankAccount && !bankCode) {
        return res.status(400).json({ error: 'At least one bank detail field is required' });
      }
      
      // Validate field types
      if (bankName !== undefined && typeof bankName !== 'string') {
        return res.status(400).json({ error: 'bankName must be a string' });
      }
      if (bankAccount !== undefined && typeof bankAccount !== 'string') {
        return res.status(400).json({ error: 'bankAccount must be a string' });
      }
      if (bankCode !== undefined && typeof bankCode !== 'string') {
        return res.status(400).json({ error: 'bankCode must be a string' });
      }
      
      // Update or create profile data
      let profile = await storage.getProfileByUserId(req.user!.id);
      
      const profileUpdates: Partial<any> = {};
      if (bankAccount !== undefined) profileUpdates.bankAccount = bankAccount;
      if (bankName !== undefined) profileUpdates.bankName = bankName;
      if (bankCode !== undefined) profileUpdates.bankCode = bankCode;
      
      if (profile) {
        profile = await storage.updateProfile(req.user!.id, profileUpdates) || profile;
      } else {
        profile = await storage.createProfile({ userId: req.user!.id, ...profileUpdates });
      }

      res.json({ 
        success: true, 
        bankDetails: {
          bankAccount: profile?.bankAccount,
          bankName: profile?.bankName,
          bankCode: profile?.bankCode,
        }
      });
    } catch (error) {
      console.error('Bank details update error:', error);
      res.status(500).json({ error: 'Failed to update bank details' });
    }
  });

  // Profile update with SMS verification endpoint (for individual users)
  app.patch('/api/profile/update-with-sms', authenticate, async (req: AuthRequest, res: Response) => {
    const { smsCode, language = 'ru', displayName, email, phone, firstName, lastName, middleName, companyName, inn, pinfl, passportSeries, passportNumber, bankAccount, bankName, bankCode, ndsPayer, registrationCodeNds } = req.body;
    
    try {
      // Get user to get their phone
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: language === 'uz' ? 'Foydalanuvchi topilmadi' : 'Пользователь не найден' });
      }
      
      // Validate SMS code is provided
      if (!smsCode || smsCode.length < 6) {
        return res.status(400).json({ 
          error: language === 'uz' 
            ? 'SMS kodini kiriting' 
            : 'Введите СМС код' 
        });
      }
      
      // Verify the SMS code
      const verificationResult = await verifyOtp(user.phone, smsCode, 'profile_edit', language);
      
      if (!verificationResult.success) {
        return res.status(400).json({ 
          error: verificationResult.error || (language === 'uz' ? 'Noto\'g\'ri kod' : 'Неверный код'),
          attemptsRemaining: verificationResult.attemptsRemaining
        });
      }
      
      // SMS verified successfully, now update the profile
      const userUpdates: Partial<any> = {};
      if (displayName !== undefined) userUpdates.displayName = displayName;
      if (email !== undefined) userUpdates.email = email;
      if (phone !== undefined) userUpdates.phone = normalizePhone(phone);
      if (firstName !== undefined) userUpdates.firstName = firstName;
      if (lastName !== undefined) userUpdates.lastName = lastName;
      if (middleName !== undefined) userUpdates.middleName = middleName;
      if (pinfl !== undefined) userUpdates.pinfl = pinfl;
      if (ndsPayer !== undefined) userUpdates.ndsPayer = ndsPayer;
      
      const updatedUser = await storage.updateUser(req.user!.id, userUpdates);
      
      if (!updatedUser) {
        return res.status(404).json({ error: language === 'uz' ? 'Foydalanuvchi topilmadi' : 'Пользователь не найден' });
      }

      // Update or create profile data
      let profile = await storage.getProfileByUserId(req.user!.id);
      
      const profileUpdates: Partial<any> = {};
      if (companyName !== undefined) profileUpdates.companyName = companyName;
      if (inn !== undefined) profileUpdates.inn = inn;
      if (passportSeries !== undefined) profileUpdates.passportSeries = passportSeries;
      if (passportNumber !== undefined) profileUpdates.passportNumber = passportNumber;
      if (bankAccount !== undefined) profileUpdates.bankAccount = bankAccount;
      if (bankName !== undefined) profileUpdates.bankName = bankName;
      if (bankCode !== undefined) profileUpdates.bankCode = bankCode;
      if (registrationCodeNds !== undefined) profileUpdates.registrationCodeNds = registrationCodeNds;
      
      if (profile) {
        profile = await storage.updateProfile(req.user!.id, profileUpdates) || profile;
      } else if (Object.keys(profileUpdates).length > 0) {
        profile = await storage.createProfile({ userId: req.user!.id, ...profileUpdates });
      }

      res.json({ 
        success: true,
        user: { 
          id: updatedUser.id, 
          phone: updatedUser.phone, 
          displayName: updatedUser.displayName, 
          roles: updatedUser.roles,
          defaultRole: updatedUser.defaultRole,
          userType: updatedUser.userType,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          middleName: updatedUser.middleName,
          pinfl: profile?.pinfl,
          ndsPayer: profile?.ndsPayer,
          companyName: profile?.companyName,
          inn: profile?.inn,
          passportSeries: profile?.passportSeries,
          passportNumber: profile?.passportNumber,
          bankAccount: profile?.bankAccount,
          bankName: profile?.bankName,
          bankCode: profile?.bankCode,
          registrationCodeNds: profile?.registrationCodeNds,
        },
        profile
      });
    } catch (error) {
      console.error('Profile update with SMS error:', error);
      const errorMsg = language === 'uz'
        ? 'Xatolik yuz berdi. Qayta urinib ko\'ring.'
        : 'Произошла ошибка. Попробуйте снова.';
      res.status(500).json({ error: errorMsg });
    }
  });

  // Profile update with E-IMZO verification endpoint (for legal entities and IPs)
  app.patch('/api/profile/update-with-eimzo', authenticate, async (req: AuthRequest, res: Response) => {
    const { eimzoSignature, signedDocument, language = 'ru', displayName, email, phone, firstName, lastName, middleName, companyName, inn, pinfl, passportSeries, passportNumber, bankAccount, bankName, bankCode, ndsPayer, registrationCodeNds } = req.body;
    
    console.log('[Profile E-IMZO] Request received for user:', req.user?.id);
    console.log('[Profile E-IMZO] Has signature:', !!eimzoSignature, 'length:', eimzoSignature?.length);
    console.log('[Profile E-IMZO] Signature first 100 chars:', eimzoSignature?.substring(0, 100));
    
    try {
      // Get user to verify their type
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: language === 'uz' ? 'Foydalanuvchi topilmadi' : 'Пользователь не найден' });
      }
      
      // Verify that user is legal entity or IP
      if (user.userType !== 'legal' && user.userType !== 'ip') {
        return res.status(400).json({ 
          error: language === 'uz' 
            ? 'Faqat yuridik shaxslar va YaTT uchun' 
            : 'Только для юридических лиц и ИП' 
        });
      }
      
      // Validate E-IMZO signature is provided
      if (!eimzoSignature) {
        return res.status(400).json({ 
          error: language === 'uz' 
            ? 'ERI imzosi talab qilinadi' 
            : 'Требуется подпись ЭЦП' 
        });
      }
      
      // Import E-IMZO service
      const { eimzoService } = await import('./eimzo');
      
      // Get client IP from request headers (same as login)
      let clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                     (req.headers['x-real-ip'] as string) || 
                     req.socket.remoteAddress || 
                     '127.0.0.1';
      
      // Convert IPv6 localhost to IPv4 format
      if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
        clientIp = '127.0.0.1';
      }
      // Strip IPv6 prefix if present
      if (clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.substring(7);
      }
      
      console.log('[Profile E-IMZO] Client IP:', clientIp);
      
      // Verify the signature using /backend/pkcs7/verify/attached endpoint
      // Note: /backend/auth only supports documents up to 128 bytes (challenge verification)
      const verificationResult = await eimzoService.verifySignature(eimzoSignature, clientIp);
      
      if (!verificationResult.success) {
        console.error('[E-IMZO] Profile update signature verification failed:', verificationResult.error);
        return res.status(400).json({ 
          error: language === 'uz' 
            ? 'Imzo tasdiqlashda xato' 
            : 'Ошибка проверки подписи',
          details: verificationResult.error
        });
      }
      
      // Extract signer info and validate it matches the user
      const signerInfo = eimzoService.extractSignerInfo(verificationResult.pkcs7Info);
      if (!signerInfo) {
        return res.status(400).json({ 
          error: language === 'uz' 
            ? 'Imzolash ma\'lumotlarini olishda xato' 
            : 'Ошибка получения данных подписи' 
        });
      }

      // Get user's current INN/PINFL for validation
      const profile = await storage.getProfileByUserId(req.user!.id);
      const userInn = profile?.inn || profile?.pinfl;
      
      // Validate that the signer is the same user (by TIN for legal, PINFL for IP)
      const signerIdentifier = user.userType === 'legal' ? signerInfo.TIN : signerInfo.PINFL;
      if (userInn && signerIdentifier && userInn !== signerIdentifier) {
        console.warn(`[E-IMZO] Profile update: Signer mismatch. User INN/PINFL: ${userInn}, Signer: ${signerIdentifier}`);
        return res.status(400).json({ 
          error: language === 'uz' 
            ? 'Imzo egasi foydalanuvchiga mos kelmaydi' 
            : 'Подписант не соответствует пользователю' 
        });
      }
      
      console.log(`[E-IMZO] Profile update signature verified for user ${user.id}, signer: ${signerInfo.CN}`);
      
      // SECURITY: Extract and validate signed document from verified PKCS#7 signature
      // This prevents replay attacks - we only trust data extracted from the signature, not request body
      let extractedDocument: string | null = null;
      
      if (verificationResult.pkcs7Info?.document) {
        extractedDocument = verificationResult.pkcs7Info.document;
      } else if (verificationResult.pkcs7Info?.documentBase64) {
        try {
          extractedDocument = Buffer.from(verificationResult.pkcs7Info.documentBase64, 'base64').toString('utf-8');
        } catch (e) {
          console.error('[E-IMZO] Failed to decode documentBase64:', e);
        }
      }
      
      if (!extractedDocument) {
        return res.status(400).json({ 
          error: language === 'uz' 
            ? 'Imzolangan hujjatni olishda xato' 
            : 'Ошибка извлечения подписанного документа' 
        });
      }
      
      try {
        const parsedSignedDoc = JSON.parse(extractedDocument);
        
        // Validate action type
        if (parsedSignedDoc.action !== 'profile_update') {
          return res.status(400).json({ 
            error: language === 'uz' 
              ? 'Noto\'g\'ri hujjat turi' 
              : 'Неверный тип документа' 
          });
        }
        
        // Validate userId matches
        if (parsedSignedDoc.userId !== req.user!.id) {
          return res.status(400).json({ 
            error: language === 'uz' 
              ? 'Foydalanuvchi mos kelmaydi' 
              : 'Пользователь не соответствует' 
          });
        }
        
        // Validate timestamp is within acceptable range (5 minutes)
        const signedTimestamp = new Date(parsedSignedDoc.timestamp);
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const fiveMinutesAhead = new Date(now.getTime() + 5 * 60 * 1000);
        
        if (signedTimestamp < fiveMinutesAgo || signedTimestamp > fiveMinutesAhead) {
          return res.status(400).json({ 
            error: language === 'uz' 
              ? 'Imzo muddati o\'tgan yoki noto\'g\'ri' 
              : 'Подпись устарела или некорректна' 
          });
        }
        
        // Validate that the updates in the signed document match the submitted updates
        const submittedUpdates = {
          displayName, email, firstName, lastName, middleName, 
          companyName, inn, pinfl, passportSeries, passportNumber, 
          bankAccount, bankName, bankCode, ndsPayer, registrationCodeNds
        };
        
        // Filter out undefined values for comparison
        const filteredSubmitted = Object.fromEntries(
          Object.entries(submittedUpdates).filter(([_, v]) => v !== undefined)
        );
        const filteredSigned = parsedSignedDoc.updates ? Object.fromEntries(
          Object.entries(parsedSignedDoc.updates).filter(([_, v]) => v !== undefined)
        ) : {};
        
        // Compare the updates
        const submittedKeys = Object.keys(filteredSubmitted).sort();
        const signedKeys = Object.keys(filteredSigned).sort();
        
        if (JSON.stringify(submittedKeys) !== JSON.stringify(signedKeys)) {
          console.warn('[E-IMZO] Profile update: Field mismatch between signed and submitted');
          return res.status(400).json({ 
            error: language === 'uz' 
              ? 'Imzolangan va yuborilgan ma\'lumotlar mos kelmaydi' 
              : 'Подписанные и отправленные данные не совпадают' 
          });
        }
        
        // Compare values
        for (const key of submittedKeys) {
          if (filteredSubmitted[key] !== filteredSigned[key]) {
            console.warn(`[E-IMZO] Profile update: Value mismatch for field ${key}`);
            return res.status(400).json({ 
              error: language === 'uz' 
                ? 'Imzolangan va yuborilgan ma\'lumotlar mos kelmaydi' 
                : 'Подписанные и отправленные данные не совпадают' 
            });
          }
        }
        
        console.log('[E-IMZO] Profile update: Signed document validated successfully');
        
      } catch (parseError) {
        console.error('[E-IMZO] Failed to parse signed document:', parseError);
        return res.status(400).json({ 
          error: language === 'uz' 
            ? 'Imzolangan hujjatni o\'qishda xato' 
            : 'Ошибка чтения подписанного документа' 
        });
      }
      
      // Signature verified and document validated, now update the profile
      const userUpdates: Partial<any> = {};
      if (displayName !== undefined) userUpdates.displayName = displayName;
      if (email !== undefined) userUpdates.email = email;
      if (phone !== undefined) userUpdates.phone = normalizePhone(phone);
      if (firstName !== undefined) userUpdates.firstName = firstName;
      if (lastName !== undefined) userUpdates.lastName = lastName;
      if (middleName !== undefined) userUpdates.middleName = middleName;
      if (pinfl !== undefined) userUpdates.pinfl = pinfl;
      if (ndsPayer !== undefined) userUpdates.ndsPayer = ndsPayer;
      
      const updatedUser = await storage.updateUser(req.user!.id, userUpdates);
      
      if (!updatedUser) {
        return res.status(404).json({ error: language === 'uz' ? 'Foydalanuvchi topilmadi' : 'Пользователь не найден' });
      }

      // Update or create profile data
      let updatedProfile = await storage.getProfileByUserId(req.user!.id);
      
      const profileUpdates: Partial<any> = {};
      if (companyName !== undefined) profileUpdates.companyName = companyName;
      if (inn !== undefined) profileUpdates.inn = inn;
      if (passportSeries !== undefined) profileUpdates.passportSeries = passportSeries;
      if (passportNumber !== undefined) profileUpdates.passportNumber = passportNumber;
      if (bankAccount !== undefined) profileUpdates.bankAccount = bankAccount;
      if (bankName !== undefined) profileUpdates.bankName = bankName;
      if (bankCode !== undefined) profileUpdates.bankCode = bankCode;
      if (registrationCodeNds !== undefined) profileUpdates.registrationCodeNds = registrationCodeNds;
      // Store E-IMZO signature info
      profileUpdates.lastEimzoSignature = eimzoSignature;
      profileUpdates.lastEimzoSignerCn = signerInfo.CN;
      profileUpdates.lastEimzoSignTime = signerInfo.signTime || new Date().toISOString();
      
      if (updatedProfile) {
        updatedProfile = await storage.updateProfile(req.user!.id, profileUpdates) || updatedProfile;
      } else if (Object.keys(profileUpdates).length > 0) {
        updatedProfile = await storage.createProfile({ userId: req.user!.id, ...profileUpdates });
      }

      res.json({ 
        success: true,
        user: { 
          id: updatedUser.id, 
          phone: updatedUser.phone, 
          displayName: updatedUser.displayName, 
          roles: updatedUser.roles,
          defaultRole: updatedUser.defaultRole,
          userType: updatedUser.userType,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          middleName: updatedUser.middleName,
          pinfl: updatedProfile?.pinfl,
          ndsPayer: updatedProfile?.ndsPayer,
          companyName: updatedProfile?.companyName,
          inn: updatedProfile?.inn,
          passportSeries: updatedProfile?.passportSeries,
          passportNumber: updatedProfile?.passportNumber,
          bankAccount: updatedProfile?.bankAccount,
          bankName: updatedProfile?.bankName,
          bankCode: updatedProfile?.bankCode,
          registrationCodeNds: updatedProfile?.registrationCodeNds,
        },
        profile: updatedProfile,
        eimzoSigner: signerInfo.CN
      });
    } catch (error) {
      console.error('Profile update with E-IMZO error:', error);
      const errorMsg = language === 'uz'
        ? 'Xatolik yuz berdi. Qayta urinib ko\'ring.'
        : 'Произошла ошибка. Попробуйте снова.';
      res.status(500).json({ error: errorMsg });
    }
  });

  // ============== PHONE CHANGE ENDPOINTS ==============
  // Cooling-off period duration in hours (48 hours for lost old phone scenario)
  const PHONE_CHANGE_COOLDOWN_HOURS = 48;

  // Get current phone change request status
  app.get('/api/phone-change/status', authenticate, async (req: AuthRequest, res: Response) => {
    const language = (req.query.language as string) || 'ru';
    try {
      const pendingRequest = await db.select()
        .from(schema.phoneChangeRequests)
        .where(and(
          eq(schema.phoneChangeRequests.userId, req.user!.id),
          inArray(schema.phoneChangeRequests.status, ['pending_verification', 'pending_cooldown'])
        ))
        .orderBy(desc(schema.phoneChangeRequests.createdAt))
        .limit(1);
      
      if (pendingRequest.length === 0) {
        return res.json({ hasPendingRequest: false });
      }

      const request = pendingRequest[0];
      const now = new Date();
      
      // Check if cooldown has ended and auto-apply
      if (request.status === 'pending_cooldown' && request.cooldownEndsAt && request.cooldownEndsAt <= now) {
        // Cooldown ended - this will be handled by the scheduled job
        // Just report the current status
      }

      res.json({
        hasPendingRequest: true,
        request: {
          id: request.id,
          newPhone: request.newPhone,
          status: request.status,
          hasOldPhoneAccess: request.hasOldPhoneAccess,
          oldPhoneVerified: request.oldPhoneVerified,
          newPhoneVerified: request.newPhoneVerified,
          passwordVerified: request.passwordVerified,
          cooldownEndsAt: request.cooldownEndsAt,
          createdAt: request.createdAt
        }
      });
    } catch (error) {
      console.error('Get phone change status error:', error);
      res.status(500).json({ error: language === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка' });
    }
  });

  // Initiate phone change request
  app.post('/api/phone-change/initiate', authenticate, async (req: AuthRequest, res: Response) => {
    const { newPhone, hasOldPhoneAccess = true, language = 'ru' } = req.body;
    
    try {
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: language === 'uz' ? 'Foydalanuvchi topilmadi' : 'Пользователь не найден' });
      }

      // Validate new phone
      if (!newPhone) {
        return res.status(400).json({ 
          error: language === 'uz' ? 'Yangi telefon raqamini kiriting' : 'Введите новый номер телефона' 
        });
      }

      const normalizedNewPhone = normalizePhone(newPhone);
      
      // Check if new phone is same as current
      if (normalizedNewPhone === user.phone) {
        return res.status(400).json({ 
          error: language === 'uz' ? 'Yangi raqam joriy raqamdan farq qilishi kerak' : 'Новый номер должен отличаться от текущего' 
        });
      }

      // Check if new phone is already registered
      const existingUser = await storage.getUserByPhone(normalizedNewPhone);
      if (existingUser) {
        return res.status(400).json({ 
          error: language === 'uz' ? 'Bu raqam allaqachon ro\'yxatdan o\'tgan' : 'Этот номер уже зарегистрирован' 
        });
      }

      // HIGH-RISK ACCOUNT CHECK: Block phone change for accounts with active orders or deposits
      // This follows NIST SP 800-63B guidance for high-risk operations requiring manual verification
      // Order status enum: 'new', 'assigned', 'completed', 'cancelled'
      // Active statuses: 'new' (pending offers/assignment), 'assigned' (order in progress)
      const activeOrders = await db.select()
        .from(schema.orders)
        .where(and(
          eq(schema.orders.customerId, req.user!.id),
          inArray(schema.orders.status, ['new', 'assigned'])
        ))
        .limit(1);

      // Check for carrier orders via contracts table (active = not closed or terminated)
      const activeCarrierContracts = await db.select()
        .from(schema.contracts)
        .where(and(
          eq(schema.contracts.carrierId, req.user!.id),
          inArray(schema.contracts.status, [
            'draft', 'pending_customer_signature', 'pending_carrier_signature',
            'signed_by_customer', 'signed_by_carrier', 'fully_signed',
            'awaiting_prepayment', 'prepayment_made', 'awaiting_completion_confirmation'
          ])
        ))
        .limit(1);

      // Check for non-zero deposit balances (each account type is a separate row)
      const deposits = await db.select()
        .from(schema.deposits)
        .where(eq(schema.deposits.userId, req.user!.id));

      const hasNonZeroDeposit = deposits.some(d => 
        Number(d.balance) > 0 || 
        Number(d.blocked) > 0
      );

      if (activeOrders.length > 0 || activeCarrierContracts.length > 0 || hasNonZeroDeposit) {
        console.log(`[PHONE_CHANGE] High-risk account blocked: userId=${req.user!.id}, activeCustomerOrders=${activeOrders.length}, activeCarrierContracts=${activeCarrierContracts.length}, hasDeposit=${hasNonZeroDeposit}`);
        return res.status(403).json({ 
          error: language === 'uz' 
            ? 'Faol buyurtmalar yoki depozit balanslaringiz bor. Telefon raqamini o\'zgartirish uchun qo\'llab-quvvatlash xizmatiga murojaat qiling.' 
            : 'У вас есть активные заказы или депозиты. Для смены номера телефона обратитесь в службу поддержки.',
          requiresSupport: true
        });
      }

      // Cancel any existing pending requests
      await db.update(schema.phoneChangeRequests)
        .set({ status: 'cancelled', cancelledAt: new Date() })
        .where(and(
          eq(schema.phoneChangeRequests.userId, req.user!.id),
          inArray(schema.phoneChangeRequests.status, ['pending_verification', 'pending_cooldown'])
        ));

      // Create new phone change request
      const [newRequest] = await db.insert(schema.phoneChangeRequests)
        .values({
          userId: req.user!.id,
          oldPhone: user.phone,
          newPhone: normalizedNewPhone,
          status: 'pending_verification',
          hasOldPhoneAccess: hasOldPhoneAccess,
        })
        .returning();

      // Determine next step based on scenario
      let nextStep: string;
      if (hasOldPhoneAccess) {
        nextStep = 'verify_old_phone';
      } else {
        nextStep = 'verify_password';
      }

      res.json({ 
        success: true, 
        requestId: newRequest.id,
        nextStep,
        message: hasOldPhoneAccess 
          ? (language === 'uz' ? 'Eski raqamingizga SMS kod yuboriladi' : 'СМС код будет отправлен на ваш текущий номер')
          : (language === 'uz' ? 'Parolingizni tasdiqlang' : 'Подтвердите ваш пароль')
      });
    } catch (error) {
      console.error('Initiate phone change error:', error);
      res.status(500).json({ error: language === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка' });
    }
  });

  // Verify old phone with SMS (Scenario 1)
  app.post('/api/phone-change/verify-old-phone', authenticate, async (req: AuthRequest, res: Response) => {
    const { requestId, code, language = 'ru' } = req.body;
    
    try {
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: language === 'uz' ? 'Foydalanuvchi topilmadi' : 'Пользователь не найден' });
      }

      // Get the pending request
      const [request] = await db.select()
        .from(schema.phoneChangeRequests)
        .where(and(
          eq(schema.phoneChangeRequests.id, requestId),
          eq(schema.phoneChangeRequests.userId, req.user!.id),
          eq(schema.phoneChangeRequests.status, 'pending_verification')
        ));

      if (!request) {
        return res.status(404).json({ 
          error: language === 'uz' ? 'So\'rov topilmadi' : 'Запрос не найден' 
        });
      }

      // Verify SMS code
      const verificationResult = await verifyOtp(request.oldPhone, code, 'phone_change', language);
      
      if (!verificationResult.success) {
        return res.status(400).json({ 
          error: verificationResult.error,
          attemptsRemaining: verificationResult.attemptsRemaining
        });
      }

      // Mark old phone as verified
      await db.update(schema.phoneChangeRequests)
        .set({ oldPhoneVerified: true })
        .where(eq(schema.phoneChangeRequests.id, requestId));

      res.json({ 
        success: true, 
        nextStep: 'verify_new_phone',
        message: language === 'uz' ? 'Eski raqam tasdiqlandi. Yangi raqamni tasdiqlang.' : 'Старый номер подтверждён. Подтвердите новый номер.'
      });
    } catch (error) {
      console.error('Verify old phone error:', error);
      res.status(500).json({ error: language === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка' });
    }
  });

  // Verify password (Scenario 2 - lost old phone)
  app.post('/api/phone-change/verify-password', authenticate, async (req: AuthRequest, res: Response) => {
    const { requestId, password, language = 'ru' } = req.body;
    
    try {
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: language === 'uz' ? 'Foydalanuvchi topilmadi' : 'Пользователь не найден' });
      }

      // Get the pending request
      const [request] = await db.select()
        .from(schema.phoneChangeRequests)
        .where(and(
          eq(schema.phoneChangeRequests.id, requestId),
          eq(schema.phoneChangeRequests.userId, req.user!.id),
          eq(schema.phoneChangeRequests.status, 'pending_verification'),
          eq(schema.phoneChangeRequests.hasOldPhoneAccess, false)
        ));

      if (!request) {
        return res.status(404).json({ 
          error: language === 'uz' ? 'So\'rov topilmadi' : 'Запрос не найден' 
        });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ 
          error: language === 'uz' ? 'Noto\'g\'ri parol' : 'Неверный пароль' 
        });
      }

      // Mark password as verified
      await db.update(schema.phoneChangeRequests)
        .set({ passwordVerified: true })
        .where(eq(schema.phoneChangeRequests.id, requestId));

      res.json({ 
        success: true, 
        nextStep: 'verify_new_phone',
        message: language === 'uz' ? 'Parol tasdiqlandi. Yangi raqamni tasdiqlang.' : 'Пароль подтверждён. Подтвердите новый номер.'
      });
    } catch (error) {
      console.error('Verify password error:', error);
      res.status(500).json({ error: language === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка' });
    }
  });

  // Send OTP to new phone
  app.post('/api/phone-change/send-new-phone-otp', authenticate, async (req: AuthRequest, res: Response) => {
    const { requestId, language = 'ru' } = req.body;
    
    try {
      // Get the pending request
      const [request] = await db.select()
        .from(schema.phoneChangeRequests)
        .where(and(
          eq(schema.phoneChangeRequests.id, requestId),
          eq(schema.phoneChangeRequests.userId, req.user!.id),
          eq(schema.phoneChangeRequests.status, 'pending_verification')
        ));

      if (!request) {
        return res.status(404).json({ 
          error: language === 'uz' ? 'So\'rov topilmadi' : 'Запрос не найден' 
        });
      }

      // Check if previous step is completed
      if (request.hasOldPhoneAccess && !request.oldPhoneVerified) {
        return res.status(400).json({ 
          error: language === 'uz' ? 'Avval eski raqamni tasdiqlang' : 'Сначала подтвердите старый номер' 
        });
      }
      if (!request.hasOldPhoneAccess && !request.passwordVerified) {
        return res.status(400).json({ 
          error: language === 'uz' ? 'Avval parolni tasdiqlang' : 'Сначала подтвердите пароль' 
        });
      }

      // Send OTP to new phone
      const result = await sendOtp(request.newPhone, 'phone_change', language);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: result.error,
          cooldownRemaining: result.cooldownRemaining
        });
      }

      res.json({ 
        success: true,
        message: language === 'uz' ? 'SMS kod yangi raqamga yuborildi' : 'СМС код отправлен на новый номер'
      });
    } catch (error) {
      console.error('Send new phone OTP error:', error);
      res.status(500).json({ error: language === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка' });
    }
  });

  // Send OTP to old phone
  app.post('/api/phone-change/send-old-phone-otp', authenticate, async (req: AuthRequest, res: Response) => {
    const { requestId, language = 'ru' } = req.body;
    
    try {
      // Get the pending request
      const [request] = await db.select()
        .from(schema.phoneChangeRequests)
        .where(and(
          eq(schema.phoneChangeRequests.id, requestId),
          eq(schema.phoneChangeRequests.userId, req.user!.id),
          eq(schema.phoneChangeRequests.status, 'pending_verification')
        ));

      if (!request) {
        return res.status(404).json({ 
          error: language === 'uz' ? 'So\'rov topilmadi' : 'Запрос не найден' 
        });
      }

      if (!request.hasOldPhoneAccess) {
        return res.status(400).json({ 
          error: language === 'uz' ? 'Bu so\'rov eski raqamga kirish imkoniyatisiz' : 'Этот запрос без доступа к старому номеру' 
        });
      }

      // Send OTP to old phone
      const result = await sendOtp(request.oldPhone, 'phone_change', language);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: result.error,
          cooldownRemaining: result.cooldownRemaining
        });
      }

      res.json({ 
        success: true,
        message: language === 'uz' ? 'SMS kod eski raqamga yuborildi' : 'СМС код отправлен на старый номер'
      });
    } catch (error) {
      console.error('Send old phone OTP error:', error);
      res.status(500).json({ error: language === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка' });
    }
  });

  // Verify new phone with SMS
  app.post('/api/phone-change/verify-new-phone', authenticate, async (req: AuthRequest, res: Response) => {
    const { requestId, code, language = 'ru' } = req.body;
    
    try {
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: language === 'uz' ? 'Foydalanuvchi topilmadi' : 'Пользователь не найден' });
      }

      // Get the pending request
      const [request] = await db.select()
        .from(schema.phoneChangeRequests)
        .where(and(
          eq(schema.phoneChangeRequests.id, requestId),
          eq(schema.phoneChangeRequests.userId, req.user!.id),
          eq(schema.phoneChangeRequests.status, 'pending_verification')
        ));

      if (!request) {
        return res.status(404).json({ 
          error: language === 'uz' ? 'So\'rov topilmadi' : 'Запрос не найден' 
        });
      }

      // Check if previous step is completed
      if (request.hasOldPhoneAccess && !request.oldPhoneVerified) {
        return res.status(400).json({ 
          error: language === 'uz' ? 'Avval eski raqamni tasdiqlang' : 'Сначала подтвердите старый номер' 
        });
      }
      if (!request.hasOldPhoneAccess && !request.passwordVerified) {
        return res.status(400).json({ 
          error: language === 'uz' ? 'Avval parolni tasdiqlang' : 'Сначала подтвердите пароль' 
        });
      }

      // Verify SMS code
      const verificationResult = await verifyOtp(request.newPhone, code, 'phone_change', language);
      
      if (!verificationResult.success) {
        return res.status(400).json({ 
          error: verificationResult.error,
          attemptsRemaining: verificationResult.attemptsRemaining
        });
      }

      // Mark new phone as verified
      await db.update(schema.phoneChangeRequests)
        .set({ newPhoneVerified: true })
        .where(eq(schema.phoneChangeRequests.id, requestId));

      // Determine next step based on scenario
      if (request.hasOldPhoneAccess) {
        // Scenario 1: Has access to old phone - apply immediately
        await db.update(schema.phoneChangeRequests)
          .set({ status: 'completed', completedAt: new Date() })
          .where(eq(schema.phoneChangeRequests.id, requestId));

        // Update user's phone number
        await storage.updateUser(req.user!.id, { phone: request.newPhone });

        res.json({ 
          success: true, 
          applied: true,
          message: language === 'uz' ? 'Telefon raqamingiz o\'zgartirildi!' : 'Ваш номер телефона изменён!'
        });
      } else {
        // Scenario 2: Lost old phone - start cooldown period
        const cooldownEndsAt = new Date();
        cooldownEndsAt.setHours(cooldownEndsAt.getHours() + PHONE_CHANGE_COOLDOWN_HOURS);

        await db.update(schema.phoneChangeRequests)
          .set({ 
            status: 'pending_cooldown',
            cooldownEndsAt 
          })
          .where(eq(schema.phoneChangeRequests.id, requestId));

        res.json({ 
          success: true, 
          applied: false,
          cooldownEndsAt,
          cooldownHours: PHONE_CHANGE_COOLDOWN_HOURS,
          message: language === 'uz' 
            ? `Xavfsizlik maqsadida telefon raqamingiz ${PHONE_CHANGE_COOLDOWN_HOURS} soatdan keyin o'zgartiriladi. Shu vaqt ichida bekor qilishingiz mumkin.` 
            : `В целях безопасности ваш номер телефона будет изменён через ${PHONE_CHANGE_COOLDOWN_HOURS} часов. Вы можете отменить это в течение этого времени.`
        });
      }
    } catch (error) {
      console.error('Verify new phone error:', error);
      res.status(500).json({ error: language === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка' });
    }
  });

  // Cancel phone change request
  app.post('/api/phone-change/cancel', authenticate, async (req: AuthRequest, res: Response) => {
    const { requestId, language = 'ru' } = req.body;
    
    try {
      // Get the pending request
      const [request] = await db.select()
        .from(schema.phoneChangeRequests)
        .where(and(
          eq(schema.phoneChangeRequests.id, requestId),
          eq(schema.phoneChangeRequests.userId, req.user!.id),
          inArray(schema.phoneChangeRequests.status, ['pending_verification', 'pending_cooldown'])
        ));

      if (!request) {
        return res.status(404).json({ 
          error: language === 'uz' ? 'So\'rov topilmadi' : 'Запрос не найден' 
        });
      }

      // Cancel the request
      await db.update(schema.phoneChangeRequests)
        .set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(schema.phoneChangeRequests.id, requestId));

      res.json({ 
        success: true,
        message: language === 'uz' ? 'So\'rov bekor qilindi' : 'Запрос отменён'
      });
    } catch (error) {
      console.error('Cancel phone change error:', error);
      res.status(500).json({ error: language === 'uz' ? 'Xatolik yuz berdi' : 'Произошла ошибка' });
    }
  });

  // Change password endpoint
  app.post('/api/profile/change-password', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }
      
      // Get user with password hash
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Verify current password
      const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      
      // Hash new password and update
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(req.user!.id, { passwordHash: newPasswordHash });
      
      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

  // Change password via SMS code endpoint
  app.post('/api/profile/change-password-sms', authenticate, async (req: AuthRequest, res: Response) => {
    const language = req.body?.language || 'ru';
    try {
      const { newPassword, smsCode } = req.body;
      
      if (!newPassword || !smsCode) {
        const errorMsg = language === 'uz' 
          ? 'Yangi parol va SMS kod majburiy'
          : 'Новый пароль и SMS код обязательны';
        return res.status(400).json({ error: errorMsg });
      }
      
      if (newPassword.length < 6) {
        const errorMsg = language === 'uz' 
          ? 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak'
          : 'Пароль должен быть не менее 6 символов';
        return res.status(400).json({ error: errorMsg });
      }
      
      // Get user
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        const errorMsg = language === 'uz' 
          ? 'Foydalanuvchi topilmadi'
          : 'Пользователь не найден';
        return res.status(404).json({ error: errorMsg });
      }
      
      // Verify SMS code
      const verifyResult = await verifyOtp(user.phone, smsCode, 'password_change', language);
      if (!verifyResult.success) {
        return res.status(400).json({ error: verifyResult.error });
      }
      
      // Hash new password and update
      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateUser(req.user!.id, { passwordHash: newPasswordHash });
      
      const successMsg = language === 'uz' 
        ? 'Parol muvaffaqiyatli o\'zgartirildi'
        : 'Пароль успешно изменён';
      res.json({ success: true, message: successMsg });
    } catch (error) {
      console.error('Password change via SMS error:', error);
      const errorMsg = language === 'uz'
        ? 'Xatolik yuz berdi. Qayta urinib ko\'ring.'
        : 'Произошла ошибка. Попробуйте снова.';
      res.status(500).json({ error: errorMsg });
    }
  });

  // Order routes
  app.get('/api/orders', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { status, context } = req.query;
      const roleContext = context as string || 'customer';
      
      // Check for representative mode
      const representativeCustomerId = req.headers['x-representative-customer-id'];
      let effectiveCustomerId = req.user!.id;
      
      if (representativeCustomerId && roleContext === 'customer') {
        const customerId = parseInt(representativeCustomerId as string, 10);
        if (!isNaN(customerId)) {
          // Verify user is an active representative for this customer
          const hasPermission = await storage.checkRepresentativePermission(customerId, req.user!.id, 'create_order');
          if (hasPermission) {
            effectiveCustomerId = customerId;
            console.log('[ORDERS DEBUG] Representative mode: viewing orders for customerId', customerId);
          }
        }
      }
      
      console.log('[ORDERS DEBUG] GET /api/orders:', { userId: req.user!.id, effectiveCustomerId, context: roleContext, roles: req.user!.roles });
      
      // Validate that user has the requested role context
      if (roleContext === 'customer' && !req.user!.roles.includes('customer')) {
        console.log('[ORDERS DEBUG] 403: User lacks customer role for customer context');
        return res.status(403).json({ error: 'Access denied: customer role required' });
      }
      if (roleContext === 'carrier' && !req.user!.roles.includes('carrier')) {
        console.log('[ORDERS DEBUG] 403: User lacks carrier role for carrier context');
        return res.status(403).json({ error: 'Access denied: carrier role required' });
      }
      if (roleContext === 'partner' && !req.user!.roles.includes('agent')) {
        console.log('[ORDERS DEBUG] 403: User lacks agent role for partner context');
        return res.status(403).json({ error: 'Access denied: partner role required' });
      }
      
      let orders: Order[] = [];
      
      // Use context parameter to determine which orders to return
      if (roleContext === 'customer') {
        // Customer sees ALL their own orders (including deleted ones with 'deleted' status)
        orders = await storage.getAllOrdersByCustomerId(effectiveCustomerId);
        console.log('[ORDERS DEBUG] Customer context: fetched', orders.length, 'orders for customerId', effectiveCustomerId);
      } else if (roleContext === 'carrier') {
        // Carrier sees ALL orders EXCEPT their own
        const allOrders = await storage.getAllOrders(status ? { status: status as string } : undefined);
        console.log('[ORDERS DEBUG] Carrier context: all orders count', allOrders.length);
        orders = allOrders.filter(order => order.customerId !== req.user!.id);
        console.log('[ORDERS DEBUG] Carrier context: after filter (customerId !==', req.user!.id, '), count', orders.length);
      } else if (roleContext === 'partner') {
        // Partner sees all orders
        orders = await storage.getAllOrders();
      } else {
        // Unknown context - return empty array
        console.log('[ORDERS DEBUG] Unknown context, returning empty array');
        orders = [];
      }
      
      // Enrich orders with customer VAT info, recalculate priceWithoutVat, normalize location points, and add active offers count
      const enrichedOrders = await Promise.all(orders.map(async (order) => {
        const customerProfile = await storage.getProfileByUserId(order.customerId);
        const isVatPayer = customerProfile?.ndsPayer ?? true;
        
        // Recalculate priceWithoutVat based on customer's VAT payer status
        // Use integer arithmetic (priceWithVat * 100 / 112) to avoid floating point errors
        const orderPriceWithVat = Number(order.priceWithVat) || 0;
        const priceWithoutVat = isVatPayer && orderPriceWithVat 
          ? Math.round(orderPriceWithVat * 100 / 112) 
          : orderPriceWithVat;
        
        // Normalize location points - ensure originPoints/destinationPoints exist for all orders
        // For legacy orders without these fields, create from single region/district
        const originPoints = order.originPoints && order.originPoints.length > 0
          ? order.originPoints
          : [{ region: order.originRegion, districts: order.originDistrict }];
        
        const destinationPoints = order.destinationPoints && order.destinationPoints.length > 0
          ? order.destinationPoints
          : [{ region: order.destinationRegion, districts: order.destinationDistrict }];
        
        // Get active offers count for customer context
        let activeOffersCount = 0;
        if (roleContext === 'customer') {
          const offers = await storage.getOffersByOrderId(order.id);
          activeOffersCount = offers.filter(o => o.status === 'active').length;
        }
        
        // Get creator info if order was created by a representative
        let createdByUser: { id: number; displayName: string } | null = null;
        if (order.createdByUserId && order.createdByUserId !== order.customerId) {
          const creator = await storage.getUserById(order.createdByUserId);
          if (creator) {
            createdByUser = {
              id: creator.id,
              displayName: creator.displayName
            };
          }
        }
        
        return {
          ...order,
          priceWithoutVat,
          originPoints,
          destinationPoints,
          activeOffersCount,
          createdByUser
        };
      }));
      
      res.json(enrichedOrders);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  app.get('/api/orders/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const order = await storage.getOrderById(parseInt(req.params.id));
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Normalize location points for legacy orders
      const originPoints = order.originPoints && order.originPoints.length > 0
        ? order.originPoints
        : [{ region: order.originRegion, districts: order.originDistrict }];
      
      const destinationPoints = order.destinationPoints && order.destinationPoints.length > 0
        ? order.destinationPoints
        : [{ region: order.destinationRegion, districts: order.destinationDistrict }];
      
      // Recalculate priceWithoutVat based on customer's VAT payer status
      const customerProfile = await storage.getProfileByUserId(order.customerId);
      const isVatPayer = customerProfile?.ndsPayer ?? true;
      const orderPriceWithVat = Number(order.priceWithVat) || 0;
      const priceWithoutVat = isVatPayer && orderPriceWithVat
        ? Math.round(orderPriceWithVat * 100 / 112)
        : orderPriceWithVat;

      res.json({ ...order, originPoints, destinationPoints, priceWithoutVat });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch order' });
    }
  });

  app.post('/api/orders', authenticate, authorize('customer'), async (req: AuthRequest, res: Response) => {
    try {
      // Rate limiting: 5 orders per minute per user
      const rateCheck = checkOrderRateLimit(req.user!.id);
      if (!rateCheck.allowed) {
        const language = (req.headers['accept-language'] || 'ru').includes('uz') ? 'uz' : 'ru';
        const resetSeconds = Math.ceil(rateCheck.resetIn / 1000);
        const errorMsg = language === 'uz'
          ? `Juda ko'p buyurtma yaratildi. ${resetSeconds} soniyadan keyin qayta urinib ko'ring.`
          : `Слишком много заказов. Попробуйте через ${resetSeconds} секунд.`;
        return res.status(429).json({ error: errorMsg });
      }
      
      const orderData = insertOrderSchema.parse(req.body);
      
      // Check for representative mode
      const representativeCustomerIdHeader = req.headers['x-representative-customer-id'] as string | undefined;
      let effectiveCustomerId = req.user!.id;
      let createdByUserId = req.user!.id;
      
      if (representativeCustomerIdHeader) {
        const representedCustomerId = parseInt(representativeCustomerIdHeader, 10);
        if (!isNaN(representedCustomerId)) {
          // Verify representative has create_order permission
          const hasPermission = await storage.checkRepresentativePermission(
            representedCustomerId,
            req.user!.id,
            'create_order'
          );
          
          if (!hasPermission) {
            return res.status(403).json({ 
              error: 'Нет прав на создание заказов для этого клиента / Bu mijoz uchun buyurtma yaratish huquqi yo\'q' 
            });
          }
          
          effectiveCustomerId = representedCustomerId;
          createdByUserId = req.user!.id; // Representative's ID
          console.log(`[ORDER] Representative ${req.user!.id} creating order for customer ${effectiveCustomerId}`);
        }
      }
      
      // Validate loading time against Tashkent timezone (UTC+5)
      if (orderData.loadDate && orderData.loadingTime) {
        const nowUtc = Date.now();
        
        // Parse user-entered date/time (in Tashkent timezone)
        const [year, month, day] = orderData.loadDate.split('-').map(Number);
        const [hours, minutes] = orderData.loadingTime.split(':').map(Number);
        
        // Convert Tashkent time to UTC by subtracting 5 hours
        // Date.UTC handles negative hours/day rollover automatically
        const selectedUtc = Date.UTC(year, month - 1, day, hours - 5, minutes);
        
        console.log('[TIMEZONE DEBUG] Input:', { loadDate: orderData.loadDate, loadingTime: orderData.loadingTime });
        console.log('[TIMEZONE DEBUG] Parsed:', { year, month, day, hours, minutes });
        console.log('[TIMEZONE DEBUG] nowUtc:', new Date(nowUtc).toISOString(), '(', nowUtc, ')');
        console.log('[TIMEZONE DEBUG] selectedUtc:', new Date(selectedUtc).toISOString(), '(', selectedUtc, ')');
        console.log('[TIMEZONE DEBUG] Comparison: selectedUtc < nowUtc:', selectedUtc < nowUtc, 'Diff (hours):', (selectedUtc - nowUtc) / (1000 * 60 * 60));
        
        if (selectedUtc < nowUtc) {
          return res.status(400).json({ 
            error: 'Invalid loading time',
            message: 'Время загрузки не может быть раньше текущего времени. Пожалуйста, выберите время не ранее текущего момента. / Yuklash vaqti joriy vaqtdan oldin bo\'lishi mumkin emas. Iltimos, hozirgi vaqtdan kechroq vaqtni tanlang.'
          });
        }
      }
      
      // Calculate customer collateral if requiresCollateral is true
      let customerBlockedCollateral = 0;
      if (orderData.requiresCollateral && orderData.priceWithVat) {
        customerBlockedCollateral = Math.floor(orderData.priceWithVat * 0.02);
        
        // Check customer's AVAILABLE balance (main - blocked) - use effectiveCustomerId for representative mode
        const mainDeposit = await storage.getDepositByUserIdAndType(effectiveCustomerId, 'main');
        const blockedDeposit = await storage.getDepositByUserIdAndType(effectiveCustomerId, 'blocked');
        const availableBalance = Number(mainDeposit?.balance) || 0;
        
        if (availableBalance < customerBlockedCollateral) {
          const shortage = customerBlockedCollateral - availableBalance;
          return res.status(400).json({ 
            error: 'Insufficient deposit balance for collateral',
            message: `Недостаточно средств на депозите для блокировки залога. Требуется: ${customerBlockedCollateral.toLocaleString('ru-RU')} сум (2% от ${orderData.priceWithVat.toLocaleString('ru-RU')} сум). На балансе: ${availableBalance.toLocaleString('ru-RU')} сум. Не хватает: ${shortage.toLocaleString('ru-RU')} сум.`,
            required: customerBlockedCollateral,
            available: availableBalance,
            shortage: shortage
          });
        }
      }
      
      // Block collateral FIRST (atomic transaction in transferBetweenAccounts)
      // If this fails, no order is created - simple and safe
      let blockResult: { success: boolean; transactionIds?: { outId: number; inId: number } } = { success: true };
      if (customerBlockedCollateral > 0) {
        blockResult = await storage.transferBetweenAccounts(
          effectiveCustomerId,
          'main',
          'blocked',
          customerBlockedCollateral,
          `Блокировка залога заказчика`
        );
        
        if (!blockResult.success) {
          console.error(`[COLLATERAL] Failed to block ${customerBlockedCollateral} for user ${effectiveCustomerId}`);
          return res.status(400).json({ 
            error: 'Failed to block collateral',
            message: `Не удалось заблокировать залог в размере ${customerBlockedCollateral.toLocaleString('ru-RU')} сум. Пожалуйста, пополните депозит и попробуйте снова.`,
            required: customerBlockedCollateral
          });
        }
        console.log(`[COLLATERAL] Blocked ${customerBlockedCollateral} for user ${effectiveCustomerId}`);
      }
      
      // Sanitize notes field to prevent XSS/HTML injection
      const sanitizedNotes = sanitizeTextInput(orderData.notes);
      
      // Create order after successful collateral blocking
      // If order creation fails, unblock the collateral with verification
      let order;
      try {
        order = await storage.createOrder({
          ...orderData,
          notes: sanitizedNotes,
          customerId: effectiveCustomerId,
          createdByUserId,
          customerBlockedCollateral,
        } as any);
      } catch (createError) {
        // Rollback: return collateral to main account with verification
        if (customerBlockedCollateral > 0) {
          console.log(`[COLLATERAL] Order creation failed, attempting to unblock ${customerBlockedCollateral} for user ${effectiveCustomerId}`);
          const rollbackResult = await storage.transferBetweenAccounts(
            effectiveCustomerId,
            'blocked',
            'main',
            customerBlockedCollateral,
            `Возврат залога - ошибка создания заказа`
          );
          if (!rollbackResult.success) {
            // CRITICAL: Funds are stuck in blocked, manual intervention required
            console.error(`[COLLATERAL] CRITICAL: Failed to unblock ${customerBlockedCollateral} for user ${effectiveCustomerId} after order creation failure`);
            return res.status(500).json({ 
              error: 'Critical error - collateral rollback failed',
              message: 'Критическая ошибка: не удалось вернуть залог. Обратитесь в поддержку.',
              blockedAmount: customerBlockedCollateral
            });
          }
          console.log(`[COLLATERAL] Successfully unblocked ${customerBlockedCollateral} for user ${effectiveCustomerId}`);
        }
        throw createError;
      }
      
      // Update transaction reference with order number
      if (customerBlockedCollateral > 0 && blockResult.transactionIds) {
        const { outId, inId } = blockResult.transactionIds;
        await storage.updateDepositTransaction(outId, { 
          reference: `Блокировка залога заказчика по заказу №${order.id}` 
        });
        await storage.updateDepositTransaction(inId, { 
          reference: `Блокировка залога заказчика по заказу №${order.id}` 
        });
      }
      
      console.log(`[ORDER] Order ${order.id} created with customer collateral ${customerBlockedCollateral}`);
      
      sendOrderNotification(order).catch(err => {
        console.error('[ORDER] Failed to send Telegram notification:', err);
      });
      
      res.json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid order data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to create order' });
    }
  });

  app.put('/api/orders/:id', authenticate, authorize('customer'), async (req: AuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrderById(orderId);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Check for representative mode
      const representativeCustomerIdHeader = req.headers['x-representative-customer-id'] as string | undefined;
      
      if (representativeCustomerIdHeader) {
        const representedCustomerId = parseInt(representativeCustomerIdHeader, 10);
        if (!isNaN(representedCustomerId) && order.customerId === representedCustomerId) {
          // Representative mode - check edit_own_orders permission
          const hasPermission = await storage.checkRepresentativePermission(
            representedCustomerId,
            req.user!.id,
            'edit_own_orders'
          );
          
          if (!hasPermission) {
            return res.status(403).json({ 
              error: 'Нет прав на редактирование заказов / Buyurtmalarni tahrirlash huquqi yo\'q' 
            });
          }
          
          // Representatives can only edit orders they created
          if (order.createdByUserId !== req.user!.id) {
            return res.status(403).json({ 
              error: 'Вы можете редактировать только заказы, созданные вами / Siz faqat o\'zingiz yaratgan buyurtmalarni tahrirlashingiz mumkin' 
            });
          }
          
          console.log(`[ORDER] Representative ${req.user!.id} editing order ${orderId} for customer ${representedCustomerId}`);
        } else {
          return res.status(403).json({ error: 'Not authorized to edit this order' });
        }
      } else {
        // Normal mode - user must be the customer
        if (order.customerId !== req.user!.id) {
          return res.status(403).json({ error: 'Not authorized to edit this order' });
        }
      }
      
      // Check if order has any active offers (exclude cancelled/rejected)
      const offers = await storage.getOffersByOrderId(orderId);
      const activeOffers = offers.filter(offer => offer.status === 'active');
      
      if (activeOffers.length > 0) {
        return res.status(400).json({ 
          error: 'Cannot edit order with active offers', 
          message: 'Please reject all offers first before editing this order' 
        });
      }
      
      const orderData = insertOrderSchema.parse(req.body);
      
      // Validate loading time against Tashkent timezone (UTC+5)
      if (orderData.loadDate && orderData.loadingTime) {
        const nowUtc = Date.now();
        
        // Parse user-entered date/time (in Tashkent timezone)
        const [year, month, day] = orderData.loadDate.split('-').map(Number);
        const [hours, minutes] = orderData.loadingTime.split(':').map(Number);
        
        // Convert Tashkent time to UTC by subtracting 5 hours
        // Date.UTC handles negative hours/day rollover automatically
        const selectedUtc = Date.UTC(year, month - 1, day, hours - 5, minutes);
        
        console.log('[TIMEZONE DEBUG] Input:', { loadDate: orderData.loadDate, loadingTime: orderData.loadingTime });
        console.log('[TIMEZONE DEBUG] Parsed:', { year, month, day, hours, minutes });
        console.log('[TIMEZONE DEBUG] nowUtc:', new Date(nowUtc).toISOString(), '(', nowUtc, ')');
        console.log('[TIMEZONE DEBUG] selectedUtc:', new Date(selectedUtc).toISOString(), '(', selectedUtc, ')');
        console.log('[TIMEZONE DEBUG] Comparison: selectedUtc < nowUtc:', selectedUtc < nowUtc, 'Diff (hours):', (selectedUtc - nowUtc) / (1000 * 60 * 60));
        
        if (selectedUtc < nowUtc) {
          return res.status(400).json({ 
            error: 'Invalid loading time',
            message: 'Время загрузки не может быть раньше текущего времени. Пожалуйста, выберите время не ранее текущего момента. / Yuklash vaqti joriy vaqtdan oldin bo\'lishi mumkin emas. Iltimos, hozirgi vaqtdan kechroq vaqtni tanlang.'
          });
        }
      }
      
      // Sanitize notes field to prevent XSS/HTML injection
      const sanitizedNotes = sanitizeTextInput(orderData.notes);
      
      // Convert weightTons to string for Drizzle numeric type compatibility
      const orderDataWithStringWeight = {
        ...orderData,
        notes: sanitizedNotes,
        weightTons: orderData.weightTons?.toString()
      };
      const updated = await storage.updateOrder(orderId, orderDataWithStringWeight as any);
      
      if (!updated) {
        return res.status(400).json({ error: 'Failed to update order' });
      }
      
      // Update Telegram notification with new order data
      updateOrderNotification(updated, 'data_changed').catch(err => {
        console.error('[Telegram] Failed to update notification for edited order:', err.message);
      });
      
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid order data', details: error.errors });
      }
      res.status(500).json({ error: 'Failed to update order' });
    }
  });

  app.delete('/api/orders/:id', authenticate, authorize('customer'), async (req: AuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      const language = (req.headers['accept-language'] || 'ru').includes('uz') ? 'uz' : 'ru';
      
      // Get order to check for blocked collateral before deleting
      const order = await storage.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Check for representative mode
      const representativeCustomerIdHeader = req.headers['x-representative-customer-id'] as string | undefined;
      let effectiveCustomerId = req.user!.id;
      
      if (representativeCustomerIdHeader) {
        const representedCustomerId = parseInt(representativeCustomerIdHeader, 10);
        if (!isNaN(representedCustomerId) && order.customerId === representedCustomerId) {
          // Representative mode - check delete_own_orders permission
          const hasPermission = await storage.checkRepresentativePermission(
            representedCustomerId,
            req.user!.id,
            'delete_own_orders'
          );
          
          if (!hasPermission) {
            return res.status(403).json({ 
              error: language === 'uz' 
                ? 'Buyurtmalarni o\'chirish huquqi yo\'q' 
                : 'Нет прав на удаление заказов'
            });
          }
          
          // Representatives can only delete orders they created
          if (order.createdByUserId !== req.user!.id) {
            return res.status(403).json({ 
              error: language === 'uz'
                ? 'Siz faqat o\'zingiz yaratgan buyurtmalarni o\'chirishingiz mumkin'
                : 'Вы можете удалять только заказы, созданные вами'
            });
          }
          
          effectiveCustomerId = representedCustomerId;
          console.log(`[ORDER] Representative ${req.user!.id} deleting order ${orderId} for customer ${representedCustomerId}`);
        } else {
          return res.status(403).json({ error: 'Not authorized to delete this order' });
        }
      } else {
        // Normal mode - user must be the customer
        if (order.customerId !== req.user!.id) {
          return res.status(403).json({ error: 'Not authorized to delete this order' });
        }
      }
      
      // Check for active offers - customer must reject all offers before deleting
      const offers = await storage.getOffersByOrderId(orderId);
      const activeOffers = offers.filter(o => o.status === 'active');
      if (activeOffers.length > 0) {
        const errorMsg = language === 'uz'
          ? `Buyurtmani o'chirish uchun avval barcha takliflarni rad eting (${activeOffers.length} ta aktiv taklif mavjud)`
          : `Чтобы удалить заказ, сначала отклоните все предложения (активных предложений: ${activeOffers.length})`;
        return res.status(400).json({ error: errorMsg });
      }
      
      // Unblock customer collateral if it was blocked
      const orderCollateral = Number(order.customerBlockedCollateral) || 0;
      if (orderCollateral > 0) {
        const unblockResult = await storage.transferBetweenAccounts(
          effectiveCustomerId,
          'blocked',
          'main',
          orderCollateral,
          `Возврат залога заказчика при удалении заказа №${orderId}`
        );
        
        if (!unblockResult.success) {
          console.error(`Failed to unblock customer collateral for order ${orderId}`);
          // Continue with deletion even if unblock fails - we don't want to leave orphaned orders
        }
      }
      
      const deleted = await storage.softDeleteOrder(orderId, effectiveCustomerId);
      
      if (!deleted) {
        return res.status(400).json({ error: 'Cannot delete order. Order not found, not owned by you, or already assigned/completed.' });
      }
      
      // Send Telegram notification for deleted order
      updateOrderNotification({ ...order, status: 'cancelled' }, 'status_changed').catch(err => {
        console.error('[Telegram] Failed to update notification for deleted order:', err.message);
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete order' });
    }
  });

  // Order Template routes
  app.get('/api/templates', authenticate, authorize('customer'), async (req: AuthRequest, res: Response) => {
    try {
      const templates = await storage.getOrderTemplatesByCustomerId(req.user!.id);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  app.post('/api/templates', authenticate, authorize('customer'), async (req: AuthRequest, res: Response) => {
    try {
      const { insertOrderTemplateSchema } = await import('@shared/schema');
      const templateData = insertOrderTemplateSchema.parse(req.body);
      
      const template = await storage.createOrderTemplate({
        ...templateData,
        customerId: req.user!.id,
      });
      
      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
        return;
      }
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  app.delete('/api/templates/:id', authenticate, authorize('customer'), async (req: AuthRequest, res: Response) => {
    try {
      const templateId = parseInt(req.params.id);
      const deleted = await storage.deleteOrderTemplate(templateId, req.user!.id);
      
      if (!deleted) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });

  // Offer routes
  app.get('/api/orders/:orderId/offers', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const offers = await storage.getOffersByOrderId(orderId);
      
      // Get order information
      const order = await storage.getOrderById(orderId);
      
      // Get customer's VAT payer status to determine sorting field
      const customerProfile = await storage.getProfileByUserId(req.user!.id);
      const isCustomerVatPayer = customerProfile?.ndsPayer ?? false;
      
      // Get carrier info and ratings for each offer
      const offersWithCarriers = await Promise.all(
        offers.map(async (offer) => {
          const carrier = await storage.getUserById(offer.carrierId);
          const rating = await storage.getAverageRating(offer.carrierId);
          return {
            ...offer,
            carrierName: carrier?.displayName || 'Unknown',
            carrierPhone: carrier?.phone || '',
            carrierRating: rating,
            order: order ? { title: order.title } : null,
          };
        })
      );
      
      // Sort offers based on customer's VAT status:
      // - VAT payer customers: sort by priceWithoutVat (lowest first)
      // - Non-VAT payer customers: sort by price (lowest first)
      // - If prices are equal, earlier submission comes first
      offersWithCarriers.sort((a, b) => {
        const priceA = Number(isCustomerVatPayer ? (a.priceWithoutVat || a.price) : a.price) || 0;
        const priceB = Number(isCustomerVatPayer ? (b.priceWithoutVat || b.price) : b.price) || 0;
        
        if (priceA !== priceB) {
          return priceA - priceB; // Lower price first
        }
        // Equal prices: earlier submission first
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      
      res.json(offersWithCarriers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch offers' });
    }
  });

  app.post('/api/orders/:orderId/offers', authenticate, authorizeCarrier, async (req: AuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.orderId);
      
      // Check that the carrier is not the owner of this order
      const order = await storage.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      if (order.customerId === req.user!.id) {
        return res.status(400).json({ error: 'Cannot submit offer on your own order' });
      }
      
      // Check if carrier is blacklisted by this customer
      const isBlacklisted = await storage.isCarrierBlacklisted(order.customerId, req.user!.id);
      if (isBlacklisted) {
        return res.status(403).json({ 
          error: 'BLACKLISTED',
          message: 'Вы не можете отправить предложение, так как находитесь в чёрном списке заказчика'
        });
      }
      
      const offerData = insertOfferSchema.parse({ ...req.body, orderId });
      // If client didn't compute priceWithoutVat, default to price (no VAT separation)
      const effectivePriceWithoutVat = offerData.priceWithoutVat ?? offerData.price;
      
      // Calculate blocking amounts based on order's collateral requirement
      // IMPORTANT: Collateral is calculated from ORDER price, not offer price
      // Collateral (2%) is only blocked if order requires it
      const orderPriceForCollateral = Number(order.priceWithVat) || 0;
      const blockedAmount = order.requiresCollateral ? Math.floor(orderPriceForCollateral * 0.02) : 0;
      // Platform commission rate (0% = free period, change to 0.02 when billing resumes)
      const COMMISSION_RATE = 0;
      const blockedCommissionAmount = Math.floor(offerData.price * COMMISSION_RATE);
      const totalToBlock = blockedAmount + blockedCommissionAmount;
      
      // Check carrier's deposit accounts for commission
      // Priority: registration_bonus account first (if carrier has one), then main account
      const mainDeposit = await storage.getDepositByUserIdAndType(req.user!.id, 'main');
      const bonusDeposit = await storage.getDepositByUserIdAndType(req.user!.id, 'registration_bonus');
      
      // Determine which account to use for commission
      // Bonus account can ONLY be used for commission, not for collateral
      let commissionSourceAccount: 'main' | 'registration_bonus' = 'main';
      const bonusAvailable = Number(bonusDeposit?.balance) || 0;
      
      if (bonusAvailable >= blockedCommissionAmount) {
        // Use bonus account for commission
        commissionSourceAccount = 'registration_bonus';
      }
      
      // Calculate total required from main account
      // If using bonus for commission, main only needs to cover collateral
      const mainRequired = commissionSourceAccount === 'registration_bonus' 
        ? blockedAmount 
        : totalToBlock;
      
      // Only check main deposit if we actually need funds from it
      // If mainRequired = 0 (bonus covers commission AND no collateral required), main deposit is not needed
      const mainBalance = Number(mainDeposit?.balance) || 0;
      if (mainRequired > 0 && (!mainDeposit || mainBalance < mainRequired)) {
        return res.status(400).json({ 
          error: 'Insufficient deposit balance',
          required: totalToBlock,
          available: mainBalance + bonusAvailable,
          collateral: blockedAmount,
          commission: blockedCommissionAmount,
          bonusAvailable: bonusAvailable
        });
      }
      
      // Transfer collateral funds from main to blocked account (only if required)
      if (blockedAmount > 0) {
        const collateralResult = await storage.transferBetweenAccounts(
          req.user!.id,
          'main',
          'blocked',
          blockedAmount,
          `Блокировка залога по заказу №${orderId}`
        );
        
        if (!collateralResult.success) {
          return res.status(400).json({ 
            error: 'Failed to block collateral funds for offer',
            required: blockedAmount,
            available: mainDeposit?.balance ?? 0
          });
        }
      }
      
      // Transfer commission funds from appropriate account to blocked account
      const commissionResult = await storage.transferBetweenAccounts(
        req.user!.id,
        commissionSourceAccount,
        'blocked',
        blockedCommissionAmount,
        commissionSourceAccount === 'registration_bonus'
          ? `Блокировка комиссии из бонуса при регистрации по заказу №${orderId}`
          : `Блокировка комиссии платформы по заказу №${orderId}`
      );
      
      if (!commissionResult.success) {
        // Rollback collateral if commission blocking failed
        if (blockedAmount > 0) {
          await storage.transferBetweenAccounts(
            req.user!.id,
            'blocked',
            'main',
            blockedAmount,
            `Возврат залога по заказу №${orderId}`
          );
        }
        return res.status(400).json({ 
          error: 'Failed to block commission funds for offer',
          required: blockedCommissionAmount,
          available: commissionSourceAccount === 'registration_bonus' ? bonusAvailable : mainBalance - blockedAmount
        });
      }
      
      // Only create offer after successfully transferring funds
      const offer = await storage.createOffer({
        ...offerData,
        carrierId: req.user!.id,
        priceWithoutVat: effectivePriceWithoutVat.toString(),
        blockedAmount,
        blockedCommissionAmount,
        commissionSourceAccount,
      });
      
      // Send notification to customer (async, don't block response)
      (async () => {
        try {
          const customer = await storage.getUserById(order.customerId);
          if (!customer) return;
          
          // Check user notification settings for new_offer
          const setting = await storage.getUserNotificationSetting(order.customerId, 'new_offer');
          const smsEnabled = setting?.smsEnabled ?? true; // Default: enabled
          const inAppEnabled = setting?.inAppEnabled ?? true; // Default: enabled
          
          // Create in-app notification for customer
          if (inAppEnabled) {
            await storage.createNotification({
              userId: order.customerId,
              type: 'new_offer',
              title: 'Yangi taklif',
              message: `Sizning ${orderId} sonli buyurtmangiz bo'yicha yangi taklif kelib tushdi`,
              orderId: orderId,
              offerId: offer.id
            });
          }
          
          // Send SMS notification to customer
          if (smsEnabled && customer.phone) {
            const smsText = `Yukbozor.uz - Sizning ${orderId} sonli buyurtmangiz bo'yicha yangi taklif kelib tushdi. Ushbu turdagi sms-xabar kelishini shaxsiy kabinetdan o'chirishingiz mumkin.`;
            await sendSms(customer.phone, smsText);
          }
          
          // Also notify the representative who created the order (if any)
          if (order.createdByUserId && order.createdByUserId !== order.customerId) {
            const representativeSetting = await storage.getUserNotificationSetting(order.createdByUserId, 'new_offer');
            const repInAppEnabled = representativeSetting?.inAppEnabled ?? true;
            
            if (repInAppEnabled) {
              await storage.createNotification({
                userId: order.createdByUserId,
                type: 'new_offer',
                title: 'Yangi taklif',
                message: `${orderId} sonli buyurtma bo'yicha yangi taklif kelib tushdi`,
                orderId: orderId,
                offerId: offer.id
              });
            }
          }
        } catch (notifyError) {
          console.error('[NOTIFY] Error sending new offer notification:', notifyError);
        }
      })();
      
      res.json(offer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('[OFFER] ZodError body:', JSON.stringify(req.body), 'errors:', JSON.stringify(error.errors));
        return res.status(400).json({ error: 'Invalid offer data', details: error.errors });
      }
      console.error('Offer creation error:', error);
      res.status(500).json({ error: 'Failed to create offer' });
    }
  });

  // Get carrier's own offers
  app.get('/api/offers/my', authenticate, authorizeCarrier, async (req: AuthRequest, res: Response) => {
    try {
      const offers = await storage.getOffersByCarrierId(req.user!.id);
      
      // Get order info for each offer
      const offersWithOrders = await Promise.all(
        offers.map(async (offer) => {
          const order = await storage.getOrderById(offer.orderId);
          return {
            ...offer,
            order: order || null,
          };
        })
      );
      
      res.json(offersWithOrders);
    } catch (error) {
      console.error('Error fetching carrier offers:', error);
      res.status(500).json({ error: 'Failed to fetch offers' });
    }
  });

  // Get offer details with order info
  app.get('/api/offers/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const offerId = parseInt(req.params.id);
      const offer = await storage.getOfferById(offerId);
      
      if (!offer) {
        return res.status(404).json({ error: 'Offer not found' });
      }
      
      // Get order info
      const order = await storage.getOrderById(offer.orderId);
      
      res.json({
        ...offer,
        order: order || null,
      });
    } catch (error) {
      console.error('Error fetching offer:', error);
      res.status(500).json({ error: 'Failed to fetch offer' });
    }
  });

  app.post('/api/offers/:id/accept', authenticate, authorize('customer'), async (req: AuthRequest, res: Response) => {
    try {
      const offer = await storage.getOfferById(parseInt(req.params.id));
      if (!offer) {
        return res.status(404).json({ error: 'Offer not found' });
      }
      
      // Get order info for references
      const order = await storage.getOrderById(offer.orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Check for representative mode
      const representativeCustomerIdHeader = req.headers['x-representative-customer-id'] as string | undefined;
      
      if (representativeCustomerIdHeader) {
        const representedCustomerId = parseInt(representativeCustomerIdHeader, 10);
        if (!isNaN(representedCustomerId) && order.customerId === representedCustomerId) {
          // Representative mode - check accept_offer permission
          const hasPermission = await storage.checkRepresentativePermission(
            representedCustomerId,
            req.user!.id,
            'accept_offer'
          );
          
          if (!hasPermission) {
            return res.status(403).json({ 
              error: 'У вас нет прав на принятие предложений в режиме представителя / Sizda vakil rejimida takliflarni qabul qilish huquqi yo\'q' 
            });
          }
          
          console.log(`[OFFER] Representative ${req.user!.id} accepting offer ${offer.id} for customer ${representedCustomerId}`);
        } else {
          return res.status(403).json({ error: 'Not authorized to accept offers for this order' });
        }
      } else {
        // Normal mode - user must be the order owner
        if (order.customerId !== req.user!.id) {
          return res.status(403).json({ error: 'Not authorized to accept offers for this order' });
        }
      }
      
      // Update offer status
      await storage.updateOffer(offer.id, { status: 'accepted' });
      
      // Update order status
      await storage.updateOrder(offer.orderId, { status: 'assigned' });
      
      // Convert numeric fields to numbers (PostgreSQL returns numeric as strings)
      // NOTE: Use != null check (not ||) because blockedCommissionAmount can be legitimately 0
      const offerPrice = Number(offer.price) || 0;
      const blockedAmount = Number(offer.blockedAmount) || 0;
      const commissionAmount = offer.blockedCommissionAmount != null ? Number(offer.blockedCommissionAmount) : Math.floor(offerPrice * 0.02);
      
      // Process commission - collateral stays blocked until contract closes
      const carrierBlockedAccount = await storage.getDepositByUserIdAndType(offer.carrierId, 'blocked');
      
      if (carrierBlockedAccount) {
        
        // CRITICAL: Verify blocked funds are still present
        const requiredBlocked = blockedAmount + commissionAmount;
        const carrierBlockedBalance = Number(carrierBlockedAccount.balance) || 0;
        if (carrierBlockedBalance < requiredBlocked) {
          console.error(`Offer ${offer.id}: Blocked amount insufficient. Expected ${requiredBlocked}, found ${carrierBlockedBalance}`);
          return res.status(500).json({ error: 'Collateral verification failed' });
        }
        
        // Deduct commission from blocked account (platform revenue) - only if commission > 0
        if (commissionAmount > 0) {
          await storage.deductFunds(offer.carrierId, 'blocked', commissionAmount);
          
          // Create audit trail for commission deduction
          await storage.createDepositTransaction({
            depositId: carrierBlockedAccount.id,
            type: 'charge_for_service',
            amount: commissionAmount,
            reference: `Снятие комиссии платформы по заказу №${order.id}`,
            status: 'completed',
          });
          
          console.log(`Commission ${commissionAmount} deducted from carrier ${offer.carrierId} for order ${order.id}`);
        } else {
          console.log(`Commission is 0 for offer ${offer.id}, skipping deduction`);
        }
        
        // Calculate partner reward (0.6% = 30% of platform's 2% commission)
        // Partner who referred the CUSTOMER gets the reward
        const customer = await storage.getUserById(order.customerId);
        if (customer && customer.referredByPartnerId) {
          const partnerRewardAmount = Math.floor(offerPrice * 0.006); // 0.6%
          const partner = await storage.getPartnerById(customer.referredByPartnerId);
          
          if (partner) {
            // Credit partner's reward account - ACTUALLY add funds
            const partnerRewardAccount = await storage.getDepositByUserIdAndType(partner.userId, 'partner_reward');
            if (partnerRewardAccount) {
              // Add funds to partner's reward account
              await storage.addFunds(partner.userId, 'partner_reward', partnerRewardAmount);
              
              // Create audit trail for partner reward
              await storage.createDepositTransaction({
                depositId: partnerRewardAccount.id,
                type: 'topup',
                amount: partnerRewardAmount,
                reference: `Вознаграждение партнёра по заказу №${order.id}`,
                status: 'completed',
              });
              
              // Create commission record
              await storage.createCommission({
                partnerId: partner.id,
                clientId: order.customerId,
                orderId: order.id,
                amount: partnerRewardAmount,
                periodMonth: new Date().toISOString().slice(0, 7),
                status: 'paid',
              });
              
              console.log(`Partner ${partner.id} received ${partnerRewardAmount} reward for order ${order.id}`);
            }
          }
        }
        
        // NOTE: Collateral (blockedAmount) stays in blocked account until contract is closed!
      }
      
      // PHASE 5: Create contract with automatic content generation
      // (order already fetched above)
      if (order) {
        // Get parties data for contract generation
        const customerForContract = await storage.getUserById(order.customerId);
        const carrier = await storage.getUserById(offer.carrierId);
        const customerProfile = await storage.getProfileByUserId(order.customerId);
        const carrierProfile = await storage.getProfileByUserId(offer.carrierId);
        
        if (!customerForContract || !carrier) {
          console.error(`Order ${order.id}: Missing user data for contract generation`);
          return res.status(500).json({ error: 'Failed to generate contract' });
        }
        
        // Create contract with automatic signatures from both parties
        // NEW MECHANISM: Contracts are auto-signed based on E-IMZO certificate registered at signup
        // Legal entities/IPs: bound to their registered E-IMZO certificate
        // Individuals: bound to their phone verification at registration
        const now = new Date();
        const contract = await storage.createContract({
          orderId: order.id,
          customerId: order.customerId,
          carrierId: offer.carrierId,
          contractDocPath: null,
          contractDocDocxPath: null,
          status: 'awaiting_prepayment', // Contract auto-signed, waiting for prepayment
          documentHash: null,
          contractContent: null,
          customerSignature: `CERT_BOUND_${order.customerId}_${now.getTime()}`, // Auto-signed via registered certificate
          carrierSignature: `CERT_BOUND_${offer.carrierId}_${now.getTime()}`, // Auto-signed via registered certificate
          customerSignerInfo: customerProfile?.eimzoCertCn || customerForContract.displayName,
          carrierSignerInfo: carrierProfile?.eimzoCertCn || carrier.displayName,
          customerSignedAt: now,
          carrierSignedAt: now,
          customerSignatureMethod: customerForContract.userType === 'individual' ? 'sms' : 'eimzo',
          carrierSignatureMethod: carrier.userType === 'individual' ? 'sms' : 'eimzo',
          customerSmsEvidence: null,
          carrierSmsEvidence: null,
          // Certificate binding - links contract to registered E-IMZO certificates
          customerCertSerial: customerProfile?.eimzoCertSerial || null,
          customerCertCn: customerProfile?.eimzoCertCn || null,
          carrierCertSerial: carrierProfile?.eimzoCertSerial || null,
          carrierCertCn: carrierProfile?.eimzoCertCn || null,
          version: 1,
          terminationInitiatedBy: null,
          terminationPenaltyType: null,
          terminationInitiatedAt: null,
          terminationConfirmedAt: null,
          customerPrepaymentBlocked: '0', // Will be set when customer pays prepayment
        });
        
        // Generate contract content automatically
        const contractContent = generateContractContent({
          order,
          customer: customerForContract,
          customerProfile: customerProfile || null,
          carrier,
          carrierProfile: carrierProfile || null,
          contractNumber: `YB-${contract.id.toString().padStart(6, '0')}`,
          contractDate: contract.generatedAt,
        });
        
        // Generate document hash
        const documentHash = generateDocumentHash(contractContent);
        
        // Update contract with generated content
        await storage.updateContract(contract.id, {
          contractContent,
          documentHash,
        });
        
        // Calculate and create agent commissions (1% of contract value = 0.5% + 0.5%)
        const agentCommission = Math.floor(offerPrice * 0.01);
        const periodMonth = new Date().toISOString().slice(0, 7);
        
        // Check for registration agent
        const regPartner = await storage.getPartnerClients(0); // Would need proper query
        // Check for permanent agent
        // This is simplified - would need proper agent lookup logic
        
        // For now, placeholder for commission creation
        // await storage.createCommission({...});
      }
      
      // Reject other offers on this order and return their deposits (collateral + commission)
      const allOffers = await storage.getOffersByOrderId(offer.orderId);
      for (const otherOffer of allOffers) {
        if (otherOffer.id !== offer.id && otherOffer.status === 'active') {
          await storage.updateOffer(otherOffer.id, { status: 'rejected' });
          
          // Convert numeric fields to numbers
          const otherBlockedAmount = Number(otherOffer.blockedAmount) || 0;
          const otherPrice = Number(otherOffer.price) || 0;
          
          // Return collateral from blocked to main (only if amount > 0)
          if (otherBlockedAmount > 0) {
            await storage.transferBetweenAccounts(
              otherOffer.carrierId,
              'blocked',
              'main',
              otherBlockedAmount,
              `Возврат залога по заказу №${order.id}`
            );
          }
          
          // Return commission from blocked to original source account (only if amount > 0)
          // NOTE: Use != null (not ||) because 0 is a valid stored value meaning "no commission"
          const commissionToReturn = otherOffer.blockedCommissionAmount != null ? Number(otherOffer.blockedCommissionAmount) : Math.floor(otherPrice * 0.02);
          if (commissionToReturn > 0) {
            const commissionDestination = (otherOffer.commissionSourceAccount === 'registration_bonus' ? 'registration_bonus' : 'main') as 'main' | 'registration_bonus';
            await storage.transferBetweenAccounts(
              otherOffer.carrierId,
              'blocked',
              commissionDestination,
              commissionToReturn,
              commissionDestination === 'registration_bonus' 
                ? `Возврат комиссии на бонусный счёт по заказу №${order.id}`
                : `Возврат комиссии платформы по заказу №${order.id}`
            );
          }
        }
      }
      
      updateOrderNotification({ ...order, status: 'assigned' }, 'status_changed').catch(err => {
        console.error('[OFFER-ACCEPT] Failed to send Telegram notification:', err);
      });
      
      res.json({ success: true, offer });
    } catch (error) {
      console.error('Accept offer error:', error);
      res.status(500).json({ error: 'Failed to accept offer' });
    }
  });

  app.post('/api/offers/:id/withdraw', authenticate, authorizeCarrier, async (req: AuthRequest, res: Response) => {
    try {
      const offer = await storage.getOfferById(parseInt(req.params.id));
      if (!offer) {
        return res.status(404).json({ error: 'Offer not found' });
      }
      
      if (offer.carrierId !== req.user!.id) {
        return res.status(403).json({ error: 'Not your offer' });
      }
      
      if (offer.status !== 'active') {
        return res.status(400).json({ error: 'Cannot withdraw this offer' });
      }
      
      await storage.updateOffer(offer.id, { status: 'withdrawn' });
      
      // Convert numeric fields to numbers
      const withdrawBlockedAmount = Number(offer.blockedAmount) || 0;
      const withdrawPrice = Number(offer.price) || 0;
      
      // Return collateral from blocked to main (only if amount > 0)
      if (withdrawBlockedAmount > 0) {
        await storage.transferBetweenAccounts(
          offer.carrierId,
          'blocked',
          'main',
          withdrawBlockedAmount,
          `Возврат залога по заказу №${offer.orderId}`
        );
      }
      
      // Return commission from blocked to original source account (only if amount > 0)
      // NOTE: Use != null (not ||) because 0 is a valid stored value meaning "no commission was blocked"
      const commissionToReturn = offer.blockedCommissionAmount != null ? Number(offer.blockedCommissionAmount) : Math.floor(withdrawPrice * 0.02);
      if (commissionToReturn > 0) {
        const commissionDestination = (offer.commissionSourceAccount === 'registration_bonus' ? 'registration_bonus' : 'main') as 'main' | 'registration_bonus';
        await storage.transferBetweenAccounts(
          offer.carrierId,
          'blocked',
          commissionDestination,
          commissionToReturn,
          commissionDestination === 'registration_bonus' 
            ? `Возврат комиссии на бонусный счёт по заказу №${offer.orderId}`
            : `Возврат комиссии платформы по заказу №${offer.orderId}`
        );
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to withdraw offer' });
    }
  });

  // Update offer price (carrier can modify their active offer)
  app.patch('/api/offers/:id', authenticate, authorizeCarrier, async (req: AuthRequest, res: Response) => {
    try {
      const offerId = parseInt(req.params.id);
      const { price, priceWithoutVat } = req.body;
      
      if (!price || price <= 0) {
        return res.status(400).json({ error: 'Invalid price' });
      }
      
      const offer = await storage.getOfferById(offerId);
      if (!offer) {
        return res.status(404).json({ error: 'Offer not found' });
      }
      
      if (offer.carrierId !== req.user!.id) {
        return res.status(403).json({ error: 'Not your offer' });
      }
      
      if (offer.status !== 'active') {
        return res.status(400).json({ error: 'Cannot modify this offer' });
      }
      
      // Get the order to check collateral requirement
      const order = await storage.getOrderById(offer.orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Calculate old and new commission (2% of offer price) - convert numeric to number
      // NOTE: Use != null (not ||) because 0 is a valid stored value meaning "no commission was blocked"
      const currentOfferPrice = Number(offer.price) || 0;
      const oldCommission = offer.blockedCommissionAmount != null ? Number(offer.blockedCommissionAmount) : Math.floor(currentOfferPrice * 0.02);
      const newCommission = Math.floor(Number(price) * 0.02);
      const commissionDifference = newCommission - oldCommission;
      
      // Check if carrier has enough balance for increased commission
      if (commissionDifference > 0) {
        const mainAccount = await storage.getDepositByUserIdAndType(offer.carrierId, 'main');
        const mainAccountBalance = Number(mainAccount?.balance) || 0;
        if (!mainAccount || mainAccountBalance < commissionDifference) {
          const lang = req.headers['accept-language']?.includes('uz') ? 'uz' : 'ru';
          return res.status(400).json({ 
            error: lang === 'ru' 
              ? `Недостаточно средств. Требуется дополнительно ${commissionDifference.toLocaleString()} сум для увеличения комиссии.`
              : `Mablag' yetarli emas. Komissiyani oshirish uchun qo'shimcha ${commissionDifference.toLocaleString()} so'm kerak.`
          });
        }
        
        // Block additional commission
        await storage.transferBetweenAccounts(
          offer.carrierId,
          'main',
          'blocked',
          commissionDifference,
          `Дополнительная комиссия платформы по заказу №${order.id}`
        );
      } else if (commissionDifference < 0) {
        // Return excess commission
        await storage.transferBetweenAccounts(
          offer.carrierId,
          'blocked',
          'main',
          Math.abs(commissionDifference),
          `Возврат части комиссии по заказу №${order.id}`
        );
      }
      
      // Update offer with new price
      const updatedOffer = await storage.updateOffer(offerId, { 
        price, 
        priceWithoutVat: priceWithoutVat || price,
        blockedCommissionAmount: newCommission
      });
      
      res.json({ success: true, offer: updatedOffer });
    } catch (error) {
      console.error('Update offer error:', error);
      res.status(500).json({ error: 'Failed to update offer' });
    }
  });

  // Customer rejects an offer
  app.post('/api/offers/:id/reject', authenticate, authorize('customer'), async (req: AuthRequest, res: Response) => {
    try {
      const language = (req.headers['accept-language'] || 'ru').includes('uz') ? 'uz' : 'ru';
      const offer = await storage.getOfferById(parseInt(req.params.id));
      if (!offer) {
        return res.status(404).json({ error: 'Offer not found' });
      }
      
      // Verify user is the order owner
      const order = await storage.getOrderById(offer.orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Check for representative mode
      const representativeCustomerIdHeader = req.headers['x-representative-customer-id'] as string | undefined;
      let isAuthorized = false;
      
      if (representativeCustomerIdHeader) {
        const representedCustomerId = parseInt(representativeCustomerIdHeader, 10);
        if (!isNaN(representedCustomerId) && order.customerId === representedCustomerId) {
          // Representative mode - check reject_offer permission
          const hasPermission = await storage.checkRepresentativePermission(
            representedCustomerId,
            req.user!.id,
            'reject_offer'
          );
          
          if (!hasPermission) {
            return res.status(403).json({ 
              error: language === 'uz' 
                ? 'Takliflarni rad etish huquqi yo\'q' 
                : 'Нет прав на отклонение предложений'
            });
          }
          
          // Representatives can only reject offers on orders they created
          if (order.createdByUserId !== req.user!.id) {
            return res.status(403).json({ 
              error: language === 'uz'
                ? 'Siz faqat o\'zingiz yaratgan buyurtmalar takliflarini rad etishingiz mumkin'
                : 'Вы можете отклонять предложения только по заказам, созданным вами'
            });
          }
          
          isAuthorized = true;
          console.log(`[OFFER] Representative ${req.user!.id} rejecting offer ${offer.id} for customer ${representedCustomerId}`);
        }
      } else {
        // Normal mode - user must be the customer
        if (order.customerId === req.user!.id) {
          isAuthorized = true;
        }
      }
      
      if (!isAuthorized) {
        return res.status(403).json({ error: 'Not authorized to reject this offer' });
      }
      
      if (offer.status !== 'active') {
        return res.status(400).json({ error: 'Cannot reject this offer' });
      }
      
      // Update offer status to rejected
      await storage.updateOffer(offer.id, { status: 'rejected' });
      
      // Convert numeric fields to numbers
      const rejectBlockedAmount = Number(offer.blockedAmount) || 0;
      const rejectPrice = Number(offer.price) || 0;
      
      // Return collateral from blocked to main (only if amount > 0)
      if (rejectBlockedAmount > 0) {
        await storage.transferBetweenAccounts(
          offer.carrierId,
          'blocked',
          'main',
          rejectBlockedAmount,
          `Возврат залога по заказу №${order.id}`
        );
      }
      
      // Return commission from blocked to original source account (only if amount > 0)
      // NOTE: Use != null (not ||) because 0 is a valid stored value meaning "no commission was blocked"
      const commissionToReturn = offer.blockedCommissionAmount != null ? Number(offer.blockedCommissionAmount) : Math.floor(rejectPrice * 0.02);
      if (commissionToReturn > 0) {
        const commissionDestination = (offer.commissionSourceAccount === 'registration_bonus' ? 'registration_bonus' : 'main') as 'main' | 'registration_bonus';
        await storage.transferBetweenAccounts(
          offer.carrierId,
          'blocked',
          commissionDestination,
          commissionToReturn,
          commissionDestination === 'registration_bonus' 
            ? `Возврат комиссии на бонусный счёт по заказу №${order.id}`
            : `Возврат комиссии платформы по заказу №${order.id}`
        );
      }
      
      res.json({ success: true, offer });
    } catch (error) {
      console.error('Reject offer error:', error);
      res.status(500).json({ error: 'Failed to reject offer' });
    }
  });

  // PHASE 3: Order completion endpoint
  app.post('/api/orders/:id/complete', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrderById(orderId);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      if (order.status !== 'assigned') {
        return res.status(400).json({ error: 'Only assigned orders can be completed' });
      }
      
      // Get the contract to find carrier
      const contract = await storage.getContractByOrderId(orderId);
      if (!contract) {
        return res.status(500).json({ error: 'Contract not found for this order' });
      }
      
      // Verify user is either customer or carrier
      if (req.user!.id !== order.customerId && req.user!.id !== contract.carrierId) {
        return res.status(403).json({ error: 'Not authorized to complete this order' });
      }
      
      // Update order status to completed
      await storage.updateOrder(orderId, { status: 'completed' });
      
      // Send Telegram notification
      updateOrderNotification({ ...order, status: 'completed' }, 'status_changed').catch(err => {
        console.error('[Telegram] Failed to update notification for completed order:', err.message);
      });
      
      res.json({ success: true, message: 'Order completed successfully' });
    } catch (error) {
      console.error('Order completion error:', error);
      res.status(500).json({ error: 'Failed to complete order' });
    }
  });

  // PHASE 3: Order cancellation endpoint
  app.post('/api/orders/:id/cancel', authenticate, authorize('customer'), async (req: AuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrderById(orderId);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      if (order.customerId !== req.user!.id) {
        return res.status(403).json({ error: 'Not your order' });
      }
      
      if (order.status === 'completed') {
        return res.status(400).json({ error: 'Cannot cancel completed orders' });
      }
      
      if (order.status === 'cancelled') {
        return res.status(400).json({ error: 'Order already cancelled' });
      }
      
      // Update order status to cancelled
      await storage.updateOrder(orderId, { status: 'cancelled' });
      
      // Send Telegram notification
      updateOrderNotification({ ...order, status: 'cancelled' }, 'status_changed').catch(err => {
        console.error('[Telegram] Failed to update notification for cancelled order:', err.message);
      });
      
      res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
      console.error('Order cancellation error:', error);
      res.status(500).json({ error: 'Failed to cancel order' });
    }
  });

  // PHASE 5: Contract endpoints
  // Get all contracts for current user filtered by role
  app.get('/api/contracts/my', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const role = req.query.role as string | undefined;
      const contracts = await storage.getContractsByUserId(req.user!.id, role);
      res.json(contracts);
    } catch (error) {
      console.error('Contracts fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch contracts' });
    }
  });

  // Get contract by order ID
  app.get('/api/contracts/order/:orderId', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.orderId);
      const contract = await storage.getContractByOrderId(orderId);
      
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Verify user is either customer or carrier
      if (req.user!.id !== contract.customerId && req.user!.id !== contract.carrierId) {
        return res.status(403).json({ error: 'Not authorized to view this contract' });
      }
      
      res.json(contract);
    } catch (error) {
      console.error('Contract fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch contract' });
    }
  });

  // Get contract by contract ID
  app.get('/api/contracts/:contractId', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const contract = await storage.getContractById(contractId);
      
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Verify user is either customer or carrier
      if (req.user!.id !== contract.customerId && req.user!.id !== contract.carrierId) {
        return res.status(403).json({ error: 'Not authorized to view this contract' });
      }
      
      res.json(contract);
    } catch (error) {
      console.error('Contract fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch contract' });
    }
  });

  // Generate contract content (for preview)
  app.post('/api/contracts/:contractId/generate', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const contract = await storage.getContractById(contractId);
      
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Verify user is either customer or carrier
      if (req.user!.id !== contract.customerId && req.user!.id !== contract.carrierId) {
        return res.status(403).json({ error: 'Not authorized to generate this contract' });
      }
      
      // Get order and parties data
      const order = await storage.getOrderById(contract.orderId);
      const customer = await storage.getUserById(contract.customerId);
      const carrier = await storage.getUserById(contract.carrierId);
      const customerProfile = await storage.getProfileByUserId(contract.customerId);
      const carrierProfile = await storage.getProfileByUserId(contract.carrierId);
      
      if (!order || !customer || !carrier) {
        return res.status(500).json({ error: 'Missing required data for contract generation' });
      }
      
      // Generate contract content
      const contractContent = generateContractContent({
        order,
        customer,
        customerProfile: customerProfile || null,
        carrier,
        carrierProfile: carrierProfile || null,
        contractNumber: `YB-${contract.id.toString().padStart(6, '0')}`,
        contractDate: contract.generatedAt,
      });
      
      // Generate document hash
      const documentHash = generateDocumentHash(contractContent);
      
      // Update contract with content and hash
      await storage.updateContract(contractId, {
        contractContent,
        documentHash,
        status: 'pending_customer_signature',
      });
      
      res.json({ 
        success: true, 
        contractContent, 
        documentHash,
        contractNumber: `YB-${contract.id.toString().padStart(6, '0')}` 
      });
    } catch (error) {
      console.error('Contract generation error:', error);
      res.status(500).json({ error: 'Failed to generate contract' });
    }
  });

  // Sign contract (EDS signature)
  app.post('/api/contracts/:contractId/sign', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const { signature, role } = req.body;
      
      if (!signature || !role) {
        return res.status(400).json({ error: 'Signature and role are required' });
      }
      
      if (role !== 'customer' && role !== 'carrier') {
        return res.status(400).json({ error: 'Invalid role' });
      }
      
      const contract = await storage.signContract(contractId, req.user!.id, signature, role);
      
      if (!contract) {
        return res.status(400).json({ error: 'Failed to sign contract. Check authorization and contract state.' });
      }
      
      res.json({ success: true, contract });
    } catch (error) {
      console.error('Contract signing error:', error);
      res.status(500).json({ error: 'Failed to sign contract' });
    }
  });

  // Customer pays prepayment - block funds and change status to prepayment_made (ATOMIC)
  app.post('/api/contracts/:contractId/pay-prepayment', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const contract = await storage.getContractById(contractId);
      
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Check for representative mode
      const representativeCustomerIdHeader = req.headers['x-representative-customer-id'] as string | undefined;
      let effectiveCustomerId = req.user!.id;
      
      if (representativeCustomerIdHeader) {
        const representedCustomerId = parseInt(representativeCustomerIdHeader, 10);
        if (!isNaN(representedCustomerId) && contract.customerId === representedCustomerId) {
          // Representative mode - check pay_contract permission
          const hasPermission = await storage.checkRepresentativePermission(
            representedCustomerId,
            req.user!.id,
            'pay_contract'
          );
          
          if (!hasPermission) {
            return res.status(403).json({ 
              error: 'У вас нет прав на оплату контрактов в режиме представителя / Sizda vakil rejimida shartnomalarni to\'lash huquqi yo\'q' 
            });
          }
          
          effectiveCustomerId = representedCustomerId;
          console.log(`[CONTRACT] Representative ${req.user!.id} paying prepayment for contract ${contractId} on behalf of customer ${representedCustomerId}`);
        } else {
          return res.status(403).json({ error: 'Not authorized to pay for this contract' });
        }
      } else {
        // Verify user is the customer of this contract
        if (contract.customerId !== req.user!.id) {
          return res.status(403).json({ error: 'Only customer can pay prepayment' });
        }
      }
      
      // Verify contract is in awaiting_prepayment or fully_signed (legacy) status
      if (contract.status !== 'awaiting_prepayment' && contract.status !== 'fully_signed') {
        return res.status(400).json({ error: 'Contract is not awaiting prepayment' });
      }
      
      // Guard: prevent double payment
      const existingPrepayment = Number(contract.customerPrepaymentBlocked) || 0;
      if (existingPrepayment > 0) {
        return res.status(400).json({ error: 'Prepayment already made for this contract' });
      }
      
      // Prepayment amount is the contract price (from accepted offer), not the order price
      const acceptedOffer = await storage.getAcceptedOfferByOrderId(contract.orderId);
      if (!acceptedOffer) {
        return res.status(404).json({ error: 'Accepted offer not found for this contract' });
      }
      const prepaymentAmount = Number(acceptedOffer.price);
      
      // Check customer's main deposit balance (pre-check for better UX)
      const mainDeposit = await storage.getDepositByUserIdAndType(effectiveCustomerId, 'main');
      const mainDepositBalance = Number(mainDeposit?.balance) || 0;
      if (!mainDeposit || mainDepositBalance < prepaymentAmount) {
        return res.status(400).json({ 
          error: 'Insufficient funds for prepayment',
          required: prepaymentAmount,
          available: mainDepositBalance
        });
      }
      
      // ATOMIC: Block prepayment, update contract status, and create audit trail in one transaction
      const blockResult = await storage.blockPrepaymentAtomic(
        effectiveCustomerId,
        contractId,
        prepaymentAmount
      );
      
      if (!blockResult.success) {
        return res.status(400).json({ 
          error: blockResult.error || 'Failed to block prepayment funds',
          required: prepaymentAmount,
          available: mainDeposit.balance
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Prepayment blocked successfully',
        blockedAmount: prepaymentAmount
      });
    } catch (error) {
      console.error('Pay prepayment error:', error);
      res.status(500).json({ error: 'Failed to process prepayment' });
    }
  });

  // Carrier marks contract as completed - awaiting customer confirmation
  app.post('/api/contracts/:contractId/mark-completed', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const contract = await storage.getContractById(contractId);
      
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Verify user is the carrier of this contract
      if (contract.carrierId !== req.user!.id) {
        return res.status(403).json({ error: 'Only carrier can mark as completed' });
      }
      
      // Verify contract is in prepayment_made or fully_signed (legacy) status
      if (contract.status !== 'prepayment_made' && contract.status !== 'fully_signed') {
        return res.status(400).json({ error: 'Contract must have prepayment before marking as completed' });
      }
      
      // Update contract status to awaiting_completion_confirmation
      await storage.updateContract(contractId, { status: 'awaiting_completion_confirmation' });
      
      res.json({ success: true, message: 'Contract marked as completed, awaiting customer confirmation' });
    } catch (error) {
      console.error('Mark completed error:', error);
      res.status(500).json({ error: 'Failed to mark contract as completed' });
    }
  });

  // Customer confirms completion - closes the contract
  app.post('/api/contracts/:contractId/confirm-completion', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const contract = await storage.getContractById(contractId);
      
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Verify user is the customer of this contract
      if (contract.customerId !== req.user!.id) {
        return res.status(403).json({ error: 'Only customer can confirm completion' });
      }
      
      // Verify contract is awaiting confirmation
      if (contract.status !== 'awaiting_completion_confirmation') {
        return res.status(400).json({ error: 'Contract is not awaiting completion confirmation' });
      }
      
      // Return carrier's collateral now that contract is successfully closed
      const acceptedOffer = await storage.getAcceptedOfferByOrderId(contract.orderId);
      const carrierBlockedAmountNum = Number(acceptedOffer?.blockedAmount) || 0;
      if (acceptedOffer && carrierBlockedAmountNum > 0) {
        await storage.transferBetweenAccounts(
          acceptedOffer.carrierId,
          'blocked',
          'main',
          carrierBlockedAmountNum,
          `Возврат залога перевозчика по заказу №${contract.orderId}`
        );
        console.log(`Carrier collateral ${carrierBlockedAmountNum} returned to carrier ${acceptedOffer.carrierId} for order ${contract.orderId}`);
      }
      
      // Return customer's collateral now that contract is successfully closed
      const order = await storage.getOrderById(contract.orderId);
      const customerCollateralNum = Number(order?.customerBlockedCollateral) || 0;
      if (order && customerCollateralNum > 0) {
        await storage.transferBetweenAccounts(
          contract.customerId,
          'blocked',
          'main',
          customerCollateralNum,
          `Возврат залога заказчика по заказу №${contract.orderId}`
        );
        console.log(`Customer collateral ${customerCollateralNum} returned to customer ${contract.customerId} for order ${contract.orderId}`);
      }
      
      // Transfer prepayment from customer blocked to carrier main
      const prepaymentBlockedNum = Number(contract.customerPrepaymentBlocked) || 0;
      if (prepaymentBlockedNum > 0) {
        const prepaymentTransferResult = await storage.transferCollateralBetweenUsers(
          contract.customerId,
          contract.carrierId,
          'blocked',
          'main',
          prepaymentBlockedNum,
          `Оплата перевозчику по контракту №${contractId}`
        );
        
        if (!prepaymentTransferResult.success) {
          console.error(`[COMPLETION] Failed to transfer prepayment ${prepaymentBlockedNum} to carrier ${contract.carrierId}`);
          return res.status(500).json({ error: 'Failed to transfer prepayment to carrier' });
        }
        
        console.log(`[COMPLETION] Prepayment ${prepaymentBlockedNum} transferred from customer ${contract.customerId} to carrier ${contract.carrierId} for contract ${contractId}`);
      }
      
      // Update contract status to closed
      await storage.updateContract(contractId, { status: 'closed' });
      
      // Also update the related order status to completed
      if (contract.orderId) {
        await storage.updateOrder(contract.orderId, { status: 'completed' });
      }
      
      // Calculate and pay partner commission now that contract is closed
      if (order) {
        const customer = await storage.getUserById(order.customerId);
        if (customer?.referredByPartnerId) {
          const partner = await storage.getPartnerById(customer.referredByPartnerId);
          if (partner) {
            // Get accepted offer price (contract amount)
            const commissionRate = 0.006; // 0.6% = 30% of platform's 2%
            const priceForCommission = Number(acceptedOffer?.price) || Number(order.priceWithVat) || 0;
            const commissionAmount = Math.floor(priceForCommission * commissionRate);
            
            // Current month for grouping
            const now = new Date();
            const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            // Create commission record
            await storage.createCommission({
              partnerId: partner.id,
              clientId: order.customerId,
              orderId: order.id,
              amount: commissionAmount,
              periodMonth,
              status: 'paid',
            });
            
            // Pay commission to partner's partner_reward account
            const partnerRewardDeposit = await storage.getDepositByUserIdAndType(partner.userId, 'partner_reward');
            if (partnerRewardDeposit) {
              await storage.addFunds(partner.userId, 'partner_reward', commissionAmount);
              
              // Create audit trail
              await storage.createDepositTransaction({
                depositId: partnerRewardDeposit.id,
                type: 'topup',
                amount: commissionAmount,
                reference: `partner-reward-contract-${contractId}`,
                status: 'completed',
              });
              
              console.log(`[PARTNER] Commission ${commissionAmount} paid to partner ${partner.id} for contract ${contractId}`);
            }
          }
        }
      }
      
      res.json({ success: true, message: 'Contract closed successfully' });
    } catch (error) {
      console.error('Confirm completion error:', error);
      res.status(500).json({ error: 'Failed to confirm completion' });
    }
  });

  // Initiate contract termination
  app.post('/api/contracts/:contractId/initiate-termination', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const { penaltyType } = req.body;
      
      if (!penaltyType || !['penalty_customer', 'penalty_carrier', 'no_penalty'].includes(penaltyType)) {
        return res.status(400).json({ error: 'Invalid penalty type' });
      }
      
      const contract = await storage.getContractById(contractId);
      
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Verify user is either customer or carrier (or authorized representative)
      const userId = req.user!.id;
      let isAuthorized = false;
      let actingAsCustomerId: number | null = null;
      
      if (contract.customerId === userId || contract.carrierId === userId) {
        isAuthorized = true;
        if (contract.customerId === userId) {
          actingAsCustomerId = userId;
        }
      } else {
        // Check if user is a representative for the customer with terminate_contract permission
        const representativeCustomerIdHeader = req.headers['x-representative-customer-id'];
        if (representativeCustomerIdHeader) {
          const principalCustomerId = parseInt(representativeCustomerIdHeader as string);
          if (principalCustomerId === contract.customerId) {
            const representative = await storage.getRepresentativeByCustomerAndUser(principalCustomerId, userId);
            if (representative && representative.isActive && representative.permissions?.includes('terminate_contract')) {
              // Verify the contract is for an order created by this representative
              const order = await storage.getOrderById(contract.orderId);
              if (order && order.createdByUserId === userId) {
                isAuthorized = true;
                actingAsCustomerId = principalCustomerId;
              }
            }
          }
        }
      }
      
      if (!isAuthorized) {
        return res.status(403).json({ error: 'Not authorized to terminate this contract' });
      }
      
      // Cannot terminate closed or already terminated contracts
      if (contract.status === 'closed' || contract.status === 'terminated' || contract.status === 'termination_pending') {
        return res.status(400).json({ error: 'Contract cannot be terminated in current status' });
      }
      
      // Update contract with termination request
      // If representative, mark as initiated by the customer (principal)
      const initiatedBy = actingAsCustomerId || req.user!.id;
      await storage.updateContract(contractId, { 
        status: 'termination_pending',
        terminationInitiatedBy: initiatedBy,
        terminationPenaltyType: penaltyType,
        terminationInitiatedAt: new Date()
      });
      
      res.json({ success: true, message: 'Termination request submitted, awaiting confirmation from other party' });
    } catch (error) {
      console.error('Initiate termination error:', error);
      res.status(500).json({ error: 'Failed to initiate termination' });
    }
  });

  // Confirm contract termination
  app.post('/api/contracts/:contractId/confirm-termination', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const contract = await storage.getContractById(contractId);
      
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Verify user is either customer or carrier (or authorized representative)
      const userId = req.user!.id;
      let isAuthorized = false;
      let actingAsCustomerId: number | null = null;
      
      if (contract.customerId === userId || contract.carrierId === userId) {
        isAuthorized = true;
        if (contract.customerId === userId) {
          actingAsCustomerId = userId;
        }
      } else {
        // Check if user is a representative for the customer with terminate_contract permission
        const representativeCustomerIdHeader = req.headers['x-representative-customer-id'];
        if (representativeCustomerIdHeader) {
          const principalCustomerId = parseInt(representativeCustomerIdHeader as string);
          if (principalCustomerId === contract.customerId) {
            const representative = await storage.getRepresentativeByCustomerAndUser(principalCustomerId, userId);
            if (representative && representative.isActive && representative.permissions?.includes('terminate_contract')) {
              // Verify the contract is for an order created by this representative
              const order = await storage.getOrderById(contract.orderId);
              if (order && order.createdByUserId === userId) {
                isAuthorized = true;
                actingAsCustomerId = principalCustomerId;
              }
            }
          }
        }
      }
      
      if (!isAuthorized) {
        return res.status(403).json({ error: 'Not authorized to confirm termination' });
      }
      
      // Must be in termination_pending status
      if (contract.status !== 'termination_pending') {
        return res.status(400).json({ error: 'Contract is not pending termination' });
      }
      
      // Confirming user must be the OTHER party (not the one who initiated)
      // For representatives, check if customer initiated (actingAsCustomerId matches terminationInitiatedBy)
      const confirmingPartyId = actingAsCustomerId || userId;
      if (contract.terminationInitiatedBy === confirmingPartyId) {
        return res.status(400).json({ error: 'Cannot confirm your own termination request' });
      }
      
      // Get order and offer to retrieve expected collateral amounts
      const order = contract.orderId ? await storage.getOrderById(contract.orderId) : null;
      const expectedCustomerCollateral = Number(order?.customerBlockedCollateral) || 0;
      
      const offers = contract.orderId ? await storage.getOffersByOrderId(contract.orderId) : [];
      const acceptedOffer = offers.find(o => o.status === 'accepted');
      const expectedCarrierCollateral = Number(acceptedOffer?.blockedAmount) || 0;
      
      // Verify actual blocked balances match expectations (live state check)
      const customerBlockedDeposit = await storage.getDepositByUserIdAndType(contract.customerId, 'blocked');
      const carrierBlockedDeposit = await storage.getDepositByUserIdAndType(contract.carrierId, 'blocked');
      
      // Use minimum of expected and actual to prevent overdraft
      const customerBlockedBalance = Number(customerBlockedDeposit?.balance) || 0;
      const carrierBlockedBalance = Number(carrierBlockedDeposit?.balance) || 0;
      const customerCollateral = Math.min(expectedCustomerCollateral, customerBlockedBalance);
      const carrierCollateral = Math.min(expectedCarrierCollateral, carrierBlockedBalance);
      
      if (customerCollateral !== expectedCustomerCollateral || carrierCollateral !== expectedCarrierCollateral) {
        console.warn(`[TERMINATION] Collateral mismatch for contract ${contractId}: ` +
          `customer expected=${expectedCustomerCollateral} actual=${customerCollateral}, ` +
          `carrier expected=${expectedCarrierCollateral} actual=${carrierCollateral}`);
      }
      
      // Handle collateral based on penalty type
      // Note: Commission is NOT returned in any case
      const penaltyType = contract.terminationPenaltyType;
      
      // Helper function to verify transfer with delta check
      const verifyTransfer = async (
        userId: number,
        fromType: 'main' | 'blocked',
        toType: 'main' | 'blocked',
        amount: number,
        fromBalanceBefore: number,
        toBalanceBefore: number
      ) => {
        const fromAfter = await storage.getDepositByUserIdAndType(userId, fromType);
        const toAfter = await storage.getDepositByUserIdAndType(userId, toType);
        const fromDelta = fromBalanceBefore - (Number(fromAfter?.balance) || 0);
        const toDelta = (Number(toAfter?.balance) || 0) - toBalanceBefore;
        return fromDelta === amount && toDelta === amount;
      };
      
      if (penaltyType === 'penalty_customer') {
        // Both collaterals go to carrier's main account
        // 1. Customer's collateral: transfer from blocked directly to carrier's main
        if (customerCollateral > 0) {
          const transferResult = await storage.transferCollateralBetweenUsers(
            contract.customerId,
            contract.carrierId,
            'blocked',
            'main',
            customerCollateral,
            `Штраф с заказчика: залог заказчика → перевозчику по контракту №${contractId}`
          );
          if (!transferResult.success) {
            return res.status(500).json({ error: 'Failed to transfer customer collateral to carrier' });
          }
          console.log(`[TERMINATION penalty_customer] Customer collateral ${customerCollateral} transferred to carrier ${contract.carrierId}`);
        }
        
        // 2. Carrier's collateral: unblock to carrier's main (carrier keeps own collateral)
        if (carrierCollateral > 0) {
          const unblockResult = await storage.transferBetweenAccounts(
            contract.carrierId,
            'blocked',
            'main',
            carrierCollateral,
            `Возврат залога перевозчика по контракту №${contractId} (штраф с заказчика)`
          );
          if (!unblockResult.success) {
            return res.status(500).json({ error: 'Failed to unblock carrier collateral' });
          }
          console.log(`[TERMINATION penalty_customer] Carrier collateral ${carrierCollateral} returned to carrier ${contract.carrierId}`);
        }
      } else if (penaltyType === 'penalty_carrier') {
        // Both collaterals go to customer's main account
        // 1. Carrier's collateral: transfer from blocked directly to customer's main
        if (carrierCollateral > 0) {
          const transferResult = await storage.transferCollateralBetweenUsers(
            contract.carrierId,
            contract.customerId,
            'blocked',
            'main',
            carrierCollateral,
            `Штраф с перевозчика: залог перевозчика → заказчику по контракту №${contractId}`
          );
          if (!transferResult.success) {
            return res.status(500).json({ error: 'Failed to transfer carrier collateral to customer' });
          }
          console.log(`[TERMINATION penalty_carrier] Carrier collateral ${carrierCollateral} transferred to customer ${contract.customerId}`);
        }
        
        // 2. Customer's collateral: unblock to customer's main (customer keeps own collateral)
        if (customerCollateral > 0) {
          const unblockResult = await storage.transferBetweenAccounts(
            contract.customerId,
            'blocked',
            'main',
            customerCollateral,
            `Возврат залога заказчика по контракту №${contractId} (штраф с перевозчика)`
          );
          if (!unblockResult.success) {
            return res.status(500).json({ error: 'Failed to unblock customer collateral' });
          }
          console.log(`[TERMINATION penalty_carrier] Customer collateral ${customerCollateral} returned to customer ${contract.customerId}`);
        }
      } else if (penaltyType === 'no_penalty') {
        // Each party gets their own collateral back
        if (customerCollateral > 0) {
          const unblockResult = await storage.transferBetweenAccounts(
            contract.customerId,
            'blocked',
            'main',
            customerCollateral,
            `Возврат залога заказчика по контракту №${contractId} (без штрафа)`
          );
          if (!unblockResult.success) {
            return res.status(500).json({ error: 'Failed to unblock customer collateral' });
          }
        }
        if (carrierCollateral > 0) {
          const unblockResult = await storage.transferBetweenAccounts(
            contract.carrierId,
            'blocked',
            'main',
            carrierCollateral,
            `Возврат залога перевозчика по контракту №${contractId} (без штрафа)`
          );
          if (!unblockResult.success) {
            return res.status(500).json({ error: 'Failed to unblock carrier collateral' });
          }
        }
      }
      
      // Return prepayment to customer (always returned on termination)
      const terminationPrepayment = Number(contract.customerPrepaymentBlocked) || 0;
      if (terminationPrepayment > 0) {
        const prepaymentReturnResult = await storage.transferBetweenAccounts(
          contract.customerId,
          'blocked',
          'main',
          terminationPrepayment,
          `Возврат предоплаты заказчику по контракту №${contractId} (расторжение)`
        );
        
        if (!prepaymentReturnResult.success) {
          console.error(`[TERMINATION] Failed to return prepayment ${terminationPrepayment} to customer ${contract.customerId}`);
          return res.status(500).json({ error: 'Failed to return prepayment to customer' });
        }
        
        console.log(`[TERMINATION] Prepayment ${terminationPrepayment} returned to customer ${contract.customerId} for contract ${contractId}`);
      }
      
      // Update contract to terminated
      await storage.updateContract(contractId, { 
        status: 'terminated',
        terminationConfirmedAt: new Date()
      });
      
      // Update order status to cancelled
      if (contract.orderId) {
        await storage.updateOrder(contract.orderId, { status: 'cancelled' });
      }
      
      res.json({ success: true, message: 'Contract terminated successfully' });
    } catch (error) {
      console.error('Confirm termination error:', error);
      res.status(500).json({ error: 'Failed to confirm termination' });
    }
  });

  // Cancel termination request (by the initiator)
  app.post('/api/contracts/:contractId/cancel-termination', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const contract = await storage.getContractById(contractId);
      
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Must be the initiator to cancel (or representative acting on behalf of initiator)
      const userId = req.user!.id;
      let canCancel = false;
      
      if (contract.terminationInitiatedBy === userId) {
        canCancel = true;
      } else {
        // Check if user is a representative for the customer who initiated
        const representativeCustomerIdHeader = req.headers['x-representative-customer-id'];
        if (representativeCustomerIdHeader) {
          const principalCustomerId = parseInt(representativeCustomerIdHeader as string);
          // Can only cancel if the principal (customer) was the one who initiated
          if (principalCustomerId === contract.terminationInitiatedBy && principalCustomerId === contract.customerId) {
            const representative = await storage.getRepresentativeByCustomerAndUser(principalCustomerId, userId);
            if (representative && representative.isActive && representative.permissions?.includes('terminate_contract')) {
              // Verify the contract is for an order created by this representative
              const order = await storage.getOrderById(contract.orderId);
              if (order && order.createdByUserId === userId) {
                canCancel = true;
              }
            }
          }
        }
      }
      
      if (!canCancel) {
        return res.status(403).json({ error: 'Only the initiator can cancel the termination request' });
      }
      
      // Must be in termination_pending status
      if (contract.status !== 'termination_pending') {
        return res.status(400).json({ error: 'Contract is not pending termination' });
      }
      
      // Restore previous status (prepayment_made is the safest default for active contracts)
      await storage.updateContract(contractId, { 
        status: 'prepayment_made',
        terminationInitiatedBy: null,
        terminationPenaltyType: null,
        terminationInitiatedAt: null
      });
      
      res.json({ success: true, message: 'Termination request cancelled' });
    } catch (error) {
      console.error('Cancel termination error:', error);
      res.status(500).json({ error: 'Failed to cancel termination' });
    }
  });

  // Rating routes
  
  // Submit rating for a closed contract
  app.post('/api/ratings', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { contractId, score, comment } = req.body;
      
      if (!contractId || !score || score < 1 || score > 5) {
        return res.status(400).json({ error: 'Invalid rating data' });
      }
      
      const contract = await storage.getContractById(contractId);
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Contract must be closed to rate
      if (contract.status !== 'closed') {
        return res.status(400).json({ error: 'Can only rate closed contracts' });
      }
      
      // Verify user is participant
      const isCustomer = contract.customerId === req.user!.id;
      const isCarrier = contract.carrierId === req.user!.id;
      
      if (!isCustomer && !isCarrier) {
        return res.status(403).json({ error: 'Not authorized to rate this contract' });
      }
      
      // Check if already rated
      const existingRating = await storage.getRatingByContractAndRater(contractId, req.user!.id);
      if (existingRating) {
        return res.status(400).json({ error: 'You have already rated this contract' });
      }
      
      // Determine who to rate and their role
      const toUserId = isCustomer ? contract.carrierId : contract.customerId;
      const ratedAsRole = isCustomer ? 'carrier' : 'customer';
      
      // Ensure counterparty exists
      if (!toUserId) {
        return res.status(400).json({ error: 'Contract is incomplete - counterparty not assigned' });
      }
      
      const rating = await storage.createRatingAndUpdateUserAverage({
        contractId,
        fromUserId: req.user!.id,
        toUserId,
        ratedAsRole,
        score,
        comment: comment || null,
      });
      
      res.json({ success: true, rating });
    } catch (error) {
      console.error('Submit rating error:', error);
      res.status(500).json({ error: 'Failed to submit rating' });
    }
  });

  // Check if user has rated a specific contract
  app.get('/api/ratings/check/:contractId', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const existingRating = await storage.getRatingByContractAndRater(contractId, req.user!.id);
      
      res.json({ hasRated: !!existingRating, rating: existingRating || null });
    } catch (error) {
      console.error('Check rating error:', error);
      res.status(500).json({ error: 'Failed to check rating' });
    }
  });

  // Get user's ratings by role
  app.get('/api/users/:userId/ratings', async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const role = req.query.role as 'customer' | 'carrier' | undefined;
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      let ratings;
      if (role && (role === 'customer' || role === 'carrier')) {
        ratings = await storage.getRatingsByUserIdAndRole(userId, role);
      } else {
        ratings = await storage.getRatingsByUserId(userId);
      }
      
      res.json({
        customerRating: user.customerRating ? parseFloat(user.customerRating) : null,
        customerRatingCount: user.customerRatingCount || 0,
        carrierRating: user.carrierRating ? parseFloat(user.carrierRating) : null,
        carrierRatingCount: user.carrierRatingCount || 0,
        ratings
      });
    } catch (error) {
      console.error('Get user ratings error:', error);
      res.status(500).json({ error: 'Failed to get user ratings' });
    }
  });

  // Deposit routes
  app.get('/api/deposits/me', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      let deposits = await storage.getDepositsByUserId(req.user!.id);
      
      // If no deposits exist, create all 4 accounts for the user
      if (deposits.length === 0) {
        deposits = await storage.createAllDepositsForUser(req.user!.id);
      }
      
      // Return all deposits as an array
      res.json(deposits);
    } catch (error) {
      console.error('Deposit fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch deposits' });
    }
  });

  // Get specific deposit account by type
  app.get('/api/deposits/me/:accountType', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const accountType = req.params.accountType as 'main' | 'blocked' | 'in_transit' | 'partner_reward';
      
      if (!['main', 'blocked', 'in_transit', 'partner_reward'].includes(accountType)) {
        return res.status(400).json({ error: 'Invalid account type' });
      }
      
      let deposit = await storage.getDepositByUserIdAndType(req.user!.id, accountType);
      
      if (!deposit) {
        deposit = await storage.createDeposit(req.user!.id, accountType);
      }
      
      res.json(deposit);
    } catch (error) {
      console.error('Deposit fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch deposit' });
    }
  });

  app.get('/api/deposits/transactions', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const deposits = await storage.getDepositsByUserId(req.user!.id);
      if (deposits.length === 0) {
        return res.json([]);
      }
      
      // Get transactions for all user's deposits
      const allTransactions: any[] = [];
      for (const deposit of deposits) {
        const transactions = await storage.getDepositTransactionsByDepositId(deposit.id);
        allTransactions.push(...transactions.map(t => ({ ...t, accountType: deposit.accountType })));
      }
      
      // Sort by createdAt descending
      allTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(allTransactions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  // Get transactions for specific deposit account
  app.get('/api/deposits/:depositId/transactions', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const depositId = parseInt(req.params.depositId);
      
      // Verify deposit belongs to user
      const deposits = await storage.getDepositsByUserId(req.user!.id);
      const deposit = deposits.find(d => d.id === depositId);
      
      if (!deposit) {
        return res.status(404).json({ error: 'Deposit not found' });
      }
      
      const transactions = await storage.getDepositTransactionsByDepositId(depositId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  app.post('/api/deposits/topup', authenticate, authorizeCarrier, async (req: AuthRequest, res: Response) =>{
    try {
      const { amount } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      
      let deposit = await storage.getDepositByUserId(req.user!.id);
      if (!deposit) {
        deposit = await storage.createDeposit(req.user!.id);
      }
      
      // In production, this would integrate with payment gateway
      // For now, directly add to balance
      const currentBalance = Number(deposit.balance) || 0;
      const newBalance = currentBalance + amount;
      await storage.updateDepositBalance(req.user!.id, newBalance);
      
      await storage.createDepositTransaction({
        depositId: deposit.id,
        type: 'topup',
        amount,
        status: 'completed',
      });
      
      res.json({ success: true, newBalance });
    } catch (error) {
      res.status(500).json({ error: 'Failed to top up deposit' });
    }
  });

  // Partner routes
  
  // Check unique data (INN, PINFL, passport) for registration
  app.post('/api/auth/check-unique-data', async (req: Request, res: Response) => {
    try {
      const { inn, pinfl, passportSeries, passportNumber, userType } = req.body;
      const errors: { field: string; message_ru: string; message_uz: string }[] = [];

      // Business rules for uniqueness:
      // 1. INN (legal entities only) - must be globally unique
      // 2. Passport (individuals only) - must be globally unique for individuals
      // 3. PINFL:
      //    - For legal entities: NOT checked (same director can have multiple companies)
      //    - For IP/individual: checked only within same userType (one person can be both IP and individual)

      // Check INN uniqueness (only for legal entities)
      if (userType === 'legal' && inn) {
        const existingByInn = await storage.getUserByInn(inn);
        if (existingByInn) {
          errors.push({
            field: 'inn',
            message_ru: 'Компания с таким ИНН уже зарегистрирована',
            message_uz: 'Bunday STIR bilan kompaniya allaqachon ro\'yxatdan o\'tgan'
          });
        }
      }

      // Check PINFL uniqueness (only for IP and individual, scoped by userType)
      if ((userType === 'ip' || userType === 'individual') && pinfl) {
        const existingByPinfl = await storage.getUserByPinfl(pinfl);
        if (existingByPinfl) {
          // Check if existing user has same userType
          // Allow if different userType (e.g., IP and individual can share PINFL)
          if (existingByPinfl.userType === userType) {
            if (userType === 'ip') {
              errors.push({
                field: 'pinfl',
                message_ru: 'ИП с таким ПИНФЛ уже зарегистрирован',
                message_uz: 'Bunday JSHSHIR bilan YaTT allaqachon ro\'yxatdan o\'tgan'
              });
            } else {
              errors.push({
                field: 'pinfl',
                message_ru: 'Физическое лицо с таким ПИНФЛ уже зарегистрировано',
                message_uz: 'Bunday JSHSHIR bilan jismoniy shaxs allaqachon ro\'yxatdan o\'tgan'
              });
            }
          }
          // If different userType, allow registration (same person, different role)
        }
      }

      // Check passport uniqueness (only for individuals)
      if (userType === 'individual' && passportSeries && passportNumber) {
        const existingByPassport = await storage.getUserByPassport(passportSeries, passportNumber);
        if (existingByPassport) {
          errors.push({
            field: 'passport',
            message_ru: 'Пользователь с такой серией и номером паспорта уже зарегистрирован',
            message_uz: 'Bunday pasport seriyasi va raqami bilan foydalanuvchi allaqachon ro\'yxatdan o\'tgan'
          });
        }
      }

      if (errors.length > 0) {
        return res.json({ unique: false, errors });
      }

      res.json({ unique: true });
    } catch (error) {
      console.error('Check unique data error:', error);
      res.status(500).json({ error: 'Failed to check data uniqueness' });
    }
  });

  // Check if referral code exists (public endpoint for registration form)
  app.get('/api/partners/check-referral-code/:code', async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      
      if (!code || code.trim().length === 0) {
        return res.json({ valid: false });
      }
      
      const partner = await storage.getPartnerByReferralCode(code.trim().toUpperCase());
      
      if (partner) {
        // Check if partner user exists
        const partnerUser = await storage.getUserById(partner.userId);
        if (partnerUser) {
          return res.json({ valid: true });
        }
      }
      
      res.json({ valid: false });
    } catch (error) {
      console.error('Check referral code error:', error);
      res.json({ valid: false });
    }
  });
  
  // PHASE 4: Partner enrollment endpoint - creates partner record on-demand
  app.post('/api/partners/enroll', authenticate, authorize('partner'), async (req: AuthRequest, res: Response) => {
    try {
      // Check if partner record already exists
      let partner = await storage.getPartnerByUserId(req.user!.id);
      
      if (partner) {
        return res.json(partner); // Already enrolled
      }
      
      // Create new partner record
      partner = await storage.createPartner(req.user!.id);
      
      res.json(partner);
    } catch (error) {
      console.error('Partner enrollment error:', error);
      res.status(500).json({ error: 'Failed to enroll as partner' });
    }
  });
  
  // PHASE 4: Get partner info with referral code
  app.get('/api/partners/me', authenticate, authorize('partner'), async (req: AuthRequest, res: Response) => {
    try {
      const partner = await storage.getPartnerByUserId(req.user!.id);
      if (!partner) {
        return res.status(404).json({ error: 'Partner profile not found. Call /api/partners/enroll first.' });
      }
      
      res.json(partner);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch partner info' });
    }
  });

  app.get('/api/partners/me/clients', authenticate, authorize('partner'), async (req: AuthRequest, res: Response) => {
    try {
      const agent = await storage.getPartnerByUserId(req.user!.id);
      if (!agent) {
        return res.json([]);
      }
      
      const clients = await storage.getPartnerClients(agent.id);
      const clientsWithDetails = await Promise.all(
        clients.map(async (client) => {
          const user = await storage.getUserById(client.clientId);
          return { ...client, displayName: user?.displayName || 'Unknown' };
        })
      );
      
      res.json(clientsWithDetails);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch clients' });
    }
  });

  app.get('/api/partners/me/commissions', authenticate, authorize('partner'), async (req: AuthRequest, res: Response) => {
    try {
      const agent = await storage.getPartnerByUserId(req.user!.id);
      if (!agent) {
        return res.json([]);
      }
      
      const commissions = await storage.getCommissionsByPartnerId(agent.id);
      
      // Group by month
      const grouped = commissions.reduce((acc, comm) => {
        const month = comm.periodMonth;
        if (!acc[month]) {
          acc[month] = { month, amount: 0 };
        }
        acc[month].amount += Number(comm.amount) || 0;
        return acc;
      }, {} as Record<string, { month: string; amount: number }>);
      
      res.json(Object.values(grouped));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch commissions' });
    }
  });

  // PHASE 4: Partner reward payout endpoint (transfer from partner_reward to main account)
  app.post('/api/partners/me/payout', authenticate, authorize('partner'), async (req: AuthRequest, res: Response) => {
    try {
      const { amount } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      
      // Get partner_reward account balance
      const partnerRewardDeposit = await storage.getDepositByUserIdAndType(req.user!.id, 'partner_reward');
      if (!partnerRewardDeposit) {
        return res.status(404).json({ error: 'Partner reward account not found' });
      }
      
      if (partnerRewardDeposit.balance < amount) {
        return res.status(400).json({ error: 'Insufficient partner reward balance' });
      }
      
      // Transfer from partner_reward to main account
      const result = await storage.transferBetweenAccounts(
        req.user!.id,
        'partner_reward',
        'main',
        amount
      );
      
      if (!result.success) {
        return res.status(500).json({ error: 'Payout failed' });
      }
      
      res.json({ success: true, message: 'Commission payout successful', amount });
    } catch (error) {
      console.error('Commission payout error:', error);
      res.status(500).json({ error: 'Failed to process payout' });
    }
  });

  // Admin routes
  app.get('/api/admin/users', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { role, includeProfiles } = req.query;
      const users = await storage.getAllUsers(role as string);
      
      // Enhance users with additional data (profiles, partner info)
      const enhancedUsers = await Promise.all(
        users.map(async (user) => {
          let enhanced: any = { ...user };
          
          // Add profile data if requested
          if (includeProfiles === 'true') {
            const profile = await storage.getProfileByUserId(user.id);
            enhanced.inn = profile?.inn || null;
            enhanced.pinfl = profile?.pinfl || null;
            enhanced.bankAccount = profile?.bankAccount || null;
          }
          
          // Add partner data if user has partner role
          if (user.roles?.includes('partner')) {
            const partner = await storage.getPartnerByUserId(user.id);
            if (partner) {
              enhanced.referralCode = partner.referralCode;
              const clients = await storage.getPartnerClients(partner.id);
              enhanced.referredUsersCount = clients.length;
            } else {
              enhanced.referralCode = null;
              enhanced.referredUsersCount = 0;
            }
          }
          
          return enhanced;
        })
      );
      
      res.json(enhancedUsers);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.get('/api/admin/withdrawals', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const withdrawals = await storage.getPendingWithdrawals();
      
      const withdrawalsWithDetails = await Promise.all(
        withdrawals.map(async (withdrawal) => {
          const deposit = await storage.getDepositByUserId(0); // Would need proper query
          // This is simplified
          return { ...withdrawal };
        })
      );
      
      res.json(withdrawalsWithDetails);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch withdrawals' });
    }
  });

  app.post('/api/admin/assign-agent/:userId', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const agent = await storage.assignPartner(userId);
      res.json(agent);
    } catch (error) {
      res.status(500).json({ error: 'Failed to assign agent' });
    }
  });

  // Admin: Credit user's deposit (manual bank transfer entry)
  app.post('/api/admin/deposits/credit', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { userId, amount, reference, language = 'ru' } = req.body;
      
      if (!userId || typeof userId !== 'number') {
        return res.status(400).json({ error: language === 'uz' ? 'Foydalanuvchi ID si kerak' : 'ID пользователя обязателен' });
      }
      
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: language === 'uz' ? 'Summa musbat bo\'lishi kerak' : 'Сумма должна быть положительной' });
      }
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: language === 'uz' ? 'Foydalanuvchi topilmadi' : 'Пользователь не найден' });
      }
      
      // Get or create main deposit account
      let mainDeposit = await storage.getDepositByUserIdAndType(userId, 'main');
      if (!mainDeposit) {
        await storage.createAllDepositsForUser(userId);
        mainDeposit = await storage.getDepositByUserIdAndType(userId, 'main');
      }
      
      if (!mainDeposit) {
        return res.status(500).json({ error: 'Failed to get deposit account' });
      }
      
      // Add funds to main account
      const updatedDeposit = await storage.addFunds(userId, 'main', amount);
      
      if (!updatedDeposit) {
        return res.status(500).json({ error: 'Failed to credit account' });
      }
      
      // Create transaction record
      await storage.createDepositTransaction({
        depositId: mainDeposit.id,
        type: 'topup',
        amount,
        reference: reference || `Admin credit by user ${req.user!.id}`,
        status: 'completed',
      });
      
      console.log(`[ADMIN] User ${req.user!.id} credited ${amount} to user ${userId}. Reference: ${reference || 'none'}`);
      
      res.json({ 
        success: true, 
        message: language === 'uz' ? 'Hisob muvaffaqiyatli to\'ldirildi' : 'Счёт успешно пополнен',
        newBalance: updatedDeposit.balance,
        userName: user.displayName
      });
    } catch (error) {
      console.error('Admin deposit credit error:', error);
      res.status(500).json({ error: 'Failed to credit deposit' });
    }
  });

  // Admin: Get user's deposit info
  app.get('/api/admin/deposits/:userId', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const deposits = await storage.getDepositsByUserId(userId);
      
      res.json({
        user: {
          id: user.id,
          displayName: user.displayName,
          phone: user.phone,
        },
        deposits,
      });
    } catch (error) {
      console.error('Admin get deposits error:', error);
      res.status(500).json({ error: 'Failed to get deposits' });
    }
  });

  // Admin: Update user data with audit logging
  app.patch('/api/admin/users/:userId', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const adminId = req.user!.id;
      const { language = 'ru', ...updates } = req.body;
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ 
          error: language === 'uz' ? 'Foydalanuvchi topilmadi' : 'Пользователь не найден' 
        });
      }
      
      // Separate user fields from profile fields
      const userFields = ['phone', 'email', 'displayName', 'lastName', 'firstName', 'middleName', 'userType'];
      const profileFields = ['companyName', 'inn', 'pinfl', 'bankAccount', 'bankName', 'bankCode', 'ndsPayer', 'registrationCodeNds', 'passportSeries', 'passportNumber', 'cardNumber', 'cardExpiry'];
      
      const userUpdates: any = {};
      const profileUpdates: any = {};
      
      for (const [key, value] of Object.entries(updates)) {
        if (userFields.includes(key)) {
          userUpdates[key] = value;
        } else if (profileFields.includes(key)) {
          profileUpdates[key] = value;
        }
      }
      
      // Check if new phone is unique
      if (userUpdates.phone && userUpdates.phone !== user.phone) {
        const existingUser = await storage.getUserByPhone(userUpdates.phone);
        if (existingUser) {
          return res.status(400).json({ 
            error: language === 'uz' ? 'Bu telefon raqami boshqa foydalanuvchiga tegishli' : 'Этот номер телефона уже используется другим пользователем' 
          });
        }
      }
      
      let updatedUser = user;
      let updatedProfile = null;
      
      // Update user data if any user fields provided
      if (Object.keys(userUpdates).length > 0) {
        const result = await storage.updateUserByAdmin(userId, userUpdates, adminId);
        if (result) updatedUser = result;
      }
      
      // Update profile data if any profile fields provided
      if (Object.keys(profileUpdates).length > 0) {
        const result = await storage.updateProfileByAdmin(userId, profileUpdates, adminId);
        if (result) updatedProfile = result;
      }
      
      console.log(`[ADMIN] User ${adminId} updated user ${userId}. Changes: ${JSON.stringify(updates)}`);
      
      res.json({
        success: true,
        message: language === 'uz' ? 'Ma\'lumotlar yangilandi' : 'Данные обновлены',
        user: updatedUser,
        profile: updatedProfile,
      });
    } catch (error) {
      console.error('Admin update user error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // Admin: Get user audit history
  app.get('/api/admin/users/:userId/audit', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get audit logs for both user and profile
      const userAuditLogs = await storage.getAuditLogsByEntity('user', userId);
      const profileAuditLogs = await storage.getAuditLogsByEntity('profile', userId);
      
      // Combine and sort by date
      const allLogs = [...userAuditLogs, ...profileAuditLogs].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      // Enhance logs with admin names
      const enhancedLogs = await Promise.all(
        allLogs.map(async (log) => {
          const admin = await storage.getUserById(log.performedBy);
          return {
            ...log,
            adminName: admin?.displayName || 'Unknown',
            changes: log.data ? JSON.parse(log.data) : [],
          };
        })
      );
      
      res.json({
        user: {
          id: user.id,
          displayName: user.displayName,
          phone: user.phone,
        },
        auditLogs: enhancedLogs,
      });
    } catch (error) {
      console.error('Admin get audit error:', error);
      res.status(500).json({ error: 'Failed to get audit logs' });
    }
  });

  // ============ WITHDRAWAL REQUESTS ============
  
  // Send SMS code for withdrawal verification (individuals only)
  app.post('/api/withdrawals/send-sms', authenticate, async (req: AuthRequest, res: Response) => {
    const { language = 'ru' } = req.body;
    try {
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Only individuals can use SMS verification
      if (user.userType !== 'individual') {
        return res.status(400).json({ 
          error: language === 'uz' 
            ? 'SMS tasdiqlash faqat jismoniy shaxslar uchun' 
            : 'SMS подтверждение только для физических лиц' 
        });
      }
      
      const result = await sendOtp(user.phone, 'withdrawal', language);
      
      if (!result.success) {
        return res.status(400).json({ 
          error: result.error,
          cooldownRemaining: result.cooldownRemaining,
          lockoutRemaining: result.lockoutRemaining
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Withdrawal send SMS error:', error);
      res.status(500).json({ error: 'Failed to send SMS' });
    }
  });
  
  // User: Create withdrawal request with verification
  app.post('/api/withdrawals', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { amount, sourceAccountType, bankAccountNumber, bankName, cardNumber, cardExpiry, language = 'ru', smsCode, eimzoSignature } = req.body;
      const userId = req.user!.id;
      
      // Validate amount
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ 
          error: language === 'uz' ? 'Summa musbat bo\'lishi kerak' : 'Сумма должна быть положительной' 
        });
      }
      
      // SECURITY: Only allow withdrawals from main or partner_reward accounts
      if (sourceAccountType !== 'main' && sourceAccountType !== 'partner_reward') {
        return res.status(400).json({ 
          error: language === 'uz' ? 'Noto\'g\'ri hisob turi' : 'Неверный тип счета' 
        });
      }
      
      // Get user profile for bank details
      const profile = await storage.getProfileByUserId(userId);
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Determine user type - legal entities and IPs require E-IMZO + bank account, individuals require SMS + card
      const requiresEimzo = user.userType === 'legal' || user.userType === 'ip';
      const isIndividual = user.userType === 'individual';
      
      // Get the final bank account info (for legal entities and IPs only)
      const finalBankAccount = bankAccountNumber || profile?.bankAccount || null;
      const finalBankName = bankName || profile?.bankName || null;
      
      // Validate required payment details based on user type
      if (isIndividual) {
        // Individuals require card details
        if (!cardNumber || !cardExpiry) {
          return res.status(400).json({ 
            error: language === 'uz' 
              ? 'Plastik karta raqami va amal qilish muddati kerak' 
              : 'Необходим номер пластиковой карты и срок действия',
            requiresCard: true
          });
        }
        
        // Validate card number format (16 digits, optionally with spaces)
        const cleanCardNumber = cardNumber.replace(/\s/g, '');
        if (!/^\d{16}$/.test(cleanCardNumber)) {
          return res.status(400).json({ 
            error: language === 'uz' 
              ? 'Karta raqami 16 ta raqamdan iborat bo\'lishi kerak' 
              : 'Номер карты должен содержать 16 цифр'
          });
        }
        
        // Validate card expiry format (MM/YY)
        if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
          return res.status(400).json({ 
            error: language === 'uz' 
              ? 'Amal qilish muddati OO/YY formatida bo\'lishi kerak' 
              : 'Срок действия должен быть в формате ММ/ГГ'
          });
        }
      } else {
        // Legal entities and IPs require bank account
        if (!finalBankAccount) {
          return res.status(400).json({ 
            error: language === 'uz' ? 'Bank hisob raqami kerak' : 'Необходим номер банковского счёта' 
          });
        }
      }
      
      // Verify based on user type
      if (requiresEimzo) {
        // E-IMZO verification for legal entities and IPs
        if (!eimzoSignature) {
          return res.status(400).json({ 
            error: language === 'uz' 
              ? 'ERI imzosi talab qilinadi' 
              : 'Требуется подпись ЭЦП',
            requiresEimzo: true
          });
        }
        
        // Verify E-IMZO signature server-side via E-IMZO server with timestamp
        // Withdrawals require legally-valid timestamps for compliance
        console.log('[Withdrawal] Verifying E-IMZO signature with timestamp for user:', userId);
        const verifyResult = await eimzoService.verifySignatureWithTimestamp(eimzoSignature);
        
        if (!verifyResult.success || verifyResult.status !== 1) {
          console.error('[Withdrawal] E-IMZO signature verification failed:', verifyResult.error);
          return res.status(400).json({ 
            error: language === 'uz' 
              ? 'ERI imzosini tekshirib bo\'lmadi' 
              : 'Не удалось проверить подпись ЭЦП',
            details: verifyResult.error
          });
        }
        
        console.log('[Withdrawal] E-IMZO signature verified with timestamp successfully');
      } else {
        // SMS verification for individuals
        if (!smsCode) {
          return res.status(400).json({ 
            error: language === 'uz' 
              ? 'SMS kod talab qilinadi' 
              : 'Требуется SMS код',
            requiresSms: true
          });
        }
        
        // Verify SMS code
        const verifyResult = await verifyOtp(user.phone, smsCode, 'withdrawal', language);
        if (!verifyResult.success) {
          return res.status(400).json({ 
            error: verifyResult.error,
            attemptsRemaining: verifyResult.attemptsRemaining
          });
        }
      }
      
      // Get bank code from profile
      const finalBankCode = profile?.bankCode || '';
      
      // Get recipient name
      const recipientName = profile?.companyName || user.displayName || '';
      
      const withdrawalRequest = {
        userId,
        amount,
        sourceAccountType: sourceAccountType as 'main' | 'partner_reward',
        // Bank details for legal entities and IPs
        bankAccount: isIndividual ? null : finalBankAccount,
        bankName: isIndividual ? null : (finalBankName || ''),
        bankCode: isIndividual ? null : finalBankCode,
        // Card details for individuals
        cardNumber: isIndividual ? cardNumber?.replace(/\s/g, '') : null, // Store without spaces
        cardExpiry: isIndividual ? cardExpiry : null,
        recipientName,
        recipientInn: profile?.inn || null,
        recipientPinfl: profile?.pinfl || null,
        verificationMethod: requiresEimzo ? 'eimzo' as const : 'sms' as const,
      };
      
      // Create withdrawal with atomic balance move
      const result = await storage.createWithdrawalWithBalanceMove(
        userId,
        sourceAccountType,
        amount,
        withdrawalRequest
      );
      
      if (!result.success) {
        return res.status(400).json({ 
          error: result.error === 'Insufficient balance' 
            ? (language === 'uz' ? 'Mablag\' yetarli emas' : 'Недостаточно средств')
            : (language === 'uz' ? 'So\'rov yaratib bo\'lmadi' : 'Не удалось создать запрос')
        });
      }
      
      res.json({
        success: true,
        message: language === 'uz' 
          ? 'So\'rov yaratildi va ko\'rib chiqilmoqda' 
          : 'Запрос создан и находится на рассмотрении',
        withdrawalRequest: result.withdrawalRequest,
      });
    } catch (error) {
      console.error('Withdrawal request error:', error);
      res.status(500).json({ error: 'Failed to create withdrawal request' });
    }
  });
  
  // User: Get own withdrawal requests history
  app.get('/api/withdrawals', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const withdrawals = await storage.getWithdrawalRequestsByUserId(req.user!.id);
      res.json(withdrawals);
    } catch (error) {
      console.error('Get withdrawals error:', error);
      res.status(500).json({ error: 'Failed to get withdrawal requests' });
    }
  });
  
  // Admin: Get pending withdrawal requests
  app.get('/api/admin/withdrawals/pending', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const withdrawals = await storage.getPendingWithdrawalRequests();
      
      // Enrich with user info
      const enrichedWithdrawals = await Promise.all(withdrawals.map(async (w) => {
        const user = await storage.getUserById(w.userId);
        const profile = await storage.getProfileByUserId(w.userId);
        return {
          ...w,
          user: user ? {
            id: user.id,
            displayName: user.displayName,
            phone: user.phone,
          } : null,
          profile: profile ? {
            inn: profile.inn,
            pinfl: profile.pinfl,
            companyName: profile.companyName,
          } : null,
        };
      }));
      
      res.json(enrichedWithdrawals);
    } catch (error) {
      console.error('Admin get pending withdrawals error:', error);
      res.status(500).json({ error: 'Failed to get pending withdrawals' });
    }
  });
  
  // Admin: Get all withdrawal requests (for history)
  app.get('/api/admin/withdrawals/all', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const withdrawals = await storage.getAllWithdrawalRequests();
      
      // Enrich with user info
      const enrichedWithdrawals = await Promise.all(withdrawals.map(async (w) => {
        const user = await storage.getUserById(w.userId);
        const profile = await storage.getProfileByUserId(w.userId);
        return {
          ...w,
          user: user ? {
            id: user.id,
            displayName: user.displayName,
            phone: user.phone,
          } : null,
          profile: profile ? {
            inn: profile.inn,
            pinfl: profile.pinfl,
            companyName: profile.companyName,
          } : null,
        };
      }));
      
      res.json(enrichedWithdrawals);
    } catch (error) {
      console.error('Admin get all withdrawals error:', error);
      res.status(500).json({ error: 'Failed to get withdrawals' });
    }
  });
  
  // Admin: Complete or reject withdrawal request
  app.post('/api/admin/withdrawals/:id/process', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const withdrawalId = parseInt(req.params.id);
      const { action, adminNote, language = 'ru' } = req.body;
      const adminId = req.user!.id;
      
      if (action !== 'complete' && action !== 'reject') {
        return res.status(400).json({ error: 'Invalid action' });
      }
      
      const withdrawal = await storage.getWithdrawalRequestById(withdrawalId);
      if (!withdrawal) {
        return res.status(404).json({ 
          error: language === 'uz' ? 'So\'rov topilmadi' : 'Запрос не найден' 
        });
      }
      
      if (withdrawal.status !== 'pending' && withdrawal.status !== 'processing') {
        return res.status(400).json({ 
          error: language === 'uz' ? 'So\'rov allaqachon ko\'rib chiqilgan' : 'Запрос уже обработан' 
        });
      }
      
      if (action === 'complete') {
        // Complete the withdrawal (deduct from in_transit)
        const result = await storage.completeWithdrawal(withdrawalId, adminId, adminNote);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }
        
        res.json({
          success: true,
          message: language === 'uz' ? 'Chiqarish muvaffaqiyatli yakunlandi' : 'Вывод успешно завершён',
        });
      } else {
        // Reject: Move funds back from in_transit to source account (atomic operation)
        const result = await storage.rejectWithdrawal(withdrawalId, adminId, adminNote);
        if (!result.success) {
          return res.status(400).json({ error: result.error });
        }
        
        res.json({
          success: true,
          message: language === 'uz' ? 'So\'rov rad etildi, mablag\' qaytarildi' : 'Запрос отклонён, средства возвращены',
        });
      }
    } catch (error) {
      console.error('Admin process withdrawal error:', error);
      res.status(500).json({ error: 'Failed to process withdrawal' });
    }
  });

  // ============ ADMIN REPORTS ============

  // Balance report - balances at a specific date
  app.get('/api/admin/reports/balances', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { asOfDate } = req.query;
      const date = asOfDate ? new Date(asOfDate as string) : new Date();
      
      // Set to end of day
      date.setHours(23, 59, 59, 999);
      
      const report = await storage.getDepositBalanceReport(date);
      res.json(report);
    } catch (error) {
      console.error('Admin balance report error:', error);
      res.status(500).json({ error: 'Failed to generate balance report' });
    }
  });

  // Admin: Get Telegram users count
  app.get('/api/admin/telegram/users-count', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const users = await storage.getUsersWithTelegramId();
      res.json({ count: users.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get Telegram users count' });
    }
  });

  // Admin: Broadcast message to all users who used the Telegram bot
  app.post('/api/admin/telegram/broadcast', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { message, parseMode } = req.body as { message: string; parseMode?: 'HTML' | 'Markdown' };
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'message is required' });
      }
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        return res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
      }

      const TelegramBot = (await import('node-telegram-bot-api')).default;
      const bot = new TelegramBot(token, { polling: false });

      const users = await storage.getUsersWithTelegramId();
      let sent = 0;
      let failed = 0;

      for (const user of users) {
        if (!user.telegramId) continue;
        try {
          await bot.sendMessage(user.telegramId, message, {
            parse_mode: parseMode || 'HTML',
          });
          sent++;
          // Small delay to avoid Telegram rate limits (30 msg/sec)
          await new Promise(r => setTimeout(r, 50));
        } catch (err: any) {
          console.warn(`[TelegramBroadcast] Failed to send to ${user.telegramId}:`, err?.message || err);
          failed++;
        }
      }

      console.log(`[TelegramBroadcast] Sent: ${sent}, Failed: ${failed}, Total: ${users.length}`);
      res.json({ sent, failed, total: users.length });
    } catch (error) {
      console.error('[TelegramBroadcast] Error:', error);
      res.status(500).json({ error: 'Broadcast failed' });
    }
  });

  // Admin - search users for reports (lightweight)
  app.get('/api/admin/users/search', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { query } = req.query;
      if (!query || typeof query !== 'string' || query.length < 2) {
        return res.json([]);
      }
      
      const allUsers = await storage.getAllUsers();
      const searchQuery = query.toLowerCase();
      
      // Get profiles for INN/PINFL search
      const userProfileMap = new Map<number, any>();
      for (const user of allUsers) {
        const profile = await storage.getProfileByUserId(user.id);
        if (profile) {
          userProfileMap.set(user.id, profile);
        }
      }
      
      const results = allUsers
        .filter(u => {
          const profile = userProfileMap.get(u.id);
          return (
            u.displayName?.toLowerCase().includes(searchQuery) ||
            u.phone?.includes(searchQuery) ||
            u.id.toString() === query ||
            profile?.inn?.includes(query) ||
            profile?.pinfl?.includes(query) ||
            profile?.eimzoCertTin?.includes(query) ||
            profile?.eimzoCertPinfl?.includes(query)
          );
        })
        .slice(0, 20)
        .map(u => {
          const profile = userProfileMap.get(u.id);
          return {
            id: u.id,
            displayName: u.displayName,
            phone: u.phone,
            userType: u.userType,
            inn: profile?.inn || profile?.eimzoCertTin || null,
            pinfl: profile?.pinfl || profile?.eimzoCertPinfl || null,
          };
        });
      
      res.json(results);
    } catch (error) {
      console.error('Admin user search error:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  });

  // Admin - get user's deposit transactions by userId
  app.get('/api/admin/users/:userId/transactions', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const userId = parseInt(req.params.userId, 10);
      const { startDate, endDate } = req.query;
      
      // Get user info
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get all deposits for this user
      const deposits = await storage.getDepositsByUserId(userId);
      
      // Get transactions for all deposits with filtering
      const allTransactions: any[] = [];
      for (const deposit of deposits) {
        const transactions = await storage.getDepositTransactionsByDepositId(deposit.id);
        
        // Filter by date if provided
        const filteredTransactions = transactions.filter(t => {
          const txDate = new Date(t.createdAt);
          if (startDate && txDate < new Date(startDate as string)) return false;
          if (endDate) {
            const end = new Date(endDate as string);
            end.setHours(23, 59, 59, 999);
            if (txDate > end) return false;
          }
          return true;
        });
        
        allTransactions.push(...filteredTransactions.map(t => ({ 
          ...t, 
          accountType: deposit.accountType,
        })));
      }
      
      // Sort by createdAt descending
      allTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Calculate totals per account type
      // Credit/debit determined by transaction type (same logic as user cabinet)
      const creditTypes = ['topup', 'unblock', 'escrow_release', 'escrow_refund', 'transfer_in', 'registration_bonus'];
      
      const accountSummary: Record<string, { credit: number; debit: number; balance: number }> = {};
      for (const deposit of deposits) {
        const depositTxs = allTransactions.filter(t => t.accountType === deposit.accountType);
        // Use absolute values - sign is determined by transaction type
        const credit = depositTxs.filter(t => creditTypes.includes(t.type)).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount as string || '0')), 0);
        const debit = depositTxs.filter(t => !creditTypes.includes(t.type)).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount as string || '0')), 0);
        accountSummary[deposit.accountType] = { credit, debit, balance: parseFloat(deposit.balance as string || '0') };
      }
      
      res.json({
        user: {
          id: user.id,
          displayName: user.displayName,
          phone: user.phone,
          userType: user.userType,
        },
        transactions: allTransactions,
        accountSummary,
        deposits: deposits.map(d => ({ id: d.id, accountType: d.accountType, balance: d.balance })),
      });
    } catch (error) {
      console.error('Admin user transactions error:', error);
      res.status(500).json({ error: 'Failed to fetch user transactions' });
    }
  });

  // Orders report - filtered and paginated
  app.get('/api/admin/reports/orders', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { startDate, endDate, status, includeDeleted, page = '1', pageSize = '20' } = req.query;
      
      const filters: any = {
        page: parseInt(page as string, 10) || 1,
        pageSize: Math.min(parseInt(pageSize as string, 10) || 20, 100),
        includeDeleted: includeDeleted === 'true',
      };
      
      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        filters.startDate = start;
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        filters.endDate = end;
      }
      if (status) {
        filters.status = Array.isArray(status) ? status : [status];
      }
      
      const report = await storage.getOrdersReport(filters);
      res.json({
        ...report,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.ceil(report.total / filters.pageSize),
      });
    } catch (error) {
      console.error('Admin orders report error:', error);
      res.status(500).json({ error: 'Failed to generate orders report' });
    }
  });

  // Admin delete order endpoint
  app.delete('/api/admin/orders/:orderId', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.orderId, 10);
      if (isNaN(orderId)) {
        return res.status(400).json({ error: 'Invalid order ID' });
      }
      
      await storage.adminDeleteOrder(orderId);
      res.json({ success: true, message: 'Order deleted successfully' });
    } catch (error: any) {
      console.error('Admin delete order error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete order' });
    }
  });

  // Contracts report - filtered and paginated
  app.get('/api/admin/reports/contracts', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { startDate, endDate, status, page = '1', pageSize = '20' } = req.query;
      
      const filters: any = {
        page: parseInt(page as string, 10) || 1,
        pageSize: Math.min(parseInt(pageSize as string, 10) || 20, 100),
      };
      
      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        filters.startDate = start;
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        filters.endDate = end;
      }
      if (status) {
        filters.status = Array.isArray(status) ? status : [status];
      }
      
      const report = await storage.getContractsReport(filters);
      res.json({
        ...report,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.ceil(report.total / filters.pageSize),
      });
    } catch (error) {
      console.error('Admin contracts report error:', error);
      res.status(500).json({ error: 'Failed to generate contracts report' });
    }
  });

  // Partner rewards report - filtered and paginated
  app.get('/api/admin/reports/partner-rewards', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { startDate, endDate, page = '1', pageSize = '20' } = req.query;
      
      const filters: any = {
        page: parseInt(page as string, 10) || 1,
        pageSize: Math.min(parseInt(pageSize as string, 10) || 20, 100),
      };
      
      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        filters.startDate = start;
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        filters.endDate = end;
      }
      
      const report = await storage.getPartnerRewardsReport(filters);
      res.json({
        ...report,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.ceil(report.total / filters.pageSize),
      });
    } catch (error) {
      console.error('Admin partner rewards report error:', error);
      res.status(500).json({ error: 'Failed to generate partner rewards report' });
    }
  });

  // Partner rewards report - Excel export
  app.get('/api/admin/reports/partner-rewards/excel', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { startDate, endDate, language = 'ru' } = req.query;
      
      const filters: any = {
        page: 1,
        pageSize: 10000, // Get all records for export
      };
      
      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        filters.startDate = start;
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        filters.endDate = end;
      }
      
      const report = await storage.getPartnerRewardsReport(filters);
      
      // Import xlsx dynamically
      const XLSX = await import('xlsx');
      
      // Prepare headers based on language
      const headers = language === 'uz' ? {
        lastName: 'Familiya',
        firstName: 'Ism',
        middleName: 'Otasining ismi',
        companyName: 'Tashkilot nomi',
        inn: 'INN',
        pinfl: 'PINFL',
        customer: 'Buyurtmachi',
        carrier: 'Tashuvchi',
        contractNumber: 'Shartnoma raqami',
        contractDate: 'Shartnoma sanasi',
        contractAmount: 'Shartnoma summasi',
        contractStatus: 'Shartnoma holati',
        rewardAmount: 'Mukofot summasi',
      } : {
        lastName: 'Фамилия',
        firstName: 'Имя',
        middleName: 'Отчество',
        companyName: 'Название организации',
        inn: 'ИНН',
        pinfl: 'ПИНФЛ',
        customer: 'Заказчик',
        carrier: 'Перевозчик',
        contractNumber: 'Номер договора',
        contractDate: 'Дата договора',
        contractAmount: 'Сумма договора',
        contractStatus: 'Статус договора',
        rewardAmount: 'Сумма вознаграждения',
      };
      
      const contractStatusLabels: Record<string, Record<string, string>> = {
        ru: {
          awaiting_prepayment: 'Ожидает предоплату',
          prepayment_made: 'Предоплата внесена',
          awaiting_completion_confirmation: 'Ожидает подтверждения',
          closed: 'Закрыт',
          termination_pending: 'Ожидает расторжения',
          terminated: 'Расторгнут',
        },
        uz: {
          awaiting_prepayment: 'Oldindan to\'lovni kutmoqda',
          prepayment_made: 'Oldindan to\'lov qilingan',
          awaiting_completion_confirmation: 'Tasdiqlashni kutmoqda',
          closed: 'Yopilgan',
          termination_pending: 'Bekor qilishni kutmoqda',
          terminated: 'Bekor qilingan',
        }
      };
      
      // Transform data for Excel
      const excelData = report.rewards.map((reward: any) => ({
        [headers.lastName]: reward.partner?.lastName || '-',
        [headers.firstName]: reward.partner?.firstName || '-',
        [headers.middleName]: reward.partner?.middleName || '-',
        [headers.companyName]: reward.partner?.companyName || '-',
        [headers.inn]: reward.partner?.inn || '-',
        [headers.pinfl]: reward.partner?.pinfl || '-',
        [headers.customer]: reward.customer?.companyName || reward.customer?.displayName || '-',
        [headers.carrier]: reward.carrier?.companyName || reward.carrier?.displayName || '-',
        [headers.contractNumber]: reward.contract?.id ? `№${reward.contract.id}` : '-',
        [headers.contractDate]: reward.contract?.generatedAt 
          ? new Date(reward.contract.generatedAt).toLocaleDateString(language === 'uz' ? 'uz-UZ' : 'ru-RU', { timeZone: 'Asia/Tashkent' })
          : '-',
        [headers.contractAmount]: reward.contract?.amount 
          ? reward.contract.amount.toLocaleString(language === 'uz' ? 'uz-UZ' : 'ru-RU')
          : '-',
        [headers.contractStatus]: reward.contract?.status 
          ? (contractStatusLabels[language as string]?.[reward.contract.status] || reward.contract.status)
          : '-',
        [headers.rewardAmount]: reward.amount.toLocaleString(language === 'uz' ? 'uz-UZ' : 'ru-RU'),
      }));
      
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 20 }, // lastName
        { wch: 15 }, // firstName
        { wch: 20 }, // middleName
        { wch: 30 }, // companyName
        { wch: 12 }, // inn
        { wch: 16 }, // pinfl
        { wch: 25 }, // customer
        { wch: 25 }, // carrier
        { wch: 15 }, // contractNumber
        { wch: 15 }, // contractDate
        { wch: 18 }, // contractAmount
        { wch: 20 }, // contractStatus
        { wch: 18 }, // rewardAmount
      ];
      
      XLSX.utils.book_append_sheet(workbook, worksheet, language === 'uz' ? 'Mukofotlar' : 'Вознаграждения');
      
      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Set response headers
      const filename = language === 'uz' 
        ? `partner_mukofotlar_${new Date().toISOString().split('T')[0]}.xlsx`
        : `partner_voznagrazhdeniya_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      console.error('Admin partner rewards Excel export error:', error);
      res.status(500).json({ error: 'Failed to generate Excel report' });
    }
  });

  // Platform commission report
  app.get('/api/admin/reports/platform-commission', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { startDate, endDate, status, page = '1', pageSize = '20' } = req.query;
      
      const filters: any = {
        page: parseInt(page as string, 10) || 1,
        pageSize: Math.min(parseInt(pageSize as string, 10) || 20, 100),
      };
      
      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        filters.startDate = start;
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        filters.endDate = end;
      }
      if (status) {
        filters.status = Array.isArray(status) ? status : [status];
      }
      
      const report = await storage.getPlatformCommissionReport(filters);
      res.json({
        ...report,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages: Math.ceil(report.total / filters.pageSize),
      });
    } catch (error) {
      console.error('Admin platform commission report error:', error);
      res.status(500).json({ error: 'Failed to generate platform commission report' });
    }
  });

  // Platform commission report - Excel export
  app.get('/api/admin/reports/platform-commission/excel', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { startDate, endDate, status, language = 'ru' } = req.query;
      
      const filters: any = {
        page: 1,
        pageSize: 10000, // Get all records for export
      };
      
      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        filters.startDate = start;
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        filters.endDate = end;
      }
      if (status) {
        filters.status = Array.isArray(status) ? status : [status];
      }
      
      const report = await storage.getPlatformCommissionReport(filters);
      
      // Import xlsx dynamically
      const XLSX = await import('xlsx');
      
      // Prepare headers based on language
      const headers = language === 'uz' ? {
        customer: 'Buyurtmachi',
        carrier: 'Tashuvchi',
        carrierInnPinfl: 'INN/PINFL',
        orderNumber: 'Buyurtma raqami',
        orderDate: 'Buyurtma sanasi',
        contractNumber: 'Shartnoma raqami',
        contractDate: 'Shartnoma sanasi',
        contractAmount: 'Shartnoma summasi',
        contractStatus: 'Shartnoma holati',
        commissionAmount: 'Hisoblangan komissiya',
        commissionFromMain: 'Asosiy hisobdan',
        commissionFromBonus: 'Bonus hisobdan',
      } : {
        customer: 'Заказчик',
        carrier: 'Перевозчик',
        carrierInnPinfl: 'ИНН/ПИНФЛ',
        orderNumber: 'Номер заказа',
        orderDate: 'Дата заказа',
        contractNumber: 'Номер договора',
        contractDate: 'Дата договора',
        contractAmount: 'Сумма договора',
        contractStatus: 'Статус договора',
        commissionAmount: 'Начисленная комиссия',
        commissionFromMain: 'С основного счёта',
        commissionFromBonus: 'С бонусного счёта',
      };
      
      // Contract status translations
      const contractStatusLabels: Record<string, Record<string, string>> = {
        ru: {
          awaiting_prepayment: 'Ожидает предоплату',
          prepayment_made: 'Предоплата внесена',
          awaiting_completion_confirmation: 'Ожидает подтверждения',
          closed: 'Закрыт',
          termination_pending: 'Ожидает расторжения',
          terminated: 'Расторгнут',
        },
        uz: {
          awaiting_prepayment: 'Oldindan to\'lovni kutmoqda',
          prepayment_made: 'Oldindan to\'lov qilingan',
          awaiting_completion_confirmation: 'Tasdiqlashni kutmoqda',
          closed: 'Yopilgan',
          termination_pending: 'Bekor qilishni kutmoqda',
          terminated: 'Bekor qilingan',
        }
      };
      
      // Transform data for Excel
      const excelData = report.commissions.map((item: any) => ({
        [headers.customer]: item.customer?.companyName || item.customer?.displayName || '-',
        [headers.carrier]: item.carrier?.companyName || item.carrier?.displayName || '-',
        [headers.carrierInnPinfl]: item.carrier?.inn || item.carrier?.pinfl || '-',
        [headers.orderNumber]: item.order?.id ? `№${item.order.id}` : '-',
        [headers.orderDate]: item.order?.createdAt 
          ? new Date(item.order.createdAt).toLocaleDateString(language === 'uz' ? 'uz-UZ' : 'ru-RU', { timeZone: 'Asia/Tashkent' })
          : '-',
        [headers.contractNumber]: item.contract?.id ? `№${item.contract.id}` : '-',
        [headers.contractDate]: item.contract?.generatedAt 
          ? new Date(item.contract.generatedAt).toLocaleDateString(language === 'uz' ? 'uz-UZ' : 'ru-RU', { timeZone: 'Asia/Tashkent' })
          : '-',
        [headers.contractAmount]: item.contract?.amount 
          ? item.contract.amount.toLocaleString(language === 'uz' ? 'uz-UZ' : 'ru-RU')
          : '-',
        [headers.contractStatus]: item.contract?.status 
          ? (contractStatusLabels[language as string]?.[item.contract.status] || item.contract.status)
          : '-',
        [headers.commissionAmount]: item.commissionAmount.toLocaleString(language === 'uz' ? 'uz-UZ' : 'ru-RU'),
        [headers.commissionFromMain]: (item.commissionFromMain || 0).toLocaleString(language === 'uz' ? 'uz-UZ' : 'ru-RU'),
        [headers.commissionFromBonus]: (item.commissionFromBonus || 0).toLocaleString(language === 'uz' ? 'uz-UZ' : 'ru-RU'),
      }));
      
      // Calculate totals for breakdown columns
      let totalFromMain = 0;
      let totalFromBonus = 0;
      report.commissions.forEach((item: any) => {
        totalFromMain += item.commissionFromMain || 0;
        totalFromBonus += item.commissionFromBonus || 0;
      });
      
      // Add total row
      excelData.push({
        [headers.customer]: language === 'uz' ? 'JAMI' : 'ИТОГО',
        [headers.carrier]: '',
        [headers.carrierInnPinfl]: '',
        [headers.orderNumber]: '',
        [headers.orderDate]: '',
        [headers.contractNumber]: '',
        [headers.contractDate]: '',
        [headers.contractAmount]: '',
        [headers.contractStatus]: '',
        [headers.commissionAmount]: report.totalCommission.toLocaleString(language === 'uz' ? 'uz-UZ' : 'ru-RU'),
        [headers.commissionFromMain]: totalFromMain.toLocaleString(language === 'uz' ? 'uz-UZ' : 'ru-RU'),
        [headers.commissionFromBonus]: totalFromBonus.toLocaleString(language === 'uz' ? 'uz-UZ' : 'ru-RU'),
      });
      
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 30 }, // customer
        { wch: 30 }, // carrier
        { wch: 16 }, // carrierInnPinfl
        { wch: 15 }, // orderNumber
        { wch: 15 }, // orderDate
        { wch: 15 }, // contractNumber
        { wch: 15 }, // contractDate
        { wch: 18 }, // contractAmount
        { wch: 20 }, // contractStatus
        { wch: 20 }, // commissionAmount
        { wch: 18 }, // commissionFromMain
        { wch: 18 }, // commissionFromBonus
      ];
      
      XLSX.utils.book_append_sheet(workbook, worksheet, language === 'uz' ? 'Platforma komissiyasi' : 'Комиссия платформы');
      
      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Set response headers
      const filename = language === 'uz' 
        ? `platforma_komissiyasi_${new Date().toISOString().split('T')[0]}.xlsx`
        : `komissiya_platformy_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      console.error('Admin platform commission Excel export error:', error);
      res.status(500).json({ error: 'Failed to generate Excel report' });
    }
  });

  // Admin order details - full order info with offers, contract, and carrier details
  app.get('/api/admin/orders/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.id, 10);
      if (isNaN(orderId)) {
        return res.status(400).json({ error: 'Invalid order ID' });
      }

      // Get order
      const order = await storage.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Get customer info with profile
      const customer = await storage.getUserById(order.customerId);
      const customerProfile = customer ? await storage.getProfileByUserId(customer.id) : null;

      // Get all offers for this order with carrier info
      const offers = await storage.getOffersByOrderId(orderId);
      const offersWithCarriers = await Promise.all(offers.map(async (offer) => {
        const carrier = await storage.getUserById(offer.carrierId);
        const carrierProfile = carrier ? await storage.getProfileByUserId(carrier.id) : null;
        return {
          ...offer,
          carrier: carrier ? {
            id: carrier.id,
            displayName: carrier.displayName,
            phone: carrier.phone,
            inn: carrierProfile?.inn || null,
            pinfl: carrierProfile?.pinfl || null,
          } : null,
        };
      }));

      // Get accepted offer
      const acceptedOffer = await storage.getAcceptedOfferByOrderId(orderId);
      let acceptedOfferWithCarrier = null;
      if (acceptedOffer) {
        const acceptedCarrier = await storage.getUserById(acceptedOffer.carrierId);
        const acceptedCarrierProfile = acceptedCarrier ? await storage.getProfileByUserId(acceptedCarrier.id) : null;
        acceptedOfferWithCarrier = {
          ...acceptedOffer,
          carrier: acceptedCarrier ? {
            id: acceptedCarrier.id,
            displayName: acceptedCarrier.displayName,
            phone: acceptedCarrier.phone,
            inn: acceptedCarrierProfile?.inn || null,
            pinfl: acceptedCarrierProfile?.pinfl || null,
          } : null,
        };
      }

      // Get contract if exists
      const contract = await storage.getContractByOrderId(orderId);
      let contractWithDetails = null;
      if (contract) {
        const contractCarrier = await storage.getUserById(contract.carrierId);
        const contractCarrierProfile = contractCarrier ? await storage.getProfileByUserId(contractCarrier.id) : null;
        contractWithDetails = {
          ...contract,
          carrier: contractCarrier ? {
            id: contractCarrier.id,
            displayName: contractCarrier.displayName,
            phone: contractCarrier.phone,
            inn: contractCarrierProfile?.inn || null,
            pinfl: contractCarrierProfile?.pinfl || null,
          } : null,
        };
      }

      res.json({
        order: {
          ...order,
          customer: customer ? {
            id: customer.id,
            displayName: customer.displayName,
            phone: customer.phone,
            inn: customerProfile?.inn || null,
            pinfl: customerProfile?.pinfl || null,
          } : null,
        },
        offers: offersWithCarriers,
        acceptedOffer: acceptedOfferWithCarrier,
        contract: contractWithDetails,
        offerCount: offers.length,
      });
    } catch (error) {
      console.error('Admin order details error:', error);
      res.status(500).json({ error: 'Failed to fetch order details' });
    }
  });

  // Public endpoint: Get concluded contracts (public deals)
  // Shows all contracts that have been signed (excludes drafts and awaiting_signatures)
  app.get('/api/contracts/public/concluded', async (req: Request, res: Response) => {
    try {
      const contracts = await storage.getAllConcludedContracts();
      res.json(contracts || []);
    } catch (error) {
      console.error('Public contracts fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch contracts' });
    }
  });

  // Public endpoint: Get new orders (public orders list)
  app.get('/api/orders/public/new', async (req: Request, res: Response) => {
    try {
      const originRegion = req.query.originRegion as string | undefined;
      const destinationRegion = req.query.destinationRegion as string | undefined;
      const transportType = req.query.transportType as string | undefined;
      const orders = await storage.getAllOrders({
        status: 'new',
        originRegion: originRegion || undefined,
        destinationRegion: destinationRegion || undefined,
        transportType: transportType || undefined,
      });
      res.json(orders);
    } catch (error) {
      console.error('Public orders fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  // Public endpoint: Get server time for countdown synchronization
  app.get('/api/server-time', async (req: Request, res: Response) => {
    res.json({ serverTime: new Date().toISOString() });
  });

  // ============ BLACKLIST MANAGEMENT ============
  
  // Search carriers by ID or name (for blacklist autocomplete)
  app.get('/api/carriers/search', authenticate, authorize('customer'), async (req: AuthRequest, res: Response) => {
    try {
      const query = (req.query.q as string || '').trim().toLowerCase();
      if (!query || query.length < 1) {
        return res.json([]);
      }
      
      // Get all users who are carriers
      const allUsers = await db.select({
        id: schema.users.id,
        displayName: schema.users.displayName,
        phone: schema.users.phone,
        roles: schema.users.roles
      })
        .from(schema.users)
        .where(sql`'carrier' = ANY(${schema.users.roles})`);
      
      // Filter by query (ID or name)
      const filtered = allUsers.filter(user => {
        const idMatch = user.id.toString().includes(query);
        const nameMatch = user.displayName?.toLowerCase().includes(query);
        return idMatch || nameMatch;
      });
      
      // Exclude self from results
      const results = filtered
        .filter(user => user.id !== req.user!.id)
        .slice(0, 10);
      
      res.json(results);
    } catch (error) {
      console.error('Carrier search error:', error);
      res.status(500).json({ error: 'Failed to search carriers' });
    }
  });
  
  // Get customer's blacklist
  app.get('/api/blacklist', authenticate, authorize('customer'), async (req: AuthRequest, res: Response) => {
    try {
      const blacklist = await storage.getBlacklistByCustomerId(req.user!.id);
      res.json(blacklist);
    } catch (error) {
      console.error('Blacklist fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch blacklist' });
    }
  });

  // Add carrier to blacklist
  app.post('/api/blacklist', authenticate, authorize('customer'), async (req: AuthRequest, res: Response) => {
    try {
      const { carrierId, reason } = req.body;
      
      if (!carrierId || typeof carrierId !== 'number') {
        return res.status(400).json({ error: 'Carrier ID is required' });
      }
      
      // Check if carrier exists and is actually a carrier
      const carrier = await storage.getUserById(carrierId);
      if (!carrier) {
        return res.status(404).json({ error: 'Carrier not found' });
      }
      if (!carrier.roles.includes('carrier')) {
        return res.status(400).json({ error: 'User is not a carrier' });
      }
      
      // Cannot blacklist yourself
      if (carrierId === req.user!.id) {
        return res.status(400).json({ error: 'Cannot blacklist yourself' });
      }
      
      // Check if already blacklisted
      const isBlacklisted = await storage.isCarrierBlacklisted(req.user!.id, carrierId);
      if (isBlacklisted) {
        return res.status(400).json({ error: 'Carrier already in blacklist' });
      }
      
      const blacklistEntry = await storage.addToBlacklist(req.user!.id, carrierId, reason);
      res.json(blacklistEntry);
    } catch (error) {
      console.error('Blacklist add error:', error);
      res.status(500).json({ error: 'Failed to add to blacklist' });
    }
  });

  // Remove carrier from blacklist
  app.delete('/api/blacklist/:carrierId', authenticate, authorize('customer'), async (req: AuthRequest, res: Response) => {
    try {
      const carrierId = parseInt(req.params.carrierId);
      
      if (isNaN(carrierId)) {
        return res.status(400).json({ error: 'Invalid carrier ID' });
      }
      
      const removed = await storage.removeFromBlacklist(req.user!.id, carrierId);
      if (!removed) {
        return res.status(404).json({ error: 'Carrier not found in blacklist' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Blacklist remove error:', error);
      res.status(500).json({ error: 'Failed to remove from blacklist' });
    }
  });

  // Check if a specific carrier is blacklisted (for offer form)
  app.get('/api/blacklist/check/:orderId', authenticate, authorizeCarrier, async (req: AuthRequest, res: Response) => {
    try {
      const orderId = parseInt(req.params.orderId);
      
      const order = await storage.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      const isBlacklisted = await storage.isCarrierBlacklisted(order.customerId, req.user!.id);
      res.json({ isBlacklisted });
    } catch (error) {
      console.error('Blacklist check error:', error);
      res.status(500).json({ error: 'Failed to check blacklist' });
    }
  });

  // Special admin bootstrap endpoint - requires bootstrap secret
  app.post('/api/bootstrap-admin', async (req: Request, res: Response) => {
    try {
      // Require a bootstrap secret from environment
      const bootstrapSecret = process.env.BOOTSTRAP_ADMIN_SECRET;
      if (!bootstrapSecret || req.body.secret !== bootstrapSecret) {
        return res.status(403).json({ error: 'Invalid bootstrap secret' });
      }

      // Check if any admin exists
      const admins = await storage.getAllUsers('admin');
      if (admins.length > 0) {
        return res.status(403).json({ error: 'Admin already exists' });
      }

      const passwordHash = await bcrypt.hash('admin123', 10);
      
      const user = await storage.createUser({
        phone: '+998901234567',
        passwordHash,
        displayName: 'System Administrator',
        roles: ['admin'],
        defaultRole: 'admin',
        userType: 'individual',
        email: 'admin@yukbor.uz',
      });

      await storage.createProfile({
        userId: user.id,
      });

      res.json({ 
        success: true, 
        message: 'Admin created. Phone: +998901234567, Password: admin123. CHANGE THIS PASSWORD!' 
      });
    } catch (error) {
      console.error('Bootstrap admin error:', error);
      res.status(500).json({ error: 'Failed to create admin' });
    }
  });

  // E-IMZO Digital Signature Routes
  
  // Check E-IMZO server status
  app.get('/api/eimzo/status', async (req: Request, res: Response) => {
    try {
      const result = await eimzoService.ping();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Get challenge for authentication
  app.post('/api/eimzo/challenge', async (req: Request, res: Response) => {
    try {
      const result = await eimzoService.getChallenge();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Verify authentication signature
  app.post('/api/eimzo/verify-auth', async (req: Request, res: Response) => {
    try {
      const { pkcs7 } = req.body;
      if (!pkcs7) {
        return res.status(400).json({ success: false, error: 'PKCS7 document required' });
      }
      
      const result = await eimzoService.verifyAuth(pkcs7);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Add timestamp to signature
  app.post('/api/eimzo/timestamp', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { pkcs7 } = req.body;
      if (!pkcs7) {
        return res.status(400).json({ success: false, error: 'PKCS7 document required' });
      }
      
      const result = await eimzoService.addTimestamp(pkcs7);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Verify document signature
  app.post('/api/eimzo/verify-signature', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { pkcs7 } = req.body;
      if (!pkcs7) {
        return res.status(400).json({ success: false, error: 'PKCS7 document required' });
      }
      
      const result = await eimzoService.verifySignature(pkcs7);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Sign contract with E-IMZO
  app.post('/api/contracts/:contractId/eimzo-sign', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const { pkcs7 } = req.body;
      const userId = req.user!.id;
      
      if (!pkcs7) {
        return res.status(400).json({ error: 'PKCS7 signature required' });
      }

      // Get contract
      const contract = await storage.getContractById(contractId);
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      // Verify user is party to contract
      const isCustomer = contract.customerId === userId;
      const isCarrier = contract.carrierId === userId;

      if (!isCustomer && !isCarrier) {
        return res.status(403).json({ error: 'Not authorized to sign this contract' });
      }

      // Verify contract has content to sign
      if (!contract.contractContent) {
        return res.status(400).json({ error: 'Contract content not generated yet' });
      }

      // Verify signature with timestamp (for contracts, legal timestamp is required)
      // This uses verifySignatureWithTimestamp which adds timestamp and verifies via /backend/pkcs7/verify/attached
      const verifyResult = await eimzoService.verifySignatureWithTimestamp(pkcs7);
      
      // CRITICAL: Reject if verification fails
      if (!verifyResult.success || verifyResult.status !== 1) {
        console.error('[E-IMZO] Signature verification failed:', verifyResult.error);
        return res.status(400).json({ 
          error: 'Signature verification failed', 
          details: verifyResult.error || 'Invalid signature' 
        });
      }

      // CRITICAL: Verify signed document matches contract content
      // The PKCS7 contains the original document - we verify its hash matches our stored hash
      if (contract.documentHash && verifyResult.pkcs7Info?.document) {
        const signedDocument = verifyResult.pkcs7Info.document;
        const signedDocumentHash = generateDocumentHash(signedDocument);
        if (signedDocumentHash !== contract.documentHash) {
          console.error(`[E-IMZO] Document hash mismatch: expected=${contract.documentHash}, got=${signedDocumentHash}`);
          return res.status(400).json({ 
            error: 'Signed document does not match contract content',
            details: 'The document you signed differs from the contract' 
          });
        }
      }

      // Extract and validate signer info
      const signerInfo = eimzoService.extractSignerInfo(verifyResult.pkcs7Info);
      if (!signerInfo || !signerInfo.serialNumber) {
        console.error('[E-IMZO] Failed to extract signer info');
        return res.status(400).json({ error: 'Failed to extract signer information from signature' });
      }

      // Get user data to verify signer matches contract party
      const signingUser = await storage.getUserById(userId);
      const signingProfile = await storage.getProfileByUserId(userId);
      
      // Verify signer TIN/PINFL matches user profile if available
      if (signingProfile) {
        const userTin = signingProfile.inn;
        const userPinfl = signingProfile.pinfl;
        
        if (userTin && signerInfo.TIN && userTin !== signerInfo.TIN) {
          console.warn(`[E-IMZO] TIN mismatch: profile=${userTin}, signature=${signerInfo.TIN}`);
          // Log warning but allow - TIN may differ for authorized signers
        }
        if (userPinfl && signerInfo.PINFL && userPinfl !== signerInfo.PINFL) {
          console.warn(`[E-IMZO] PINFL mismatch: profile=${userPinfl}, signature=${signerInfo.PINFL}`);
        }
      }
      
      // Update contract with verified signature
      const signatureField = isCustomer ? 'customerSignature' : 'carrierSignature';
      const signedAtField = isCustomer ? 'customerSignedAt' : 'carrierSignedAt';
      const signerInfoField = isCustomer ? 'customerSignerInfo' : 'carrierSignerInfo';
      const signatureMethodField = isCustomer ? 'customerSignatureMethod' : 'carrierSignatureMethod';
      
      const updateData: Record<string, any> = {
        [signatureField]: verifyResult.pkcs7WithTimestamp,
        [signedAtField]: new Date(),
        [signerInfoField]: JSON.stringify(signerInfo),
        [signatureMethodField]: 'eimzo'
      };

      // Check if both parties have signed - only then activate contract
      const existingSignature = isCustomer ? contract.carrierSignature : contract.customerSignature;
      if (existingSignature && !existingSignature.startsWith('AUTO_SIGNED_')) {
        // Both parties have E-IMZO signatures - contract is fully signed
        updateData.status = 'fully_signed';
      } else if (isCustomer) {
        updateData.status = 'signed_by_customer';
      } else {
        updateData.status = 'signed_by_carrier';
      }

      await storage.updateContract(contractId, updateData);
      
      const updatedContract = await storage.getContractById(contractId);
      res.json({ 
        success: true, 
        contract: updatedContract,
        signerInfo 
      });
    } catch (error: any) {
      console.error('E-IMZO contract signing error:', error);
      res.status(500).json({ error: error.message || 'Failed to sign contract' });
    }
  });

  // SMS contract signing - Step 1: Send OTP
  app.post('/api/contracts/:contractId/sms-sign/send', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const userId = req.user!.id;
      const language = (req.body?.language || 'ru') as 'ru' | 'uz';

      // Get contract
      const contract = await storage.getContractById(contractId);
      if (!contract) {
        return res.status(404).json({ error: language === 'uz' ? 'Shartnoma topilmadi' : 'Договор не найден' });
      }

      // Verify user is party to contract
      const isCustomer = contract.customerId === userId;
      const isCarrier = contract.carrierId === userId;

      if (!isCustomer && !isCarrier) {
        return res.status(403).json({ error: language === 'uz' ? 'Ruxsat berilmagan' : 'Не авторизован для подписания этого договора' });
      }

      // Check if user is individual (only individuals can use SMS signing)
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: language === 'uz' ? 'Foydalanuvchi topilmadi' : 'Пользователь не найден' });
      }

      if (user.userType !== 'individual') {
        return res.status(400).json({ 
          error: language === 'uz' 
            ? 'Faqat jismoniy shaxslar SMS orqali imzolashi mumkin. Iltimos, ERI dan foydalaning.' 
            : 'Только физические лица могут подписывать через SMS. Пожалуйста, используйте ЭЦП.' 
        });
      }

      // Verify contract has content
      if (!contract.contractContent) {
        return res.status(400).json({ error: language === 'uz' ? 'Shartnoma mazmuni yaratilmagan' : 'Контент договора не создан' });
      }

      // Send OTP
      const smsResult = await sendOtp(user.phone, 'contract_sign', language);
      
      if (!smsResult.success) {
        return res.status(500).json({ error: smsResult.error || (language === 'uz' ? 'SMS yuborib bo\'lmadi' : 'Не удалось отправить SMS') });
      }

      res.json({ 
        success: true, 
        message: language === 'uz' ? 'SMS kod yuborildi' : 'SMS код отправлен',
        contractId 
      });
    } catch (error: any) {
      console.error('SMS sign send error:', error);
      res.status(500).json({ error: error.message || 'Failed to send SMS' });
    }
  });

  // SMS contract signing - Step 2: Verify OTP and sign
  app.post('/api/contracts/:contractId/sms-sign/verify', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const { code } = req.body;
      const userId = req.user!.id;
      const language = (req.body?.language || 'ru') as 'ru' | 'uz';

      if (!code) {
        return res.status(400).json({ error: language === 'uz' ? 'Kod talab qilinadi' : 'Код обязателен' });
      }

      // Get contract
      const contract = await storage.getContractById(contractId);
      if (!contract) {
        return res.status(404).json({ error: language === 'uz' ? 'Shartnoma topilmadi' : 'Договор не найден' });
      }

      // Verify user is party to contract
      const isCustomer = contract.customerId === userId;
      const isCarrier = contract.carrierId === userId;

      if (!isCustomer && !isCarrier) {
        return res.status(403).json({ error: language === 'uz' ? 'Ruxsat berilmagan' : 'Не авторизован' });
      }

      // Get user
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: language === 'uz' ? 'Foydalanuvchi topilmadi' : 'Пользователь не найден' });
      }

      // Verify user is individual
      if (user.userType !== 'individual') {
        return res.status(400).json({ 
          error: language === 'uz' 
            ? 'Faqat jismoniy shaxslar SMS orqali imzolashi mumkin' 
            : 'Только физические лица могут подписывать через SMS' 
        });
      }

      // Verify OTP
      const verifyResult = await verifyOtp(user.phone, code, 'contract_sign');
      
      if (!verifyResult.success) {
        return res.status(400).json({ 
          error: verifyResult.error || (language === 'uz' ? 'Noto\'g\'ri kod' : 'Неверный код') 
        });
      }

      // Create SMS evidence record
      const smsEvidence = {
        phone: user.phone,
        verifiedAt: new Date().toISOString(),
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        contractId,
        documentHash: contract.documentHash,
        userId,
        userName: user.displayName,
        consentText: language === 'uz' 
          ? `Men, ${user.displayName}, ushbu shartnoma shartlariga rozilik bildiraman va uni SMS tasdiqlash orqali imzolayman.`
          : `Я, ${user.displayName}, подтверждаю согласие с условиями данного договора и подписываю его посредством SMS-подтверждения.`
      };

      // Update contract with SMS signature
      const signatureField = isCustomer ? 'customerSignature' : 'carrierSignature';
      const signedAtField = isCustomer ? 'customerSignedAt' : 'carrierSignedAt';
      const signerInfoField = isCustomer ? 'customerSignerInfo' : 'carrierSignerInfo';
      const signatureMethodField = isCustomer ? 'customerSignatureMethod' : 'carrierSignatureMethod';
      const smsEvidenceField = isCustomer ? 'customerSmsEvidence' : 'carrierSmsEvidence';

      const updateData: Record<string, any> = {
        [signatureField]: `SMS_SIGNED_${userId}_${Date.now()}`,
        [signedAtField]: new Date(),
        [signerInfoField]: JSON.stringify({
          name: user.displayName,
          phone: user.phone,
          signatureMethod: 'sms'
        }),
        [signatureMethodField]: 'sms',
        [smsEvidenceField]: smsEvidence
      };

      // Check if both parties have signed
      const existingSignature = isCustomer ? contract.carrierSignature : contract.customerSignature;
      const existingMethod = isCustomer ? contract.carrierSignatureMethod : contract.customerSignatureMethod;
      
      if (existingSignature && !existingSignature.startsWith('AUTO_SIGNED_')) {
        // Both parties have signatures (E-IMZO or SMS)
        updateData.status = 'fully_signed';
      } else if (isCustomer) {
        updateData.status = 'signed_by_customer';
      } else {
        updateData.status = 'signed_by_carrier';
      }

      await storage.updateContract(contractId, updateData);

      const updatedContract = await storage.getContractById(contractId);
      res.json({ 
        success: true, 
        contract: updatedContract,
        message: language === 'uz' ? 'Shartnoma muvaffaqiyatli imzolandi' : 'Договор успешно подписан'
      });
    } catch (error: any) {
      console.error('SMS sign verify error:', error);
      res.status(500).json({ error: error.message || 'Failed to verify SMS' });
    }
  });

  // Get contract signature status
  app.get('/api/contracts/:contractId/signature-status', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const contract = await storage.getContractById(contractId);
      
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      // Helper to determine if a signature is real (not auto-generated)
      const isRealSignature = (sig: string | null) => sig && !sig.startsWith('AUTO_SIGNED_');

      res.json({
        customerSigned: isRealSignature(contract.customerSignature),
        carrierSigned: isRealSignature(contract.carrierSignature),
        customerSignatureMethod: contract.customerSignatureMethod,
        carrierSignatureMethod: contract.carrierSignatureMethod,
        customerSignedAt: contract.customerSignedAt,
        carrierSignedAt: contract.carrierSignedAt,
        fullySigned: isRealSignature(contract.customerSignature) && isRealSignature(contract.carrierSignature)
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Download contract as DOCX or PDF (with QR code)
  // Use ?format=pdf for PDF format, default is DOCX
  app.get('/api/contracts/:contractId/download/:lang', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const lang = req.params.lang as 'ru' | 'uz';
      const format = (req.query.format as string)?.toLowerCase() || 'docx';
      
      if (lang !== 'ru' && lang !== 'uz') {
        return res.status(400).json({ error: 'Invalid language. Use "ru" or "uz"' });
      }
      
      if (format !== 'docx' && format !== 'pdf') {
        return res.status(400).json({ error: 'Invalid format. Use "docx" or "pdf"' });
      }
      
      const contract = await storage.getContractById(contractId);
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Verify user is party to the contract
      const userId = req.user!.id;
      let hasAccess = false;
      
      if (contract.customerId === userId || contract.carrierId === userId) {
        hasAccess = true;
      } else {
        // Check if user is admin
        const user = await storage.getUserById(userId);
        if (user?.roles?.includes('admin')) {
          hasAccess = true;
        } else {
          // Check if user is a representative for the customer
          const representativeCustomerIdHeader = req.headers['x-representative-customer-id'];
          if (representativeCustomerIdHeader) {
            const principalCustomerId = parseInt(representativeCustomerIdHeader as string);
            if (principalCustomerId === contract.customerId) {
              const representative = await storage.getRepresentativeByCustomerAndUser(principalCustomerId, userId);
              if (representative && representative.isActive) {
                // Verify the contract is for an order created by this representative
                const order = await storage.getOrderById(contract.orderId);
                if (order && order.createdByUserId === userId) {
                  hasAccess = true;
                }
              }
            }
          }
        }
      }
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const order = await storage.getOrderById(contract.orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Получаем принятое предложение для использования цены договора
      const offer = await storage.getAcceptedOfferByOrderId(contract.orderId);
      if (!offer) {
        return res.status(404).json({ error: 'Accepted offer not found' });
      }
      
      const customer = await storage.getUserById(contract.customerId);
      const carrier = await storage.getUserById(contract.carrierId);
      
      if (!customer || !carrier) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const customerProfile = await storage.getProfileByUserId(contract.customerId);
      const carrierProfile = await storage.getProfileByUserId(contract.carrierId);
      
      const contractData = {
        contract,
        order,
        offer,
        customer,
        customerProfile: customerProfile || null,
        carrier,
        carrierProfile: carrierProfile || null,
      };
      
      if (format === 'pdf') {
        // Generate PDF with QR code
        const pdfBuffer = await generateContractPdf(contractData, lang);
        const filename = getContractPdfFilename(contractId, lang);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
      } else {
        // Generate DOCX (default)
        const docxBuffer = await generateContractDocx(contractData, lang);
        const filename = getContractFilename(contractId, lang);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', docxBuffer.length);
        res.send(docxBuffer);
      }
    } catch (error: any) {
      console.error('Contract download error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate contract document' });
    }
  });

  // PUBLIC endpoint - Download contract as DOCX without authentication (for QR code scanning)
  app.get('/api/contracts/public/:contractId/download/:lang', async (req: Request, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      const lang = req.params.lang as 'ru' | 'uz';
      
      if (lang !== 'ru' && lang !== 'uz') {
        return res.status(400).json({ error: 'Invalid language. Use "ru" or "uz"' });
      }
      
      const contract = await storage.getContractById(contractId);
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      const order = await storage.getOrderById(contract.orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      const offer = await storage.getAcceptedOfferByOrderId(contract.orderId);
      if (!offer) {
        return res.status(404).json({ error: 'Accepted offer not found' });
      }
      
      const customer = await storage.getUserById(contract.customerId);
      const carrier = await storage.getUserById(contract.carrierId);
      
      if (!customer || !carrier) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const customerProfile = await storage.getProfileByUserId(contract.customerId);
      const carrierProfile = await storage.getProfileByUserId(contract.carrierId);
      
      const contractData = {
        contract,
        order,
        offer,
        customer,
        customerProfile: customerProfile || null,
        carrier,
        carrierProfile: carrierProfile || null,
      };
      
      // Generate DOCX
      const docxBuffer = await generateContractDocx(contractData, lang);
      const filename = getContractFilename(contractId, lang);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', docxBuffer.length);
      res.send(docxBuffer);
    } catch (error: any) {
      console.error('Public contract download error:', error);
      res.status(500).json({ error: error.message || 'Failed to generate contract document' });
    }
  });

  // ============ PARTNER REWARD STATEMENTS ============
  
  // Admin: Get all partner reward statements
  app.get('/api/admin/reward-statements', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const statements = await storage.getAllPartnerRewardStatements();
      res.json(statements);
    } catch (error) {
      console.error('Get reward statements error:', error);
      res.status(500).json({ error: 'Failed to get reward statements' });
    }
  });

  // Admin: Get single partner reward statement with items
  app.get('/api/admin/reward-statements/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const statement = await storage.getPartnerRewardStatementById(id);
      if (!statement) {
        return res.status(404).json({ error: 'Statement not found' });
      }
      const items = await storage.getPartnerRewardStatementItems(id);
      res.json({ statement, items });
    } catch (error) {
      console.error('Get reward statement error:', error);
      res.status(500).json({ error: 'Failed to get reward statement' });
    }
  });

  // Admin: Create partner reward statement
  app.post('/api/admin/reward-statements', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { periodMonth } = req.body;
      if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) {
        return res.status(400).json({ error: 'Invalid period format. Use YYYY-MM' });
      }
      
      const statement = await storage.createPartnerRewardStatement({
        periodMonth,
        createdByAdminId: req.user!.id,
      });
      
      // Generate items for all users with partner_reward balance
      const itemCount = await storage.generatePartnerRewardStatementItems(statement.id);
      
      // Get updated statement
      const updatedStatement = await storage.getPartnerRewardStatementById(statement.id);
      
      res.json({ 
        statement: updatedStatement, 
        itemCount,
        message: `Created statement with ${itemCount} users` 
      });
    } catch (error) {
      console.error('Create reward statement error:', error);
      res.status(500).json({ error: 'Failed to create reward statement' });
    }
  });

  // Admin: Update statement item (mark as paid)
  app.patch('/api/admin/reward-statements/:statementId/items/:itemId', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const itemId = parseInt(req.params.itemId);
      const statementId = parseInt(req.params.statementId);
      const { paidAmount, status, adminNote } = req.body;
      
      // Get current item to check previous paid amount
      const currentItems = await storage.getPartnerRewardStatementItems(statementId);
      const currentItem = currentItems.find(i => i.id === itemId);
      if (!currentItem) {
        return res.status(404).json({ error: 'Item not found' });
      }
      
      const previousPaid = parseFloat(currentItem.paidAmount || '0');
      const newPaidAmount = paidAmount !== undefined ? parseFloat(paidAmount) : previousPaid;
      const paidNow = new Date();
      
      const updates: any = {};
      if (paidAmount !== undefined) updates.paidAmount = String(paidAmount);
      if (status) updates.status = status;
      if (adminNote !== undefined) updates.adminNote = adminNote;
      if (status === 'paid' || (paidAmount && parseFloat(paidAmount) > 0)) {
        updates.paidAt = paidNow;
      }
      
      // Determine final status: use provided status or keep current
      const finalStatus = status || currentItem.status;
      
      // If marking as paid or already paid with increased amount - deduct from partner_reward account
      if (finalStatus === 'paid' && newPaidAmount > previousPaid) {
        const deductAmount = newPaidAmount - previousPaid;
        
        // Get partner_reward deposit for this user
        const deposit = await storage.getDepositByUserIdAndType(currentItem.userId, 'partner_reward');
        if (deposit) {
          const currentBalance = parseFloat(deposit.balance || '0');
          
          // Check sufficient balance
          if (currentBalance < deductAmount) {
            return res.status(400).json({ 
              error: `Insufficient partner_reward balance. Available: ${currentBalance}, Required: ${deductAmount}` 
            });
          }
          
          const newBalance = currentBalance - deductAmount;
          
          // Update partner_reward balance
          await storage.updateDepositBalanceByType(currentItem.userId, 'partner_reward', newBalance);
          
          // Create transaction record (amount in sums, not tiyin)
          const statement = await storage.getPartnerRewardStatementById(statementId);
          await storage.createDepositTransaction({
            depositId: deposit.id,
            type: 'withdrawal_completed',
            amount: deductAmount,
            reference: `Выплата вознаграждения за ${statement?.periodMonth || 'N/A'} (ведомость #${statementId})`,
            status: 'completed',
          });
        }
      }
      
      const item = await storage.updatePartnerRewardStatementItem(itemId, updates);
      
      // Recalculate statement totals
      const allItems = await storage.getPartnerRewardStatementItems(statementId);
      const totalPaid = allItems.reduce((sum, i) => sum + parseFloat(i.paidAmount || '0'), 0);
      await storage.updatePartnerRewardStatement(statementId, { totalPaid: String(totalPaid) });
      
      res.json(item);
    } catch (error) {
      console.error('Update reward statement item error:', error);
      res.status(500).json({ error: 'Failed to update item' });
    }
  });

  // Admin: Finalize statement (set status to finalized)
  app.post('/api/admin/reward-statements/:id/finalize', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const statement = await storage.getPartnerRewardStatementById(id);
      if (!statement) {
        return res.status(404).json({ error: 'Statement not found' });
      }
      if (statement.status !== 'draft') {
        return res.status(400).json({ error: 'Only draft statements can be finalized' });
      }
      
      const updated = await storage.updatePartnerRewardStatement(id, { 
        status: 'finalized',
        finalizedAt: new Date()
      });
      res.json(updated);
    } catch (error) {
      console.error('Finalize statement error:', error);
      res.status(500).json({ error: 'Failed to finalize statement' });
    }
  });

  // Admin: Mark statement as paid
  app.post('/api/admin/reward-statements/:id/mark-paid', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const statement = await storage.getPartnerRewardStatementById(id);
      if (!statement) {
        return res.status(404).json({ error: 'Statement not found' });
      }
      if (statement.status !== 'finalized') {
        return res.status(400).json({ error: 'Only finalized statements can be marked as paid' });
      }
      
      const updated = await storage.updatePartnerRewardStatement(id, { status: 'paid' });
      res.json(updated);
    } catch (error) {
      console.error('Mark statement paid error:', error);
      res.status(500).json({ error: 'Failed to mark statement as paid' });
    }
  });

  // Admin: Delete statement (only drafts)
  app.delete('/api/admin/reward-statements/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const statement = await storage.getPartnerRewardStatementById(id);
      if (!statement) {
        return res.status(404).json({ error: 'Statement not found' });
      }
      if (statement.status !== 'draft') {
        return res.status(400).json({ error: 'Only draft statements can be deleted' });
      }
      
      await storage.deletePartnerRewardStatement(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete statement error:', error);
      res.status(500).json({ error: 'Failed to delete statement' });
    }
  });

  // Admin: Export statement to Excel
  app.get('/api/admin/reward-statements/:id/export', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const lang = (req.query.lang as string) === 'uz' ? 'uz' : 'ru';
      
      const statement = await storage.getPartnerRewardStatementById(id);
      if (!statement) {
        return res.status(404).json({ error: 'Statement not found' });
      }
      
      const items = await storage.getPartnerRewardStatementItems(id);
      
      const XLSX = await import('xlsx');
      
      const headers = lang === 'uz' ? {
        displayName: 'Foydalanuvchi',
        userType: 'Turi',
        inn: 'INN',
        pinfl: 'PINFL',
        bankAccount: 'Hisob raqami',
        bankName: 'Bank',
        bankCode: 'MFO',
        openingBalance: "Boshlang'ich qoldiq",
        accruedAmount: 'Hisoblangan',
        previousPaid: 'Oldin to\'langan',
        closingBalance: 'To\'lanishi kerak',
        paidAmount: 'To\'langan',
        status: 'Holat'
      } : {
        displayName: 'Пользователь',
        userType: 'Тип',
        inn: 'ИНН',
        pinfl: 'ПИНФЛ',
        bankAccount: 'Расчётный счёт',
        bankName: 'Банк',
        bankCode: 'МФО',
        openingBalance: 'Сальдо на начало',
        accruedAmount: 'Начислено',
        previousPaid: 'Ранее оплачено',
        closingBalance: 'К выплате',
        paidAmount: 'Оплачено',
        status: 'Статус'
      };
      
      const userTypeLabels = lang === 'uz' 
        ? { legal: 'Yur. shaxs', ip: 'YaTT', individual: 'Jis. shaxs' }
        : { legal: 'Юр. лицо', ip: 'ИП', individual: 'Физ. лицо' };
      
      const statusLabels = lang === 'uz'
        ? { pending: 'Kutilmoqda', paid: 'To\'langan', partial: 'Qisman' }
        : { pending: 'Ожидает', paid: 'Оплачено', partial: 'Частично' };
      
      const rows = items.map((item: any) => ({
        [headers.displayName]: item.displayName,
        [headers.userType]: userTypeLabels[item.userType as keyof typeof userTypeLabels] || item.userType,
        [headers.inn]: item.inn || '',
        [headers.pinfl]: item.pinfl || '',
        [headers.bankAccount]: item.bankAccount || '',
        [headers.bankName]: item.bankName || '',
        [headers.bankCode]: item.bankCode || '',
        [headers.openingBalance]: parseFloat(item.openingBalance || '0'),
        [headers.accruedAmount]: parseFloat(item.accruedAmount || '0'),
        [headers.previousPaid]: parseFloat(item.previousPaid || '0'),
        [headers.closingBalance]: parseFloat(item.closingBalance || '0'),
        [headers.paidAmount]: parseFloat(item.paidAmount || '0'),
        [headers.status]: statusLabels[item.status as keyof typeof statusLabels] || item.status
      }));
      
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      
      const sheetName = lang === 'uz' ? 'Vedomost' : 'Ведомость';
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      const filename = lang === 'uz'
        ? `vedomost_${statement.periodMonth}.xlsx`
        : `vedomost_${statement.periodMonth}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      console.error('Export statement error:', error);
      res.status(500).json({ error: 'Failed to export statement' });
    }
  });

  // Telegram Channels Management (Admin only)
  const VALID_CHANNEL_TYPES = ['orders', 'announcements', 'ai_source', 'broadcast', 'promo'] as const;
  type ValidChannelType = typeof VALID_CHANNEL_TYPES[number];
  const isValidChannelType = (v: any): v is ValidChannelType => VALID_CHANNEL_TYPES.includes(v);

  app.get('/api/admin/push/token-count', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { db } = await import('./db');
      const schema = await import('@shared/schema');
      const { count } = await import('drizzle-orm');
      const rows = await db.select({ count: count() }).from(schema.pushTokens);
      res.json({ count: rows[0]?.count ?? 0 });
    } catch (error: any) {
      console.error('Token count error:', error);
      res.status(500).json({ error: 'Failed to count tokens' });
    }
  });

  // Push notification rate limit settings
  app.get('/api/admin/push-settings', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const maxPerHour = await getPushMaxPerHour();
      res.json({ maxPerHour });
    } catch (error) {
      console.error('Get push settings error:', error);
      res.status(500).json({ error: 'Failed to fetch push settings' });
    }
  });

  app.patch('/api/admin/push-settings', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { maxPerHour } = req.body;
      const parsed = parseInt(maxPerHour, 10);
      if (isNaN(parsed) || parsed < 0 || parsed > 10000) {
        return res.status(400).json({ error: 'maxPerHour must be between 0 and 10000 (0 = unlimited)' });
      }
      await setPushMaxPerHour(parsed);
      res.json({ maxPerHour: parsed });
    } catch (error) {
      console.error('Update push settings error:', error);
      res.status(500).json({ error: 'Failed to update push settings' });
    }
  });

  // Bot announcement channel posting setting
  app.get('/api/admin/bot-channel-settings', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const postToChannels = await getBotPostToChannels();
      res.json({ postToChannels });
    } catch (error) {
      console.error('Get bot channel settings error:', error);
      res.status(500).json({ error: 'Failed to fetch bot channel settings' });
    }
  });

  app.patch('/api/admin/bot-channel-settings', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { postToChannels } = req.body;
      if (typeof postToChannels !== 'boolean') {
        return res.status(400).json({ error: 'postToChannels must be a boolean' });
      }
      await setBotPostToChannels(postToChannels);
      res.json({ postToChannels });
    } catch (error) {
      console.error('Update bot channel settings error:', error);
      res.status(500).json({ error: 'Failed to update bot channel settings' });
    }
  });

  app.post('/api/admin/push/test-send', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { sendTestPush } = await import('./services/push-notification-service');
      const title = (req.body?.title as string) || 'Тест push-уведомлений';
      const body = (req.body?.body as string) || 'Если вы видите это — уведомления работают!';
      const result = await sendTestPush(title, body);
      res.json(result);
    } catch (error: any) {
      console.error('Test push error:', error);
      res.status(500).json({ error: 'Failed to send test push', details: error?.message });
    }
  });

  app.post('/api/admin/push/broadcast', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { title, body } = req.body;
      if (!title || !body) {
        return res.status(400).json({ error: 'title and body are required' });
      }
      const { sendTestPush } = await import('./services/push-notification-service');
      const result = await sendTestPush(String(title), String(body));
      // Save to broadcast history
      const { db } = await import('./db');
      const schema = await import('@shared/schema');
      await db.insert(schema.pushBroadcasts).values({
        title: String(title),
        body: String(body),
        totalTokens: result.totalTokens,
        sentCount: result.sent,
        errorCount: result.errors.length,
        staleRemoved: result.staleRemoved,
      });
      res.json(result);
    } catch (error: any) {
      console.error('Broadcast push error:', error);
      res.status(500).json({ error: 'Failed to send broadcast', details: error?.message });
    }
  });

  app.get('/api/admin/push/broadcasts', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { db } = await import('./db');
      const schema = await import('@shared/schema');
      const { desc } = await import('drizzle-orm');
      const broadcasts = await db
        .select()
        .from(schema.pushBroadcasts)
        .orderBy(desc(schema.pushBroadcasts.createdAt))
        .limit(50);
      res.json(broadcasts);
    } catch (error: any) {
      console.error('Get broadcasts error:', error);
      res.status(500).json({ error: 'Failed to fetch broadcasts' });
    }
  });

  app.get('/api/admin/telegram-channels', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const t = req.query.type as string | undefined;
      const channelType = isValidChannelType(t) ? t : undefined;
      const channels = await storage.getAllTelegramChannels(channelType);
      res.json(channels);
    } catch (error) {
      console.error('Get telegram channels error:', error);
      res.status(500).json({ error: 'Failed to fetch channels' });
    }
  });

  app.post('/api/admin/telegram-channels', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { chatId, name, channelType, intervalMinutes, activeHoursFrom, activeHoursTo, timezone } = req.body;
      
      if (!chatId || !name) {
        return res.status(400).json({ error: 'chatId and name are required' });
      }

      const validChannelType: ValidChannelType = isValidChannelType(channelType) ? channelType : 'orders';

      // Check if channel already exists for this type
      const existing = await storage.getTelegramChannelByChatId(chatId, validChannelType);
      if (existing) {
        return res.status(400).json({ error: 'Channel with this ID already exists for this type' });
      }

      const channel = await storage.createTelegramChannel({
        chatId,
        name,
        channelType: validChannelType,
        createdBy: req.user!.id,
        intervalMinutes: typeof intervalMinutes === 'number' && intervalMinutes > 0 ? intervalMinutes : undefined,
        activeHoursFrom: typeof activeHoursFrom === 'number' && activeHoursFrom >= 0 && activeHoursFrom <= 24 ? activeHoursFrom : undefined,
        activeHoursTo: typeof activeHoursTo === 'number' && activeHoursTo >= 0 && activeHoursTo <= 24 ? activeHoursTo : undefined,
        timezone: typeof timezone === 'string' && timezone.length > 0 && timezone.length < 64 ? timezone : undefined,
      });

      res.status(201).json(channel);
    } catch (error) {
      console.error('Create telegram channel error:', error);
      res.status(500).json({ error: 'Failed to create channel' });
    }
  });

  app.patch('/api/admin/telegram-channels/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const channelId = parseInt(req.params.id);
      const { name, isActive, intervalMinutes, activeHoursFrom, activeHoursTo, timezone, blockedUserIds } = req.body;

      const updates: { name?: string; isActive?: boolean; intervalMinutes?: number; activeHoursFrom?: number; activeHoursTo?: number; timezone?: string; blockedUserIds?: string[] } = {};
      if (typeof name === 'string') updates.name = name;
      if (typeof isActive === 'boolean') updates.isActive = isActive;
      if (typeof intervalMinutes === 'number' && intervalMinutes > 0) updates.intervalMinutes = intervalMinutes;
      if (typeof activeHoursFrom === 'number' && activeHoursFrom >= 0 && activeHoursFrom <= 24) updates.activeHoursFrom = activeHoursFrom;
      if (typeof activeHoursTo === 'number' && activeHoursTo >= 0 && activeHoursTo <= 24) updates.activeHoursTo = activeHoursTo;
      if (typeof timezone === 'string' && timezone.length > 0 && timezone.length < 64) updates.timezone = timezone;
      if (Array.isArray(blockedUserIds)) updates.blockedUserIds = blockedUserIds.map(String).filter(Boolean);

      const channel = await storage.updateTelegramChannel(channelId, updates);
      
      if (!channel) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      res.json(channel);
    } catch (error) {
      console.error('Update telegram channel error:', error);
      res.status(500).json({ error: 'Failed to update channel' });
    }
  });

  app.delete('/api/admin/telegram-channels/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const channelId = parseInt(req.params.id);
      
      const deleted = await storage.deleteTelegramChannel(channelId);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Channel not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Delete telegram channel error:', error);
      res.status(500).json({ error: 'Failed to delete channel' });
    }
  });

  // ──────── Telegram skipped/failed AI source messages (Admin) ────────
  app.get('/api/admin/telegram-skipped-messages', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) || '100') || 100, 500);
      const items = await storage.listTelegramSkippedMessages(limit);
      res.json(items);
    } catch (error) {
      console.error('Get skipped telegram messages error:', error);
      res.status(500).json({ error: 'Failed to fetch skipped messages' });
    }
  });

  app.get('/api/admin/telegram-skipped-messages/count', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response) => {
    try {
      const count = await storage.countTelegramSkippedMessages();
      res.json({ count });
    } catch (error) {
      console.error('Count skipped telegram messages error:', error);
      res.status(500).json({ error: 'Failed to count skipped messages' });
    }
  });

  app.delete('/api/admin/telegram-skipped-messages/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
      const ok = await storage.deleteTelegramSkippedMessage(id);
      if (!ok) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (error) {
      console.error('Delete skipped telegram message error:', error);
      res.status(500).json({ error: 'Failed to delete skipped message' });
    }
  });

  app.post('/api/admin/telegram-skipped-messages/:id/retry', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
      const { retrySkippedTelegramMessage } = await import('./services/telegram-source-listener');
      let textOverride: string | undefined;
      if (req.body && req.body.text !== undefined && req.body.text !== null) {
        if (typeof req.body.text !== 'string') {
          return res.status(400).json({ error: 'text must be a string' });
        }
        const trimmed = req.body.text.trim();
        if (trimmed.length < 10) {
          return res.status(400).json({ error: 'text too short (min 10 chars)' });
        }
        if (req.body.text.length > 4000) {
          return res.status(400).json({ error: 'text too long (max 4000 chars)' });
        }
        textOverride = req.body.text;
      }
      const result = await retrySkippedTelegramMessage(id, textOverride);
      if (result.ok) return res.json({ success: true });
      if (result.error === 'not_found') return res.status(404).json({ error: 'Not found' });
      return res.status(409).json({ success: false, reason: result.reason, error: result.error });
    } catch (error) {
      console.error('Retry skipped telegram message error:', error);
      res.status(500).json({ error: 'Failed to retry skipped message' });
    }
  });

  // ──────── Promo Channel Preview / Test Send (Admin) ────────
  app.get('/api/admin/telegram-channels/:id/next-promo', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const promo = await peekNextPromoForChannel(id);
      if (!promo) return res.json({ promo: null });
      res.json({ promo: { id: promo.id, textRu: promo.textRu, textUz: promo.textUz } });
    } catch (error: any) {
      console.error('Peek next promo error:', error);
      res.status(500).json({ error: error?.message || 'Failed to peek next promo' });
    }
  });

  app.post('/api/admin/telegram-channels/:id/send-test-promo', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const promo = await sendTestPromoToChannel(id);
      res.json({ success: true, promo: { id: promo.id, textRu: promo.textRu, textUz: promo.textUz } });
    } catch (error: any) {
      console.error('Send test promo error:', error);
      res.status(400).json({ error: error?.message || 'Failed to send test promo' });
    }
  });

  // ──────── Telegram Promo Messages (Admin) ────────
  app.get('/api/admin/telegram-promo-messages', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response) => {
    try {
      const items = await storage.getAllTelegramPromoMessages();
      res.json(items);
    } catch (error) {
      console.error('Get promo messages error:', error);
      res.status(500).json({ error: 'Failed to fetch promo messages' });
    }
  });

  app.post('/api/admin/telegram-promo-messages', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { textRu, textUz, isActive, displayOrder } = req.body;
      if (!textRu || !textUz) {
        return res.status(400).json({ error: 'textRu and textUz are required' });
      }
      const item = await storage.createTelegramPromoMessage({
        textRu: String(textRu),
        textUz: String(textUz),
        isActive: typeof isActive === 'boolean' ? isActive : true,
        displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
        createdBy: req.user!.id,
      });
      res.status(201).json(item);
    } catch (error) {
      console.error('Create promo message error:', error);
      res.status(500).json({ error: 'Failed to create promo message' });
    }
  });

  app.patch('/api/admin/telegram-promo-messages/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { textRu, textUz, isActive, displayOrder } = req.body;
      const updates: { textRu?: string; textUz?: string; isActive?: boolean; displayOrder?: number } = {};
      if (typeof textRu === 'string') updates.textRu = textRu;
      if (typeof textUz === 'string') updates.textUz = textUz;
      if (typeof isActive === 'boolean') updates.isActive = isActive;
      if (typeof displayOrder === 'number') updates.displayOrder = displayOrder;
      const item = await storage.updateTelegramPromoMessage(id, updates);
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (error) {
      console.error('Update promo message error:', error);
      res.status(500).json({ error: 'Failed to update promo message' });
    }
  });

  app.delete('/api/admin/telegram-promo-messages/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const ok = await storage.deleteTelegramPromoMessage(id);
      if (!ok) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true });
    } catch (error) {
      console.error('Delete promo message error:', error);
      res.status(500).json({ error: 'Failed to delete promo message' });
    }
  });

  // ==================== NOTIFICATIONS ====================
  
  // Get user notifications
  app.get('/api/notifications', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = await storage.getNotificationsByUserId(req.user!.id, limit);
      const unreadCount = await storage.getUnreadNotificationsCount(req.user!.id);
      res.json({ notifications, unreadCount });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  // Get unread notifications count
  app.get('/api/notifications/unread-count', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const count = await storage.getUnreadNotificationsCount(req.user!.id);
      res.json({ count });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  });

  // Mark notification as read
  app.put('/api/notifications/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const notificationId = parseInt(req.params.id);
      const notification = await storage.markNotificationAsRead(notificationId, req.user!.id);
      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      res.json(notification);
    } catch (error) {
      console.error('Mark notification read error:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // Mark all notifications as read
  app.put('/api/notifications/read-all', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const count = await storage.markAllNotificationsAsRead(req.user!.id);
      res.json({ markedCount: count });
    } catch (error) {
      console.error('Mark all notifications read error:', error);
      res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
  });

  // ==================== NOTIFICATION SETTINGS ====================

  // Available notification types
  const NOTIFICATION_TYPES = [
    { type: 'new_offer', labelRu: 'Новое предложение по заказу', labelUz: 'Buyurtma bo\'yicha yangi taklif' }
  ];

  // Get user notification settings
  app.get('/api/notification-settings', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const settings = await storage.getUserNotificationSettings(req.user!.id);
      
      // Return settings with all notification types (default: enabled)
      const result = NOTIFICATION_TYPES.map(nt => {
        const setting = settings.find(s => s.notificationType === nt.type);
        return {
          notificationType: nt.type,
          labelRu: nt.labelRu,
          labelUz: nt.labelUz,
          smsEnabled: setting?.smsEnabled ?? true,
          inAppEnabled: setting?.inAppEnabled ?? true
        };
      });
      
      res.json(result);
    } catch (error) {
      console.error('Get notification settings error:', error);
      res.status(500).json({ error: 'Failed to fetch notification settings' });
    }
  });

  // Update user notification setting
  app.put('/api/notification-settings/:type', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { type } = req.params;
      const { smsEnabled, inAppEnabled } = req.body;
      
      // Validate notification type
      if (!NOTIFICATION_TYPES.find(nt => nt.type === type)) {
        return res.status(400).json({ error: 'Invalid notification type' });
      }
      
      const setting = await storage.upsertUserNotificationSetting(
        req.user!.id,
        type,
        smsEnabled ?? true,
        inAppEnabled ?? true
      );
      
      res.json(setting);
    } catch (error) {
      console.error('Update notification setting error:', error);
      res.status(500).json({ error: 'Failed to update notification setting' });
    }
  });

  // ==================== ANNOUNCEMENTS (for individual customers) ====================

  // Validation schema for announcements
  const announcementSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    originRegions: z.array(z.string()).min(1, 'At least one origin region is required'),
    originDistrict: z.array(z.string()).default([]),
    destinationRegions: z.array(z.string()).min(1, 'At least one destination region is required'),
    destinationDistrict: z.array(z.string()).default([]),
    originPoints: z.array(z.object({
      region: z.string(),
      districts: z.array(z.string())
    })).optional(),
    destinationPoints: z.array(z.object({
      region: z.string(),
      districts: z.array(z.string())
    })).optional(),
    transportType: z.enum(['labo', 'bongo', 'furgon', 'isuzu5', 'isuzu10', 'gruzovik', 
      'fura_tent', 'fura_ref', 'paravoz', 'shalanda', 'traller', 'tonar', 
      'benzovoz', 'konteynerovoz', 'other']),
    vehicleCount: z.coerce.number().int().min(1, 'At least 1 vehicle required').default(1),
    weightTons: z.union([z.coerce.number().min(0), z.null()]).optional().nullable().default(null),
    loadDate: z.string().min(1, 'Load date is required'),
    loadingTime: z.string().min(1, 'Loading time is required'),
    price: z.union([z.coerce.number().min(0), z.null()]).optional().default(null),
    paymentTypes: z.array(z.enum(['cash', 'card', 'transfer'])).min(1, 'At least one payment type required'),
    contactPhone: z.string().min(1, 'Contact phone is required'),
    notes: z.string().optional(),
    isDangerous: z.boolean().optional().default(false),
    isNonstandard: z.boolean().optional().default(false),
    isPartialLoad: z.boolean().optional().default(false),
    photoUrls: z.array(z.string().url().or(z.string().startsWith('/'))).max(5).optional().default([]),
  });

  // Create announcement (only for individual customers)
  app.post('/api/announcements', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      console.log('[ANNOUNCEMENT] Create request body:', JSON.stringify(req.body, null, 2));
      
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        console.log('[ANNOUNCEMENT] User not found:', req.user!.id);
        return res.status(404).json({ error: 'User not found' });
      }
      
      console.log('[ANNOUNCEMENT] User type:', user.userType, 'Roles:', user.roles);
      
      // Only individual customers can create announcements
      if (user.userType !== 'individual') {
        console.log('[ANNOUNCEMENT] Rejected: not individual user type');
        return res.status(403).json({ error: 'Only individual customers can create announcements' });
      }
      
      if (!user.roles.includes('customer')) {
        console.log('[ANNOUNCEMENT] Rejected: no customer role');
        return res.status(403).json({ error: 'Customer role required' });
      }
      
      const validationResult = announcementSchema.safeParse(req.body);
      if (!validationResult.success) {
        console.log('[ANNOUNCEMENT] Validation failed:', validationResult.error.errors);
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: validationResult.error.errors 
        });
      }
      
      const data = validationResult.data;
      const announcement = await storage.createAnnouncement({
        customerId: req.user!.id,
        title: data.title,
        originRegions: data.originRegions,
        originDistrict: data.originDistrict,
        destinationRegions: data.destinationRegions,
        destinationDistrict: data.destinationDistrict,
        originPoints: data.originPoints,
        destinationPoints: data.destinationPoints,
        transportType: data.transportType,
        vehicleCount: data.vehicleCount,
        weightTons: data.weightTons != null && Number(data.weightTons) > 0 ? String(data.weightTons) : null,
        loadDate: data.loadDate,
        loadingTime: data.loadingTime,
        price: data.price !== null && data.price !== undefined ? String(data.price) : null,
        paymentTypes: data.paymentTypes,
        contactPhone: data.contactPhone,
        notes: data.notes,
        isDangerous: data.isDangerous,
        isNonstandard: data.isNonstandard,
        isPartialLoad: data.isPartialLoad,
        photoUrls: data.photoUrls ?? [],
      });
      
      // Send Telegram notification for new announcement
      try {
        const customer = await storage.getUserById(req.user!.id);
        const telegramResult = await sendAnnouncementNotification(announcement, customer || undefined);
        console.log('[ANNOUNCEMENT] Telegram notification sent for announcement', announcement.id);
        
        // Save Telegram message ID for future updates
        if (telegramResult.success && telegramResult.messageId && telegramResult.chatId) {
          await storage.updateAnnouncement(announcement.id, {
            telegramMessageId: String(telegramResult.messageId),
            telegramChatId: telegramResult.chatId
          });
        }
      } catch (telegramError: any) {
        console.error('[ANNOUNCEMENT] Failed to send Telegram notification:', telegramError.message);
      }

      // Send push notification to subscribed devices (fire-and-forget)
      notifyNewAnnouncement(announcement).catch((pushErr: any) => {
        console.error('[ANNOUNCEMENT] Failed to send push notification:', pushErr?.message || pushErr);
      });
      
      res.status(201).json(announcement);
    } catch (error: any) {
      console.error('Create announcement error:', error);
      console.error('Error stack:', error?.stack);
      console.error('Error message:', error?.message);
      res.status(500).json({ 
        error: 'Failed to create announcement',
        details: error?.message || 'Unknown error'
      });
    }
  });

  // Get my announcements (authenticated customer)
  app.get('/api/announcements/my', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const statusFilter = req.query.status as string | undefined;
      // Show deleted only when explicitly requesting 'all' status
      const includeDeleted = statusFilter === 'all';
      const announcements = await storage.getAnnouncementsByCustomerId(req.user!.id, statusFilter, includeDeleted);
      res.json(announcements);
    } catch (error) {
      console.error('Get my announcements error:', error);
      res.status(500).json({ error: 'Failed to fetch announcements' });
    }
  });

  // Get public announcements (anyone can view)
  app.get('/api/announcements/public', async (req: Request, res: Response) => {
    try {
      const rawOrigin = req.query.originRegion;
      const rawDest = req.query.destinationRegion;
      const rawTransport = req.query.transportType;
      const excludeBot = req.query.excludeBot === 'true';

      const originRegions = rawOrigin
        ? (Array.isArray(rawOrigin) ? (rawOrigin as string[]) : [rawOrigin as string])
        : undefined;
      const destinationRegions = rawDest
        ? (Array.isArray(rawDest) ? (rawDest as string[]) : [rawDest as string])
        : undefined;
      const transportTypes = rawTransport
        ? (Array.isArray(rawTransport) ? (rawTransport as string[]) : [rawTransport as string])
        : undefined;

      const announcements = await storage.getPublicAnnouncements({
        originRegions,
        destinationRegions,
        transportTypes,
        excludeBot: excludeBot || undefined,
      });
      
      // Enrich with customer info
      const enrichedAnnouncements = await Promise.all(
        announcements.map(async (announcement) => {
          const customer = await storage.getUserById(announcement.customerId);
          return {
            ...announcement,
            customerName: announcement.createdByBot ? 'Telegram' : (customer?.displayName || 'Unknown'),
            customerRating: announcement.createdByBot ? null : (customer?.customerRating ? Number(customer.customerRating) : null),
          };
        })
      );
      
      res.json(enrichedAnnouncements);
    } catch (error) {
      console.error('Get public announcements error:', error);
      res.status(500).json({ error: 'Failed to fetch public announcements' });
    }
  });

  // Get single announcement by ID
  app.get('/api/announcements/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid announcement ID' });
      }
      
      const announcement = await storage.getAnnouncementById(id);
      if (!announcement) {
        return res.status(404).json({ error: 'Announcement not found' });
      }
      
      // Enrich with customer info
      const customer = await storage.getUserById(announcement.customerId);
      
      res.json({
        ...announcement,
        customerName: announcement.createdByBot ? 'Telegram' : (customer?.displayName || 'Unknown'),
        customerPhone: announcement.contactPhone,
        customerRating: announcement.createdByBot ? null : (customer?.customerRating ? Number(customer.customerRating) : null),
      });
    } catch (error) {
      console.error('Get announcement error:', error);
      res.status(500).json({ error: 'Failed to fetch announcement' });
    }
  });

  // Update announcement (owner only)
  app.put('/api/announcements/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid announcement ID' });
      }
      
      const announcement = await storage.getAnnouncementById(id);
      if (!announcement) {
        return res.status(404).json({ error: 'Announcement not found' });
      }
      
      if (announcement.customerId !== req.user!.id) {
        return res.status(403).json({ error: 'Not authorized to edit this announcement' });
      }
      
      // Allow partial updates
      const updateSchema = announcementSchema.partial();
      const validationResult = updateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: validationResult.error.errors 
        });
      }
      
      // Convert numeric fields to strings for DB
      const updateData: any = { ...validationResult.data };
      if (updateData.weightTons !== undefined) {
        updateData.weightTons = String(updateData.weightTons);
      }
      if (updateData.price !== undefined) {
        updateData.price = updateData.price !== null ? String(updateData.price) : null;
      }
      
      const updated = await storage.updateAnnouncement(id, updateData);
      res.json(updated);
    } catch (error) {
      console.error('Update announcement error:', error);
      res.status(500).json({ error: 'Failed to update announcement' });
    }
  });

  // Update announcement status
  app.put('/api/announcements/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!['new', 'active', 'closed', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      
      const announcement = await storage.getAnnouncementById(id);
      if (!announcement) {
        return res.status(404).json({ error: 'Announcement not found' });
      }
      
      if (announcement.customerId !== req.user!.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const updated = await storage.updateAnnouncement(id, { status });
      
      // Update Telegram message when status changes to closed or cancelled
      if (updated && (status === 'closed' || status === 'cancelled')) {
        try {
          await updateAnnouncementNotification(updated);
          console.log('[ANNOUNCEMENT] Telegram notification updated for announcement', id);
        } catch (telegramError: any) {
          console.error('[ANNOUNCEMENT] Failed to update Telegram notification:', telegramError.message);
        }
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Update announcement status error:', error);
      res.status(500).json({ error: 'Failed to update status' });
    }
  });

  // Delete announcement (soft delete)
  app.delete('/api/announcements/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid announcement ID' });
      }
      
      // Get announcement before deletion to update Telegram
      const announcement = await storage.getAnnouncementById(id);
      
      const success = await storage.softDeleteAnnouncement(id, req.user!.id);
      if (!success) {
        return res.status(404).json({ error: 'Announcement not found or not authorized' });
      }
      
      // Update Telegram message after deletion
      if (announcement && announcement.telegramMessageId) {
        try {
          // Use the original announcement but update status to cancelled
          const deletedAnnouncement = {
            ...announcement,
            status: 'cancelled' as const,
            deletedAt: new Date()
          };
          await updateAnnouncementNotification(deletedAnnouncement);
          console.log('[ANNOUNCEMENT] Telegram notification updated for deleted announcement', id);
        } catch (telegramError: any) {
          console.error('[ANNOUNCEMENT] Failed to update Telegram notification:', telegramError.message);
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Delete announcement error:', error);
      res.status(500).json({ error: 'Failed to delete announcement' });
    }
  });

  // ==================== ANNOUNCEMENT TEMPLATES ====================

  // Get my announcement templates
  app.get('/api/announcement-templates', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const templates = await storage.getAnnouncementTemplatesByCustomerId(req.user!.id);
      res.json(templates);
    } catch (error) {
      console.error('Get announcement templates error:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  // Create announcement template
  app.post('/api/announcement-templates', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const user = await storage.getUserById(req.user!.id);
      if (!user || user.userType !== 'individual') {
        return res.status(403).json({ error: 'Only individual customers can create templates' });
      }
      
      const { name, ...templateData } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Template name is required' });
      }
      
      const template = await storage.createAnnouncementTemplate({
        customerId: req.user!.id,
        name,
        ...templateData
      });
      
      res.status(201).json(template);
    } catch (error) {
      console.error('Create announcement template error:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  // Update announcement template
  app.put('/api/announcement-templates/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const template = await storage.getAnnouncementTemplateById(id);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      if (template.customerId !== req.user!.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      
      const updated = await storage.updateAnnouncementTemplate(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Update announcement template error:', error);
      res.status(500).json({ error: 'Failed to update template' });
    }
  });

  // Delete announcement template
  app.delete('/api/announcement-templates/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteAnnouncementTemplate(id, req.user!.id);
      
      if (!success) {
        return res.status(404).json({ error: 'Template not found or not authorized' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Delete announcement template error:', error);
      res.status(500).json({ error: 'Failed to delete template' });
    }
  });

  // ============= REPRESENTATIVES ROUTES =============
  // For legal entities and IPs to delegate work to individuals
  
  // Get list of representatives for current customer
  app.get('/api/representatives', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      
      // Get current user's data to check userType
      const currentUser = await storage.getUserById(userId);
      if (!currentUser) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      // Only legal entities and IPs can have representatives
      if (currentUser.userType === 'individual') {
        return res.status(403).json({ error: 'Только юридические лица и ИП могут иметь представителей' });
      }
      
      const representatives = await storage.getRepresentativesByCustomerId(userId);
      
      // Get user info for each representative
      const enrichedReps = await Promise.all(representatives.map(async (rep) => {
        const repUser = await storage.getUserById(rep.representativeUserId);
        return {
          ...rep,
          representativeUser: repUser ? {
            id: repUser.id,
            displayName: repUser.displayName,
            phone: repUser.phone,
            userType: repUser.userType,
          } : null,
        };
      }));
      
      res.json(enrichedReps);
    } catch (error) {
      console.error('Get representatives error:', error);
      res.status(500).json({ error: 'Failed to get representatives' });
    }
  });
  
  // Get list of customers where current user is a representative (principals)
  app.get('/api/representatives/my-principals', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      
      // Get current user's data to check userType
      const currentUser = await storage.getUserById(userId);
      if (!currentUser) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      // Only individuals can be representatives
      if (currentUser.userType !== 'individual') {
        return res.json([]);
      }
      
      const principals = await storage.getPrincipalsByRepresentativeUserId(userId);
      
      // Get customer info for each principal
      const enrichedPrincipals = await Promise.all(principals.map(async (rep) => {
        const customer = await storage.getUserById(rep.customerId);
        const profile = customer ? await storage.getProfileByUserId(customer.id) : null;
        return {
          ...rep,
          status: rep.isActive ? 'active' : 'revoked',
          customer: customer ? {
            id: customer.id,
            displayName: customer.displayName,
            phone: customer.phone,
            userType: customer.userType,
            companyName: profile?.companyName,
            inn: profile?.inn,
          } : null,
        };
      }));
      
      res.json(enrichedPrincipals);
    } catch (error) {
      console.error('Get principals error:', error);
      res.status(500).json({ error: 'Failed to get principals' });
    }
  });
  
  // Search users by phone to add as representative
  app.get('/api/representatives/search-user', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { phone } = req.query;
      const userId = req.user!.id;
      
      // Get current user's data to check userType
      const currentUser = await storage.getUserById(userId);
      if (!currentUser) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      // Only legal entities and IPs can search for representatives
      if (currentUser.userType === 'individual') {
        return res.status(403).json({ error: 'Только юридические лица и ИП могут добавлять представителей' });
      }
      
      if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ error: 'Укажите номер телефона' });
      }
      
      // Normalize phone number - add + if missing
      let normalizedPhone = phone.trim();
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = '+' + normalizedPhone;
      }
      
      const foundUser = await storage.getUserByPhone(normalizedPhone);
      
      if (!foundUser) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      // Only individuals can be representatives
      if (foundUser.userType !== 'individual') {
        return res.status(400).json({ error: 'Только физические лица могут быть представителями' });
      }
      
      // Cannot add yourself
      if (foundUser.id === userId) {
        return res.status(400).json({ error: 'Вы не можете добавить себя как представителя' });
      }
      
      // Check if already a representative
      const existing = await storage.getRepresentativeByCustomerAndUser(userId, foundUser.id);
      if (existing) {
        return res.status(400).json({ error: 'Этот пользователь уже является вашим представителем' });
      }
      
      res.json({
        id: foundUser.id,
        displayName: foundUser.displayName,
        phone: foundUser.phone,
        userType: foundUser.userType,
      });
    } catch (error) {
      console.error('Search user error:', error);
      res.status(500).json({ error: 'Failed to search user' });
    }
  });
  
  // Add a new representative
  app.post('/api/representatives', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { representativeUserId, permissions } = req.body;
      
      // Get current user's data to check userType
      const currentUser = await storage.getUserById(userId);
      if (!currentUser) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      // Only legal entities and IPs can add representatives
      if (currentUser.userType === 'individual') {
        return res.status(403).json({ error: 'Только юридические лица и ИП могут добавлять представителей' });
      }
      
      if (!representativeUserId) {
        return res.status(400).json({ error: 'Укажите ID представителя' });
      }
      
      // Check if target user exists and is individual
      const repUser = await storage.getUserById(representativeUserId);
      if (!repUser) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      if (repUser.userType !== 'individual') {
        return res.status(400).json({ error: 'Только физические лица могут быть представителями' });
      }
      
      // Cannot add yourself
      if (repUser.id === userId) {
        return res.status(400).json({ error: 'Вы не можете добавить себя как представителя' });
      }
      
      // Check if already exists
      const existing = await storage.getRepresentativeByCustomerAndUser(userId, repUser.id);
      if (existing) {
        return res.status(400).json({ error: 'Этот пользователь уже является вашим представителем' });
      }
      
      const representative = await storage.createRepresentative({
        customerId: userId,
        representativeUserId: repUser.id,
        permissions: permissions || [],
        isActive: true,
      });
      
      res.status(201).json(representative);
    } catch (error) {
      console.error('Create representative error:', error);
      res.status(500).json({ error: 'Failed to create representative' });
    }
  });
  
  // Update representative permissions
  app.put('/api/representatives/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      const { permissions, isActive } = req.body;
      
      // Get current user's data to check userType
      const currentUser = await storage.getUserById(userId);
      if (!currentUser) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      // Only legal entities and IPs can update representatives
      if (currentUser.userType === 'individual') {
        return res.status(403).json({ error: 'Только юридические лица и ИП могут управлять представителями' });
      }
      
      const existing = await storage.getRepresentativeById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Представитель не найден' });
      }
      
      // Only owner can update
      if (existing.customerId !== userId) {
        return res.status(403).json({ error: 'Вы не можете редактировать этого представителя' });
      }
      
      const updates: any = {};
      if (permissions !== undefined) updates.permissions = permissions;
      if (isActive !== undefined) updates.isActive = isActive;
      
      const updated = await storage.updateRepresentative(id, updates);
      res.json(updated);
    } catch (error) {
      console.error('Update representative error:', error);
      res.status(500).json({ error: 'Failed to update representative' });
    }
  });
  
  // Delete representative
  app.delete('/api/representatives/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user!.id;
      
      // Get current user's data to check userType
      const currentUser = await storage.getUserById(userId);
      if (!currentUser) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      // Only legal entities and IPs can delete representatives
      if (currentUser.userType === 'individual') {
        return res.status(403).json({ error: 'Только юридические лица и ИП могут управлять представителями' });
      }
      
      const existing = await storage.getRepresentativeById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Представитель не найден' });
      }
      
      // Only owner can delete
      if (existing.customerId !== userId) {
        return res.status(403).json({ error: 'Вы не можете удалить этого представителя' });
      }
      
      await storage.deleteRepresentative(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete representative error:', error);
      res.status(500).json({ error: 'Failed to delete representative' });
    }
  });

  // Activate representative mode - individual acts on behalf of a customer
  app.post('/api/representatives/activate/:customerId', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const customerId = parseInt(req.params.customerId);
      const user = req.user!;
      
      // Fetch full user data
      const userData = await storage.getUserById(user.id);
      if (!userData) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Only individuals can activate representative mode
      if (userData.userType !== 'individual') {
        return res.status(403).json({ error: 'Только физические лица могут работать как представители' });
      }
      
      // Check if user is an active representative for this customer
      const representative = await storage.getRepresentativeByCustomerAndUser(customerId, user.id);
      if (!representative) {
        return res.status(404).json({ error: 'Вы не являетесь представителем этой организации' });
      }
      
      if (!representative.isActive) {
        return res.status(403).json({ error: 'Ваши полномочия представителя неактивны' });
      }
      
      // Get customer info
      const customer = await storage.getUserById(customerId);
      if (!customer) {
        return res.status(404).json({ error: 'Заказчик не найден' });
      }
      
      const customerProfile = await storage.getProfileByUserId(customerId);
      
      res.json({
        success: true,
        customerId: customer.id,
        customerName: customerProfile?.companyName || customer.displayName,
        displayName: customer.displayName,
        companyName: customerProfile?.companyName || null,
        permissions: representative.permissions || [],
      });
    } catch (error) {
      console.error('Activate representative mode error:', error);
      res.status(500).json({ error: 'Failed to activate representative mode' });
    }
  });

  // Deactivate representative mode
  app.post('/api/representatives/deactivate', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      // Simply acknowledge the deactivation - actual mode is managed client-side
      res.json({ success: true });
    } catch (error) {
      console.error('Deactivate representative mode error:', error);
      res.status(500).json({ error: 'Failed to deactivate representative mode' });
    }
  });

  // Get principal's orders (for representative mode)
  app.get('/api/representatives/principal-orders', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const representativeCustomerIdHeader = req.headers['x-representative-customer-id'];
      const principalCustomerId = representativeCustomerIdHeader ? parseInt(representativeCustomerIdHeader as string) : null;
      
      console.log('[PRINCIPAL_ORDERS] Request:', {
        userId: req.user!.id,
        principalCustomerId,
        header: representativeCustomerIdHeader
      });
      
      if (!principalCustomerId) {
        return res.status(400).json({ error: 'No principal customer selected' });
      }

      // Verify user is an active representative for this customer
      const representative = await storage.getRepresentativeByCustomerAndUser(principalCustomerId, req.user!.id);
      console.log('[PRINCIPAL_ORDERS] Representative:', representative);
      
      if (!representative || !representative.isActive) {
        return res.status(403).json({ error: 'Not authorized to access this principal\'s data' });
      }

      // Get only orders created by this representative for the principal customer
      const orders = await storage.getOrdersByCustomerIdAndCreatedBy(principalCustomerId, req.user!.id);
      console.log('[PRINCIPAL_ORDERS] Found orders:', orders.length, 'for userId:', req.user!.id);
      res.json(orders);
    } catch (error) {
      console.error('Get principal orders error:', error);
      res.status(500).json({ error: 'Failed to get principal orders' });
    }
  });

  // Get principal's contracts (for representative mode)
  app.get('/api/representatives/principal-contracts', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const representativeCustomerIdHeader = req.headers['x-representative-customer-id'];
      const principalCustomerId = representativeCustomerIdHeader ? parseInt(representativeCustomerIdHeader as string) : null;
      
      if (!principalCustomerId) {
        return res.status(400).json({ error: 'No principal customer selected' });
      }

      // Verify user is an active representative for this customer
      const representative = await storage.getRepresentativeByCustomerAndUser(principalCustomerId, req.user!.id);
      if (!representative || !representative.isActive) {
        return res.status(403).json({ error: 'Not authorized to access this principal\'s data' });
      }

      // Get only contracts for orders created by this representative
      const representativeOrders = await storage.getOrdersByCustomerIdAndCreatedBy(principalCustomerId, req.user!.id);
      const orderIds = representativeOrders.map(o => o.id);
      
      if (orderIds.length === 0) {
        return res.json([]);
      }
      
      // Get all contracts for the principal customer and filter by representative's orders
      const allContracts = await storage.getContractsByUserId(principalCustomerId, 'customer');
      const contracts = allContracts.filter(c => orderIds.includes(c.orderId));
      res.json(contracts);
    } catch (error) {
      console.error('Get principal contracts error:', error);
      res.status(500).json({ error: 'Failed to get principal contracts' });
    }
  });

  // Get principal's sent documents (for representative mode)
  app.get('/api/representatives/principal-documents/sent', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const representativeCustomerIdHeader = req.headers['x-representative-customer-id'];
      const principalCustomerId = representativeCustomerIdHeader ? parseInt(representativeCustomerIdHeader as string) : null;
      
      if (!principalCustomerId) {
        return res.status(400).json({ error: 'No principal customer selected' });
      }

      // Verify user is an active representative for this customer
      const representative = await storage.getRepresentativeByCustomerAndUser(principalCustomerId, req.user!.id);
      if (!representative || !representative.isActive) {
        return res.status(403).json({ error: 'Not authorized to access this principal\'s data' });
      }

      // Get sent documents for the principal customer
      const { didoxService } = await import('./services/didox-service');
      const documents = await didoxService.getUserDocuments(principalCustomerId, 'sent');
      res.json(documents);
    } catch (error) {
      console.error('Get principal sent documents error:', error);
      res.status(500).json({ error: 'Failed to get principal documents' });
    }
  });

  // Get principal's received documents (for representative mode)
  app.get('/api/representatives/principal-documents/received', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const representativeCustomerIdHeader = req.headers['x-representative-customer-id'];
      const principalCustomerId = representativeCustomerIdHeader ? parseInt(representativeCustomerIdHeader as string) : null;
      
      if (!principalCustomerId) {
        return res.status(400).json({ error: 'No principal customer selected' });
      }

      // Verify user is an active representative for this customer
      const representative = await storage.getRepresentativeByCustomerAndUser(principalCustomerId, req.user!.id);
      if (!representative || !representative.isActive) {
        return res.status(403).json({ error: 'Not authorized to access this principal\'s data' });
      }

      // Get received documents for the principal customer
      const { didoxService } = await import('./services/didox-service');
      const documents = await didoxService.getUserDocuments(principalCustomerId, 'received');
      res.json(documents);
    } catch (error) {
      console.error('Get principal received documents error:', error);
      res.status(500).json({ error: 'Failed to get principal documents' });
    }
  });

  // ============= DIDOX INTEGRATION ROUTES =============
  
  // Check if Didox is configured
  app.get('/api/didox/status', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { didoxService } = await import('./services/didox-service');
      const isConfigured = didoxService.isDidoxConfigured();
      const userToken = await didoxService.getUserToken(req.user!.id);
      
      res.json({
        configured: isConfigured,
        authenticated: !!userToken,
      });
    } catch (error) {
      console.error('Didox status error:', error);
      res.status(500).json({ error: 'Failed to check Didox status' });
    }
  });

  // Login to Didox with password
  app.post('/api/didox/auth/password', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { taxId, password, locale } = req.body;
      
      if (!taxId || !password) {
        return res.status(400).json({ error: 'Tax ID and password are required' });
      }
      
      const { didoxService } = await import('./services/didox-service');
      const authResponse = await didoxService.loginWithPassword(taxId, password, locale || 'ru');
      
      // Save token for user
      await didoxService.saveUserToken(
        req.user!.id,
        authResponse.token,
        taxId,
        authResponse.company?.name
      );
      
      res.json({
        success: true,
        company: authResponse.company,
        relatedCompanies: authResponse.related_companies,
      });
    } catch (error: any) {
      console.error('Didox auth error:', error);
      res.status(401).json({ error: error.message || 'Authentication failed' });
    }
  });

  // Login to Didox with E-IMZO signature
  app.post('/api/didox/auth/eimzo', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { taxId, signature, locale } = req.body;
      
      if (!taxId || !signature) {
        return res.status(400).json({ error: 'Tax ID and signature are required' });
      }
      
      const { didoxService } = await import('./services/didox-service');
      const authResponse = await didoxService.loginWithEimzo(taxId, signature, locale || 'ru');
      
      // Save token for user
      await didoxService.saveUserToken(
        req.user!.id,
        authResponse.token,
        taxId,
        authResponse.company?.name
      );
      
      res.json({
        success: true,
        company: authResponse.company,
      });
    } catch (error: any) {
      console.error('Didox E-IMZO auth error:', error);
      res.status(401).json({ error: error.message || 'E-IMZO authentication failed' });
    }
  });

  // Get company info by INN (for auto-fill during registration)
  app.get('/api/didox/company/:taxId', async (req: Request, res: Response) => {
    try {
      const { taxId } = req.params;
      
      const { didoxService } = await import('./services/didox-service');
      const { getBankNameByMfo } = await import('../shared/uzbekistan-banks');
      
      const companyInfo = await didoxService.getCompanyInfo(taxId);
      
      if (!companyInfo) {
        return res.status(404).json({ error: 'Company not found' });
      }
      
      // If Didox doesn't return bank name, try to look it up by MFO code
      if (!companyInfo.bankName && (companyInfo.bankMfo || companyInfo.bankId)) {
        const mfo = (companyInfo.bankMfo || companyInfo.bankId) as string;
        const bankName = getBankNameByMfo(mfo, 'ru');
        if (bankName) {
          companyInfo.bankName = bankName;
        }
      }
      
      res.json(companyInfo);
    } catch (error: any) {
      console.error('Didox company lookup error:', error);
      res.status(500).json({ error: error.message || 'Failed to lookup company' });
    }
  });
  
  // Get bank name by MFO code
  app.get('/api/banks/mfo/:mfo', async (req: Request, res: Response) => {
    try {
      const { mfo } = req.params;
      const lang = (req.query.lang as string) || 'ru';
      
      const { getBankInfoByMfo } = await import('../shared/uzbekistan-banks');
      const bankInfo = getBankInfoByMfo(mfo);
      
      if (!bankInfo) {
        return res.status(404).json({ error: 'Bank not found' });
      }
      
      res.json({
        mfo: bankInfo.mfo,
        name: lang === 'uz' ? bankInfo.nameUz : bankInfo.name,
        nameRu: bankInfo.name,
        nameUz: bankInfo.nameUz
      });
    } catch (error: any) {
      console.error('Bank lookup error:', error);
      res.status(500).json({ error: error.message || 'Failed to lookup bank' });
    }
  });

  // Get prefill data for invoice/waybill from contract
  app.get('/api/didox/contracts/:contractId/prefill', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const contractId = parseInt(req.params.contractId);
      
      const { didoxService } = await import('./services/didox-service');
      const prefillData = await didoxService.getContractPrefillData(contractId);
      
      if (!prefillData) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Check user has access to this contract
      const isCustomer = prefillData.contract.customerId === req.user!.id;
      const isCarrier = prefillData.contract.carrierId === req.user!.id;
      
      if (!isCustomer && !isCarrier) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      res.json(prefillData);
    } catch (error: any) {
      console.error('Contract prefill error:', error);
      res.status(500).json({ error: error.message || 'Failed to get prefill data' });
    }
  });

  // Create and send invoice (Счет-фактура) - only carrier can send
  app.post('/api/didox/invoices', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { contractId, docNumber, docDate, items, ...otherData } = req.body;
      
      if (!contractId) {
        return res.status(400).json({ error: 'Contract ID is required' });
      }
      
      const { didoxService } = await import('./services/didox-service');
      
      // Get user token
      const userToken = await didoxService.getUserToken(req.user!.id);
      if (!userToken) {
        return res.status(401).json({ error: 'Please authenticate with Didox first', code: 'DIDOX_AUTH_REQUIRED' });
      }
      
      // Get contract data
      const prefillData = await didoxService.getContractPrefillData(contractId);
      if (!prefillData) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Only carrier can send invoice
      if (prefillData.contract.carrierId !== req.user!.id) {
        return res.status(403).json({ error: 'Only carrier can send invoice' });
      }
      
      const senderProfile = prefillData.carrier.profile;
      const receiverProfile = prefillData.customer.profile;
      
      if (!senderProfile?.inn || !receiverProfile?.inn) {
        return res.status(400).json({ error: 'Both parties must have INN configured' });
      }
      
      // Create invoice in Didox
      const didoxDocId = await didoxService.createInvoice(userToken, {
        contractId,
        docNumber: docNumber || `SF-${contractId}-${Date.now()}`,
        docDate: new Date(docDate || Date.now()),
        sellerTaxId: senderProfile.inn,
        sellerName: senderProfile.companyName || prefillData.carrier.displayName || '',
        buyerTaxId: receiverProfile.inn,
        buyerName: receiverProfile.companyName || prefillData.customer.displayName || '',
        items: items || [{
          name: `Транспортные услуги по договору №${prefillData.order.id}`,
          unitCode: '796',
          unitName: 'шт',
          quantity: 1,
          price: prefillData.offerPrice || toNum(prefillData.order.priceWithVat),
          vatRate: 12,
        }],
        contractNumber: String(prefillData.order.id),
        contractDate: prefillData.contract.generatedAt.toISOString().split('T')[0],
        ...otherData,
      });
      
      // Check if receiver is a platform user
      const receiverUser = await didoxService.findUserByTaxId(receiverProfile.inn);
      
      // Save document to local DB
      const totalSum = (items || []).reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) || prefillData.offerPrice || toNum(prefillData.order.priceWithVat);
      const totalSumWithVat = totalSum * 1.12;
      
      const docId = await didoxService.saveDocument({
        contractId,
        didoxDocId,
        docType: 'factura',
        docNumber: docNumber || `SF-${contractId}-${Date.now()}`,
        docDate: new Date(docDate || Date.now()),
        senderId: req.user!.id,
        senderTaxId: senderProfile.inn,
        senderName: senderProfile.companyName || prefillData.carrier.displayName || '',
        receiverId: receiverUser?.id,
        receiverTaxId: receiverProfile.inn,
        receiverName: receiverProfile.companyName || prefillData.customer.displayName || '',
        documentJson: { items, ...otherData },
        status: 'sent',
        totalSum,
        totalSumWithVat,
      });
      
      res.json({
        success: true,
        documentId: docId,
        didoxDocId,
      });
    } catch (error: any) {
      console.error('Create invoice error:', error);
      res.status(500).json({ error: error.message || 'Failed to create invoice' });
    }
  });

  // Create and send waybill (ТТН) - only customer can send
  app.post('/api/didox/waybills', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { contractId, docNumber, docDate, loadingPoint, unloadingPoint, items, vehicleNumber, driverName, ...otherData } = req.body;
      
      if (!contractId) {
        return res.status(400).json({ error: 'Contract ID is required' });
      }
      
      const { didoxService } = await import('./services/didox-service');
      
      // Get user token
      const userToken = await didoxService.getUserToken(req.user!.id);
      if (!userToken) {
        return res.status(401).json({ error: 'Please authenticate with Didox first', code: 'DIDOX_AUTH_REQUIRED' });
      }
      
      // Get contract data
      const prefillData = await didoxService.getContractPrefillData(contractId);
      if (!prefillData) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      
      // Check for representative mode
      const representativeCustomerIdHeader = req.headers['x-representative-customer-id'] as string | undefined;
      
      if (representativeCustomerIdHeader) {
        const representedCustomerId = parseInt(representativeCustomerIdHeader, 10);
        if (!isNaN(representedCustomerId) && prefillData.contract.customerId === representedCustomerId) {
          // Representative mode - check send_waybill permission
          const hasPermission = await storage.checkRepresentativePermission(
            representedCustomerId,
            req.user!.id,
            'send_waybill'
          );
          
          if (!hasPermission) {
            return res.status(403).json({ 
              error: 'У вас нет прав на отправку ТТН в режиме представителя / Sizda vakil rejimida TTN yuborish huquqi yo\'q' 
            });
          }
          
          console.log(`[WAYBILL] Representative ${req.user!.id} sending waybill for contract ${contractId} on behalf of customer ${representedCustomerId}`);
        } else {
          return res.status(403).json({ error: 'Not authorized to send waybill for this contract' });
        }
      } else {
        // Only customer can send waybill
        if (prefillData.contract.customerId !== req.user!.id) {
          return res.status(403).json({ error: 'Only customer can send waybill' });
        }
      }
      
      const senderProfile = prefillData.customer.profile;
      const receiverProfile = prefillData.carrier.profile;
      
      if (!senderProfile?.inn || !receiverProfile?.inn) {
        return res.status(400).json({ error: 'Both parties must have INN configured' });
      }
      
      // Create waybill in Didox
      const didoxDocId = await didoxService.createWaybill(userToken, {
        contractId,
        docNumber: docNumber || `TTN-${contractId}-${Date.now()}`,
        docDate: new Date(docDate || Date.now()),
        consignorTaxId: senderProfile.inn,
        consignorName: senderProfile.companyName || prefillData.customer.displayName || '',
        consigneeTaxId: receiverProfile.inn,
        consigneeName: receiverProfile.companyName || prefillData.carrier.displayName || '',
        carrierTaxId: receiverProfile.inn,
        carrierName: receiverProfile.companyName || prefillData.carrier.displayName || '',
        loadingPoint: loadingPoint || prefillData.order.originRegion,
        unloadingPoint: unloadingPoint || prefillData.order.destinationRegion,
        items: items || [{
          name: prefillData.order.title || 'Груз',
          unitCode: '796',
          unitName: 'шт',
          quantity: 1,
          price: prefillData.offerPrice || toNum(prefillData.order.priceWithVat),
        }],
        vehicleNumber,
        driverName,
        contractNumber: String(prefillData.order.id),
        contractDate: prefillData.contract.generatedAt.toISOString().split('T')[0],
        ...otherData,
      });
      
      // Check if receiver is a platform user
      const receiverUser = await didoxService.findUserByTaxId(receiverProfile.inn);
      
      // Save document to local DB
      const totalSum = (items || []).reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) || prefillData.offerPrice || toNum(prefillData.order.priceWithVat);
      
      const docId = await didoxService.saveDocument({
        contractId,
        didoxDocId,
        docType: 'waybill',
        docNumber: docNumber || `TTN-${contractId}-${Date.now()}`,
        docDate: new Date(docDate || Date.now()),
        senderId: req.user!.id,
        senderTaxId: senderProfile.inn,
        senderName: senderProfile.companyName || prefillData.customer.displayName || '',
        receiverId: receiverUser?.id,
        receiverTaxId: receiverProfile.inn,
        receiverName: receiverProfile.companyName || prefillData.carrier.displayName || '',
        documentJson: { items, loadingPoint, unloadingPoint, vehicleNumber, driverName, ...otherData },
        status: 'sent',
        totalSum,
      });
      
      res.json({
        success: true,
        documentId: docId,
        didoxDocId,
      });
    } catch (error: any) {
      console.error('Create waybill error:', error);
      res.status(500).json({ error: error.message || 'Failed to create waybill' });
    }
  });

  // Get user's documents (sent or received)
  app.get('/api/didox/documents', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const { type = 'sent', docType } = req.query;
      
      const { didoxService } = await import('./services/didox-service');
      const documents = await didoxService.getUserDocuments(
        req.user!.id,
        type as 'sent' | 'received',
        docType as 'factura' | 'waybill' | undefined
      );
      
      res.json(documents);
    } catch (error: any) {
      console.error('Get documents error:', error);
      res.status(500).json({ error: error.message || 'Failed to get documents' });
    }
  });

  // Get single document by ID
  app.get('/api/didox/documents/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      const [document] = await db
        .select()
        .from(schema.didoxDocuments)
        .where(eq(schema.didoxDocuments.id, id))
        .limit(1);
      
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      // Check access
      if (document.senderId !== req.user!.id && document.receiverId !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      res.json(document);
    } catch (error: any) {
      console.error('Get document error:', error);
      res.status(500).json({ error: error.message || 'Failed to get document' });
    }
  });

  // Sign document with E-IMZO
  app.post('/api/didox/documents/:id/sign', authenticate, async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { signature } = req.body;
      
      if (!signature) {
        return res.status(400).json({ error: 'Signature is required' });
      }
      
      const [document] = await db
        .select()
        .from(schema.didoxDocuments)
        .where(eq(schema.didoxDocuments.id, id))
        .limit(1);
      
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      // Check access - only sender or receiver can sign
      if (document.senderId !== req.user!.id && document.receiverId !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const { didoxService } = await import('./services/didox-service');
      
      // Get user token
      const userToken = await didoxService.getUserToken(req.user!.id);
      if (!userToken) {
        return res.status(401).json({ error: 'Please authenticate with Didox first', code: 'DIDOX_AUTH_REQUIRED' });
      }
      
      // Sign in Didox
      if (document.didoxDocId) {
        await didoxService.signDocument(userToken, document.didoxDocId, signature);
      }
      
      // Update local record
      const isSender = document.senderId === req.user!.id;
      await db
        .update(schema.didoxDocuments)
        .set({
          ...(isSender ? {
            senderSignature: signature,
            senderSignedAt: new Date(),
          } : {
            receiverSignature: signature,
            receiverSignedAt: new Date(),
            status: 'signed',
          }),
          updatedAt: new Date(),
        })
        .where(eq(schema.didoxDocuments.id, id));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Sign document error:', error);
      res.status(500).json({ error: error.message || 'Failed to sign document' });
    }
  });

  // ─── Admin: Orders management ─────────────────────────────────────────────
  app.get('/api/admin/orders', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { status, search, page = '1', pageSize = '25' } = req.query;
      const result = await storage.getAdminOrdersList({
        status: status as string,
        search: search as string,
        page: parseInt(page as string, 10) || 1,
        pageSize: Math.min(parseInt(pageSize as string, 10) || 25, 100),
      });
      res.json({ ...result, page: parseInt(page as string, 10) || 1, pageSize: parseInt(pageSize as string, 10) || 25, totalPages: Math.ceil(result.total / (parseInt(pageSize as string, 10) || 25)) });
    } catch (error: any) {
      console.error('Admin orders list error:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  app.patch('/api/admin/orders/:id/status', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { status } = req.body;
      const valid = ['new', 'assigned', 'completed', 'cancelled'];
      if (!status || !valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
      await storage.adminUpdateOrderStatus(id, status);
      // Update Telegram message when status changes
      try {
        const updated = await storage.getOrderById(id);
        if (updated) {
          await updateOrderNotification(updated, 'status_changed');
        }
      } catch (telegramError: any) {
        console.error('[ADMIN] Failed to update Telegram order notification:', telegramError.message);
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Admin update order status error:', error);
      res.status(500).json({ error: error.message || 'Failed to update status' });
    }
  });

  app.patch('/api/admin/orders/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      await storage.adminUpdateOrderFields(id, req.body);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Admin update order fields error:', error);
      res.status(500).json({ error: error.message || 'Failed to update order' });
    }
  });

  // ─── Admin: Announcements management ──────────────────────────────────────
  app.get('/api/admin/announcements', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const { status, search, createdBy, page = '1', pageSize = '25' } = req.query;
      const result = await storage.getAdminAnnouncementsList({
        status: status as string,
        search: search as string,
        createdBy: createdBy as string,
        page: parseInt(page as string, 10) || 1,
        pageSize: Math.min(parseInt(pageSize as string, 10) || 25, 100),
      });
      res.json({ ...result, page: parseInt(page as string, 10) || 1, pageSize: parseInt(pageSize as string, 10) || 25, totalPages: Math.ceil(result.total / (parseInt(pageSize as string, 10) || 25)) });
    } catch (error: any) {
      console.error('Admin announcements list error:', error);
      res.status(500).json({ error: 'Failed to fetch announcements' });
    }
  });

  app.patch('/api/admin/announcements/:id/status', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { status } = req.body;
      const valid = ['new', 'active', 'closed', 'completed', 'cancelled'];
      if (!status || !valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
      await storage.adminUpdateAnnouncementStatus(id, status);
      // Update Telegram message when status changes
      try {
        const updated = await storage.getAnnouncementById(id);
        if (updated) {
          await updateAnnouncementNotification(updated);
        }
      } catch (telegramError: any) {
        console.error('[ADMIN] Failed to update Telegram notification:', telegramError.message);
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Admin update announcement status error:', error);
      res.status(500).json({ error: error.message || 'Failed to update status' });
    }
  });

  app.patch('/api/admin/announcements/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      await storage.adminUpdateAnnouncementFields(id, req.body);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Admin update announcement fields error:', error);
      res.status(500).json({ error: error.message || 'Failed to update announcement' });
    }
  });

  app.delete('/api/admin/announcements/:id', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      await storage.adminDeleteAnnouncement(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Admin delete announcement error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete announcement' });
    }
  });

  // ===== Push Notification Endpoints =====
  // Register or update a push token (no auth required — works for guest users)
  app.post('/api/push/register', async (req: Request, res: Response) => {
    try {
      const { expoToken, originRegions, destinationRegions, transportTypes, excludeBot } = req.body;
      if (!expoToken || typeof expoToken !== 'string') {
        return res.status(400).json({ error: 'expoToken is required' });
      }
      // Extract userId from JWT if present (optional)
      let userId: number | null = null;
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (token) {
          const payload = jwt.verify(token, process.env.SESSION_SECRET!) as any;
          userId = payload?.id || null;
        }
      } catch {}

      const safeOriginRegions = Array.isArray(originRegions) ? originRegions.filter(Boolean) : [];
      const safeDestRegions = Array.isArray(destinationRegions) ? destinationRegions.filter(Boolean) : [];
      const safeTransportTypes = Array.isArray(transportTypes) ? transportTypes.filter(Boolean) : [];
      const safeExcludeBot = excludeBot === true;

      console.log(`[Push] Register: token=${expoToken.slice(0, 35)}... userId=${userId} origins=${JSON.stringify(safeOriginRegions)} dests=${JSON.stringify(safeDestRegions)} transports=${JSON.stringify(safeTransportTypes)} excludeBot=${safeExcludeBot}`);

      await registerPushToken(expoToken, userId, {
        originRegions: safeOriginRegions,
        destinationRegions: safeDestRegions,
        transportTypes: safeTransportTypes,
        excludeBot: safeExcludeBot,
      });
      console.log(`[Push] Token stored in DB for userId=${userId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Push register error:', error);
      res.status(500).json({ error: 'Failed to register push token' });
    }
  });

  // Unregister a push token (e.g. on logout or permission revoke)
  app.delete('/api/push/unregister', async (req: Request, res: Response) => {
    try {
      const { expoToken } = req.body;
      if (!expoToken || typeof expoToken !== 'string') {
        return res.status(400).json({ error: 'expoToken is required' });
      }
      await unregisterPushToken(expoToken);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Push unregister error:', error);
      res.status(500).json({ error: 'Failed to unregister push token' });
    }
  });

  // ── Mobile Analytics ──────────────────────────────────────────────────────
  // Simple in-memory rate limiter for analytics endpoints (by IP)
  const analyticsRateLimit = new Map<string, { count: number; resetAt: number }>();
  function checkAnalyticsRate(ip: string): boolean {
    const now = Date.now();
    const entry = analyticsRateLimit.get(ip);
    if (!entry || now > entry.resetAt) {
      analyticsRateLimit.set(ip, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    if (entry.count >= 60) return false;
    entry.count++;
    return true;
  }
  setInterval(() => {
    const now = Date.now();
    for (const [ip, e] of analyticsRateLimit.entries()) {
      if (now > e.resetAt) analyticsRateLimit.delete(ip);
    }
  }, 5 * 60_000);

  app.post('/api/analytics/event', async (req: Request, res: Response) => {
    const ip = req.ip || 'unknown';
    if (!checkAnalyticsRate(ip)) return res.status(429).json({ error: 'Rate limit' });
    try {
      const { eventName, screen, deviceModel, osVersion, appVersion, metadata } = req.body;
      if (!eventName) return res.status(400).json({ error: 'eventName required' });
      // Try to extract userId from JWT if present (optional)
      let userId: number | null = null;
      try {
        const token = req.cookies?.token || (req.headers.authorization as string)?.replace('Bearer ', '');
        if (token) {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          userId = decoded?.id ?? null;
        }
      } catch (_) {}
      await db.insert(schema.appEvents).values({
        userId,
        eventName: String(eventName).slice(0, 100),
        screen: screen ? String(screen).slice(0, 100) : null,
        deviceModel: deviceModel ? String(deviceModel).slice(0, 100) : null,
        osVersion: osVersion ? String(osVersion).slice(0, 50) : null,
        appVersion: appVersion ? String(appVersion).slice(0, 30) : null,
        metadata: metadata ?? null,
      });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to save event' });
    }
  });

  app.post('/api/analytics/error', async (req: Request, res: Response) => {
    const ip = req.ip || 'unknown';
    if (!checkAnalyticsRate(ip)) return res.status(429).json({ error: 'Rate limit' });
    try {
      const { errorMessage, errorStack, screen, deviceModel, osVersion, appVersion } = req.body;
      if (!errorMessage) return res.status(400).json({ error: 'errorMessage required' });
      let userId: number | null = null;
      try {
        const token = req.cookies?.token || (req.headers.authorization as string)?.replace('Bearer ', '');
        if (token) {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          userId = decoded?.id ?? null;
        }
      } catch (_) {}
      await db.insert(schema.appErrors).values({
        userId,
        errorMessage: String(errorMessage).slice(0, 2000),
        errorStack: errorStack ? String(errorStack).slice(0, 5000) : null,
        screen: screen ? String(screen).slice(0, 100) : null,
        deviceModel: deviceModel ? String(deviceModel).slice(0, 100) : null,
        osVersion: osVersion ? String(osVersion).slice(0, 50) : null,
        appVersion: appVersion ? String(appVersion).slice(0, 30) : null,
      });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to save error' });
    }
  });

  // Admin analytics - summary stats
  app.get('/api/admin/analytics/summary', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;

      if (dateFrom && isNaN(Date.parse(dateFrom))) return res.status(400).json({ error: 'Invalid dateFrom' });
      if (dateTo && isNaN(Date.parse(dateTo))) return res.status(400).json({ error: 'Invalid dateTo' });

      // Default window: last 7 days
      const since = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const until = dateTo ? new Date(dateTo + 'T23:59:59') : new Date();

      // Single query with CTEs — one round-trip to the DB
      const result = await db.execute(sql`
        WITH
          active_user_ids AS (
            SELECT DISTINCT user_id
            FROM app_events
            WHERE event_name = 'session_start'
              AND created_at >= ${since} AND created_at <= ${until}
              AND user_id IS NOT NULL
          ),
          err_stats AS (
            SELECT
              COUNT(*)                                                        AS total_errors,
              COUNT(DISTINCT ae.user_id)                                      AS unique_users_with_errors,
              COUNT(DISTINCT CASE WHEN au.user_id IS NOT NULL THEN ae.user_id END) AS active_users_with_errors
            FROM app_errors ae
            LEFT JOIN active_user_ids au ON ae.user_id = au.user_id
            WHERE ae.created_at >= ${since} AND ae.created_at <= ${until}
          ),
          session_stats AS (
            SELECT COUNT(*) AS total_sessions
            FROM app_events
            WHERE event_name = 'session_start'
              AND created_at >= ${since} AND created_at <= ${until}
          ),
          active_users AS (
            SELECT COUNT(*) AS total_active_users
            FROM active_user_ids
          ),
          top_screen AS (
            SELECT screen
            FROM app_errors
            WHERE created_at >= ${since} AND created_at <= ${until}
              AND screen IS NOT NULL AND screen <> ''
            GROUP BY screen
            ORDER BY COUNT(*) DESC
            LIMIT 1
          )
        SELECT
          err_stats.total_errors,
          err_stats.unique_users_with_errors,
          err_stats.active_users_with_errors,
          session_stats.total_sessions,
          active_users.total_active_users,
          top_screen.screen AS top_error_screen
        FROM err_stats, session_stats, active_users
        LEFT JOIN top_screen ON true
      `);

      const row = result.rows[0] as any;
      const totalActiveUsers = parseInt(String(row?.total_active_users ?? 0));
      const activeUsersWithErrors = parseInt(String(row?.active_users_with_errors ?? 0));
      const uniqueUsersWithErrors = parseInt(String(row?.unique_users_with_errors ?? 0));
      const crashFreeRate = totalActiveUsers > 0
        ? Math.round(((totalActiveUsers - activeUsersWithErrors) / totalActiveUsers) * 1000) / 10
        : null;
      res.json({
        totalErrors: parseInt(String(row?.total_errors ?? 0)),
        uniqueUsersWithErrors,
        totalSessions: parseInt(String(row?.total_sessions ?? 0)),
        totalActiveUsers,
        crashFreeRate,
        topErrorScreen: row?.top_error_screen ?? null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin analytics endpoints
  app.get('/api/admin/analytics/events', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
      const offset = (page - 1) * limit;
      const eventName = req.query.eventName as string | undefined;
      const eventNames = req.query.eventNames as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const search = req.query.search as string | undefined;

      const since = dateFrom ? new Date(dateFrom) : null;
      const until = dateTo ? new Date(dateTo + 'T23:59:59') : null;
      const names = eventNames ? eventNames.split(',').map(s => s.trim()).filter(Boolean) : null;

      function buildEventsConditions() {
        const c: any[] = [];
        if (eventName) c.push(sql`ae.event_name = ${eventName}`);
        else if (names && names.length > 0) c.push(sql`ae.event_name = ANY(${names})`);
        if (since) c.push(sql`ae.created_at >= ${since}`);
        if (until) c.push(sql`ae.created_at <= ${until}`);
        if (search) c.push(sql`(u.display_name ILIKE ${`%${search}%`} OR u.phone ILIKE ${`%${search}%`})`);
        return c;
      }

      const rowConds = buildEventsConditions();
      const rowWhere = rowConds.length > 0 ? sql`WHERE ${sql.join(rowConds, sql` AND `)}` : sql``;

      const rows = await db.execute(sql`
        SELECT ae.id, ae.event_name, ae.screen, ae.device_model, ae.os_version, ae.app_version,
               ae.metadata, ae.created_at,
               u.id as user_id, u.display_name, u.phone
        FROM app_events ae
        LEFT JOIN users u ON ae.user_id = u.id
        ${rowWhere}
        ORDER BY ae.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const cntConds = buildEventsConditions();
      const cntWhere = cntConds.length > 0 ? sql`WHERE ${sql.join(cntConds, sql` AND `)}` : sql``;

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total FROM app_events ae
        LEFT JOIN users u ON ae.user_id = u.id
        ${cntWhere}
      `);

      res.json({
        events: rows.rows,
        total: parseInt(String((countResult.rows[0] as any)?.total ?? 0)),
        page,
        limit,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/analytics/errors', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
      const offset = (page - 1) * limit;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const search = req.query.search as string | undefined;

      const since = dateFrom ? new Date(dateFrom) : null;
      const until = dateTo ? new Date(dateTo + 'T23:59:59') : null;

      function buildErrorsConditions() {
        const c: any[] = [];
        if (since) c.push(sql`ae.created_at >= ${since}`);
        if (until) c.push(sql`ae.created_at <= ${until}`);
        if (search) c.push(sql`(u.display_name ILIKE ${`%${search}%`} OR u.phone ILIKE ${`%${search}%`} OR ae.error_message ILIKE ${`%${search}%`})`);
        return c;
      }

      const rowConds = buildErrorsConditions();
      const rowWhere = rowConds.length > 0 ? sql`WHERE ${sql.join(rowConds, sql` AND `)}` : sql``;

      const rows = await db.execute(sql`
        SELECT ae.id, ae.error_message, ae.error_stack, ae.screen, ae.device_model, ae.os_version,
               ae.app_version, ae.created_at,
               u.id as user_id, u.display_name, u.phone
        FROM app_errors ae
        LEFT JOIN users u ON ae.user_id = u.id
        ${rowWhere}
        ORDER BY ae.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const cntConds = buildErrorsConditions();
      const cntWhere = cntConds.length > 0 ? sql`WHERE ${sql.join(cntConds, sql` AND `)}` : sql``;

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as total FROM app_errors ae
        LEFT JOIN users u ON ae.user_id = u.id
        ${cntWhere}
      `);

      res.json({
        errors: rows.rows,
        total: parseInt(String((countResult.rows[0] as any)?.total ?? 0)),
        page,
        limit,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin analytics - sessions list (session_start events)
  app.get('/api/admin/analytics/sessions', authenticate, authorize('admin'), async (req: AuthRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
      const offset = (page - 1) * limit;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const search = req.query.search as string | undefined;

      const since = dateFrom ? new Date(dateFrom) : null;
      const until = dateTo ? new Date(dateTo + 'T23:59:59') : null;

      // Simple flat query — no subqueries, no LATERAL, guaranteed to work
      const rowConds: any[] = [sql`ae.event_name = 'session_start'`];
      if (since) rowConds.push(sql`ae.created_at >= ${since}`);
      if (until) rowConds.push(sql`ae.created_at <= ${until}`);
      if (search) rowConds.push(sql`(u.display_name ILIKE ${`%${search}%`} OR u.phone ILIKE ${`%${search}%`})`);

      const rows = await db.execute(sql`
        SELECT
          ae.id,
          ae.created_at  AS started_at,
          ae.device_model,
          ae.os_version,
          ae.app_version,
          u.id           AS user_id,
          u.display_name,
          u.phone,
          (ae.metadata->>'durationSeconds')::int  AS duration_seconds,
          (ae.metadata->>'screensVisited')::int   AS screens_visited
        FROM app_events ae
        LEFT JOIN users u ON ae.user_id = u.id
        WHERE ${sql.join(rowConds, sql` AND `)}
        ORDER BY ae.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const cntConds: any[] = [sql`ae.event_name = 'session_start'`];
      if (since) cntConds.push(sql`ae.created_at >= ${since}`);
      if (until) cntConds.push(sql`ae.created_at <= ${until}`);
      if (search) cntConds.push(sql`(u.display_name ILIKE ${`%${search}%`} OR u.phone ILIKE ${`%${search}%`})`);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) AS total
        FROM app_events ae
        LEFT JOIN users u ON ae.user_id = u.id
        WHERE ${sql.join(cntConds, sql` AND `)}
      `);

      res.json({
        sessions: (rows.rows as any[]).map(r => ({
          id: r.id,
          started_at: r.started_at ?? r.startedAt ?? r.created_at ?? r.createdAt ?? null,
          device_model: r.device_model ?? r.deviceModel ?? null,
          os_version: r.os_version ?? r.osVersion ?? null,
          app_version: r.app_version ?? r.appVersion ?? null,
          user_id: r.user_id ?? r.userId ?? null,
          display_name: r.display_name ?? r.displayName ?? null,
          phone: r.phone ?? null,
          duration_seconds: r.duration_seconds ?? r.durationSeconds ?? null,
          screens_visited: r.screens_visited ?? r.screensVisited ?? null,
        })),
        total: parseInt(String((countResult.rows[0] as any)?.total ?? 0)),
        page,
        limit,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── AI Voice Assistant Routes ─────────────────────────────────────────────

  function getAiClient(): { client: OpenAI; model: string } | null {
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const aiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const aiBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    if (deepseekKey) {
      return { client: new OpenAI({ apiKey: deepseekKey, baseURL: 'https://api.deepseek.com/v1' }), model: 'deepseek-v4-flash' };
    }
    if (openaiKey) {
      return { client: new OpenAI({ apiKey: openaiKey }), model: 'gpt-4o-mini' };
    }
    if (aiKey && aiBase && !aiKey.includes('DUMMY')) {
      return { client: new OpenAI({ apiKey: aiKey, baseURL: aiBase }), model: 'gpt-4o-mini' };
    }
    return null;
  }

  // === AI Voice Assistant — in-memory IP rate limiter (no Redis needed) ===
  const _aiRlMap = new Map<string, { n: number; reset: number }>();
  function _aiRl(req: Request, key: string, max: number): boolean {
    const ip = ((req.headers['x-forwarded-for'] as string) || '').split(',')[0]?.trim() || (req as any).ip || 'unknown';
    const k = `${ip}::${key}`;
    const now = Date.now();
    const e = _aiRlMap.get(k);
    if (!e || now > e.reset) { _aiRlMap.set(k, { n: 1, reset: now + 60_000 }); return true; }
    if (e.n >= max) return false;
    e.n++;
    return true;
  }

  // Audio upload middleware for /api/ai/transcribe
  const audioUploadMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = /\.(m4a|mp4|mp3|wav|webm|ogg|aac)$/i.test(file.originalname) ||
        ['audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/webm',
         'audio/ogg', 'audio/x-m4a', 'audio/aac', 'application/octet-stream'].includes(file.mimetype);
      cb(ok ? null : new Error('Unsupported audio format'), ok);
    },
  });

  // POST /api/ai/transcribe — audio → text via Whisper (no auth, IP rate-limited: 5 req/min)
  app.post('/api/ai/transcribe',
    (req: Request, res: Response, next: NextFunction) => {
      if (!_aiRl(req, 'transcribe', 5)) return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
      audioUploadMiddleware.single('audio')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message });
        next();
      });
    },
    async (req: Request, res: Response) => {
      try {
        const ai = getAiClient();
        if (!ai) return res.status(503).json({ error: 'AI service not configured' });
        // Whisper only available via real OpenAI key, not DeepSeek
        let whisperClient: OpenAI;
        const openaiKey = process.env.OPENAI_API_KEY;
        const aiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
        const aiBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
        if (openaiKey) {
          whisperClient = new OpenAI({ apiKey: openaiKey });
        } else if (aiKey && aiBase && !aiKey.includes('DUMMY')) {
          whisperClient = new OpenAI({ apiKey: aiKey, baseURL: aiBase });
        } else {
          return res.status(503).json({ error: 'Whisper requires OpenAI API key' });
        }
        const file = (req as any).file as (Express.Multer.File & { buffer: Buffer }) | undefined;
        if (!file) return res.status(400).json({ error: 'No audio file provided' });
        const audioFile = new File([file.buffer], file.originalname || 'audio.m4a', { type: file.mimetype || 'audio/m4a' });
        const reqLang = (req as any).body?.language as string | undefined;

        const uzPrompt = "Ertaga Toshkentdan Samarqandga 2 ta tent fura kerak. Qashqadaryoga 3 ta isuzu bor. Buxoroga 1 ta ref fura ertalab to'qqizda yuklaydi. Andijondan Navoiyga ikkita bongo. Namangan, Farg'ona, Qo'qon, Guliston, Jizzax, Termiz, Denov, Nukus, Urganch, Xiva. Yuk og'irligi 10 tonna, 5 tonna, 20 tonna. Transport: fura, tent, ref, labo, bongo, furgon, isuzu, tipper, gazelle.";
        const ruPrompt = "Диспетчер описывает перевозку грузов по Узбекистану. Маршруты: Ташкент (город), Ташкентская область, Самарканд, Бухара, Навои, Карши, Термез, Сурхандарья, Денов, Джизак, Нукус, Ургенч, Андижан, Наманган, Фергана, Коканд. Типы транспорта: фура, тент-фура, реф-фура, рефрижератор, самосвал, бортовой, газель, будка, ISUZU, цистерна, контейнеровоз, лабо, бонго, фургон.";

        let finalText = '';

        if (reqLang === 'uz') {
          // Uzbek UI: use gpt-4o-audio-preview to transcribe directly — bypasses Whisper entirely.
          // Whisper with language:'uz' always outputs Kazakh Cyrillic; this is a model-level limitation
          // that cannot be fixed with prompts or post-processing.
          const audioBase64 = file.buffer.toString('base64');
          // Determine audio format for the API
          const ext = (file.originalname || 'audio.m4a').split('.').pop()?.toLowerCase() || 'm4a';
          const fmtMap: Record<string, string> = { m4a: 'mp4', mp4: 'mp4', mp3: 'mp3', wav: 'wav', webm: 'webm', ogg: 'ogg', aac: 'aac' };
          const audioFormat = fmtMap[ext] || 'mp4';

          try {
            const audioCompletion = await whisperClient.chat.completions.create({
              model: 'gpt-4o-audio-preview',
              modalities: ['text'],
              messages: [
                {
                  role: 'system',
                  content: `You are a transcription assistant for Uzbek freight dispatchers. Transcribe the audio exactly as spoken into Uzbek Latin script. Never use Cyrillic. Never use Kazakh.

TRANSPORT TYPES (use exactly these spellings):
fura, tent fura, ref fura, isuzu, bongo, labo, gazelle, furgon, tipper, avtorefrijerator, bortovoy, konteyner

CITIES (capitalize first letter, use exactly these spellings):
Toshkent, Toshkent viloyati, Samarqand, Buxoro, Qarshi, Qashqadaryo, Termiz, Surxondaryo, Denov, Andijon, Namangan, Farg'ona, Qo'qon, Navoiy, Jizzax, Guliston, Sirdaryo, Nukus, Urganch, Xiva, Beruniy

TIME WORDS (use exactly):
soat, ertalab, kechqurun, tushda, yarim, ertaga, bugun, hafta

WEIGHT / QUANTITY WORDS (use exactly):
tonna, kg, metr, kub, dona, ta, litr

PRICE WORDS (use exactly):
narxi, narx, million, ming, yuz, so'm, dollar, pul, to'lov

ACTION WORDS (use exactly):
kerak, bor, yuklaydi, tushiradi, jo'natadi, keladi, boradi, qiladi, mumkin, tayyor

NUMBER WORDS (write as digits when possible):
bir, ikki, uch, to'rt, besh, olti, yetti, sakkiz, to'qqiz, o'n, yigirma, o'ttiz, qirq, ellik, oltmish, yetmish, sakson, to'qson, yuz, ming, million

Return ONLY the transcription text. No explanations, no extra words.`,
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'input_audio',
                      input_audio: { data: audioBase64, format: audioFormat as any },
                    },
                  ] as any,
                },
              ],
              temperature: 0,
            } as any);
            let transcribed = ((audioCompletion as any).choices?.[0]?.message?.content || '').trim();

            // Lightweight deterministic correction pass for known common ASR errors
            if (transcribed.length > 0) {
              const corrections: [RegExp, string][] = [
                [/\betalab\b/gi, 'ertalab'],
                [/\bertalabga\b/gi, 'ertalabga'],
                [/\bnarki\b/gi, 'narxi'],
                [/\bnarky\b/gi, 'narxi'],
                [/\bmilyonsun\b/gi, 'million'],
                [/\bmilyonson\b/gi, 'million'],
                [/\bmilyonsum\b/gi, 'million so\'m'],
                [/\bSa['']?o\b/g, 'Soat'],
                [/\bsa['']?o\b/g, 'soat'],
                [/\bkere\b/gi, 'kerak'],
                [/\btori\b/gi, 'to\'rt'],
                [/\barvi\b/gi, 'yuz'],
                [/\bogʻirligi\b/gi, 'og\'irligi'],
                [/\btonno\b/gi, 'tonna'],
                [/\bkarshi\b/gi, 'Qarshi'],
                [/\bqarshiga\b/gi, 'Qarshiga'],
                [/\bkarshiga\b/gi, 'Qarshiga'],
              ];
              for (const [pattern, replacement] of corrections) {
                transcribed = transcribed.replace(pattern, replacement);
              }
              console.log('[AI Transcribe] gpt-4o-audio-preview uz succeeded, len=', transcribed.length);
            }

            if (transcribed.length > 0) {
              finalText = transcribed;
            }
          } catch (audioErr: any) {
            console.warn('[AI Transcribe] gpt-4o-audio-preview failed, falling back to whisper-1 auto-detect:', audioErr.message);
            // Fallback: whisper-1 WITHOUT language parameter — auto-detect avoids forcing Kazakh Cyrillic
            try {
              const t = await whisperClient.audio.transcriptions.create({
                file: audioFile,
                model: 'whisper-1',
                prompt: uzPrompt,
                // No language param: auto-detect is more likely to give Latin output than language:'uz'
              } as any);
              finalText = (t.text || '').trim();
              console.log('[AI Transcribe] whisper-1 auto-detect uz fallback succeeded, len=', finalText.length);
            } catch (wErr: any) {
              console.warn('[AI Transcribe] whisper-1 fallback also failed:', wErr.message);
            }
          }
        } else {
          // Russian UI: force Russian transcription — works well, no normalization needed
          const transcription = await whisperClient.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            language: 'ru',
            prompt: ruPrompt,
          });
          finalText = transcription.text || '';
          console.log('[AI Transcribe] whisper-1 ru succeeded, text_len=', finalText.length);
        }

        res.json({ text: finalText, transcript: finalText });
      } catch (err: any) {
        console.error('[AI Transcribe]', err.message);
        res.status(500).json({ error: err.message || 'Transcription failed' });
      }
    }
  );

  // Canonical values — must stay in sync with announcementSchema enums and mobile constants
  const AI_REGION_MAP: Record<string, { ru: string; uz: string }> = {
    tashkent_city: { ru: 'Ташкент (город)', uz: 'Toshkent shahri' },
    tashkent: { ru: 'Ташкентская обл.', uz: 'Toshkent viloyati' },
    andijan: { ru: 'Андижан', uz: 'Andijon' },
    bukhara: { ru: 'Бухара', uz: 'Buxoro' },
    fergana: { ru: 'Фергана/Коканд', uz: "Farg'ona/Qo'qon" },
    jizzakh: { ru: 'Джизак', uz: 'Jizzax' },
    namangan: { ru: 'Наманган', uz: 'Namangan' },
    navoi: { ru: 'Навои', uz: 'Navoiy' },
    kashkadarya: { ru: 'Кашкадарья/Карши/Шахрисабз', uz: 'Qashqadaryo/Qarshi/Shahrisabz' },
    samarkand: { ru: 'Самарканд', uz: 'Samarqand' },
    sirdarya: { ru: 'Сырдарья/Гулистан', uz: 'Sirdaryo/Guliston' },
    surkhandarya: { ru: 'Сурхандарья/Термез/Денов', uz: 'Surxondaryo/Termiz/Denov' },
    karakalpakstan: { ru: 'Каракалпакстан/Нукус', uz: "Qoraqalpog'iston/Nukus" },
    khorezm: { ru: 'Хорезм/Ургенч/Хива', uz: 'Xorazm/Urganch/Xiva' },
  };
  const AI_REGION_VALUES = Object.keys(AI_REGION_MAP);
  const AI_TRANSPORT_MAP: Record<string, { ru: string; uz: string }> = {
    labo: { ru: 'Лабо', uz: 'Labo' },
    bongo: { ru: 'Бонго', uz: 'Bongo' },
    furgon: { ru: 'Фургон', uz: 'Furgon' },
    isuzu5: { ru: 'ISUZU до 5т', uz: 'ISUZU 5t gacha' },
    isuzu10: { ru: 'ISUZU до 10т', uz: 'ISUZU 10t gacha' },
    gruzovik: { ru: 'Грузовик', uz: 'Yuk mashinasi' },
    fura_tent: { ru: 'Фура Тент', uz: 'Fura Tent' },
    fura_ref: { ru: 'Фура Реф/Рефрижератор', uz: 'Fura Ref' },
    paravoz: { ru: 'Паравоз/Тягач', uz: 'Paravoz' },
    shalanda: { ru: 'Шаланда', uz: 'Shalanda' },
    traller: { ru: 'Траллер', uz: 'Traller' },
    tonar: { ru: 'Тонар', uz: 'Tonar' },
    benzovoz: { ru: 'Бензовоз/Цистерна', uz: 'Benzovoz' },
    konteynerovoz: { ru: 'Контейнеровоз', uz: 'Konteynerovoz' },
    other: { ru: 'Прочие', uz: 'Boshqalar' },
  };
  const AI_TRANSPORT_VALUES = Object.keys(AI_TRANSPORT_MAP);

  // POST /api/ai/voice-announcement — multi-turn dispatcher chat → structured announcements
  // No auth required; IP rate-limited: 15 req/min per IP
  app.post('/api/ai/voice-announcement', async (req: Request, res: Response) => {
    try {
      if (!_aiRl(req, 'voice-ann', 15)) return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
      const ai = getAiClient();
      if (!ai) return res.status(503).json({ error: 'AI service not configured' });
      const { message, history = [], language = 'ru', userPhone = '' } = req.body;
      if (!message || typeof message !== 'string' || message.trim().length < 2) {
        return res.status(400).json({ error: 'Message is too short' });
      }
      const now = new Date();
      const todayISO = now.toISOString().slice(0, 10);
      const todayRu = now.toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric' });

      const regionListDetailed = AI_REGION_VALUES
        .map(v => `  ${v} = ${AI_REGION_MAP[v].ru} / ${AI_REGION_MAP[v].uz}`)
        .join('\n');
      const transportListDetailed = AI_TRANSPORT_VALUES
        .map(v => `  ${v} = ${AI_TRANSPORT_MAP[v].ru} / ${AI_TRANSPORT_MAP[v].uz}`)
        .join('\n');
      const replyLang = language === 'uz' ? 'uzbek' : 'russian';
      const replyLangUpper = replyLang === 'uzbek' ? 'UZBEK' : 'RUSSIAN';
      const weightQ = replyLang === 'uzbek' ? 'Yukning og\'irligi necha tonna?' : 'Какой вес груза (в тоннах)?';
      const confirmQ = replyLang === 'uzbek' ? 'Tasdiqlaysizmi?' : 'Подтверждаете?';
      const systemPrompt = `You are a freight dispatcher assistant for Uzbekistan. Parse cargo descriptions and return structured JSON data. Always write the "reply" field in ${replyLangUpper} language only.

The dispatcher writes in ${replyLang === 'uzbek' ? 'Uzbek' : 'Russian'}. They may describe ONE or MULTIPLE cargo routes at once.

REGIONS — use ONLY these enum values for originRegion/destinationRegion:
${regionListDetailed}

TRANSPORT TYPES — use ONLY these enum values for transportType:
${transportListDetailed}

Today: ${todayRu} (ISO: ${todayISO})
User phone: ${userPhone || 'unknown'}

CITY DISAMBIGUATION (CRITICAL — apply before all other rules):
- "Тошкент" / "Ташкент" alone (no qualifier) = tashkent_city (THE CITY of Tashkent)
- "Тошкент вилояти" / "Ташкентская область" / "Ташкентская обл." = tashkent (THE REGION)
- "Toshkent" alone (no qualifier) = tashkent_city
- "Toshkent viloyati" / "Toshkent oblasti" = tashkent

RULES:
1. Extract all cargo routes from the message. Each route = one announcement object.
2. For contactPhone: use "${userPhone || ''}" if user didn't specify a different phone.
3. REQUIRED fields (all must be non-empty for ready=true): originRegion, destinationRegion, transportType, vehicleCount, contactPhone.
4. OPTIONAL (set null if not mentioned — server keeps empty, does NOT fill defaults): weightTons, loadDate, loadingTime, paymentTypes, price.
5. Fill optional fields ONLY if dispatcher explicitly mentioned them, otherwise set null. NEVER guess or assume values (especially for weightTons — do NOT put 1 or any number if user didn't say).
6. WEIGHT CLARIFICATION RULE:
   - Look at the conversation history. If the user has NOT mentioned cargo weight in ANY message so far AND there is no previous assistant message that already asked about weight → add "weightTons" to "missing" and ask for it in your reply.
   - If you already asked about weight in a previous assistant turn and the user still hasn't provided it → set weightTons=null, remove "weightTons" from "missing", allow ready=true. Do NOT ask about weight a second time.
7. TRANSPORT TYPE CLARIFICATION RULE:
   - NEVER guess or assume a transport type. Only use what the user explicitly said.
   - If the user has NOT mentioned transport type in ANY message so far AND no previous assistant message already asked about it → add "transportType" to "missing" and ask the user which transport type they need.
   - If you already asked about transport type in a previous assistant turn and the user still hasn't provided it OR says they don't know → set transportType="other", remove "transportType" from "missing", allow ready=true. Do NOT ask a second time.
8. DISTRICTS RULE:
   - If the user mentions a specific district/rayon name (e.g. "Чиланзар", "Сергели", "Мирзо-Улугбек", "Yunusobod", "Bektemir", "Mirzo Ulugbek" etc.), populate originDistrict or destinationDistrict as a single-element array with that district name exactly as the user said it.
   - If no district mentioned, set originDistrict=[] and destinationDistrict=[].
9. Title format: "CityFrom→CityTo TransportType xCount" in Russian (e.g. "Ташкент→Карши tent-fura x2").
10. NOTES FIELD: Extract any additional cargo details into the "notes" field. This includes (but is not limited to): fragility requirements (e.g. "хрупкий", "mo'rt"), temperature requirements (e.g. "рефрижератор нужен", "сovuq"), special handling instructions, specific loading/unloading conditions, hazardous materials warnings, oversized cargo details, required permits, extra contact info, or any other detail the dispatcher mentioned that doesn't fit other fields. If the user mentioned nothing extra, set notes="".
11. "missing" array: list what's still needed for ready=true (leave empty [] if all required fields are filled).
12. The "reply" field is MANDATORY and must NEVER be empty. Write a short, natural conversational reply in ${replyLangUpper} language that:
   - Confirms what you understood
   - If missing fields: asks for them specifically (weight question: ask simply like "${weightQ}")
   - If all filled (ready=true): confirms the details and asks "${confirmQ}"

Respond with this exact JSON structure:
{
  "announcements": [
    {
      "title": "Ташкент→Карши tent-fura x2",
      "originRegion": "tashkent_city",
      "originDistrict": [],
      "destinationRegion": "kashkadarya",
      "destinationDistrict": [],
      "transportType": "tent",
      "vehicleCount": 2,
      "weightTons": null,
      "loadDate": "${todayISO}",
      "loadingTime": null,
      "price": null,
      "paymentTypes": null,
      "notes": "",
      "contactPhone": "${userPhone || ''}"
    }
  ],
  "missing": [],
  "reply": "${replyLang === 'uzbek' ? 'Tushundim: Toshkentdan Qarshiga 2 tent-fura. Tasdiqlaysizmi?' : 'Понял: из Ташкента в Карши 2 tent-фуры. Подтверждаете?'}"
}`;

      const historyMsgs = Array.isArray(history)
        ? (history as any[])
            .filter((m: any) => m.role === 'user' || m.role === 'assistant')
            .slice(-10)
            .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: String(m.content || '') }))
        : [];

      const completion = await ai.client.chat.completions.create({
        model: ai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyMsgs,
          { role: 'user', content: message },
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const rawContent = completion.choices[0]?.message?.content || '{}';
      let parsed: any;
      try { parsed = JSON.parse(rawContent); } catch {
        return res.status(500).json({ error: 'AI returned invalid JSON' });
      }

      const announcements = (parsed.announcements || []).map((a: any) => ({
        title: String(a.title || ''),
        originRegion: String(a.originRegion || ''),
        originDistrict: Array.isArray(a.originDistrict) ? a.originDistrict.map(String).filter(Boolean) : (a.originDistrict ? [String(a.originDistrict)] : []),
        destinationRegion: String(a.destinationRegion || ''),
        destinationDistrict: Array.isArray(a.destinationDistrict) ? a.destinationDistrict.map(String).filter(Boolean) : (a.destinationDistrict ? [String(a.destinationDistrict)] : []),
        transportType: String(a.transportType || ''),
        vehicleCount: Number(a.vehicleCount) || 1,
        weightTons: a.weightTons != null && Number(a.weightTons) > 0 ? String(a.weightTons) : null,
        loadDate: a.loadDate || todayISO,
        loadingTime: a.loadingTime || 'kun davomida',
        price: a.price != null ? String(a.price) : undefined,
        paymentTypes: Array.isArray(a.paymentTypes) && a.paymentTypes.length > 0 ? a.paymentTypes : ['cash'],
        notes: String(a.notes || ''),
        contactPhone: String(a.contactPhone || userPhone),
      }));

      // If AI flagged weightTons or transportType as still-missing, suppress ready=true so clarification turn happens first
      const weightStillMissing = Array.isArray(parsed.missing) && parsed.missing.includes('weightTons');
      const transportStillMissing = Array.isArray(parsed.missing) && parsed.missing.includes('transportType');
      const allRequiredFilled = !weightStillMissing && !transportStillMissing &&
        announcements.length > 0 &&
        (announcements as any[]).every((a: any) =>
          a.originRegion && a.destinationRegion && a.transportType &&
          Number(a.vehicleCount) > 0 && a.contactPhone
        );
      // Fallback reply if AI returned empty string
      let replyText = String(parsed.reply || '').trim();
      if (!replyText) {
        const missing = Array.isArray(parsed.missing) ? parsed.missing : [];
        if (announcements.length === 0) {
          replyText = language === 'uz'
            ? 'Kechirasiz, yuk ma\'lumotlarini tushunmadim. Marshrutni, transport turini va mashinalar sonini ayting.'
            : 'Не удалось распознать данные о грузе. Укажите маршрут, тип транспорта и количество машин.';
        } else if (missing.length > 0) {
          replyText = language === 'uz'
            ? `Tushundim. Yana kerak: ${missing.join(', ')}`
            : `Понял. Ещё нужно: ${missing.join(', ')}`;
        } else if (allRequiredFilled) {
          replyText = language === 'uz'
            ? 'Hammasi tayyor! Tasdiqlaysizmi?'
            : 'Всё готово! Подтверждаете?';
        } else {
          replyText = language === 'uz'
            ? 'Tushundim. Davom eting.'
            : 'Понял. Продолжайте.';
        }
      }
      res.json({
        announcements,
        missing: Array.isArray(parsed.missing) ? parsed.missing : [],
        reply: replyText,
        ready: allRequiredFilled,
      });
    } catch (err: any) {
      console.error('[AI VoiceAnnouncement]', err.message);
      res.status(500).json({ error: err.message || 'AI parsing failed' });
    }
  });

  // ── Chat: REST + WebSocket ─────────────────────────────────────────────────

  // In-memory state: roomId → connected WS clients, roomId → voice participant set
  const chatWsClients = new Map<number, Set<WebSocket>>();
  const chatVoiceParticipants = new Map<number, Map<string, { name: string }>>();

  function broadcastChatRoom(roomId: number, payload: object) {
    const clients = chatWsClients.get(roomId);
    if (!clients) return;
    const json = JSON.stringify(payload);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(json);
    }
  }

  // GET /api/chat/rooms — list active rooms (no auth)
  app.get('/api/chat/rooms', async (req: Request, res: Response) => {
    try {
      const rooms = await db.execute(sql`
        SELECT id, name_ru, name_uz, slug, sort_order, is_active, created_at, updated_at
        FROM chat_rooms
        WHERE is_active = true
        ORDER BY sort_order ASC, id ASC
      `);
      const rows = (rooms.rows as any[]).map(r => ({
        id: r.id,
        nameRu: r.name_ru,
        nameUz: r.name_uz,
        slug: r.slug,
        sortOrder: r.sort_order,
        isActive: r.is_active,
        voiceParticipantCount: chatVoiceParticipants.get(Number(r.id))?.size ?? 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/chat/rooms/stats — message counts per room (admin)
  app.get('/api/chat/rooms/stats', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const result = await db.execute(sql`
        SELECT
          r.id,
          r.name_ru AS "nameRu",
          r.name_uz AS "nameUz",
          r.slug,
          r.is_active AS "isActive",
          COUNT(m.id)::int AS "messageCount",
          MAX(m.created_at) AS "lastMessageAt",
          COUNT(m.id) FILTER (WHERE m.created_at >= NOW() - INTERVAL '7 days')::int AS "messagesLast7Days"
        FROM chat_rooms r
        LEFT JOIN chat_messages m ON m.room_id = r.id
        GROUP BY r.id, r.name_ru, r.name_uz, r.slug, r.is_active
        ORDER BY r.sort_order ASC, r.id ASC
      `);
      res.json(result.rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/chat/rooms/all — list all rooms including inactive (admin)
  app.get('/api/chat/rooms/all', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const rooms = await db.execute(sql`
        SELECT id, name_ru, name_uz, slug, sort_order, is_active, created_at, updated_at
        FROM chat_rooms ORDER BY sort_order ASC, id ASC
      `);
      res.json((rooms.rows as any[]).map(r => ({
        id: r.id, nameRu: r.name_ru, nameUz: r.name_uz, slug: r.slug,
        sortOrder: r.sort_order, isActive: r.is_active,
        createdAt: r.created_at, updatedAt: r.updated_at,
      })));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/chat/rooms — create room (admin)
  app.post('/api/chat/rooms', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const { nameRu, nameUz, slug, sortOrder, isActive } = req.body;
      if (!nameRu || !nameUz || !slug) return res.status(400).json({ error: 'nameRu, nameUz, slug required' });
      const result = await db.execute(sql`
        INSERT INTO chat_rooms (name_ru, name_uz, slug, sort_order, is_active)
        VALUES (${nameRu}, ${nameUz}, ${slug}, ${sortOrder ?? 0}, ${isActive !== false})
        RETURNING id, name_ru, name_uz, slug, sort_order, is_active, created_at, updated_at
      `);
      const r = (result.rows as any[])[0];
      res.json({ id: r.id, nameRu: r.name_ru, nameUz: r.name_uz, slug: r.slug, sortOrder: r.sort_order, isActive: r.is_active });
    } catch (err: any) {
      if (String(err.message).includes('unique') || String(err.message).includes('duplicate')) {
        return res.status(400).json({ error: 'Slug already exists' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/chat/rooms/:id — update room (admin)
  app.put('/api/chat/rooms/:id', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { nameRu, nameUz, slug, sortOrder, isActive } = req.body;
      await db.execute(sql`
        UPDATE chat_rooms
        SET name_ru = COALESCE(${nameRu ?? null}, name_ru),
            name_uz = COALESCE(${nameUz ?? null}, name_uz),
            slug = COALESCE(${slug ?? null}, slug),
            sort_order = COALESCE(${sortOrder ?? null}, sort_order),
            is_active = COALESCE(${isActive ?? null}, is_active),
            updated_at = NOW()
        WHERE id = ${id}
      `);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/chat/rooms/:id — delete room (admin)
  app.delete('/api/chat/rooms/:id', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await db.execute(sql`DELETE FROM chat_rooms WHERE id = ${id}`);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/chat/rooms/:id/messages — last 50 messages (no auth)
  app.get('/api/chat/rooms/:id/messages', async (req: Request, res: Response) => {
    try {
      const roomId = parseInt(req.params.id);
      const result = await db.execute(sql`
        SELECT id, room_id, author_name, user_id, text, flagged, created_at
        FROM chat_messages
        WHERE room_id = ${roomId}
        ORDER BY created_at DESC
        LIMIT 50
      `);
      const rows = (result.rows as any[]).reverse().map(r => ({
        id: r.id,
        roomId: r.room_id,
        authorName: r.author_name,
        userId: r.user_id,
        text: r.text,
        flagged: r.flagged,
        createdAt: r.created_at,
      }));
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/chat/rooms/:id/messages — post message (no auth required)
  app.post('/api/chat/rooms/:id/messages', async (req: AuthRequest, res: Response) => {
    try {
      const roomId = parseInt(req.params.id);
      let { text, authorName } = req.body;

      // Validate room exists
      const roomCheck = await db.execute(sql`SELECT id FROM chat_rooms WHERE id = ${roomId} AND is_active = true`);
      if ((roomCheck.rows as any[]).length === 0) return res.status(404).json({ error: 'Room not found' });

      // Sanitize
      const cleanText = sanitizeTextInput(text);
      if (!cleanText || cleanText.length < 1) return res.status(400).json({ error: 'text is required' });
      if (cleanText.length > 500) return res.status(400).json({ error: 'Message too long (max 500)' });

      const cleanAuthor = sanitizeTextInput(authorName) || 'Guest';

      // Try to get userId from token if provided (optional)
      let userId: number | null = null;
      try {
        const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
        if (token) {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          userId = decoded.id;
        }
      } catch {}

      const result = await db.execute(sql`
        INSERT INTO chat_messages (room_id, author_name, user_id, text)
        VALUES (${roomId}, ${cleanAuthor}, ${userId}, ${cleanText})
        RETURNING id, room_id, author_name, user_id, text, created_at
      `);
      const msg = (result.rows as any[])[0];
      const msgObj = {
        id: msg.id, roomId: msg.room_id, authorName: msg.author_name,
        userId: msg.user_id, text: msg.text, createdAt: msg.created_at,
      };

      // Broadcast to all WebSocket clients in this room
      broadcastChatRoom(roomId, { type: 'message', ...msgObj });
      res.json(msgObj);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // IP-based rate limiter for voice token endpoint (5 tokens per minute per IP)
  const voiceTokenHits = new Map<string, { count: number; resetAt: number }>();
  const VOICE_TOKEN_LIMIT = 5;
  const VOICE_TOKEN_WINDOW_MS = 60_000;

  function voiceTokenRateLimit(req: Request, res: Response, next: () => void) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = voiceTokenHits.get(ip);
    if (!entry || now > entry.resetAt) {
      voiceTokenHits.set(ip, { count: 1, resetAt: now + VOICE_TOKEN_WINDOW_MS });
      return next();
    }
    if (entry.count >= VOICE_TOKEN_LIMIT) {
      return res.status(429).json({ error: 'Too many voice token requests. Try again in a minute.' });
    }
    entry.count++;
    return next();
  }

  // GET /api/chat/rooms/:id/voice-token — get Livekit JWT (rate-limited, identity validated)
  app.get('/api/chat/rooms/:id/voice-token', voiceTokenRateLimit, async (req: Request, res: Response) => {
    const livekitUrl = process.env.LIVEKIT_URL;
    const livekitApiKey = process.env.LIVEKIT_API_KEY;
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET;

    if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
      return res.status(503).json({ error: 'Voice chat is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.' });
    }

    const roomId = parseInt(req.params.id);
    if (isNaN(roomId) || roomId <= 0) return res.status(400).json({ error: 'Invalid roomId' });

    // Verify the room exists and is active
    const roomCheck = await db.execute(sql`SELECT id FROM chat_rooms WHERE id = ${roomId} AND is_active = true`);
    if ((roomCheck.rows as any[]).length === 0) return res.status(404).json({ error: 'Room not found' });

    // Derive identity server-side from JWT if present; otherwise treat as guest
    let resolvedIdentity: string;
    let resolvedDisplayName: string;

    let sessionUserId: number | null = null;
    let sessionUserName: string | null = null;
    try {
      const token = (req as any).cookies?.token || req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        sessionUserId = decoded.id;
        // Fetch display name from DB
        const userRow = await db.execute(sql`SELECT first_name, last_name FROM users WHERE id = ${sessionUserId} LIMIT 1`);
        const u = (userRow.rows as any[])[0];
        if (u) sessionUserName = [u.first_name, u.last_name].filter(Boolean).join(' ') || null;
      }
    } catch {}

    if (sessionUserId) {
      // Authenticated — identity is locked to server-verified user ID
      resolvedIdentity = `user_${sessionUserId}`;
      resolvedDisplayName = sessionUserName || `User ${sessionUserId}`;
    } else {
      // Guest — identity must be guest_<number>, name comes from query param
      const { displayName } = req.query as { displayName?: string };
      const cleanName = String(displayName ?? '').slice(0, 50).trim();
      if (!cleanName) return res.status(400).json({ error: 'displayName is required for guest voice chat' });
      resolvedIdentity = `guest_${Date.now()}`;
      resolvedDisplayName = cleanName;
    }

    try {
      const { AccessToken } = await import('livekit-server-sdk');
      const at = new AccessToken(livekitApiKey, livekitApiSecret, {
        identity: resolvedIdentity,
        name: resolvedDisplayName,
      });
      at.addGrant({
        roomJoin: true,
        room: `yukbozor-chat-${roomId}`,
        canPublish: true,
        canSubscribe: true,
      });
      const token = await at.toJwt();
      res.json({ token, url: livekitUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/chat/livekit-webhook — LiveKit webhook for voice participant events
  app.post('/api/chat/livekit-webhook', async (req: Request, res: Response) => {
    const livekitApiKey = process.env.LIVEKIT_API_KEY;
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET;
    if (!livekitApiKey || !livekitApiSecret) return res.sendStatus(503);

    try {
      const { WebhookReceiver } = await import('livekit-server-sdk');
      const receiver = new WebhookReceiver(livekitApiKey, livekitApiSecret);
      const authHeader = req.headers['authorization'] as string | undefined;
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const event = await receiver.receive(rawBody, authHeader);

      const roomName: string = (event as any).room?.name || '';
      const match = roomName.match(/^yukbozor-chat-(\d+)$/);
      if (!match) return res.sendStatus(200);
      const chatRoomId = parseInt(match[1]);

      const eventType: string = (event as any).event || '';
      const participant = (event as any).participant;
      const identity: string = participant?.identity || '';
      const name: string = participant?.name || identity;

      if (eventType === 'participant_joined') {
        if (!chatVoiceParticipants.has(chatRoomId)) {
          chatVoiceParticipants.set(chatRoomId, new Map());
        }
        chatVoiceParticipants.get(chatRoomId)!.set(identity, { name });
      } else if (eventType === 'participant_left') {
        chatVoiceParticipants.get(chatRoomId)?.delete(identity);
      }

      // Broadcast updated participant list to all WS clients in this chat room
      const pMap = chatVoiceParticipants.get(chatRoomId) ?? new Map();
      const participants = Array.from(pMap.entries()).map(([id, info]) => ({
        identity: id,
        name: info.name,
        isMuted: false,
        isSpeaking: false,
      }));
      broadcastChatRoom(chatRoomId, { type: 'voice_participants', participants });

      res.sendStatus(200);
    } catch (err: any) {
      console.error('[livekit-webhook]', err?.message);
      res.sendStatus(400);
    }
  });

  // DELETE /api/chat/messages/:id — delete a message (admin only)
  app.delete('/api/chat/messages/:id', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const result = await db.execute(sql`
        DELETE FROM chat_messages WHERE id = ${id} RETURNING room_id
      `);
      const row = (result.rows as any[])[0];
      if (row) {
        broadcastChatRoom(Number(row.room_id), { type: 'message_deleted', id });
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/chat/messages/:id/flag — toggle flagged state (admin only)
  app.post('/api/chat/messages/:id/flag', authenticate, authorize('admin'), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const result = await db.execute(sql`
        UPDATE chat_messages
        SET flagged = NOT flagged
        WHERE id = ${id}
        RETURNING id, flagged, room_id
      `);
      const row = (result.rows as any[])[0];
      if (!row) return res.status(404).json({ error: 'Message not found' });
      res.json({ ok: true, flagged: row.flagged });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────

  const httpServer = createServer(app);

  // ── Chat WebSocket ─────────────────────────────────────────────────────────
  const chatWss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      if (url.pathname === '/api/chat/ws') {
        chatWss.handleUpgrade(req, socket as any, head, (ws) => {
          chatWss.emit('connection', ws, req);
        });
      }
      // All other upgrade paths (e.g. Vite HMR) are left alone — do NOT destroy
    } catch {
      // ignore parse errors; let the socket live
    }
  });

  chatWss.on('connection', (ws: WebSocket, req: any) => {
    let roomId = 0;
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      roomId = parseInt(url.searchParams.get('roomId') ?? '0');
    } catch {}

    if (!roomId) { ws.close(); return; }

    if (!chatWsClients.has(roomId)) chatWsClients.set(roomId, new Set());
    chatWsClients.get(roomId)!.add(ws);

    ws.on('close', () => {
      chatWsClients.get(roomId)?.delete(ws);
      if (chatWsClients.get(roomId)?.size === 0) chatWsClients.delete(roomId);
    });

    ws.on('error', () => {
      chatWsClients.get(roomId)?.delete(ws);
    });
  });
  // ─────────────────────────────────────────────────────────────────────────────
  
  startOrderExpiryProcessor();
  startPhoneChangeProcessor();
  startAuthListener();
  startTelegramSourceListener();
  startBroadcastScheduler();
  startPromoScheduler();
  startBotAnnouncementCloser();
  startChatCleanupProcessor();
  
  return httpServer;
}
