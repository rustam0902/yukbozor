# Yukbor.uz - Cargo Transportation Platform

## Overview
Yukbor.uz is a B2B marketplace platform for cargo transportation in Uzbekistan. It connects customers with shipping needs to carriers, streamlining order management, offer submissions, contract generation, and financial workflows. The platform features a multi-role authentication system with role-based access control, a commission-based partner system, and a robust multi-account deposit system. The primary goal is to establish a transparent and efficient marketplace for transportation services in Uzbekistan.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The frontend is developed using React 18, TypeScript, and Vite. Styling is based on Tailwind CSS with shadcn/ui components, adhering to a Material Design-inspired B2B aesthetic. It incorporates reusable UI components, role-specific layouts, and persistent dual-language support for Russian and Uzbek. The mobile application utilizes React Native with Expo, providing distinct tab layouts and navigation flows for different user roles. The mobile app also supports a guest mode where users can browse public announcements and orders without logging in.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Vite, Wouter, TanStack Query, Tailwind CSS, shadcn/ui.
- **Backend**: Node.js, Express.js, TypeScript, RESTful API.
- **Database**: PostgreSQL (Neon Serverless) with Drizzle ORM, using `numeric(15,2)` for monetary values.
- **Authentication**: JWT-based authentication (httpOnly cookies), `bcryptjs` for password hashing, and role-based authorization. Mobile app includes biometric authentication and secure token storage.
- **Mobile**: React Native (Expo) for cross-platform Android/iOS.
- **Internationalization**: Full bilingual support for Russian and Uzbek.
- **SEO & PWA**: Comprehensive SEO with meta tags, Open Graph, Twitter Cards, JSON-LD, sitemap, and PWA support with network-first caching.

### Feature Specifications
- **Multi-Role System**: Supports Customer, Carrier, and Partner roles with dynamic switching.
- **Order Management**: Comprehensive order creation with multiple points, cargo details, VAT-aware pricing, templates, and automatic `priceWithoutVat` calculation.
- **Financial System**: Multi-account deposit system for atomic transactions, collateral blocking (2% from both parties), prepayment management, and a carrier registration bonus. Supports various transaction types and account types (main, blocked, in_transit, partner_reward, registration_bonus).
- **Contract Management**: DOCX contract generation in Russian or Uzbek, with automated binding via public offer acceptance (E-IMZO for legal entities/IPs, SMS for individuals). Supports contract termination with a three-tier penalty system.
- **Partner Referral Program**: Partners earn 0.6% commission on platform fees, with self-referral prevention.
- **Digital Signatures**: Integration with E-IMZO for legally-binding electronic document signatures (PKCS#7) with certificate type detection for account access.
- **User Registration**: Simplified 4-5 step wizard. No INN/PINFL/E-IMZO/bank fields at signup — added later in Profile.
- **Rating System**: Dual-role rating (Customer/Carrier) with 1-5 stars and comments.
- **Notifications**: Dual-channel notification system (SMS and in-app) with per-type user settings, including Telegram notifications.
- **Electronic Document Management**: Integration for invoices and waybills, including auto-prefill from contract data and company data lookup by TIN/INN.
- **Representatives System**: Legal entities/IPs can delegate order and contract management to individual representatives with granular permissions (create_order, edit_own_orders, delete_own_orders, accept_offer, pay_contract, send_waybill).
- **Announcements Feature**: Simplified cargo posting system for individual customers, accessible to carriers without login. Public announcements and orders visible in guest mode. Supports up to 5 cargo photos per announcement/order, uploaded via mobile (expo-image-picker), stored on server filesystem (`uploads/<userId>/`), served as static files at `/uploads/*`. Camera icon shown on cards when photos exist.
- **File Upload**: `POST /api/upload` endpoint (auth required), multer-based, accepts up to 5 `image/*` files (10 MB each), returns `{ urls: string[] }`. Files stored at `uploads/<userId>/<uuid>.<ext>`, served via serve-static at `/uploads`.
- **SMS Verification**: 6-digit OTP codes with rate limiting.
- **Telegram Authentication**: Login and registration via Telegram bot (`@Yukbozor_orders_bot`). Flow: app generates a token → user opens deep link `tg://resolve?domain=BOTNAME&start=TOKEN` → bot confirms identity → app polls `GET /api/auth/telegram/poll/:token` → JWT issued. If no account found, navigates to RegisterScreen with Telegram data pre-filled. `telegramId` stored on users table.
- **Telegram Bot AI Features** (admin-managed, prod-only polling):
  - **AI sources** (`channelType=ai_source`): announcements bot polls configured Telegram groups, dedups via `telegram_processed_updates`, parses free-text cargo posts using OpenAI `gpt-4o-mini` (Replit AI Integrations — billed via Replit credits, no separate API key), and creates `announcements` rows with `createdByBot=true` owned by ADMIN_PHONE user.
  - **Broadcast scheduler** (`channelType=broadcast`): every 60s pushes the list of open announcements to broadcast channels at configurable interval/active hours (Tashkent UTC+5).
  - **Promo scheduler** (`channelType=promo`): round-robins admin-managed promo message templates (RU + UZ in one post) into promo channels at configurable interval/hours.
  - **Bot announcement closer**: every 5 minutes auto-closes bot-created announcements older than 2 hours.
  - All managed in Admin → Telegram Channels (5 sub-sections + Promo Messages CRUD).
- **Push Notifications** (Expo Push API, production):
  - `push_tokens` table stores Expo push tokens with optional filter prefs (`origin_region`, `destination_region`, `transport_type`).
  - Token with null filter = receives all new announcements; set filter = receives only matching ones.
  - `notifyNewAnnouncement` called after every new announcement (manual via API + bot-created via Telegram listener).
  - Mobile: `usePushNotifications` hook requests permission, registers token with server; `PushNotificationBanner` one-time onboarding card; re-registration on filter change from CargoListScreen.
  - API endpoints: `POST /api/push/register` (no auth, works for guests), `DELETE /api/push/unregister`.

## External Dependencies

- **Database Service**: Neon Serverless PostgreSQL
- **UI Libraries**: Radix UI, shadcn/ui
- **Styling Framework**: Tailwind CSS
- **Form Management**: `react-hook-form`, `zod`, `drizzle-zod`
- **Authentication**: `jsonwebtoken`, `bcryptjs`, `cookie-parser`
- **SEO**: `react-helmet-async`
- **SMS Provider**: Play Mobile SMS-Broker
- **Digital Signatures**: E-IMZO Server
- **Electronic Document Management**: Didox.uz API
- **Build Tools**: Vite, `tsx`, `esbuild`
- **Mobile Development**: React Native, Expo, React Navigation