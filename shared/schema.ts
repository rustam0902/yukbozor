import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, pgEnum, numeric, serial, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Location point schema for multiple origin/destination support
export const locationPointSchema = z.object({
  region: z.string().min(1),
  districts: z.array(z.string().min(1)).min(1),
});

export type LocationPoint = z.infer<typeof locationPointSchema>;

export const userRoleEnum = pgEnum('user_role', ['customer', 'carrier', 'partner', 'admin']);
export const userTypeEnum = pgEnum('user_type', ['legal', 'ip', 'individual']);
export const orderStatusEnum = pgEnum('order_status', ['new', 'assigned', 'completed', 'cancelled']);
export const offerStatusEnum = pgEnum('offer_status', ['active', 'withdrawn', 'accepted', 'rejected']);
export const depositAccountTypeEnum = pgEnum('deposit_account_type', ['main', 'blocked', 'in_transit', 'partner_reward', 'registration_bonus']);
export const depositTransactionTypeEnum = pgEnum('deposit_transaction_type', [
  'topup', 'block', 'unblock', 'charge_for_service', 'withdrawal_request', 'withdrawal_completed',
  'escrow_block', 'escrow_release', 'escrow_refund', 'transfer_out', 'transfer_in', 'registration_bonus'
]);
export const depositTransactionStatusEnum = pgEnum('deposit_transaction_status', ['pending', 'completed', 'cancelled']);
export const partnerTypeEnum = pgEnum('partner_type', ['registration_agent', 'permanent_agent']);
export const commissionStatusEnum = pgEnum('commission_status', ['calculated', 'pending', 'paid']);
export const paymentTermsEnum = pgEnum('payment_terms', ['transfer', 'card', 'cash']);
export const transportTypeEnum = pgEnum('transport_type', [
  'labo', 'bongo', 'furgon', 'isuzu5', 'isuzu10', 'gruzovik', 
  'fura_tent', 'fura_ref', 'paravoz', 'shalanda', 'traller', 'tonar', 
  'benzovoz', 'konteynerovoz', 'other'
]);
export const contractStatusEnum = pgEnum('contract_status', [
  'draft', 'pending_customer_signature', 'pending_carrier_signature', 
  'signed_by_customer', 'signed_by_carrier', 'fully_signed',
  'awaiting_prepayment', 'prepayment_made', 'awaiting_completion_confirmation', 'closed',
  'termination_pending', 'terminated'
]);

export const terminationPenaltyTypeEnum = pgEnum('termination_penalty_type', [
  'penalty_customer', 'penalty_carrier', 'no_penalty'
]);

export const signatureMethodEnum = pgEnum('signature_method', ['eimzo', 'sms']);

export const withdrawalStatusEnum = pgEnum('withdrawal_status', ['pending', 'processing', 'completed', 'rejected']);

export const rewardStatementStatusEnum = pgEnum('reward_statement_status', ['draft', 'finalized', 'paid']);
export const rewardStatementItemStatusEnum = pgEnum('reward_statement_item_status', ['pending', 'paid', 'partial']);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  roles: userRoleEnum("roles").array().notNull(),
  defaultRole: userRoleEnum("default_role").notNull(),
  userType: userTypeEnum("user_type").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  verifiedAt: timestamp("verified_at"),
  displayName: text("display_name").notNull(),
  lastName: text("last_name"),
  firstName: text("first_name"),
  middleName: text("middle_name"),
  referredByPartnerId: integer("referred_by_partner_id"),
  customerRating: numeric("customer_rating", { precision: 3, scale: 2 }),
  customerRatingCount: integer("customer_rating_count").default(0),
  carrierRating: numeric("carrier_rating", { precision: 3, scale: 2 }),
  carrierRatingCount: integer("carrier_rating_count").default(0),
  telegramId: text("telegram_id").unique("users_telegram_id_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  companyName: text("company_name"),
  inn: text("inn"),
  pinfl: text("pinfl"),
  bankAccount: text("bank_account"),
  bankName: text("bank_name"),
  bankCode: text("bank_code"),
  ndsPayer: boolean("nds_payer").default(false),
  registrationCodeNds: text("registration_code_nds"),
  passportSeries: text("passport_series"),
  passportNumber: text("passport_number"),
  cardNumber: text("card_number"),
  cardExpiry: text("card_expiry"),
  // E-IMZO Certificate data for legal entities and IPs
  eimzoCertSerial: text("eimzo_cert_serial"),          // Certificate serial number
  eimzoCertIssuer: text("eimzo_cert_issuer"),          // Certificate issuer (CA)
  eimzoCertValidFrom: timestamp("eimzo_cert_valid_from"),
  eimzoCertValidTo: timestamp("eimzo_cert_valid_to"),
  eimzoCertCn: text("eimzo_cert_cn"),                  // Common Name from certificate
  eimzoCertO: text("eimzo_cert_o"),                    // Organization from certificate
  eimzoCertTin: text("eimzo_cert_tin"),                // TIN from certificate
  eimzoCertPinfl: text("eimzo_cert_pinfl"),            // PINFL from certificate
  // Offer acceptance (registration signature)
  offerAcceptedAt: timestamp("offer_accepted_at"),     // When user accepted the offer
  offerAcceptanceSignature: text("offer_acceptance_signature"), // PKCS#7 signature of offer acceptance
  offerAcceptanceHash: text("offer_acceptance_hash"), // SHA-256 hash of signed offer document
  offerVersion: text("offer_version"),                 // Version of accepted offer
});

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique("agents_user_id_unique"),
  referralCode: text("referral_code").notNull().unique("agents_referral_code_unique"),
  status: text("status").notNull().default('active'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const partnerClients = pgTable("partner_clients", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => partners.id).notNull(),
  clientId: integer("client_id").references(() => users.id).notNull().unique(),
  type: partnerTypeEnum("type").notNull(),
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id).notNull(),
  createdByUserId: integer("created_by_user_id").references(() => users.id), // User who created the order (representative or owner)
  title: text("title").notNull(),
  // Legacy single region/district fields (kept for backward compatibility)
  originRegion: text("origin_region").notNull(),
  originDistrict: text("origin_district").array().notNull(),
  destinationRegion: text("destination_region").notNull(),
  destinationDistrict: text("destination_district").array().notNull(),
  // New multi-point fields: array of {region, districts[]} objects
  originPoints: jsonb("origin_points").$type<LocationPoint[]>(),
  destinationPoints: jsonb("destination_points").$type<LocationPoint[]>(),
  transportType: transportTypeEnum("transport_type").notNull(),
  weightTons: numeric("weight_tons", { precision: 10, scale: 2 }).notNull(),
  loadDate: text("load_date").notNull(),
  loadingTime: text("loading_time").notNull(),
  priceWithVat: numeric("price_with_vat", { precision: 15, scale: 2 }).notNull(),
  priceWithoutVat: numeric("price_without_vat", { precision: 15, scale: 2 }),
  requiresCollateral: boolean("requires_collateral").default(false).notNull(),
  customerBlockedCollateral: numeric("customer_blocked_collateral", { precision: 15, scale: 2 }).default('0'),
  notes: text("notes"),
  isDangerous: boolean("is_dangerous").default(false).notNull(),
  isNonstandard: boolean("is_nonstandard").default(false).notNull(),
  isPartialLoad: boolean("is_partial_load").default(false).notNull(),
  status: orderStatusEnum("status").default('new').notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  extensionCount: integer("extension_count").default(0).notNull(),
  // URLs of uploaded cargo photos (stored on server filesystem)
  photoUrls: text("photo_urls").array().notNull().default([]),
});

export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  carrierId: integer("carrier_id").references(() => users.id).notNull(),
  price: numeric("price", { precision: 15, scale: 2 }).notNull(),
  priceWithoutVat: numeric("price_without_vat", { precision: 15, scale: 2 }).notNull(),
  blockedAmount: numeric("blocked_amount", { precision: 15, scale: 2 }).notNull(),
  blockedCommissionAmount: numeric("blocked_commission_amount", { precision: 15, scale: 2 }).default('0').notNull(),
  commissionSourceAccount: text("commission_source_account").default('main').notNull(), // 'main' or 'registration_bonus'
  status: offerStatusEnum("status").default('active').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull().unique(),
  customerId: integer("customer_id").references(() => users.id).notNull(),
  carrierId: integer("carrier_id").references(() => users.id).notNull(),
  contractDocPath: text("contract_doc_path"),
  contractDocDocxPath: text("contract_doc_docx_path"),
  status: contractStatusEnum("status").notNull().default('draft'),
  documentHash: text("document_hash"),      // SHA-256 hash of contract content
  contractContent: text("contract_content"),
  customerSignature: text("customer_signature"),
  carrierSignature: text("carrier_signature"),
  customerSignerInfo: text("customer_signer_info"),
  carrierSignerInfo: text("carrier_signer_info"),
  customerSignedAt: timestamp("customer_signed_at"),
  carrierSignedAt: timestamp("carrier_signed_at"),
  customerSignatureMethod: signatureMethodEnum("customer_signature_method"),
  carrierSignatureMethod: signatureMethodEnum("carrier_signature_method"),
  customerSmsEvidence: jsonb("customer_sms_evidence"),
  carrierSmsEvidence: jsonb("carrier_sms_evidence"),
  // Certificate binding - links contract to registered E-IMZO certificate
  customerCertSerial: text("customer_cert_serial"),   // Customer's certificate serial at signing
  customerCertCn: text("customer_cert_cn"),           // Customer's certificate CN
  carrierCertSerial: text("carrier_cert_serial"),     // Carrier's certificate serial at signing
  carrierCertCn: text("carrier_cert_cn"),             // Carrier's certificate CN
  version: integer("version").notNull().default(1),
  terminationInitiatedBy: integer("termination_initiated_by").references(() => users.id),
  terminationPenaltyType: terminationPenaltyTypeEnum("termination_penalty_type"),
  terminationInitiatedAt: timestamp("termination_initiated_at"),
  terminationConfirmedAt: timestamp("termination_confirmed_at"),
  customerPrepaymentBlocked: numeric("customer_prepayment_blocked", { precision: 15, scale: 2 }).default('0'),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deposits = pgTable("deposits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accountType: depositAccountTypeEnum("account_type").notNull().default('main'),
  balance: numeric("balance", { precision: 15, scale: 2 }).default('0').notNull(),
  blocked: numeric("blocked", { precision: 15, scale: 2 }).default('0').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userAccountUnique: sql`UNIQUE (${table.userId}, ${table.accountType})`,
}));

export const depositTransactions = pgTable("deposit_transactions", {
  id: serial("id").primaryKey(),
  depositId: integer("deposit_id").references(() => deposits.id).notNull(),
  type: depositTransactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  reference: text("reference"),
  status: depositTransactionStatusEnum("status").default('pending').notNull(),
  withdrawalRequestId: integer("withdrawal_request_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Withdrawal requests - for users to withdraw funds from their accounts
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  sourceAccountType: depositAccountTypeEnum("source_account_type").notNull(), // main or partner_reward only
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  // Bank account details (for legal entities and IPs - copied from profile at time of request)
  bankAccount: text("bank_account"),
  bankName: text("bank_name"),
  bankCode: text("bank_code"),
  recipientInn: text("recipient_inn"),
  recipientPinfl: text("recipient_pinfl"),
  recipientName: text("recipient_name").notNull(),
  // Card details (for individuals only)
  cardNumber: text("card_number"), // Format: XXXX XXXX XXXX XXXX
  cardExpiry: text("card_expiry"), // Format: MM/YY
  // Verification
  verificationMethod: signatureMethodEnum("verification_method").notNull(),
  signaturePayload: text("signature_payload"), // PKCS#7 for E-IMZO or OTP token for SMS
  // Status and processing
  status: withdrawalStatusEnum("status").default('pending').notNull(),
  processedByAdminId: integer("processed_by_admin_id").references(() => users.id),
  processedAt: timestamp("processed_at"),
  rejectionReason: text("rejection_reason"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Partner reward statements - monthly statements for partner reward payouts
export const partnerRewardStatements = pgTable("partner_reward_statements", {
  id: serial("id").primaryKey(),
  periodMonth: text("period_month").notNull(), // Format: YYYY-MM
  status: rewardStatementStatusEnum("status").default('draft').notNull(),
  createdByAdminId: integer("created_by_admin_id").references(() => users.id).notNull(),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).default('0').notNull(),
  totalPaid: numeric("total_paid", { precision: 15, scale: 2 }).default('0').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  finalizedAt: timestamp("finalized_at"),
});

// Partner reward statement items - individual user entries in a statement
export const partnerRewardStatementItems = pgTable("partner_reward_statement_items", {
  id: serial("id").primaryKey(),
  statementId: integer("statement_id").references(() => partnerRewardStatements.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  // User info copied at statement creation time
  displayName: text("display_name").notNull(),
  userType: userTypeEnum("user_type").notNull(),
  inn: text("inn"),
  pinfl: text("pinfl"),
  bankAccount: text("bank_account"),
  bankName: text("bank_name"),
  bankCode: text("bank_code"),
  // Financial data
  openingBalance: numeric("opening_balance", { precision: 15, scale: 2 }).default('0').notNull(), // Сальдо на начало месяца
  accruedAmount: numeric("accrued_amount", { precision: 15, scale: 2 }).default('0').notNull(), // Начислено за месяц
  previousPaidAmount: numeric("previous_paid_amount", { precision: 15, scale: 2 }).default('0').notNull(), // Оплачено за предыдущие месяцы
  closingBalance: numeric("closing_balance", { precision: 15, scale: 2 }).default('0').notNull(), // Сальдо на конец месяца (к оплате)
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).default('0').notNull(), // Сумма оплачено (вводится вручную)
  status: rewardStatementItemStatusEnum("status").default('pending').notNull(),
  paidAt: timestamp("paid_at"),
  adminNote: text("admin_note"),
});

export const partnerCommissions = pgTable("partner_commissions", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => partners.id).notNull(),
  clientId: integer("client_id").references(() => users.id).notNull(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  periodMonth: text("period_month").notNull(),
  status: commissionStatusEnum("status").default('calculated').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ratedAsRoleEnum = pgEnum('rated_as_role', ['customer', 'carrier']);

export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").references(() => contracts.id).notNull(),
  fromUserId: integer("from_user_id").references(() => users.id).notNull(),
  toUserId: integer("to_user_id").references(() => users.id).notNull(),
  ratedAsRole: ratedAsRoleEnum("rated_as_role").notNull(),
  score: integer("score").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(),
  performedBy: integer("performed_by").references(() => users.id).notNull(),
  data: text("data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orderTemplates = pgTable("order_templates", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  // Legacy single region/district fields (kept for backward compatibility)
  originRegion: text("origin_region").notNull(),
  originDistrict: text("origin_district").array().notNull(),
  destinationRegion: text("destination_region").notNull(),
  destinationDistrict: text("destination_district").array().notNull(),
  // New multi-point fields
  originPoints: jsonb("origin_points").$type<LocationPoint[]>(),
  destinationPoints: jsonb("destination_points").$type<LocationPoint[]>(),
  transportType: transportTypeEnum("transport_type").notNull(),
  weightTons: numeric("weight_tons", { precision: 10, scale: 2 }).notNull(),
  loadDate: text("load_date"),
  loadingTime: text("loading_time"),
  priceWithVat: numeric("price_with_vat", { precision: 15, scale: 2 }).notNull(),
  requiresCollateral: boolean("requires_collateral").default(false).notNull(),
  notes: text("notes"),
  isDangerous: boolean("is_dangerous").default(false).notNull(),
  isNonstandard: boolean("is_nonstandard").default(false).notNull(),
  isPartialLoad: boolean("is_partial_load").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// SMS Verification codes for phone validation and SMS login
export const smsVerificationPurposeEnum = pgEnum('sms_verification_purpose', ['registration', 'login', 'phone_change', 'password_change', 'profile_edit', 'contract_sign']);

// Phone change request status
export const phoneChangeStatusEnum = pgEnum('phone_change_status', ['pending_verification', 'pending_cooldown', 'completed', 'cancelled', 'requires_support']);

export const smsVerifications = pgTable("sms_verifications", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  code: text("code").notNull(),
  purpose: smsVerificationPurposeEnum("purpose").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  verified: boolean("verified").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Phone change requests with cooling-off period
export const phoneChangeRequests = pgTable("phone_change_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  oldPhone: text("old_phone").notNull(),
  newPhone: text("new_phone").notNull(),
  status: phoneChangeStatusEnum("status").default('pending_verification').notNull(),
  hasOldPhoneAccess: boolean("has_old_phone_access").default(true).notNull(),
  oldPhoneVerified: boolean("old_phone_verified").default(false).notNull(),
  newPhoneVerified: boolean("new_phone_verified").default(false).notNull(),
  passwordVerified: boolean("password_verified").default(false).notNull(),
  cooldownEndsAt: timestamp("cooldown_ends_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Blacklist - customers can block carriers from submitting offers
export const blacklist = pgTable("blacklist", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id).notNull(),
  carrierId: integer("carrier_id").references(() => users.id).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  customerCarrierUnique: sql`UNIQUE (${table.customerId}, ${table.carrierId})`,
}));

// Telegram notifications - tracks messages sent to Telegram channel for order updates
export const telegramNotifications = pgTable("telegram_notifications", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id).notNull(),
  chatId: text("chat_id").notNull(),
  messageId: integer("message_id").notNull(),
  lastStatus: text("last_status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orderChatUnique: sql`UNIQUE (${table.orderId}, ${table.chatId})`,
}));

// Channel type for telegram channels
// orders/announcements: outbound channels where bot posts new orders/announcements
// ai_source: inbound groups where bot reads cargo posts and AI-parses them into announcements
// broadcast: outbound channels where bot periodically posts a digest of open cargo
// promo: outbound channels where bot periodically posts rotating promo messages
export const channelTypeEnum = pgEnum("channel_type", ["orders", "announcements", "ai_source", "broadcast", "promo"]);

// Telegram channels - stores channels where the bot sends order/announcement notifications
// or, for ai_source channels, reads incoming cargo posts.
export const telegramChannels = pgTable("telegram_channels", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  name: text("name").notNull(),
  channelType: channelTypeEnum("channel_type").default("orders").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  // Configurable interval for periodic broadcast/promo channels (minutes)
  intervalMinutes: integer("interval_minutes").default(5).notNull(),
  timezone: text("timezone").default('Asia/Tashkent').notNull(),
  // Active hours window (24h, channel local time treated as Asia/Tashkent UTC+5)
  activeHoursFrom: integer("active_hours_from").default(9).notNull(),
  activeHoursTo: integer("active_hours_to").default(21).notNull(),
  // Last time the scheduler sent a message to this channel
  lastSentAt: timestamp("last_sent_at"),
  // Persisted round-robin cursor for promo rotation (survives restarts)
  promoRotationIndex: integer("promo_rotation_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
  // For ai_source channels: Telegram user IDs or usernames to ignore (e.g. bots, admins)
  blockedUserIds: text("blocked_user_ids").array(),
}, (table) => ({
  chatIdTypeUnique: unique("telegram_channels_chat_id_channel_type_unique").on(table.chatId, table.channelType),
}));

// Promo messages used by promo-type channels. Bot rotates through active messages
// in displayOrder ascending order.
export const telegramPromoMessages = pgTable("telegram_promo_messages", {
  id: serial("id").primaryKey(),
  textRu: text("text_ru").notNull(),
  textUz: text("text_uz").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
});

// Dedup table for processed Telegram updates so AI parsing isn't re-run on
// duplicate deliveries from the polling bot.
export const telegramProcessedUpdates = pgTable("telegram_processed_updates", {
  updateId: text("update_id").primaryKey(), // composite "<chatId>:<messageId>"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reasons a Telegram source message was skipped / failed to be turned into an
// announcement by the AI source listener.
//   not_cargo     - AI parser decided the post is not a cargo offer
//   parser_error  - The parser threw / OpenAI call failed
//   insert_error  - Parsed OK but the announcement insert failed (DB error)
export const telegramSkippedReasonEnum = pgEnum("telegram_skipped_reason", [
  "not_cargo", "parser_error", "insert_error",
]);

// Stores Telegram messages from ai_source channels that were not converted
// into announcements, so admins can review what was skipped, clear or retry.
export const telegramSkippedMessages = pgTable("telegram_skipped_messages", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  chatTitle: text("chat_title"),
  messageId: integer("message_id").notNull(),
  text: text("text").notNull(),
  reason: telegramSkippedReasonEnum("reason").notNull(),
  errorDetail: text("error_detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  chatMessageUnique: unique("telegram_skipped_messages_chat_msg_unique").on(table.chatId, table.messageId),
}));

export type TelegramSkippedMessage = typeof telegramSkippedMessages.$inferSelect;
export type InsertTelegramSkippedMessage = typeof telegramSkippedMessages.$inferInsert;

// Tracks which announcements have been individually broadcast to each broadcast channel.
// Prevents re-sending the same announcement to the same channel on subsequent ticks.
export const telegramBroadcastLog = pgTable("telegram_broadcast_log", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").references(() => telegramChannels.id, { onDelete: 'cascade' }).notNull(),
  announcementId: integer("announcement_id").references(() => announcements.id, { onDelete: 'cascade' }).notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export type TelegramBroadcastLog = typeof telegramBroadcastLog.$inferSelect;

export type TelegramPromoMessage = typeof telegramPromoMessages.$inferSelect;
export type InsertTelegramPromoMessage = typeof telegramPromoMessages.$inferInsert;

// Telegram auth requests - temporary records for Telegram-based login/registration
export const telegramAuthRequests = pgTable("telegram_auth_requests", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique("telegram_auth_requests_token_key"),
  status: text("status").notNull().default("pending"), // pending | completed | not_registered | expired
  telegramId: text("telegram_id"),
  telegramUsername: text("telegram_username"),
  telegramFirstName: text("telegram_first_name"),
  telegramLastName: text("telegram_last_name"),
  userId: integer("user_id"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TelegramAuthRequest = typeof telegramAuthRequests.$inferSelect;
export type InsertTelegramAuthRequest = typeof telegramAuthRequests.$inferInsert;

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  verifiedAt: true,
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  status: true,
  customerId: true,
  deletedAt: true,
  priceWithoutVat: true,
}).extend({
  title: z.string().min(1, { message: 'Title is required' }),
  // Legacy fields - still required for backward compatibility
  originRegion: z.string().min(1, { message: 'Origin region is required' }),
  destinationRegion: z.string().min(1, { message: 'Destination region is required' }),
  originDistrict: z.array(z.string().min(1)).min(1, { message: 'At least one origin district is required' }),
  destinationDistrict: z.array(z.string().min(1)).min(1, { message: 'At least one destination district is required' }),
  // New multi-point fields
  originPoints: z.array(locationPointSchema).min(1).optional(),
  destinationPoints: z.array(locationPointSchema).min(1).optional(),
  weightTons: z.coerce.number().positive(),
  priceWithVat: z.coerce.number().positive(),
  loadDate: z.string().min(1, { message: 'Load date is required' }).refine((date) => {
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate >= today;
  }, { message: 'Load date cannot be in the past' }),
  loadingTime: z.string().min(1, { message: 'Loading time is required' }),
  photoUrls: z.array(z.string().url().or(z.string().startsWith('/'))).max(5).optional().default([]),
});

export const insertOfferSchema = createInsertSchema(offers).omit({
  id: true,
  createdAt: true,
  status: true,
  blockedAmount: true,
  carrierId: true,
}).extend({
  price: z.coerce.number().positive(),
  priceWithoutVat: z.coerce.number().nonnegative().optional(),
});

export const insertDepositTransactionSchema = createInsertSchema(depositTransactions).omit({
  id: true,
  createdAt: true,
}).extend({
  amount: z.coerce.number().positive(),
});

export const insertRatingSchema = createInsertSchema(ratings).omit({
  id: true,
  createdAt: true,
}).extend({
  score: z.coerce.number().int().min(1).max(5),
  ratedAsRole: z.enum(['customer', 'carrier']),
});

export const insertOrderTemplateSchema = createInsertSchema(orderTemplates).omit({
  id: true,
  createdAt: true,
  customerId: true,
}).extend({
  weightTons: z.coerce.number().positive(),
  priceWithVat: z.coerce.number().positive(),
  originDistrict: z.array(z.string()).min(1, { message: 'At least one origin district is required' }),
  destinationDistrict: z.array(z.string()).min(1, { message: 'At least one destination district is required' }),
  originPoints: z.array(locationPointSchema).min(1).optional(),
  destinationPoints: z.array(locationPointSchema).min(1).optional(),
  loadingTime: z.string().optional(),
  loadDate: z.string().optional(),
  notes: z.string().optional(),
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  generatedAt: true,
  updatedAt: true,
});

// Select types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Offer = typeof offers.$inferSelect;
export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Deposit = typeof deposits.$inferSelect;
export type DepositTransaction = typeof depositTransactions.$inferSelect;
export type InsertDepositTransaction = z.infer<typeof insertDepositTransactionSchema>;
export type Partner = typeof partners.$inferSelect;
export type PartnerClient = typeof partnerClients.$inferSelect;
export type PartnerCommission = typeof partnerCommissions.$inferSelect;
export type Rating = typeof ratings.$inferSelect;
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type OrderTemplate = typeof orderTemplates.$inferSelect;
export type InsertOrderTemplate = z.infer<typeof insertOrderTemplateSchema>;
export type SmsVerification = typeof smsVerifications.$inferSelect;
export type PhoneChangeRequest = typeof phoneChangeRequests.$inferSelect;
export type Blacklist = typeof blacklist.$inferSelect;
export type TelegramNotification = typeof telegramNotifications.$inferSelect;
export type TelegramChannel = typeof telegramChannels.$inferSelect;
export type InsertTelegramChannel = typeof telegramChannels.$inferInsert;

export const insertPhoneChangeRequestSchema = createInsertSchema(phoneChangeRequests).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  cancelledAt: true,
});
export type InsertPhoneChangeRequest = z.infer<typeof insertPhoneChangeRequestSchema>;

export const insertBlacklistSchema = createInsertSchema(blacklist).omit({
  id: true,
  createdAt: true,
});
export type InsertBlacklist = z.infer<typeof insertBlacklistSchema>;

export const insertWithdrawalRequestSchema = createInsertSchema(withdrawalRequests).omit({
  id: true,
  createdAt: true,
  processedAt: true,
  processedByAdminId: true,
  status: true,
}).extend({
  amount: z.coerce.number().int().positive(),
  sourceAccountType: z.enum(['main', 'partner_reward']), // Only these two allowed
});
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = z.infer<typeof insertWithdrawalRequestSchema>;

// Partner reward statements types
export type PartnerRewardStatement = typeof partnerRewardStatements.$inferSelect;
export type PartnerRewardStatementItem = typeof partnerRewardStatementItems.$inferSelect;

export const insertPartnerRewardStatementSchema = createInsertSchema(partnerRewardStatements).omit({
  id: true,
  createdAt: true,
  finalizedAt: true,
  totalAmount: true,
  totalPaid: true,
});
export type InsertPartnerRewardStatement = z.infer<typeof insertPartnerRewardStatementSchema>;

export const insertPartnerRewardStatementItemSchema = createInsertSchema(partnerRewardStatementItems).omit({
  id: true,
  paidAt: true,
});
export type InsertPartnerRewardStatementItem = z.infer<typeof insertPartnerRewardStatementItemSchema>;

// Notification types enum
export const notificationTypeEnum = pgEnum('notification_type', ['new_offer']);

// Notifications table - for in-app notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  orderId: integer("order_id").references(() => orders.id),
  offerId: integer("offer_id").references(() => offers.id),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User notification settings - per notification type, per channel
export const userNotificationSettings = pgTable("user_notification_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  notificationType: notificationTypeEnum("notification_type").notNull(),
  smsEnabled: boolean("sms_enabled").default(true).notNull(),
  inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  isRead: true,
});
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export const insertUserNotificationSettingSchema = createInsertSchema(userNotificationSettings).omit({
  id: true,
  updatedAt: true,
});
export type UserNotificationSetting = typeof userNotificationSettings.$inferSelect;
export type InsertUserNotificationSetting = z.infer<typeof insertUserNotificationSettingSchema>;

// Payment type enum for announcements
export const paymentTypeEnum = pgEnum('payment_type', ['cash', 'card', 'transfer']);

// Announcement status enum
export const announcementStatusEnum = pgEnum('announcement_status', ['new', 'active', 'closed', 'completed', 'cancelled']);

// Announcements table - for individual (physical) customers only
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  originRegions: text("origin_regions").array().notNull(), // Multiple regions array
  originDistrict: text("origin_district").array().notNull(),
  destinationRegions: text("destination_regions").array().notNull(), // Multiple regions array
  destinationDistrict: text("destination_district").array().notNull(),
  originPoints: jsonb("origin_points").$type<LocationPoint[]>(),
  destinationPoints: jsonb("destination_points").$type<LocationPoint[]>(),
  transportType: transportTypeEnum("transport_type").notNull(),
  vehicleCount: integer("vehicle_count").default(1).notNull(), // Number of vehicles
  weightTons: numeric("weight_tons", { precision: 10, scale: 2 }), // nullable — null means "not specified"
  loadDate: text("load_date").notNull(),
  loadingTime: text("loading_time").notNull(),
  price: numeric("price", { precision: 15, scale: 2 }),
  paymentTypes: text("payment_types").array().notNull(), // ['cash', 'card', 'transfer']
  contactPhone: text("contact_phone").notNull(),
  notes: text("notes"),
  isDangerous: boolean("is_dangerous").default(false).notNull(),
  isNonstandard: boolean("is_nonstandard").default(false).notNull(),
  isPartialLoad: boolean("is_partial_load").default(false).notNull(),
  status: announcementStatusEnum("status").default('new').notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  telegramMessageId: text("telegram_message_id"),
  telegramChatId: text("telegram_chat_id"),
  // True when this announcement was AI-parsed from an external Telegram group post.
  createdByBot: boolean("created_by_bot").default(false).notNull(),
  // Source ai_source chat id this announcement came from (for traceability).
  botSourceChatId: text("bot_source_chat_id"),
  // Telegram username of the original poster in the ai_source group.
  botSourceUsername: text("bot_source_username"),
  // Telegram message_id of the original post (used to build a direct link).
  botSourceMessageId: integer("bot_source_message_id"),
  // URLs of uploaded cargo photos (stored on server filesystem)
  photoUrls: text("photo_urls").array().notNull().default([]),
});

// Announcement templates for saving reusable configurations
export const announcementTemplates = pgTable("announcement_templates", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  title: text("title"),
  originRegions: text("origin_regions").array(), // Multiple regions array
  originDistrict: text("origin_district").array(),
  destinationRegions: text("destination_regions").array(), // Multiple regions array
  destinationDistrict: text("destination_district").array(),
  originPoints: jsonb("origin_points").$type<LocationPoint[]>(),
  destinationPoints: jsonb("destination_points").$type<LocationPoint[]>(),
  transportType: transportTypeEnum("transport_type"),
  vehicleCount: integer("vehicle_count").default(1), // Number of vehicles
  weightTons: numeric("weight_tons", { precision: 10, scale: 2 }),
  loadingTime: text("loading_time"),
  price: numeric("price", { precision: 15, scale: 2 }),
  paymentTypes: text("payment_types").array(),
  contactPhone: text("contact_phone"),
  notes: text("notes"),
  isDangerous: boolean("is_dangerous").default(false),
  isNonstandard: boolean("is_nonstandard").default(false),
  isPartialLoad: boolean("is_partial_load").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  deletedAt: true,
  expiresAt: true,
  status: true,
});
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

export const insertAnnouncementTemplateSchema = createInsertSchema(announcementTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AnnouncementTemplate = typeof announcementTemplates.$inferSelect;
export type InsertAnnouncementTemplate = z.infer<typeof insertAnnouncementTemplateSchema>;

// Didox document types
export const didoxDocTypeEnum = pgEnum('didox_doc_type', ['factura', 'waybill']);
export const didoxDocStatusEnum = pgEnum('didox_doc_status', [
  'draft',           // Черновик (0)
  'sent',            // Ожидает подписи партнера (1)
  'pending',         // Ожидает вашей подписи (2)
  'signed',          // Подписан (3)
  'rejected',        // Отказ от подписи (4)
  'deleted',         // Удален (5)
  'error'            // Ошибка при отправке
]);

// Didox user tokens - stores user authentication with Didox
export const didoxUserTokens = pgTable("didox_user_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  didoxToken: text("didox_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  taxId: varchar("tax_id", { length: 20 }).notNull(), // ИНН пользователя
  companyName: text("company_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Didox documents - stores sent/received documents
export const didoxDocuments = pgTable("didox_documents", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").references(() => contracts.id).notNull(),
  didoxDocId: text("didox_doc_id"), // ID документа в системе Didox
  docType: didoxDocTypeEnum("doc_type").notNull(),
  docNumber: varchar("doc_number", { length: 50 }),
  docDate: timestamp("doc_date").notNull(),
  
  // Sender info
  senderId: integer("sender_id").references(() => users.id).notNull(),
  senderTaxId: varchar("sender_tax_id", { length: 20 }).notNull(),
  senderName: text("sender_name").notNull(),
  
  // Receiver info
  receiverId: integer("receiver_id").references(() => users.id), // null if receiver is not platform user
  receiverTaxId: varchar("receiver_tax_id", { length: 20 }).notNull(),
  receiverName: text("receiver_name").notNull(),
  
  // Document content (JSON stored as Didox format)
  documentJson: jsonb("document_json").notNull(),
  
  // Status and metadata
  status: didoxDocStatusEnum("status").default('draft').notNull(),
  totalSum: numeric("total_sum", { precision: 15, scale: 2 }),
  totalSumWithVat: numeric("total_sum_with_vat", { precision: 15, scale: 2 }),
  
  // Signatures
  senderSignature: text("sender_signature"),
  senderSignedAt: timestamp("sender_signed_at"),
  receiverSignature: text("receiver_signature"),
  receiverSignedAt: timestamp("receiver_signed_at"),
  
  // Error tracking
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDidoxUserTokenSchema = createInsertSchema(didoxUserTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type DidoxUserToken = typeof didoxUserTokens.$inferSelect;
export type InsertDidoxUserToken = z.infer<typeof insertDidoxUserTokenSchema>;

export const insertDidoxDocumentSchema = createInsertSchema(didoxDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  totalSum: z.coerce.number().optional(),
  totalSumWithVat: z.coerce.number().optional(),
});
export type DidoxDocument = typeof didoxDocuments.$inferSelect;
export type InsertDidoxDocument = z.infer<typeof insertDidoxDocumentSchema>;

// ===== Representatives System =====
// Allows legal entities and IPs to assign individuals to act on their behalf

// Representative permission types
export const representativePermissionEnum = pgEnum('representative_permission', [
  'create_order',       // Create orders
  'edit_own_orders',    // Edit orders created by this representative
  'delete_own_orders',  // Delete orders created by this representative
  'accept_offer',       // Accept carrier offers
  'pay_contract',       // Make payments on contracts
  'send_waybill',       // Send TTN via Didox
  'terminate_contract'  // Initiate contract termination
]);

// Representatives table - links a customer (legal/IP) to an individual user
export const representatives = pgTable("representatives", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => users.id).notNull(), // Legal entity or IP who assigns the representative
  representativeUserId: integer("representative_user_id").references(() => users.id).notNull(), // Individual who acts as representative
  permissions: representativePermissionEnum("permissions").array().notNull().default([]), // Array of granted permissions
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  customerRepUnique: unique().on(table.customerId, table.representativeUserId),
}));

export const insertRepresentativeSchema = createInsertSchema(representatives).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Representative = typeof representatives.$inferSelect;
export type InsertRepresentative = z.infer<typeof insertRepresentativeSchema>;

// Enum type for permissions (for use in frontend)
export type RepresentativePermission = 'create_order' | 'edit_own_orders' | 'delete_own_orders' | 'accept_offer' | 'reject_offer' | 'pay_contract' | 'send_waybill' | 'terminate_contract';

// Helper to get all permission values
export const ALL_REPRESENTATIVE_PERMISSIONS: RepresentativePermission[] = [
  'create_order', 'edit_own_orders', 'delete_own_orders', 'accept_offer', 'reject_offer', 'pay_contract', 'send_waybill', 'terminate_contract'
];

// ===== Push Notifications =====
// Stores Expo push tokens with optional filter preferences
export const pushTokens = pgTable("push_tokens", {
  id: serial("id").primaryKey(),
  expoToken: varchar("expo_token", { length: 255 }).unique().notNull(),
  userId: integer("user_id").references(() => users.id),
  originRegions: text("origin_regions").array(),
  destinationRegions: text("destination_regions").array(),
  transportTypes: text("transport_types").array(),
  excludeBot: boolean("exclude_bot").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastNotifiedAt: timestamp("last_notified_at"),
  dailyCount: integer("daily_count").default(0).notNull(),
});

export const insertPushTokenSchema = createInsertSchema(pushTokens).omit({ id: true, updatedAt: true });
export type PushToken = typeof pushTokens.$inferSelect;
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;

// ===== App Settings =====
// Key-value store for configurable system settings
export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;

// ===== Push Broadcasts =====
// History of one-time push notifications sent by admins
export const pushBroadcasts = pgTable("push_broadcasts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  totalTokens: integer("total_tokens").default(0).notNull(),
  sentCount: integer("sent_count").default(0).notNull(),
  errorCount: integer("error_count").default(0).notNull(),
  staleRemoved: integer("stale_removed").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PushBroadcast = typeof pushBroadcasts.$inferSelect;

// ===== Mobile Analytics =====
export const appEvents = pgTable("app_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  eventName: varchar("event_name", { length: 100 }).notNull(),
  screen: varchar("screen", { length: 100 }),
  deviceModel: varchar("device_model", { length: 100 }),
  osVersion: varchar("os_version", { length: 50 }),
  appVersion: varchar("app_version", { length: 30 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AppEvent = typeof appEvents.$inferSelect;
export const insertAppEventSchema = createInsertSchema(appEvents).omit({ id: true, createdAt: true });
export type InsertAppEvent = z.infer<typeof insertAppEventSchema>;

export const appErrors = pgTable("app_errors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  errorMessage: text("error_message").notNull(),
  errorStack: text("error_stack"),
  screen: varchar("screen", { length: 100 }),
  deviceModel: varchar("device_model", { length: 100 }),
  osVersion: varchar("os_version", { length: 50 }),
  appVersion: varchar("app_version", { length: 30 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AppError = typeof appErrors.$inferSelect;
export const insertAppErrorSchema = createInsertSchema(appErrors).omit({ id: true, createdAt: true });
export type InsertAppError = z.infer<typeof insertAppErrorSchema>;

// ===== Chat System =====

export const chatRooms = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  nameRu: text("name_ru").notNull(),
  nameUz: text("name_uz").notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").references(() => chatRooms.id, { onDelete: 'cascade' }).notNull(),
  authorName: text("author_name").notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'set null' }),
  text: text("text").notNull(),
  flagged: boolean("flagged").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertChatRoomSchema = createInsertSchema(chatRooms).omit({ id: true, createdAt: true, updatedAt: true });
export type ChatRoom = typeof chatRooms.$inferSelect;
export type InsertChatRoom = z.infer<typeof insertChatRoomSchema>;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// Permission display names for UI
export const PERMISSION_LABELS = {
  ru: {
    create_order: 'Создание заказов',
    edit_own_orders: 'Редактирование своих заказов',
    delete_own_orders: 'Удаление своих заказов',
    accept_offer: 'Принятие предложений',
    reject_offer: 'Отклонение предложений',
    pay_contract: 'Оплата договоров',
    send_waybill: 'Отправка ТТН',
    terminate_contract: 'Расторжение договоров'
  },
  uz: {
    create_order: 'Buyurtma yaratish',
    edit_own_orders: 'O\'z buyurtmalarini tahrirlash',
    delete_own_orders: 'O\'z buyurtmalarini o\'chirish',
    accept_offer: 'Takliflarni qabul qilish',
    reject_offer: 'Takliflarni rad etish',
    pay_contract: 'Shartnomani to\'lash',
    send_waybill: 'TTN yuborish',
    terminate_contract: 'Shartnomani bekor qilish'
  }
} as const;
