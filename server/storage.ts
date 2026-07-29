import { eq, and, or, desc, sql, gte, lte, lt, inArray, notInArray, isNull, isNotNull, ne, like, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import * as schema from "@shared/schema";
import { db } from "./db";

/**
 * Convert number to string for database storage (numeric columns)
 * Drizzle ORM requires numeric columns to be inserted as strings
 */
function toDbNum(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "0";
  return String(value);
}

// Admin phone number - only this phone can have admin role
const ADMIN_PHONE = process.env.ADMIN_PHONE || '+998939698899';

// Normalize phone for comparison
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-9);
}

import type {
  User,
  InsertUser,
  Profile,
  InsertProfile,
  Order,
  InsertOrder,
  Offer,
  InsertOffer,
  Deposit,
  DepositTransaction,
  InsertDepositTransaction,
  Contract,
  Partner,
  PartnerClient,
  PartnerCommission,
  Rating,
  InsertRating,
  OrderTemplate,
  InsertOrderTemplate,
  WithdrawalRequest,
  InsertWithdrawalRequest,
  TelegramNotification,
  TelegramChannel,
  PartnerRewardStatement,
  PartnerRewardStatementItem,
  InsertPartnerRewardStatementItem,
  AuditLog,
  Notification,
  InsertNotification,
  UserNotificationSetting,
  Announcement,
  InsertAnnouncement,
  AnnouncementTemplate,
  InsertAnnouncementTemplate,
  Representative,
  InsertRepresentative
} from "@shared/schema";

type TelegramChannelType = 'orders' | 'announcements' | 'ai_source' | 'broadcast' | 'promo';

export interface IStorage {
  // Users
  getUserById(id: number): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByInn(inn: string): Promise<User | undefined>;
  getUserByPinfl(pinfl: string): Promise<User | undefined>;
  getUserByPinflAndType(pinfl: string, userType: string): Promise<User | undefined>;
  getUserByPassport(series: string, number: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  
  // Profiles
  getProfileByUserId(userId: number): Promise<Profile | undefined>;
  getProfileByInn(inn: string): Promise<Profile | undefined>;
  getProfileByPinfl(pinfl: string): Promise<Profile | undefined>;
  getAllProfilesByPinfl(pinfl: string): Promise<Profile[]>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(userId: number, updates: Partial<Profile>): Promise<Profile | undefined>;
  
  // Orders
  getOrderById(id: number): Promise<Order | undefined>;
  getOrdersByCustomerId(customerId: number): Promise<Order[]>;
  getOrdersByCustomerIdAndCreatedBy(customerId: number, createdByUserId: number): Promise<Order[]>;
  getAllOrders(filters?: { status?: string; originRegion?: string; destinationRegion?: string; transportType?: string }): Promise<Order[]>;
  getExpiredNewOrders(): Promise<Order[]>;
  createOrder(order: InsertOrder & { customerId: number; customerBlockedCollateral?: number }): Promise<Order>;
  updateOrder(id: number, updates: Partial<Order> | any): Promise<Order | undefined>;
  softDeleteOrder(id: number, customerId: number): Promise<boolean>;
  extendOrderExpiry(orderId: number): Promise<Order | undefined>;
  
  // Offers
  getOfferById(id: number): Promise<Offer | undefined>;
  getOffersByOrderId(orderId: number): Promise<Offer[]>;
  getOffersByCarrierId(carrierId: number): Promise<Offer[]>;
  getAcceptedOfferByOrderId(orderId: number): Promise<Offer | undefined>;
  createOffer(offer: InsertOffer & { blockedAmount: number; blockedCommissionAmount?: number }): Promise<Offer>;
  updateOffer(id: number, updates: Partial<Offer>): Promise<Offer | undefined>;
  
  // Deposits
  getDepositByUserId(userId: number): Promise<Deposit | undefined>;
  getDepositsByUserId(userId: number): Promise<Deposit[]>;
  getDepositByUserIdAndType(userId: number, accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward' | 'registration_bonus'): Promise<Deposit | undefined>;
  createDeposit(userId: number, accountType?: 'main' | 'blocked' | 'in_transit' | 'partner_reward'): Promise<Deposit>;
  createAllDepositsForUser(userId: number): Promise<Deposit[]>;
  updateDepositBalance(userId: number, newBalance: number): Promise<Deposit | undefined>;
  updateDepositBalanceByType(userId: number, accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward', newBalance: number, newBlocked?: number): Promise<Deposit | undefined>;
  blockFunds(userId: number, accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward', amount: number): Promise<Deposit | undefined>;
  unblockFunds(userId: number, accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward', amount: number): Promise<Deposit | undefined>;
  
  // Deposit fund operations
  deductFunds(userId: number, accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward', amount: number): Promise<Deposit | undefined>;
  addFunds(userId: number, accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward', amount: number): Promise<Deposit | undefined>;
  unblockAndDeduct(userId: number, accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward', unblockAmount: number, deductAmount: number): Promise<Deposit | undefined>;
  
  // Escrow operations (Phase 3)
  blockEscrowFunds(customerId: number, amount: number): Promise<Deposit | undefined>;
  releaseEscrowToCarrier(customerId: number, carrierId: number, amount: number): Promise<{ customerEscrow: Deposit; carrierMain: Deposit } | undefined>;
  refundEscrowToCustomer(customerId: number, amount: number): Promise<{ customerEscrow: Deposit; customerMain: Deposit } | undefined>;
  
  // Deposit Transactions
  getDepositTransactionsByDepositId(depositId: number): Promise<DepositTransaction[]>;
  createDepositTransaction(transaction: InsertDepositTransaction): Promise<DepositTransaction>;
  updateDepositTransaction(id: number, updates: Partial<DepositTransaction>): Promise<DepositTransaction | undefined>;
  getPendingWithdrawals(): Promise<DepositTransaction[]>;
  
  // Contracts
  getContractByOrderId(orderId: number): Promise<Contract | undefined>;
  getContractById(contractId: number): Promise<Contract | undefined>;
  getContractsByUserId(userId: number, role?: string): Promise<any[]>;
  getContractsByStatus(status: string): Promise<any[]>;
  getContractsByStatuses(statuses: string[]): Promise<any[]>;
  getAllConcludedContracts(): Promise<any[]>;
  createContract(contract: Omit<Contract, 'id' | 'generatedAt' | 'updatedAt'>): Promise<Contract>;
  updateContract(contractId: number, updates: Partial<Contract>): Promise<Contract | undefined>;
  signContract(contractId: number, userId: number, signature: string, role: 'customer' | 'carrier'): Promise<Contract | undefined>;
  
  // Partners
  getPartnerById(partnerId: number): Promise<Partner | undefined>;
  getPartnerByUserId(userId: number): Promise<Partner | undefined>;
  getPartnerByReferralCode(referralCode: string): Promise<Partner | undefined>;
  createPartner(userId: number): Promise<Partner>;
  getPartnerClients(partnerId: number): Promise<PartnerClient[]>;
  getPartnerClientByUserId(userId: number): Promise<PartnerClient | undefined>;
  addPartnerClient(partnerClient: Omit<PartnerClient, 'id' | 'createdAt'>): Promise<PartnerClient>;
  registerUserWithReferral(
    userData: {
      phone: string;
      passwordHash: string;
      displayName: string;
      lastName?: string | null;
      firstName?: string | null;
      middleName?: string | null;
      roles: ('customer' | 'carrier' | 'partner')[];
      defaultRole: 'customer' | 'carrier' | 'partner';
      userType: 'legal' | 'ip' | 'individual';
      email?: string;
      referredByPartnerId?: number;
    },
    profileData: {
      companyName?: string;
      inn?: string;
      pinfl?: string;
      passportSeries?: string;
      passportNumber?: string;
      bankAccount?: string;
      bankName?: string;
      bankCode?: string;
      ndsPayer?: boolean;
      registrationCodeNds?: string;
    },
    referringPartnerId?: number
  ): Promise<User>;
  
  // Partner Commissions
  getCommissionsByPartnerId(partnerId: number): Promise<PartnerCommission[]>;
  createCommission(commission: Omit<PartnerCommission, 'id' | 'createdAt'>): Promise<PartnerCommission>;
  
  // Ratings
  getRatingsByUserId(userId: number): Promise<Rating[]>;
  getRatingsByUserIdAndRole(userId: number, role: 'customer' | 'carrier'): Promise<Rating[]>;
  getAverageRating(userId: number): Promise<number>;
  getAverageRatingByRole(userId: number, role: 'customer' | 'carrier'): Promise<number>;
  getRatingByContractAndRater(contractId: number, fromUserId: number): Promise<Rating | undefined>;
  createRating(rating: InsertRating): Promise<Rating>;
  createRatingAndUpdateUserAverage(rating: InsertRating): Promise<Rating>;
  
  // Order Templates
  getOrderTemplatesByCustomerId(customerId: number): Promise<OrderTemplate[]>;
  createOrderTemplate(template: InsertOrderTemplate & { customerId: number }): Promise<OrderTemplate>;
  deleteOrderTemplate(id: number, customerId: number): Promise<boolean>;
  
  // Admin
  getAllUsers(role?: string): Promise<User[]>;
  assignPartner(userId: number): Promise<Partner>;
  
  // Transfer between accounts
  transferBetweenAccounts(
    userId: number, 
    fromType: 'main' | 'blocked' | 'in_transit' | 'partner_reward' | 'registration_bonus',
    toType: 'main' | 'blocked' | 'in_transit' | 'partner_reward' | 'registration_bonus',
    amount: number,
    reference?: string
  ): Promise<{ success: boolean; transactionIds?: { outId: number; inId: number } }>;
  
  // Atomic prepayment blocking
  blockPrepaymentAtomic(
    customerId: number,
    contractId: number,
    amount: number
  ): Promise<{ success: boolean; error?: string }>;
  
  // Blacklist
  getBlacklistByCustomerId(customerId: number): Promise<{ id: number; customerId: number; carrierId: number; reason: string | null; createdAt: Date; carrier?: User }[]>;
  isCarrierBlacklisted(customerId: number, carrierId: number): Promise<boolean>;
  addToBlacklist(customerId: number, carrierId: number, reason?: string): Promise<{ id: number; customerId: number; carrierId: number; reason: string | null; createdAt: Date }>;
  removeFromBlacklist(customerId: number, carrierId: number): Promise<boolean>;
  
  // Withdrawal Requests
  createWithdrawalRequest(request: InsertWithdrawalRequest): Promise<WithdrawalRequest>;
  getWithdrawalRequestById(id: number): Promise<WithdrawalRequest | undefined>;
  getWithdrawalRequestsByUserId(userId: number): Promise<WithdrawalRequest[]>;
  getPendingWithdrawalRequests(): Promise<WithdrawalRequest[]>;
  getAllWithdrawalRequests(): Promise<WithdrawalRequest[]>;
  updateWithdrawalRequestStatus(id: number, status: 'pending' | 'processing' | 'completed' | 'rejected', adminId?: number, note?: string): Promise<WithdrawalRequest | undefined>;
  
  // Atomic withdrawal with balance update
  createWithdrawalWithBalanceMove(
    userId: number,
    sourceAccountType: 'main' | 'partner_reward',
    amount: number,
    request: InsertWithdrawalRequest
  ): Promise<{ success: boolean; withdrawalRequest?: WithdrawalRequest; error?: string }>;
  
  // Complete withdrawal (move funds from in_transit)
  completeWithdrawal(
    withdrawalId: number,
    adminId: number,
    adminNote?: string
  ): Promise<{ success: boolean; error?: string }>;

  // Reject withdrawal (return funds from in_transit to source)
  rejectWithdrawal(
    withdrawalId: number,
    adminId: number,
    adminNote?: string
  ): Promise<{ success: boolean; error?: string }>;

  // Admin Reports
  getDepositBalanceReport(asOfDate: Date): Promise<{
    users: {
      userId: number;
      displayName: string;
      phone: string;
      userType: string;
      inn: string | null;
      pinfl: string | null;
      main: number;
      blocked: number;
      in_transit: number;
      partner_reward: number;
      total: number;
    }[];
    totals: {
      main: number;
      blocked: number;
      in_transit: number;
      partner_reward: number;
      total: number;
    };
  }>;

  getDepositTurnoverReport(startDate: Date, endDate: Date): Promise<{
    users: {
      userId: number;
      displayName: string;
      phone: string;
      userType: string;
      creditMain: number;
      debitMain: number;
      creditBlocked: number;
      debitBlocked: number;
      creditInTransit: number;
      debitInTransit: number;
      creditPartnerReward: number;
      debitPartnerReward: number;
    }[];
    totals: {
      creditMain: number;
      debitMain: number;
      creditBlocked: number;
      debitBlocked: number;
      creditInTransit: number;
      debitInTransit: number;
      creditPartnerReward: number;
      debitPartnerReward: number;
    };
  }>;

  getOrdersReport(filters: {
    startDate?: Date;
    endDate?: Date;
    status?: string[];
    includeDeleted?: boolean;
    page: number;
    pageSize: number;
  }): Promise<{
    orders: any[];
    total: number;
    statusCounts: Record<string, number>;
    deletedCount: number;
  }>;

  adminDeleteOrder(orderId: number): Promise<void>;
  getAdminOrdersList(filters: { status?: string; search?: string; page: number; pageSize: number }): Promise<{ orders: any[]; total: number }>;
  adminUpdateOrderStatus(id: number, status: string): Promise<void>;
  adminUpdateOrderFields(id: number, data: Partial<any>): Promise<void>;

  getContractsReport(filters: {
    startDate?: Date;
    endDate?: Date;
    status?: string[];
    page: number;
    pageSize: number;
  }): Promise<{
    contracts: any[];
    total: number;
    statusCounts: Record<string, number>;
  }>;

  getPartnerRewardsReport(filters: {
    startDate?: Date;
    endDate?: Date;
    page: number;
    pageSize: number;
  }): Promise<{
    rewards: any[];
    total: number;
  }>;

  getPlatformCommissionReport(filters: {
    startDate?: Date;
    endDate?: Date;
    status?: string[];
    page: number;
    pageSize: number;
  }): Promise<{
    commissions: any[];
    total: number;
    totalCommission: number;
  }>;

  // Telegram Notifications
  getTelegramNotificationByOrderId(orderId: number, chatId: string): Promise<TelegramNotification | undefined>;
  createTelegramNotification(data: { orderId: number; chatId: string; messageId: number; lastStatus: string }): Promise<TelegramNotification>;
  updateTelegramNotification(orderId: number, chatId: string, updates: { messageId?: number; lastStatus?: string }): Promise<TelegramNotification | undefined>;
  
  // Telegram Channels
  getActiveTelegramChannels(channelType?: TelegramChannelType): Promise<TelegramChannel[]>;
  getAllTelegramChannels(channelType?: TelegramChannelType): Promise<TelegramChannel[]>;
  getTelegramChannelById(id: number): Promise<TelegramChannel | undefined>;
  getTelegramChannelByChatId(chatId: string, channelType?: TelegramChannelType): Promise<TelegramChannel | undefined>;
  createTelegramChannel(data: { chatId: string; name: string; channelType?: TelegramChannelType; createdBy?: number; intervalMinutes?: number; activeHoursFrom?: number; activeHoursTo?: number; timezone?: string; blockedUserIds?: string[] }): Promise<TelegramChannel>;
  updateTelegramChannel(id: number, updates: { name?: string; isActive?: boolean; intervalMinutes?: number; activeHoursFrom?: number; activeHoursTo?: number; timezone?: string; lastSentAt?: Date; blockedUserIds?: string[] }): Promise<TelegramChannel | undefined>;
  deleteTelegramChannel(id: number): Promise<boolean>;
  markTelegramChannelSent(id: number): Promise<void>;
  updateTelegramChannelPromoIndex(id: number, idx: number): Promise<void>;

  // Telegram processed updates (dedup for AI source polling)
  isTelegramUpdateProcessed(updateId: string): Promise<boolean>;
  markTelegramUpdateProcessed(updateId: string): Promise<void>;

  // Telegram broadcast log (per-announcement per-channel tracking)
  insertBroadcastLog(channelId: number, announcementId: number): Promise<void>;
  getAnnouncementsForBroadcast(channelId: number, intervalMinutes: number): Promise<import('@shared/schema').Announcement[]>;

  // Telegram skipped/failed AI-source messages (admin review)
  listTelegramSkippedMessages(limit?: number): Promise<import('@shared/schema').TelegramSkippedMessage[]>;
  countTelegramSkippedMessages(sinceMs?: number): Promise<number>;
  getTelegramSkippedMessage(id: number): Promise<import('@shared/schema').TelegramSkippedMessage | undefined>;
  recordTelegramSkippedMessage(data: import('@shared/schema').InsertTelegramSkippedMessage): Promise<import('@shared/schema').TelegramSkippedMessage>;
  deleteTelegramSkippedMessage(id: number): Promise<boolean>;

  // Telegram Promo Messages
  getAllTelegramPromoMessages(): Promise<import('@shared/schema').TelegramPromoMessage[]>;
  getActiveTelegramPromoMessages(): Promise<import('@shared/schema').TelegramPromoMessage[]>;
  createTelegramPromoMessage(data: { textRu: string; textUz: string; isActive?: boolean; displayOrder?: number; createdBy?: number }): Promise<import('@shared/schema').TelegramPromoMessage>;
  updateTelegramPromoMessage(id: number, updates: { textRu?: string; textUz?: string; isActive?: boolean; displayOrder?: number }): Promise<import('@shared/schema').TelegramPromoMessage | undefined>;
  deleteTelegramPromoMessage(id: number): Promise<boolean>;

  // Bot announcements helpers
  getOpenAnnouncementsForBroadcast(limit?: number): Promise<Announcement[]>;
  getExpiredBotAnnouncements(olderThan: Date): Promise<Announcement[]>;
  findDuplicateActiveAnnouncement(originRegion: string, destinationRegion: string, transportType: string, contactPhone: string): Promise<boolean>;

  // Telegram Auth Requests
  createTelegramAuthRequest(token: string, expiresAt: Date): Promise<import('@shared/schema').TelegramAuthRequest>;
  getTelegramAuthRequest(token: string): Promise<import('@shared/schema').TelegramAuthRequest | undefined>;
  updateTelegramAuthRequest(token: string, updates: Partial<import('@shared/schema').TelegramAuthRequest>): Promise<import('@shared/schema').TelegramAuthRequest | undefined>;
  getUserByTelegramId(telegramId: string): Promise<import('@shared/schema').User | undefined>;
  getUsersWithTelegramId(): Promise<import('@shared/schema').User[]>;
  cleanupExpiredTelegramAuthRequests(): Promise<void>;

  // Partner Reward Statements
  createPartnerRewardStatement(data: { periodMonth: string; createdByAdminId: number }): Promise<PartnerRewardStatement>;
  getPartnerRewardStatementById(id: number): Promise<PartnerRewardStatement | undefined>;
  getAllPartnerRewardStatements(): Promise<PartnerRewardStatement[]>;
  updatePartnerRewardStatement(id: number, updates: Partial<PartnerRewardStatement>): Promise<PartnerRewardStatement | undefined>;
  deletePartnerRewardStatement(id: number): Promise<boolean>;
  
  // Partner Reward Statement Items
  createPartnerRewardStatementItem(data: InsertPartnerRewardStatementItem): Promise<PartnerRewardStatementItem>;
  getPartnerRewardStatementItems(statementId: number): Promise<PartnerRewardStatementItem[]>;
  updatePartnerRewardStatementItem(id: number, updates: Partial<PartnerRewardStatementItem>): Promise<PartnerRewardStatementItem | undefined>;
  deletePartnerRewardStatementItem(id: number): Promise<boolean>;
  
  // Generate statement items for all users with partner_reward balance
  generatePartnerRewardStatementItems(statementId: number): Promise<number>;
  
  // Audit Logs
  createAuditLog(data: { entityType: string; entityId: number; action: string; performedBy: number; data?: string }): Promise<AuditLog>;
  getAuditLogsByEntity(entityType: string, entityId: number): Promise<AuditLog[]>;
  
  // Admin user update
  updateUserByAdmin(userId: number, updates: Partial<User>, adminId: number): Promise<User | undefined>;
  updateProfileByAdmin(userId: number, updates: Partial<Profile>, adminId: number): Promise<Profile | undefined>;
  
  // Notifications
  createNotification(data: InsertNotification): Promise<Notification>;
  getNotificationsByUserId(userId: number, limit?: number): Promise<Notification[]>;
  getUnreadNotificationsCount(userId: number): Promise<number>;
  markNotificationAsRead(id: number, userId: number): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: number): Promise<number>;
  
  // User Notification Settings
  getUserNotificationSettings(userId: number): Promise<UserNotificationSetting[]>;
  getUserNotificationSetting(userId: number, notificationType: string): Promise<UserNotificationSetting | undefined>;
  upsertUserNotificationSetting(userId: number, notificationType: string, smsEnabled: boolean, inAppEnabled: boolean): Promise<UserNotificationSetting>;

  // Announcements (for individual customers)
  getAnnouncementById(id: number): Promise<Announcement | undefined>;
  getAnnouncementsByCustomerId(customerId: number, statusFilter?: string, includeDeleted?: boolean): Promise<Announcement[]>;
  getPublicAnnouncements(filters?: { status?: string; originRegions?: string[]; destinationRegions?: string[]; transportTypes?: string[]; excludeBot?: boolean }): Promise<Announcement[]>;
  createAnnouncement(announcement: InsertAnnouncement & { customerId: number }): Promise<Announcement>;
  updateAnnouncement(id: number, updates: Partial<Announcement>): Promise<Announcement | undefined>;
  softDeleteAnnouncement(id: number, customerId: number): Promise<boolean>;
  getAdminAnnouncementsList(filters: { status?: string; search?: string; createdBy?: string; page: number; pageSize: number }): Promise<{ announcements: any[]; total: number }>;
  adminUpdateAnnouncementStatus(id: number, status: string): Promise<void>;
  adminUpdateAnnouncementFields(id: number, data: Partial<any>): Promise<void>;
  adminDeleteAnnouncement(id: number): Promise<void>;
  
  // Announcement Templates
  getAnnouncementTemplateById(id: number): Promise<AnnouncementTemplate | undefined>;
  getAnnouncementTemplatesByCustomerId(customerId: number): Promise<AnnouncementTemplate[]>;
  createAnnouncementTemplate(template: InsertAnnouncementTemplate & { customerId: number }): Promise<AnnouncementTemplate>;
  updateAnnouncementTemplate(id: number, updates: Partial<AnnouncementTemplate>): Promise<AnnouncementTemplate | undefined>;
  deleteAnnouncementTemplate(id: number, customerId: number): Promise<boolean>;
  
  // Representatives (for legal entities and IPs to delegate work to individuals)
  getRepresentativeById(id: number): Promise<Representative | undefined>;
  getRepresentativesByCustomerId(customerId: number): Promise<Representative[]>;
  getRepresentativeByCustomerAndUser(customerId: number, representativeUserId: number): Promise<Representative | undefined>;
  getPrincipalsByRepresentativeUserId(representativeUserId: number): Promise<Representative[]>;
  createRepresentative(data: InsertRepresentative): Promise<Representative>;
  updateRepresentative(id: number, updates: Partial<Representative>): Promise<Representative | undefined>;
  deleteRepresentative(id: number): Promise<boolean>;
  checkRepresentativePermission(customerId: number, representativeUserId: number, permission: string): Promise<boolean>;
}

export class DbStorage implements IStorage {
  async getUserById(id: number): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return result[0];
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const result = await db.select().from(schema.users).where(eq(schema.users.phone, phone));
    return result[0];
  }

  async getUserByInn(inn: string): Promise<User | undefined> {
    const result = await db.select()
      .from(schema.users)
      .innerJoin(schema.profiles, eq(schema.users.id, schema.profiles.userId))
      .where(eq(schema.profiles.inn, inn));
    return result[0]?.users;
  }

  async getUserByPinfl(pinfl: string): Promise<User | undefined> {
    const result = await db.select()
      .from(schema.users)
      .innerJoin(schema.profiles, eq(schema.users.id, schema.profiles.userId))
      .where(eq(schema.profiles.pinfl, pinfl));
    return result[0]?.users;
  }

  async getUserByPinflAndType(pinfl: string, userType: string): Promise<User | undefined> {
    const result = await db.select()
      .from(schema.users)
      .innerJoin(schema.profiles, eq(schema.users.id, schema.profiles.userId))
      .where(and(
        eq(schema.profiles.pinfl, pinfl),
        eq(schema.users.userType, userType as any)
      ));
    return result[0]?.users;
  }

  async getUserByPassport(series: string, number: string): Promise<User | undefined> {
    const result = await db.select()
      .from(schema.users)
      .innerJoin(schema.profiles, eq(schema.users.id, schema.profiles.userId))
      .where(and(
        eq(schema.profiles.passportSeries, series),
        eq(schema.profiles.passportNumber, number)
      ));
    return result[0]?.users;
  }

  async createUser(user: InsertUser): Promise<User> {
    // Check if this is the admin phone number
    const isAdminPhone = user.phone && normalizePhone(user.phone) === normalizePhone(ADMIN_PHONE);
    
    if (isAdminPhone) {
      // Admin phone: assign ONLY admin role (exclusive)
      user.roles = ['admin'] as any;
      user.defaultRole = 'admin';
      console.log(`[ADMIN] Registering admin user with phone ${user.phone}`);
    } else {
      // Non-admin: strip admin role if somehow present (security)
      if (user.roles && Array.isArray(user.roles)) {
        user.roles = user.roles.filter(role => role !== 'admin') as any;
      }
    }
    
    const result = await db.insert(schema.users).values(user).returning();
    return result[0];
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    // Security: Admin role protection
    // 1. Prevent adding admin role to non-admin users
    // 2. Preserve admin role for users who already have it (admin is EXCLUSIVE)
    if (updates.roles && Array.isArray(updates.roles)) {
      const currentUser = await this.getUserById(id);
      const hadAdmin = currentUser?.roles?.includes('admin') ?? false;
      const hasAdminInUpdate = updates.roles.includes('admin');
      
      if (hadAdmin) {
        // User already has admin - ALWAYS keep ONLY admin (exclusive role)
        updates.roles = ['admin'] as any;
      } else if (hasAdminInUpdate) {
        // Non-admin trying to add admin - BLOCK
        updates.roles = updates.roles.filter(role => role !== 'admin') as any;
        console.log(`[SECURITY] Blocked attempt to add admin role to user ${id}`);
      }
    }
    
    const result = await db.update(schema.users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning();
    return result[0];
  }

  async getProfileByUserId(userId: number): Promise<Profile | undefined> {
    const result = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
    return result[0];
  }

  async getProfileByInn(inn: string): Promise<Profile | undefined> {
    const result = await db.select().from(schema.profiles).where(eq(schema.profiles.inn, inn));
    return result[0];
  }

  async getProfileByPinfl(pinfl: string): Promise<Profile | undefined> {
    const result = await db.select().from(schema.profiles).where(eq(schema.profiles.pinfl, pinfl));
    return result[0];
  }

  async getAllProfilesByPinfl(pinfl: string): Promise<Profile[]> {
    return await db.select().from(schema.profiles).where(eq(schema.profiles.pinfl, pinfl));
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const result = await db.insert(schema.profiles).values(profile).returning();
    return result[0];
  }

  async updateProfile(userId: number, updates: Partial<Profile>): Promise<Profile | undefined> {
    const result = await db.update(schema.profiles)
      .set(updates)
      .where(eq(schema.profiles.userId, userId))
      .returning();
    return result[0];
  }

  async getOrderById(id: number): Promise<Order | undefined> {
    const result = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
    return result[0];
  }

  async getOrdersByCustomerId(customerId: number): Promise<Order[]> {
    return await db.select().from(schema.orders)
      .where(and(
        eq(schema.orders.customerId, customerId),
        sql`${schema.orders.deletedAt} IS NULL`
      ))
      .orderBy(desc(schema.orders.createdAt));
  }

  async getOrdersByCustomerIdAndCreatedBy(customerId: number, createdByUserId: number): Promise<Order[]> {
    // Get ALL orders created by this representative for the principal customer (including deleted)
    console.log('[STORAGE] getOrdersByCustomerIdAndCreatedBy:', { customerId, createdByUserId });
    
    // Representatives should see ALL their orders, including deleted ones
    const result = await db.select().from(schema.orders)
      .where(and(
        eq(schema.orders.customerId, customerId),
        eq(schema.orders.createdByUserId, createdByUserId)
      ))
      .orderBy(desc(schema.orders.createdAt));
    console.log('[STORAGE] Found orders for representative', createdByUserId, ':', result.length);
    return result;
  }

  async getAllOrdersByCustomerId(customerId: number): Promise<Order[]> {
    return await db.select().from(schema.orders)
      .where(eq(schema.orders.customerId, customerId))
      .orderBy(desc(schema.orders.createdAt));
  }

  async getAllOrders(filters?: { status?: string; originRegion?: string; destinationRegion?: string; transportType?: string }): Promise<Order[]> {
    // Always exclude deleted orders from public listing
    const conditions: any[] = [sql`${schema.orders.deletedAt} IS NULL`];
    if (filters?.status) {
      conditions.push(eq(schema.orders.status, filters.status as any));
    }
    if (filters?.transportType) {
      conditions.push(eq(schema.orders.transportType, filters.transportType as any));
    }
    let orders = await db.select().from(schema.orders)
      .where(and(...conditions))
      .orderBy(desc(schema.orders.createdAt));

    // Post-filter by regions (using both legacy fields and points arrays)
    if (filters?.originRegion) {
      const r = filters.originRegion;
      orders = orders.filter(o => {
        const fromPoints = o.originPoints as any[];
        if (fromPoints && fromPoints.length > 0) return fromPoints[0]?.region === r;
        return o.originRegion === r;
      });
    }
    if (filters?.destinationRegion) {
      const r = filters.destinationRegion;
      orders = orders.filter(o => {
        const toPoints = o.destinationPoints as any[];
        if (toPoints && toPoints.length > 0) return toPoints[0]?.region === r;
        return o.destinationRegion === r;
      });
    }
    return orders;
  }

  async getExpiredNewOrders(): Promise<Order[]> {
    const now = new Date();
    return await db.select().from(schema.orders)
      .where(and(
        eq(schema.orders.status, 'new'),
        sql`${schema.orders.expiresAt} IS NOT NULL`,
        sql`${schema.orders.expiresAt} <= ${now}`,
        sql`${schema.orders.deletedAt} IS NULL`
      ))
      .orderBy(schema.orders.expiresAt);
  }

  async extendOrderExpiry(orderId: number): Promise<Order | undefined> {
    const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const result = await db.update(schema.orders)
      .set({
        expiresAt: newExpiresAt,
        extensionCount: sql`${schema.orders.extensionCount} + 1`
      })
      .where(eq(schema.orders.id, orderId))
      .returning();
    return result[0];
  }

  async createOrder(order: InsertOrder & { customerId: number; customerBlockedCollateral?: number }): Promise<Order> {
    // If originPoints provided, also set legacy fields from first point for backward compatibility
    // If originPoints not provided, create them from legacy fields
    let originRegion = order.originRegion;
    let originDistrict = order.originDistrict;
    let originPoints = order.originPoints;
    let destinationRegion = order.destinationRegion;
    let destinationDistrict = order.destinationDistrict;
    let destinationPoints = order.destinationPoints;
    
    if (order.originPoints && order.originPoints.length > 0) {
      originRegion = order.originPoints[0].region;
      originDistrict = order.originPoints[0].districts;
    } else {
      originPoints = [{ region: order.originRegion, districts: order.originDistrict }];
    }
    
    if (order.destinationPoints && order.destinationPoints.length > 0) {
      destinationRegion = order.destinationPoints[0].region;
      destinationDistrict = order.destinationPoints[0].districts;
    } else {
      destinationPoints = [{ region: order.destinationRegion, districts: order.destinationDistrict }];
    }
    
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    
    // Get customer profile to check ndsPayer status for price calculation
    const customerProfile = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, order.customerId)).limit(1);
    const isNdsPayer = customerProfile.length > 0 && customerProfile[0].ndsPayer === true;
    
    // Calculate priceWithoutVat based on customer's NDS payer status
    const priceWithVatNum = Number(order.priceWithVat);
    const priceWithoutVatNum = isNdsPayer ? priceWithVatNum / 1.12 : priceWithVatNum;
    
    // Convert numeric fields to string for Drizzle numeric type compatibility
    const weightTonsStr = toDbNum(order.weightTons);
    const priceWithVatStr = toDbNum(order.priceWithVat);
    const priceWithoutVatStr = toDbNum(priceWithoutVatNum);
    const customerBlockedCollateralStr = toDbNum(order.customerBlockedCollateral || 0);
    
    const result = await db.insert(schema.orders).values({
      ...order,
      weightTons: weightTonsStr,
      priceWithVat: priceWithVatStr,
      priceWithoutVat: priceWithoutVatStr,
      customerBlockedCollateral: customerBlockedCollateralStr,
      originRegion,
      originDistrict,
      originPoints,
      destinationRegion,
      destinationDistrict,
      destinationPoints,
      expiresAt,
      extensionCount: 0,
    }).returning();
    return result[0];
  }

  async updateOrder(id: number, updates: Partial<Order> | any): Promise<Order | undefined> {
    // Normalize multi-point and legacy fields to keep them in sync
    const normalizedUpdates: any = { ...updates };
    
    // Convert numeric fields to string for Drizzle numeric type compatibility
    if (updates.weightTons !== undefined) {
      normalizedUpdates.weightTons = toDbNum(updates.weightTons);
    }
    if (updates.priceWithVat !== undefined) {
      normalizedUpdates.priceWithVat = toDbNum(updates.priceWithVat);
    }
    if (updates.customerBlockedCollateral !== undefined) {
      normalizedUpdates.customerBlockedCollateral = toDbNum(updates.customerBlockedCollateral);
    }
    
    if (updates.originPoints && updates.originPoints.length > 0) {
      normalizedUpdates.originRegion = updates.originPoints[0].region;
      normalizedUpdates.originDistrict = updates.originPoints[0].districts;
    } else if (updates.originRegion || updates.originDistrict) {
      normalizedUpdates.originPoints = [{ 
        region: updates.originRegion || '', 
        districts: updates.originDistrict || [''] 
      }];
    }
    
    if (updates.destinationPoints && updates.destinationPoints.length > 0) {
      normalizedUpdates.destinationRegion = updates.destinationPoints[0].region;
      normalizedUpdates.destinationDistrict = updates.destinationPoints[0].districts;
    } else if (updates.destinationRegion || updates.destinationDistrict) {
      normalizedUpdates.destinationPoints = [{ 
        region: updates.destinationRegion || '', 
        districts: updates.destinationDistrict || [''] 
      }];
    }
    
    const result = await db.update(schema.orders)
      .set(normalizedUpdates)
      .where(eq(schema.orders.id, id))
      .returning();
    return result[0];
  }

  async softDeleteOrder(id: number, customerId: number): Promise<boolean> {
    const order = await this.getOrderById(id);
    if (!order || order.customerId !== customerId) {
      return false;
    }
    
    // Only allow deletion if order is not assigned or completed
    if (order.status === 'assigned' || order.status === 'completed') {
      return false;
    }
    
    // Additional safety check: update only if status is still new or cancelled
    // Also clear expiresAt to stop the timer
    const result = await db.update(schema.orders)
      .set({ 
        deletedAt: new Date(),
        expiresAt: null  // Clear expiry to stop timer
      })
      .where(and(
        eq(schema.orders.id, id),
        eq(schema.orders.customerId, customerId),
        sql`${schema.orders.status} IN ('new', 'cancelled')`
      ))
      .returning();
    return result.length > 0;
  }

  async adminDeleteOrder(orderId: number): Promise<void> {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('Order not found / Заказ не найден');
    }
    
    // Check if order is already deleted
    if (order.deletedAt) {
      throw new Error('Order is already deleted / Заказ уже удалён');
    }
    
    // Check if order has an active contract (assigned status)
    if (order.status === 'assigned') {
      throw new Error('Cannot delete order with active contract / Невозможно удалить заказ с активным контрактом');
    }
    
    // Soft delete the order
    await db.update(schema.orders)
      .set({ 
        deletedAt: new Date(),
        expiresAt: null  // Clear expiry to stop timer
      })
      .where(eq(schema.orders.id, orderId));
  }

  async getAdminOrdersList(filters: { status?: string; search?: string; page: number; pageSize: number }): Promise<{ orders: any[]; total: number }> {
    const conditions: SQL[] = [isNull(schema.orders.deletedAt)];
    if (filters.status && filters.status !== 'all') {
      conditions.push(eq(schema.orders.status, filters.status as any));
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          like(schema.orders.title, term),
          like(schema.orders.originRegion, term),
          like(schema.orders.destinationRegion, term),
          like(schema.users.phone, term),
          like(schema.users.name, term),
        )!
      );
    }
    const where = and(...conditions);
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(schema.orders)
      .leftJoin(schema.users, eq(schema.orders.customerId, schema.users.id))
      .where(where);
    const total = Number(countResult[0]?.count || 0);
    const offset = (filters.page - 1) * filters.pageSize;
    const rows = await db.select({ order: schema.orders, customer: schema.users })
      .from(schema.orders)
      .leftJoin(schema.users, eq(schema.orders.customerId, schema.users.id))
      .where(where)
      .orderBy(desc(schema.orders.createdAt))
      .limit(filters.pageSize)
      .offset(offset);
    return { orders: rows.map(r => ({ ...r.order, customerName: r.customer?.name, customerPhone: r.customer?.phone })), total };
  }

  async adminUpdateOrderStatus(id: number, status: string): Promise<void> {
    await db.update(schema.orders).set({ status: status as any }).where(eq(schema.orders.id, id));
  }

  async adminUpdateOrderFields(id: number, data: Partial<any>): Promise<void> {
    const allowed = ['title', 'originRegion', 'originDistrict', 'destinationRegion', 'destinationDistrict', 'transportType', 'weightTons', 'priceWithVat', 'priceWithoutVat', 'loadDate', 'loadingTime'];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (key in data) update[key] = data[key];
    }
    if (Object.keys(update).length === 0) return;
    await db.update(schema.orders).set(update).where(eq(schema.orders.id, id));
  }

  async getOfferById(id: number): Promise<Offer | undefined> {
    const result = await db.select().from(schema.offers).where(eq(schema.offers.id, id));
    return result[0];
  }

  async getOffersByOrderId(orderId: number): Promise<Offer[]> {
    return await db.select().from(schema.offers)
      .where(eq(schema.offers.orderId, orderId))
      .orderBy(desc(schema.offers.createdAt));
  }

  async getOffersByCarrierId(carrierId: number): Promise<Offer[]> {
    return await db.select().from(schema.offers)
      .where(eq(schema.offers.carrierId, carrierId))
      .orderBy(desc(schema.offers.createdAt));
  }

  async getAcceptedOfferByOrderId(orderId: number): Promise<Offer | undefined> {
    const result = await db.select().from(schema.offers)
      .where(and(
        eq(schema.offers.orderId, orderId),
        eq(schema.offers.status, 'accepted')
      ));
    return result[0];
  }

  async createOffer(offer: InsertOffer & { blockedAmount: number; blockedCommissionAmount?: number; commissionSourceAccount?: string }): Promise<Offer> {
    // Convert numeric fields to string for Drizzle numeric type compatibility
    const offerWithNumericStrings = {
      ...offer,
      price: toDbNum(offer.price),
      priceWithoutVat: toDbNum(offer.priceWithoutVat),
      blockedAmount: toDbNum(offer.blockedAmount),
      blockedCommissionAmount: offer.blockedCommissionAmount !== undefined ? toDbNum(offer.blockedCommissionAmount) : undefined
    };
    const result = await db.insert(schema.offers).values(offerWithNumericStrings).returning();
    return result[0];
  }

  async updateOffer(id: number, updates: Partial<Offer>): Promise<Offer | undefined> {
    // Convert numeric fields to string for Drizzle numeric type compatibility
    const normalizedUpdates: any = { ...updates };
    if (updates.price !== undefined) {
      normalizedUpdates.price = toDbNum(updates.price as number);
    }
    if (updates.priceWithoutVat !== undefined) {
      normalizedUpdates.priceWithoutVat = toDbNum(updates.priceWithoutVat as number);
    }
    if (updates.blockedAmount !== undefined) {
      normalizedUpdates.blockedAmount = toDbNum(updates.blockedAmount as number);
    }
    if (updates.blockedCommissionAmount !== undefined) {
      normalizedUpdates.blockedCommissionAmount = toDbNum(updates.blockedCommissionAmount as number);
    }
    const result = await db.update(schema.offers)
      .set(normalizedUpdates)
      .where(eq(schema.offers.id, id))
      .returning();
    return result[0];
  }

  async getDepositByUserId(userId: number): Promise<Deposit | undefined> {
    const result = await db.select().from(schema.deposits)
      .where(and(
        eq(schema.deposits.userId, userId),
        eq(schema.deposits.accountType, 'main')
      ));
    return result[0];
  }

  async getDepositsByUserId(userId: number): Promise<Deposit[]> {
    return await db.select().from(schema.deposits)
      .where(eq(schema.deposits.userId, userId))
      .orderBy(schema.deposits.accountType);
  }

  async getDepositByUserIdAndType(userId: number, accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward' | 'registration_bonus'): Promise<Deposit | undefined> {
    const result = await db.select().from(schema.deposits)
      .where(and(
        eq(schema.deposits.userId, userId),
        eq(schema.deposits.accountType, accountType)
      ));
    return result[0];
  }

  async createDeposit(userId: number, accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward' = 'main'): Promise<Deposit> {
    const result = await db.insert(schema.deposits).values({ 
      userId, 
      accountType,
      balance: toDbNum(0),
      blocked: toDbNum(0)
    }).returning();
    return result[0];
  }

  async createAllDepositsForUser(userId: number): Promise<Deposit[]> {
    const accountTypes: Array<'main' | 'blocked' | 'in_transit' | 'partner_reward'> = ['main', 'blocked', 'in_transit', 'partner_reward'];
    const deposits: Deposit[] = [];
    
    // Check existing deposits first
    const existingDeposits = await this.getDepositsByUserId(userId);
    const existingTypes = new Set(existingDeposits.map(d => d.accountType));
    
    for (const accountType of accountTypes) {
      if (!existingTypes.has(accountType)) {
        const deposit = await this.createDeposit(userId, accountType);
        deposits.push(deposit);
      } else {
        const existing = existingDeposits.find(d => d.accountType === accountType);
        if (existing) deposits.push(existing);
      }
    }
    
    return deposits;
  }

  async updateDepositBalance(userId: number, newBalance: number): Promise<Deposit | undefined> {
    const result = await db.update(schema.deposits)
      .set({ balance: toDbNum(newBalance), updatedAt: new Date() })
      .where(and(
        eq(schema.deposits.userId, userId),
        eq(schema.deposits.accountType, 'main')
      ))
      .returning();
    return result[0];
  }

  async updateDepositBalanceByType(
    userId: number, 
    accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward', 
    newBalance: number,
    newBlocked?: number
  ): Promise<Deposit | undefined> {
    const updates: any = { balance: toDbNum(newBalance), updatedAt: new Date() };
    if (newBlocked !== undefined) {
      updates.blocked = toDbNum(newBlocked);
    }
    
    const result = await db.update(schema.deposits)
      .set(updates)
      .where(and(
        eq(schema.deposits.userId, userId),
        eq(schema.deposits.accountType, accountType)
      ))
      .returning();
    return result[0];
  }

  async deductFunds(userId: number, accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward', amount: number): Promise<Deposit | undefined> {
    // Atomic conditional deduction - prevents negative balance
    // WHERE clause ensures balance >= amount before deducting
    const result = await db.update(schema.deposits)
      .set({ 
        balance: sql`${schema.deposits.balance} - ${amount}`,
        updatedAt: new Date() 
      })
      .where(and(
        eq(schema.deposits.userId, userId),
        eq(schema.deposits.accountType, accountType),
        sql`${schema.deposits.balance} >= ${amount}` // Atomic balance check
      ))
      .returning();
    return result[0];
  }

  async addFunds(userId: number, accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward', amount: number): Promise<Deposit | undefined> {
    // Atomic fund addition
    const result = await db.update(schema.deposits)
      .set({ 
        balance: sql`${schema.deposits.balance} + ${amount}`,
        updatedAt: new Date() 
      })
      .where(and(
        eq(schema.deposits.userId, userId),
        eq(schema.deposits.accountType, accountType)
      ))
      .returning();
    return result[0];
  }

  async unblockAndDeduct(userId: number, accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward', unblockAmount: number, deductAmount: number): Promise<Deposit | undefined> {
    // ATOMIC operation: unblock collateral AND deduct commission in single UPDATE
    // This prevents race conditions between unblock and deduct
    const result = await db.update(schema.deposits)
      .set({ 
        blocked: sql`GREATEST(0, ${schema.deposits.blocked} - ${unblockAmount})`,
        balance: sql`${schema.deposits.balance} - ${deductAmount}`,
        updatedAt: new Date() 
      })
      .where(and(
        eq(schema.deposits.userId, userId),
        eq(schema.deposits.accountType, accountType),
        // Ensure blocked >= unblockAmount
        sql`${schema.deposits.blocked} >= ${unblockAmount}`,
        // Ensure balance >= deductAmount (after accounting for unblock effect)
        sql`${schema.deposits.balance} >= ${deductAmount}`
      ))
      .returning();
    return result[0];
  }

  async blockFunds(userId: number, accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward', amount: number): Promise<Deposit | undefined> {
    // Atomic conditional UPDATE - safe for Neon serverless (no FOR UPDATE support)
    // This single query atomically:
    // 1. Checks available balance (WHERE clause)
    // 2. Updates blocked amount if condition met
    // 3. Returns updated row or nothing if insufficient funds
    const result = await db.update(schema.deposits)
      .set({ 
        blocked: sql`${schema.deposits.blocked} + ${amount}`,
        updatedAt: new Date() 
      })
      .where(and(
        eq(schema.deposits.userId, userId),
        eq(schema.deposits.accountType, accountType),
        sql`${schema.deposits.balance} - ${schema.deposits.blocked} >= ${amount}` // Atomic balance check
      ))
      .returning();
    return result[0];
  }

  async unblockFunds(userId: number, accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward', amount: number): Promise<Deposit | undefined> {
    // Atomic UPDATE with GREATEST to prevent negative blocked - safe for Neon serverless
    const result = await db.update(schema.deposits)
      .set({ 
        blocked: sql`GREATEST(0, ${schema.deposits.blocked} - ${amount})`,
        updatedAt: new Date() 
      })
      .where(and(
        eq(schema.deposits.userId, userId),
        eq(schema.deposits.accountType, accountType)
      ))
      .returning();
    return result[0];
  }

  // ============ PHASE 3: ESCROW/PREPAYMENT OPERATIONS ============

  async blockEscrowFunds(customerId: number, amount: number): Promise<Deposit | undefined> {
    // Blocks prepayment in customer's blocked account (previously escrow)
    // Uses atomic blockFunds operation for safety
    return await this.blockFunds(customerId, 'blocked', amount);
  }

  async releaseEscrowToCarrier(customerId: number, carrierId: number, amount: number): Promise<{ customerEscrow: Deposit; carrierMain: Deposit } | undefined> {
    // ATOMIC release using explicit transaction: unblock+deduct customer blocked AND add to carrier main + audit trail
    try {
      return await db.transaction(async (tx) => {
        // Step 1: Unblock and deduct from customer blocked account (atomic conditional UPDATE)
        const customerBlockedResult = await tx.update(schema.deposits)
          .set({ 
            blocked: sql`GREATEST(0, ${schema.deposits.blocked} - ${amount})`,
            balance: sql`${schema.deposits.balance} - ${amount}`,
            updatedAt: new Date() 
          })
          .where(and(
            eq(schema.deposits.userId, customerId),
            eq(schema.deposits.accountType, 'blocked'),
            sql`${schema.deposits.blocked} >= ${amount}`,
            sql`${schema.deposits.balance} >= ${amount}`
          ))
          .returning();

        const customerBlocked = customerBlockedResult[0];
        if (!customerBlocked) {
          throw new Error('Insufficient blocked funds');
        }

        // Step 2: Add to carrier main account (atomic conditional UPDATE)
        const carrierMainResult = await tx.update(schema.deposits)
          .set({
            balance: sql`${schema.deposits.balance} + ${amount}`,
            updatedAt: new Date()
          })
          .where(and(
            eq(schema.deposits.userId, carrierId),
            eq(schema.deposits.accountType, 'main')
          ))
          .returning();

        const carrierMain = carrierMainResult[0];
        if (!carrierMain) {
          throw new Error('Carrier main account not found');
        }

        // Step 3: Create audit trail for both sides (within transaction)
        await tx.insert(schema.depositTransactions).values({
          depositId: customerBlocked.id,
          type: 'escrow_release',
          amount: toDbNum(amount),
          reference: `prepay-release-to-carrier-${carrierId}`,
          status: 'completed',
        });

        await tx.insert(schema.depositTransactions).values({
          depositId: carrierMain.id,
          type: 'topup',
          amount: toDbNum(amount),
          reference: `prepay-received-from-customer-${customerId}`,
          status: 'completed',
        });

        return { customerEscrow: customerBlocked, carrierMain };
      });
    } catch (error) {
      console.error(`CRITICAL: Failed to release prepayment to carrier. Customer ${customerId}, Carrier ${carrierId}, Amount ${amount}`, error);
      return undefined;
    }
  }

  async refundEscrowToCustomer(customerId: number, amount: number): Promise<{ customerEscrow: Deposit; customerMain: Deposit } | undefined> {
    // ATOMIC refund using explicit transaction: unblock+deduct customer blocked AND add to customer main + audit trail
    try {
      return await db.transaction(async (tx) => {
        // Step 1: Unblock and deduct from customer blocked account (atomic conditional UPDATE)
        const customerBlockedResult = await tx.update(schema.deposits)
          .set({ 
            blocked: sql`GREATEST(0, ${schema.deposits.blocked} - ${amount})`,
            balance: sql`${schema.deposits.balance} - ${amount}`,
            updatedAt: new Date() 
          })
          .where(and(
            eq(schema.deposits.userId, customerId),
            eq(schema.deposits.accountType, 'blocked'),
            sql`${schema.deposits.blocked} >= ${amount}`,
            sql`${schema.deposits.balance} >= ${amount}`
          ))
          .returning();

        const customerBlocked = customerBlockedResult[0];
        if (!customerBlocked) {
          throw new Error('Insufficient blocked funds');
        }

        // Step 2: Add to customer main account (atomic conditional UPDATE)
        const customerMainResult = await tx.update(schema.deposits)
          .set({
            balance: sql`${schema.deposits.balance} + ${amount}`,
            updatedAt: new Date()
          })
          .where(and(
            eq(schema.deposits.userId, customerId),
            eq(schema.deposits.accountType, 'main')
          ))
          .returning();

        const customerMain = customerMainResult[0];
        if (!customerMain) {
          throw new Error('Customer main account not found');
        }

        // Step 3: Create audit trail for both sides (within transaction)
        await tx.insert(schema.depositTransactions).values({
          depositId: customerBlocked.id,
          type: 'escrow_refund',
          amount: toDbNum(amount),
          reference: `prepay-refund-to-customer-main`,
          status: 'completed',
        });

        await tx.insert(schema.depositTransactions).values({
          depositId: customerMain.id,
          type: 'topup',
          amount: toDbNum(amount),
          reference: `prepay-refunded-from-blocked`,
          status: 'completed',
        });

        return { customerEscrow: customerBlocked, customerMain };
      });
    } catch (error) {
      console.error(`CRITICAL: Failed to refund prepayment to customer. Customer ${customerId}, Amount ${amount}`, error);
      return undefined;
    }
  }

  // PHASE 4: Transfer between accounts (e.g., partner_reward to main for payout)
  async transferBetweenAccounts(
    userId: number, 
    fromType: 'main' | 'blocked' | 'in_transit' | 'partner_reward' | 'registration_bonus',
    toType: 'main' | 'blocked' | 'in_transit' | 'partner_reward' | 'registration_bonus',
    amount: number,
    reference?: string
  ): Promise<{ success: boolean; transactionIds?: { outId: number; inId: number } }> {
    // ATOMIC transfer using explicit transaction: deduct from source AND add to destination + audit trail
    try {
      const result = await db.transaction(async (tx) => {
        // Step 0: Ensure destination account exists (for legacy users without all account types)
        const existingToAccount = await tx.select().from(schema.deposits)
          .where(and(
            eq(schema.deposits.userId, userId),
            eq(schema.deposits.accountType, toType)
          ))
          .limit(1);
        
        if (existingToAccount.length === 0) {
          // Create missing account type
          await tx.insert(schema.deposits).values({
            userId,
            accountType: toType,
            balance: 0,
            blocked: 0,
          });
          console.log(`[DEPOSIT] Auto-created missing ${toType} account for user ${userId}`);
        }

        // Step 1: Deduct from source account (atomic conditional UPDATE)
        const fromAccountResult = await tx.update(schema.deposits)
          .set({ 
            balance: sql`${schema.deposits.balance} - ${amount}`,
            updatedAt: new Date() 
          })
          .where(and(
            eq(schema.deposits.userId, userId),
            eq(schema.deposits.accountType, fromType),
            sql`${schema.deposits.balance} >= ${amount}` // Atomic balance check
          ))
          .returning();

        const fromAccount = fromAccountResult[0];
        if (!fromAccount) {
          throw new Error(`Insufficient balance in ${fromType} account`);
        }

        // Step 2: Add to destination account (atomic UPDATE)
        const toAccountResult = await tx.update(schema.deposits)
          .set({
            balance: sql`${schema.deposits.balance} + ${amount}`,
            updatedAt: new Date()
          })
          .where(and(
            eq(schema.deposits.userId, userId),
            eq(schema.deposits.accountType, toType)
          ))
          .returning();

        const toAccount = toAccountResult[0];
        if (!toAccount) {
          throw new Error(`${toType} account not found`);
        }

        // Step 3: Create audit trail for both sides (within transaction)
        // Use provided reference or generate default
        const outReference = reference || `transfer-to-${toType}`;
        const inReference = reference || `transfer-from-${fromType}`;
        
        const [outTx] = await tx.insert(schema.depositTransactions).values({
          depositId: fromAccount.id,
          type: 'transfer_out',
          amount: toDbNum(amount),
          reference: outReference,
          status: 'completed',
        }).returning();

        const [inTx] = await tx.insert(schema.depositTransactions).values({
          depositId: toAccount.id,
          type: 'transfer_in',
          amount: toDbNum(amount),
          reference: inReference,
          status: 'completed',
        }).returning();
        
        return { outId: outTx.id, inId: inTx.id };
      });

      return { success: true, transactionIds: result };
    } catch (error) {
      console.error(`CRITICAL: Failed to transfer between accounts. User ${userId}, From ${fromType} to ${toType}, Amount ${amount}`, error);
      return { success: false };
    }
  }

  // PHASE 5: Transfer collateral between DIFFERENT users (for contract termination penalties)
  async transferCollateralBetweenUsers(
    fromUserId: number,
    toUserId: number,
    fromAccountType: 'main' | 'blocked',
    toAccountType: 'main' | 'blocked',
    amount: number,
    reference: string
  ): Promise<{ success: boolean; transactionIds?: { outId: number; inId: number } }> {
    if (amount <= 0) {
      return { success: true };
    }
    
    try {
      const result = await db.transaction(async (tx) => {
        // Step 1: Deduct from source user's account (atomic conditional UPDATE)
        const fromAccountResult = await tx.update(schema.deposits)
          .set({ 
            balance: sql`${schema.deposits.balance} - ${amount}`,
            updatedAt: new Date() 
          })
          .where(and(
            eq(schema.deposits.userId, fromUserId),
            eq(schema.deposits.accountType, fromAccountType),
            sql`${schema.deposits.balance} >= ${amount}` // Atomic balance check
          ))
          .returning();

        const fromAccount = fromAccountResult[0];
        if (!fromAccount) {
          throw new Error(`Insufficient balance in user ${fromUserId} ${fromAccountType} account`);
        }

        // Step 2: Add to destination user's account (atomic UPDATE)
        const toAccountResult = await tx.update(schema.deposits)
          .set({
            balance: sql`${schema.deposits.balance} + ${amount}`,
            updatedAt: new Date()
          })
          .where(and(
            eq(schema.deposits.userId, toUserId),
            eq(schema.deposits.accountType, toAccountType)
          ))
          .returning();

        const toAccount = toAccountResult[0];
        if (!toAccount) {
          throw new Error(`User ${toUserId} ${toAccountType} account not found`);
        }

        // Step 3: Create audit trail for both sides (within transaction)
        const [outTx] = await tx.insert(schema.depositTransactions).values({
          depositId: fromAccount.id,
          type: 'transfer_out',
          amount: toDbNum(amount),
          reference,
          status: 'completed',
        }).returning();

        const [inTx] = await tx.insert(schema.depositTransactions).values({
          depositId: toAccount.id,
          type: 'transfer_in',
          amount: toDbNum(amount),
          reference,
          status: 'completed',
        }).returning();
        
        return { outId: outTx.id, inId: inTx.id };
      });

      console.log(`Collateral transfer successful: ${amount} from user ${fromUserId} (${fromAccountType}) to user ${toUserId} (${toAccountType})`);
      return { success: true, transactionIds: result };
    } catch (error) {
      console.error(`CRITICAL: Failed to transfer collateral between users. From ${fromUserId} to ${toUserId}, Amount ${amount}`, error);
      return { success: false };
    }
  }

  // Atomic prepayment blocking: debit main, credit blocked, update contract in one transaction
  async blockPrepaymentAtomic(
    customerId: number,
    contractId: number,
    amount: number
  ): Promise<{ success: boolean; error?: string }> {
    if (amount <= 0) {
      return { success: false, error: 'Invalid prepayment amount' };
    }
    
    try {
      await db.transaction(async (tx) => {
        // Step 1: Deduct from customer's main account (atomic conditional UPDATE)
        const mainAccountResult = await tx.update(schema.deposits)
          .set({ 
            balance: sql`${schema.deposits.balance} - ${amount}`,
            updatedAt: new Date() 
          })
          .where(and(
            eq(schema.deposits.userId, customerId),
            eq(schema.deposits.accountType, 'main'),
            sql`${schema.deposits.balance} >= ${amount}` // Atomic balance check
          ))
          .returning();

        const mainAccount = mainAccountResult[0];
        if (!mainAccount) {
          throw new Error('Insufficient balance in main account');
        }

        // Step 2: Add to customer's blocked account
        const blockedAccountResult = await tx.update(schema.deposits)
          .set({
            balance: sql`${schema.deposits.balance} + ${amount}`,
            updatedAt: new Date()
          })
          .where(and(
            eq(schema.deposits.userId, customerId),
            eq(schema.deposits.accountType, 'blocked')
          ))
          .returning();

        const blockedAccount = blockedAccountResult[0];
        if (!blockedAccount) {
          throw new Error('Blocked account not found');
        }

        // Step 3: Update contract with prepayment amount and status
        const contractResult = await tx.update(schema.contracts)
          .set({
            customerPrepaymentBlocked: amount,
            status: 'prepayment_made',
            updatedAt: new Date()
          })
          .where(and(
            eq(schema.contracts.id, contractId),
            // Guard: only update if not already paid (customerPrepaymentBlocked is 0 or null)
            sql`(${schema.contracts.customerPrepaymentBlocked} IS NULL OR ${schema.contracts.customerPrepaymentBlocked} = 0)`
          ))
          .returning();

        if (contractResult.length === 0) {
          throw new Error('Contract already paid or not found');
        }

        // Step 4: Create audit trail
        await tx.insert(schema.depositTransactions).values({
          depositId: mainAccount.id,
          type: 'transfer_out',
          amount: toDbNum(amount),
          reference: `Блокировка предоплаты по контракту №${contractId}`,
          status: 'completed',
        });

        await tx.insert(schema.depositTransactions).values({
          depositId: blockedAccount.id,
          type: 'transfer_in',
          amount: toDbNum(amount),
          reference: `Блокировка предоплаты по контракту №${contractId}`,
          status: 'completed',
        });
      });

      console.log(`[PREPAYMENT] Atomic prepayment ${amount} blocked for contract ${contractId}, customer ${customerId}`);
      return { success: true };
    } catch (error: any) {
      console.error(`[PREPAYMENT] Failed to block prepayment atomically. Contract ${contractId}, Customer ${customerId}, Amount ${amount}`, error);
      return { success: false, error: error.message || 'Transaction failed' };
    }
  }

  async getDepositTransactionsByDepositId(depositId: number): Promise<DepositTransaction[]> {
    return await db.select().from(schema.depositTransactions)
      .where(eq(schema.depositTransactions.depositId, depositId))
      .orderBy(desc(schema.depositTransactions.createdAt));
  }

  async createDepositTransaction(transaction: InsertDepositTransaction): Promise<DepositTransaction> {
    // Convert amount to string for Drizzle numeric type compatibility
    const transactionWithNumericString = {
      ...transaction,
      amount: toDbNum(transaction.amount)
    };
    const result = await db.insert(schema.depositTransactions).values(transactionWithNumericString).returning();
    return result[0];
  }

  async updateDepositTransaction(id: number, updates: Partial<DepositTransaction>): Promise<DepositTransaction | undefined> {
    const result = await db.update(schema.depositTransactions)
      .set(updates)
      .where(eq(schema.depositTransactions.id, id))
      .returning();
    return result[0];
  }

  async getPendingWithdrawals(): Promise<DepositTransaction[]> {
    return await db.select().from(schema.depositTransactions)
      .where(and(
        eq(schema.depositTransactions.type, 'withdrawal_request'),
        eq(schema.depositTransactions.status, 'pending')
      ))
      .orderBy(desc(schema.depositTransactions.createdAt));
  }

  async getContractByOrderId(orderId: number): Promise<Contract | undefined> {
    const result = await db.select().from(schema.contracts).where(eq(schema.contracts.orderId, orderId));
    return result[0];
  }

  async createContract(contract: Omit<Contract, 'id' | 'generatedAt' | 'updatedAt'>): Promise<Contract> {
    const result = await db.insert(schema.contracts).values(contract).returning();
    return result[0];
  }

  async getContractById(contractId: number): Promise<any | undefined> {
    const carrierUsers = alias(schema.users, 'carrier_users');
    const result = await db.select({
      contract: schema.contracts,
      order: schema.orders,
      offerPrice: schema.offers.price,
      offerPriceWithoutVat: schema.offers.priceWithoutVat,
      customerName: schema.users.displayName,
      customerPhone: schema.users.phone,
      carrierName: carrierUsers.displayName,
      carrierPhone: carrierUsers.phone,
    })
    .from(schema.contracts)
    .innerJoin(schema.orders, eq(schema.contracts.orderId, schema.orders.id))
    .innerJoin(schema.users, eq(schema.contracts.customerId, schema.users.id))
    .innerJoin(carrierUsers, eq(schema.contracts.carrierId, carrierUsers.id))
    .leftJoin(schema.offers, and(
      eq(schema.offers.orderId, schema.contracts.orderId),
      eq(schema.offers.carrierId, schema.contracts.carrierId)
    ))
    .where(eq(schema.contracts.id, contractId));

    if (!result[0]) return undefined;
    const r = result[0];
    return {
      ...r.contract,
      order: r.order,
      offerPrice: r.offerPrice,
      priceWithoutVat: r.offerPriceWithoutVat,
      customerName: r.customerName || '',
      carrierName: r.carrierName || '',
      customer: { id: r.contract.customerId, displayName: r.customerName, phone: r.customerPhone },
      carrier: { id: r.contract.carrierId, displayName: r.carrierName, phone: r.carrierPhone },
    };
  }

  async getContractsByUserId(userId: number, role?: string): Promise<any[]> {
    // Build where condition based on role
    let whereCondition;
    if (role === 'customer') {
      whereCondition = eq(schema.contracts.customerId, userId);
    } else if (role === 'carrier') {
      whereCondition = eq(schema.contracts.carrierId, userId);
    } else {
      // No role filter - return all contracts where user is either customer or carrier
      whereCondition = or(
        eq(schema.contracts.customerId, userId),
        eq(schema.contracts.carrierId, userId)
      );
    }

    const carrierUsers = alias(schema.users, 'carrier_users');
    const result = await db.select({
      contract: schema.contracts,
      order: schema.orders,
      offerPrice: schema.offers.price,
      offerPriceWithoutVat: schema.offers.priceWithoutVat,
      customerName: schema.users.displayName,
      customerPhone: schema.users.phone,
      carrierName: carrierUsers.displayName,
      carrierPhone: carrierUsers.phone,
    })
    .from(schema.contracts)
    .innerJoin(schema.orders, eq(schema.contracts.orderId, schema.orders.id))
    .innerJoin(schema.users, eq(schema.contracts.customerId, schema.users.id))
    .innerJoin(carrierUsers, eq(schema.contracts.carrierId, carrierUsers.id))
    .leftJoin(schema.offers, and(
      eq(schema.offers.orderId, schema.contracts.orderId),
      eq(schema.offers.carrierId, schema.contracts.carrierId)
    ))
    .where(whereCondition)
    .orderBy(desc(schema.contracts.generatedAt));
    
    return result.map(r => ({
      ...r.contract,
      order: r.order,
      offerPrice: r.offerPrice,
      priceWithoutVat: r.offerPriceWithoutVat,
      customerName: r.customerName || '',
      carrierName: r.carrierName || '',
      customer: { id: r.contract.customerId, displayName: r.customerName, phone: r.customerPhone },
      carrier: { id: r.contract.carrierId, displayName: r.carrierName, phone: r.carrierPhone },
    }));
  }

  async getContractsByStatus(status: string): Promise<any[]> {
    const result = await db.select({
      contract: schema.contracts,
      order: schema.orders,
      customer: {
        id: schema.users.id,
        displayName: schema.users.displayName,
        phone: schema.users.phone,
      },
      carrier: {
        id: sql`carrier.id`,
        displayName: sql`carrier.display_name`,
        phone: sql`carrier.phone`,
      }
    })
    .from(schema.contracts)
    .innerJoin(schema.orders, eq(schema.contracts.orderId, schema.orders.id))
    .innerJoin(schema.users, eq(schema.contracts.customerId, schema.users.id))
    .innerJoin(sql`users AS carrier`, sql`${schema.contracts.carrierId} = carrier.id`)
    .where(eq(schema.contracts.status, status as any))
    .orderBy(desc(schema.contracts.generatedAt));
    
    return result.map(r => ({
      contract: r.contract,
      order: r.order,
      customer: r.customer,
      carrier: r.carrier,
    }));
  }

  async getContractsByStatuses(statuses: string[]): Promise<any[]> {
    const result = await db.select({
      contract: schema.contracts,
      order: schema.orders,
      customer: {
        id: schema.users.id,
        displayName: schema.users.displayName,
        phone: schema.users.phone,
      },
      carrier: {
        id: sql`carrier.id`,
        displayName: sql`carrier.display_name`,
        phone: sql`carrier.phone`,
      }
    })
    .from(schema.contracts)
    .innerJoin(schema.orders, eq(schema.contracts.orderId, schema.orders.id))
    .innerJoin(schema.users, eq(schema.contracts.customerId, schema.users.id))
    .innerJoin(sql`users AS carrier`, sql`${schema.contracts.carrierId} = carrier.id`)
    .where(inArray(schema.contracts.status, statuses as any))
    .orderBy(desc(schema.contracts.generatedAt));
    
    return result.map(r => ({
      contract: r.contract,
      order: r.order,
      customer: r.customer,
      carrier: r.carrier,
    }));
  }

  async getAllConcludedContracts(): Promise<any[]> {
    // Get all contracts that are fully signed (excludes drafts and partial signatures)
    const concludedStatuses = [
      'fully_signed',
      'awaiting_prepayment',
      'prepayment_made',
      'awaiting_completion_confirmation',
      'closed',
      'termination_pending',
      'terminated'
    ];
    
    const result = await db.select({
      contract: schema.contracts,
      order: schema.orders,
      customer: {
        id: schema.users.id,
        displayName: schema.users.displayName,
        phone: schema.users.phone,
      },
      carrier: {
        id: sql`carrier.id`,
        displayName: sql`carrier.display_name`,
        phone: sql`carrier.phone`,
      },
      offerPrice: sql`accepted_offer.price`.as('offer_price')
    })
    .from(schema.contracts)
    .innerJoin(schema.orders, eq(schema.contracts.orderId, schema.orders.id))
    .innerJoin(schema.users, eq(schema.contracts.customerId, schema.users.id))
    .innerJoin(sql`users AS carrier`, sql`${schema.contracts.carrierId} = carrier.id`)
    .leftJoin(
      sql`offers AS accepted_offer`,
      sql`accepted_offer.order_id = ${schema.contracts.orderId} AND accepted_offer.carrier_id = ${schema.contracts.carrierId} AND accepted_offer.status = 'accepted'`
    )
    .where(inArray(schema.contracts.status, concludedStatuses as any))
    .orderBy(desc(schema.contracts.generatedAt));
    
    return result.map(r => ({
      contract: r.contract,
      order: r.order,
      customer: r.customer,
      carrier: r.carrier,
      offerPrice: r.offerPrice,
    }));
  }

  async updateContract(contractId: number, updates: Partial<Contract>): Promise<Contract | undefined> {
    const result = await db.update(schema.contracts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.contracts.id, contractId))
      .returning();
    return result[0];
  }

  async signContract(
    contractId: number,
    userId: number,
    signature: string,
    role: 'customer' | 'carrier'
  ): Promise<Contract | undefined> {
    try {
      return await db.transaction(async (tx) => {
        // Get contract
        const contractResult = await tx.select().from(schema.contracts)
          .where(eq(schema.contracts.id, contractId));
        
        const contract = contractResult[0];
        if (!contract) {
          throw new Error('Contract not found');
        }

        // Verify user is authorized to sign
        if (role === 'customer' && contract.customerId !== userId) {
          throw new Error('Not authorized to sign as customer');
        }
        if (role === 'carrier' && contract.carrierId !== userId) {
          throw new Error('Not authorized to sign as carrier');
        }

        // Check if already signed
        if (role === 'customer' && contract.customerSignature) {
          throw new Error('Contract already signed by customer');
        }
        if (role === 'carrier' && contract.carrierSignature) {
          throw new Error('Contract already signed by carrier');
        }

        // Prepare updates
        const updates: Partial<Contract> = {
          updatedAt: new Date(),
        };

        if (role === 'customer') {
          updates.customerSignature = signature;
          updates.customerSignedAt = new Date();
          
          // Update status
          if (contract.carrierSignature) {
            updates.status = 'fully_signed';
          } else {
            updates.status = 'signed_by_customer';
          }
        } else {
          updates.carrierSignature = signature;
          updates.carrierSignedAt = new Date();
          
          // Update status
          if (contract.customerSignature) {
            updates.status = 'fully_signed';
          } else {
            updates.status = 'signed_by_carrier';
          }
        }

        // Update contract
        const updatedResult = await tx.update(schema.contracts)
          .set(updates)
          .where(eq(schema.contracts.id, contractId))
          .returning();

        return updatedResult[0];
      });
    } catch (error) {
      console.error('Contract signing error:', error);
      return undefined;
    }
  }

  async getPartnerById(partnerId: number): Promise<Partner | undefined> {
    const result = await db.select().from(schema.partners).where(eq(schema.partners.id, partnerId));
    return result[0];
  }

  async getPartnerByUserId(userId: number): Promise<Partner | undefined> {
    const result = await db.select().from(schema.partners).where(eq(schema.partners.userId, userId));
    return result[0];
  }

  async getPartnerByReferralCode(referralCode: string): Promise<Partner | undefined> {
    // Normalize referral code: uppercase and trim
    const normalizedCode = referralCode.trim().toUpperCase();
    const result = await db.select().from(schema.partners).where(eq(schema.partners.referralCode, normalizedCode));
    return result[0];
  }

  async createPartner(userId: number): Promise<Partner> {
    // Generate unique 8-character alphanumeric referral code
    const generateReferralCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    // Ensure uniqueness
    let referralCode = generateReferralCode();
    let existing = await this.getPartnerByReferralCode(referralCode);
    while (existing) {
      referralCode = generateReferralCode();
      existing = await this.getPartnerByReferralCode(referralCode);
    }

    const result = await db.insert(schema.partners).values({ userId, referralCode }).returning();
    return result[0];
  }

  async getPartnerClients(partnerId: number): Promise<PartnerClient[]> {
    return await db.select().from(schema.partnerClients)
      .where(eq(schema.partnerClients.partnerId, partnerId))
      .orderBy(desc(schema.partnerClients.createdAt));
  }

  async getPartnerClientByUserId(userId: number): Promise<PartnerClient | undefined> {
    const result = await db.select().from(schema.partnerClients)
      .where(eq(schema.partnerClients.clientId, userId));
    return result[0];
  }

  async addPartnerClient(partnerClient: Omit<PartnerClient, 'id' | 'createdAt'>): Promise<PartnerClient> {
    const result = await db.insert(schema.partnerClients).values(partnerClient).returning();
    return result[0];
  }

  async getCommissionsByPartnerId(partnerId: number): Promise<PartnerCommission[]> {
    return await db.select().from(schema.partnerCommissions)
      .where(eq(schema.partnerCommissions.partnerId, partnerId))
      .orderBy(desc(schema.partnerCommissions.periodMonth));
  }

  async createCommission(commission: Omit<PartnerCommission, 'id' | 'createdAt'>): Promise<PartnerCommission> {
    // Convert amount to string for Drizzle numeric type compatibility
    const commissionWithNumericString = {
      ...commission,
      amount: toDbNum(commission.amount)
    };
    const result = await db.insert(schema.partnerCommissions).values(commissionWithNumericString).returning();
    return result[0];
  }

  async getRatingsByUserId(userId: number): Promise<Rating[]> {
    return await db.select().from(schema.ratings)
      .where(eq(schema.ratings.toUserId, userId))
      .orderBy(desc(schema.ratings.createdAt));
  }

  async getRatingsByUserIdAndRole(userId: number, role: 'customer' | 'carrier'): Promise<Rating[]> {
    return await db.select().from(schema.ratings)
      .where(and(
        eq(schema.ratings.toUserId, userId),
        eq(schema.ratings.ratedAsRole, role)
      ))
      .orderBy(desc(schema.ratings.createdAt));
  }

  async getAverageRating(userId: number): Promise<number> {
    const result = await db.select({
      avg: sql<number>`AVG(${schema.ratings.score})::float`
    })
    .from(schema.ratings)
    .where(eq(schema.ratings.toUserId, userId));
    
    return result[0]?.avg || 0;
  }

  async getAverageRatingByRole(userId: number, role: 'customer' | 'carrier'): Promise<number> {
    const result = await db.select({
      avg: sql<number>`AVG(${schema.ratings.score})::float`,
      count: sql<number>`COUNT(*)::int`
    })
    .from(schema.ratings)
    .where(and(
      eq(schema.ratings.toUserId, userId),
      eq(schema.ratings.ratedAsRole, role)
    ));
    
    return result[0]?.avg || 0;
  }

  async getRatingByContractAndRater(contractId: number, fromUserId: number): Promise<Rating | undefined> {
    const result = await db.select().from(schema.ratings)
      .where(and(
        eq(schema.ratings.contractId, contractId),
        eq(schema.ratings.fromUserId, fromUserId)
      ));
    return result[0];
  }

  async createRating(rating: InsertRating): Promise<Rating> {
    const result = await db.insert(schema.ratings).values(rating).returning();
    return result[0];
  }

  async createRatingAndUpdateUserAverage(rating: InsertRating): Promise<Rating> {
    const newRating = await db.insert(schema.ratings).values(rating).returning();
    
    const avgResult = await db.select({
      avg: sql<number>`ROUND(AVG(${schema.ratings.score})::numeric, 2)`,
      count: sql<number>`COUNT(*)::int`
    })
    .from(schema.ratings)
    .where(and(
      eq(schema.ratings.toUserId, rating.toUserId),
      eq(schema.ratings.ratedAsRole, rating.ratedAsRole)
    ));
    
    const avgRating = avgResult[0]?.avg || 0;
    const count = avgResult[0]?.count || 0;
    
    if (rating.ratedAsRole === 'customer') {
      await db.update(schema.users)
        .set({ 
          customerRating: avgRating.toString(),
          customerRatingCount: count
        })
        .where(eq(schema.users.id, rating.toUserId));
    } else {
      await db.update(schema.users)
        .set({ 
          carrierRating: avgRating.toString(),
          carrierRatingCount: count
        })
        .where(eq(schema.users.id, rating.toUserId));
    }
    
    return newRating[0];
  }

  async getAllUsers(role?: string): Promise<User[]> {
    if (role) {
      // Whitelist validation for SQL injection prevention
      const validRoles = ['customer', 'carrier', 'partner', 'admin'];
      if (!validRoles.includes(role)) {
        return [];
      }
      return await db.select().from(schema.users)
        .where(sql`${schema.users.roles} @> ARRAY[${role}::user_role]`)
        .orderBy(desc(schema.users.createdAt));
    }
    return await db.select().from(schema.users).orderBy(desc(schema.users.createdAt));
  }

  async getOrderTemplatesByCustomerId(customerId: number): Promise<OrderTemplate[]> {
    return await db.select()
      .from(schema.orderTemplates)
      .where(eq(schema.orderTemplates.customerId, customerId))
      .orderBy(desc(schema.orderTemplates.createdAt));
  }

  async createOrderTemplate(template: InsertOrderTemplate & { customerId: number }): Promise<OrderTemplate> {
    // Convert weightTons to string for Drizzle numeric type compatibility
    const templateWithStringWeight = {
      ...template,
      weightTons: typeof template.weightTons === 'number' 
        ? template.weightTons.toString() 
        : template.weightTons
    };
    const result = await db.insert(schema.orderTemplates).values(templateWithStringWeight).returning();
    return result[0];
  }

  async deleteOrderTemplate(id: number, customerId: number): Promise<boolean> {
    const result = await db.delete(schema.orderTemplates)
      .where(and(
        eq(schema.orderTemplates.id, id),
        eq(schema.orderTemplates.customerId, customerId)
      ))
      .returning();
    return result.length > 0;
  }

  async assignPartner(userId: number): Promise<Partner> {
    // Generate a unique referral code
    const referralCode = `REF${userId.toString().padStart(6, '0')}${Date.now().toString(36).toUpperCase()}`;
    const result = await db.insert(schema.partners).values({ userId, referralCode }).returning();
    return result[0];
  }

  // PHASE 4: Atomic registration with optional referral partner linking
  async registerUserWithReferral(
    userData: {
      phone: string;
      passwordHash: string;
      displayName: string;
      lastName?: string | null;
      firstName?: string | null;
      middleName?: string | null;
      roles: ('customer' | 'carrier' | 'partner')[];
      defaultRole: 'customer' | 'carrier' | 'partner';
      userType: 'legal' | 'ip' | 'individual';
      email?: string;
      referredByPartnerId?: number;
    },
    profileData: {
      companyName?: string;
      inn?: string;
      pinfl?: string;
      passportSeries?: string;
      passportNumber?: string;
      bankAccount?: string;
      bankName?: string;
      bankCode?: string;
      ndsPayer?: boolean;
      registrationCodeNds?: string;
      // E-IMZO certificate data for legal entities and IPs
      eimzoCertSerial?: string | null;
      eimzoCertIssuer?: string | null;
      eimzoCertValidFrom?: Date | null;
      eimzoCertValidTo?: Date | null;
      eimzoCertCn?: string | null;
      eimzoCertO?: string | null;
      eimzoCertTin?: string | null;
      eimzoCertPinfl?: string | null;
      // Offer acceptance signature
      offerAcceptedAt?: Date | null;
      offerAcceptanceSignature?: string | null;
      offerAcceptanceHash?: string | null;
      offerVersion?: string | null;
    },
    referringPartnerId?: number
  ): Promise<User> {
    // ATOMIC registration: user + deposits + profile + partner-client link in single transaction
    try {
      return await db.transaction(async (tx) => {
        // Step 1: Create user
        const userResult = await tx.insert(schema.users).values({
          phone: userData.phone,
          passwordHash: userData.passwordHash,
          displayName: userData.displayName,
          lastName: userData.lastName || null,
          firstName: userData.firstName || null,
          middleName: userData.middleName || null,
          roles: userData.roles,
          defaultRole: userData.defaultRole,
          userType: userData.userType,
          email: userData.email,
          referredByPartnerId: userData.referredByPartnerId,
        }).returning();
        
        const user = userResult[0];
        if (!user) {
          throw new Error('Failed to create user');
        }

        // Step 2: Create deposit accounts
        // All users get: main, blocked, in_transit, partner_reward
        const depositAccounts: { userId: number; accountType: 'main' | 'blocked' | 'in_transit' | 'partner_reward' | 'registration_bonus'; balance: string }[] = [
          { userId: user.id, accountType: 'main', balance: toDbNum(0) },
          { userId: user.id, accountType: 'blocked', balance: toDbNum(0) },
          { userId: user.id, accountType: 'in_transit', balance: toDbNum(0) },
          { userId: user.id, accountType: 'partner_reward', balance: toDbNum(0) },
        ];
        
        // Carriers (legal entities and IPs only) get registration bonus account with 200,000 sum
        const REGISTRATION_BONUS_AMOUNT = 200000;
        const isCarrier = userData.roles.includes('carrier');
        if (isCarrier) {
          depositAccounts.push({ userId: user.id, accountType: 'registration_bonus', balance: toDbNum(REGISTRATION_BONUS_AMOUNT) });
        }
        
        const depositResults = await tx.insert(schema.deposits).values(depositAccounts).returning();
        
        // Create transaction record for registration bonus
        if (isCarrier) {
          const bonusDeposit = depositResults.find(d => d.accountType === 'registration_bonus');
          if (bonusDeposit) {
            await tx.insert(schema.depositTransactions).values({
              depositId: bonusDeposit.id,
              type: 'registration_bonus',
              amount: toDbNum(REGISTRATION_BONUS_AMOUNT),
              reference: `Registration bonus for carrier ${user.id}`,
              status: 'completed',
            });
          }
        }

        // Step 3: Create profile with E-IMZO certificate data if provided
        await tx.insert(schema.profiles).values({
          userId: user.id,
          companyName: profileData.companyName,
          inn: profileData.inn,
          pinfl: profileData.pinfl,
          passportSeries: profileData.passportSeries,
          passportNumber: profileData.passportNumber,
          bankAccount: profileData.bankAccount,
          bankName: profileData.bankName,
          bankCode: profileData.bankCode,
          ndsPayer: profileData.ndsPayer || false,
          registrationCodeNds: profileData.registrationCodeNds,
          // E-IMZO certificate data
          eimzoCertSerial: profileData.eimzoCertSerial,
          eimzoCertIssuer: profileData.eimzoCertIssuer,
          eimzoCertValidFrom: profileData.eimzoCertValidFrom,
          eimzoCertValidTo: profileData.eimzoCertValidTo,
          eimzoCertCn: profileData.eimzoCertCn,
          eimzoCertO: profileData.eimzoCertO,
          eimzoCertTin: profileData.eimzoCertTin,
          eimzoCertPinfl: profileData.eimzoCertPinfl,
          // Offer acceptance signature
          offerAcceptedAt: profileData.offerAcceptedAt,
          offerAcceptanceSignature: profileData.offerAcceptanceSignature,
          offerAcceptanceHash: profileData.offerAcceptanceHash,
          offerVersion: profileData.offerVersion,
        });

        // Step 4: Create partner record ONLY if user explicitly chose partner as default role
        let partnerId: number | undefined;
        if (userData.defaultRole === 'partner') {
          // Generate unique referral code
          const generateReferralCode = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = '';
            for (let i = 0; i < 8; i++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
          };
          
          let referralCode = generateReferralCode();
          // Check uniqueness within transaction
          let existingPartner = await tx.select().from(schema.partners)
            .where(eq(schema.partners.referralCode, referralCode));
          while (existingPartner.length > 0) {
            referralCode = generateReferralCode();
            existingPartner = await tx.select().from(schema.partners)
              .where(eq(schema.partners.referralCode, referralCode));
          }
          
          const partnerResult = await tx.insert(schema.partners).values({
            userId: user.id,
            referralCode,
            status: 'active',
          }).returning();
          
          partnerId = partnerResult[0].id;
        }

        // Step 5: Create partner-client link if referred by partner
        // Note: referringPartnerId is the ID of the partner who referred this user
        if (referringPartnerId) {
          await tx.insert(schema.partnerClients).values({
            partnerId: referringPartnerId,  // ID of referring partner
            clientId: user.id,  // ID of newly registered user (client)
            type: 'registration_agent',
            startDate: new Date(),
          });
        }

        return user;
      });
    } catch (error) {
      console.error('CRITICAL: Atomic registration failed', error);
      throw error;
    }
  }

  // Blacklist methods
  async getBlacklistByCustomerId(customerId: number): Promise<{ id: number; customerId: number; carrierId: number; reason: string | null; createdAt: Date; carrier?: User }[]> {
    const result = await db.select({
      blacklist: schema.blacklist,
      carrier: schema.users
    })
      .from(schema.blacklist)
      .leftJoin(schema.users, eq(schema.blacklist.carrierId, schema.users.id))
      .where(eq(schema.blacklist.customerId, customerId))
      .orderBy(desc(schema.blacklist.createdAt));
    
    return result.map(row => ({
      id: row.blacklist.id,
      customerId: row.blacklist.customerId,
      carrierId: row.blacklist.carrierId,
      reason: row.blacklist.reason,
      createdAt: row.blacklist.createdAt,
      carrier: row.carrier || undefined
    }));
  }

  async isCarrierBlacklisted(customerId: number, carrierId: number): Promise<boolean> {
    const result = await db.select()
      .from(schema.blacklist)
      .where(and(
        eq(schema.blacklist.customerId, customerId),
        eq(schema.blacklist.carrierId, carrierId)
      ));
    return result.length > 0;
  }

  async addToBlacklist(customerId: number, carrierId: number, reason?: string): Promise<{ id: number; customerId: number; carrierId: number; reason: string | null; createdAt: Date }> {
    const result = await db.insert(schema.blacklist).values({
      customerId,
      carrierId,
      reason: reason || null
    }).returning();
    return result[0];
  }

  async removeFromBlacklist(customerId: number, carrierId: number): Promise<boolean> {
    const result = await db.delete(schema.blacklist)
      .where(and(
        eq(schema.blacklist.customerId, customerId),
        eq(schema.blacklist.carrierId, carrierId)
      ))
      .returning();
    return result.length > 0;
  }

  // Withdrawal Request methods
  async createWithdrawalRequest(request: InsertWithdrawalRequest): Promise<WithdrawalRequest> {
    // Convert amount to string for Drizzle numeric type compatibility
    const requestWithNumericString = {
      ...request,
      amount: toDbNum(request.amount)
    };
    const result = await db.insert(schema.withdrawalRequests).values(requestWithNumericString).returning();
    return result[0];
  }

  async getWithdrawalRequestById(id: number): Promise<WithdrawalRequest | undefined> {
    const result = await db.select().from(schema.withdrawalRequests).where(eq(schema.withdrawalRequests.id, id));
    return result[0];
  }

  async getWithdrawalRequestsByUserId(userId: number): Promise<WithdrawalRequest[]> {
    return await db.select()
      .from(schema.withdrawalRequests)
      .where(eq(schema.withdrawalRequests.userId, userId))
      .orderBy(desc(schema.withdrawalRequests.createdAt));
  }

  async getPendingWithdrawalRequests(): Promise<WithdrawalRequest[]> {
    return await db.select()
      .from(schema.withdrawalRequests)
      .where(or(
        eq(schema.withdrawalRequests.status, 'pending'),
        eq(schema.withdrawalRequests.status, 'processing')
      ))
      .orderBy(desc(schema.withdrawalRequests.createdAt));
  }

  async getAllWithdrawalRequests(): Promise<WithdrawalRequest[]> {
    return await db.select()
      .from(schema.withdrawalRequests)
      .orderBy(desc(schema.withdrawalRequests.createdAt));
  }

  async updateWithdrawalRequestStatus(
    id: number, 
    status: 'pending' | 'processing' | 'completed' | 'rejected', 
    adminId?: number, 
    note?: string
  ): Promise<WithdrawalRequest | undefined> {
    const updates: any = { status };
    if (adminId) {
      updates.processedByAdminId = adminId;
      updates.processedAt = new Date();
    }
    if (note) {
      updates.adminNote = note;
    }
    const result = await db.update(schema.withdrawalRequests)
      .set(updates)
      .where(eq(schema.withdrawalRequests.id, id))
      .returning();
    return result[0];
  }

  // Atomic withdrawal: deduct from source, add to in_transit, create withdrawal request
  // Uses database transaction to ensure all-or-nothing behavior
  async createWithdrawalWithBalanceMove(
    userId: number,
    sourceAccountType: 'main' | 'partner_reward',
    amount: number,
    request: InsertWithdrawalRequest
  ): Promise<{ success: boolean; withdrawalRequest?: WithdrawalRequest; error?: string }> {
    // SECURITY: Only allow withdrawals from main or partner_reward accounts
    if (sourceAccountType !== 'main' && sourceAccountType !== 'partner_reward') {
      return { success: false, error: 'Invalid source account type' };
    }

    try {
      // Get source deposit (before transaction to check existence)
      const sourceDeposit = await this.getDepositByUserIdAndType(userId, sourceAccountType);
      if (!sourceDeposit) {
        return { success: false, error: 'Source account not found' };
      }

      // Get or create in_transit deposit (before transaction)
      let inTransitDeposit = await this.getDepositByUserIdAndType(userId, 'in_transit');
      if (!inTransitDeposit) {
        await this.createAllDepositsForUser(userId);
        inTransitDeposit = await this.getDepositByUserIdAndType(userId, 'in_transit');
      }

      if (!inTransitDeposit) {
        return { success: false, error: 'Failed to get in_transit account' };
      }

      // Use database transaction for atomic operations with SQL-level arithmetic
      const result = await db.transaction(async (tx) => {
        // Atomically deduct from source ONLY IF balance is sufficient (prevents overdraft)
        // Uses WHERE balance >= amount to ensure atomic balance check + update
        const updateResult = await tx.update(schema.deposits)
          .set({ balance: sql`${schema.deposits.balance} - ${amount}` })
          .where(and(
            eq(schema.deposits.id, sourceDeposit.id),
            gte(schema.deposits.balance, amount)
          ));

        // Check if update succeeded (rowCount = 0 means insufficient balance)
        if (updateResult.rowCount === 0) {
          throw new Error('INSUFFICIENT_BALANCE');
        }

        // Atomically add to in_transit using SQL expression
        await tx.update(schema.deposits)
          .set({ balance: sql`${schema.deposits.balance} + ${amount}` })
          .where(eq(schema.deposits.id, inTransitDeposit!.id));

        // Create withdrawal request
        const withdrawalResult = await tx.insert(schema.withdrawalRequests)
          .values(request)
          .returning();
        const withdrawalRequest = withdrawalResult[0];

        // Create transaction records
        await tx.insert(schema.depositTransactions).values({
          depositId: sourceDeposit.id,
          type: 'withdrawal_request',
          amount: -amount,
          reference: `Withdrawal request #${withdrawalRequest.id}`,
          status: 'completed',
          withdrawalRequestId: withdrawalRequest.id,
        });

        await tx.insert(schema.depositTransactions).values({
          depositId: inTransitDeposit!.id,
          type: 'transfer_in',
          amount: amount,
          reference: `Withdrawal in transit #${withdrawalRequest.id}`,
          status: 'completed',
          withdrawalRequestId: withdrawalRequest.id,
        });

        return withdrawalRequest;
      });

      return { success: true, withdrawalRequest: result };
    } catch (error: unknown) {
      console.error('Withdrawal balance move error:', error);
      if (error instanceof Error && error.message === 'INSUFFICIENT_BALANCE') {
        return { success: false, error: 'Insufficient balance' };
      }
      return { success: false, error: 'Transaction failed' };
    }
  }

  // Complete withdrawal: deduct from in_transit after admin confirms bank transfer
  // Uses database transaction to ensure all-or-nothing behavior
  async completeWithdrawal(
    withdrawalId: number,
    adminId: number,
    adminNote?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const withdrawal = await this.getWithdrawalRequestById(withdrawalId);
      if (!withdrawal) {
        return { success: false, error: 'Withdrawal request not found' };
      }

      if (withdrawal.status !== 'pending' && withdrawal.status !== 'processing') {
        return { success: false, error: 'Withdrawal already processed' };
      }

      // Get in_transit deposit
      const inTransitDeposit = await this.getDepositByUserIdAndType(withdrawal.userId, 'in_transit');
      if (!inTransitDeposit) {
        return { success: false, error: 'In transit account not found' };
      }

      const withdrawalAmount = parseFloat(String(withdrawal.amount));

      // Use database transaction for atomic operations with SQL-level arithmetic
      await db.transaction(async (tx) => {
        // Atomically deduct from in_transit ONLY IF balance is sufficient (prevents overdraft)
        const updateResult = await tx.update(schema.deposits)
          .set({ balance: sql`${schema.deposits.balance} - ${withdrawalAmount}` })
          .where(and(
            eq(schema.deposits.id, inTransitDeposit.id),
            gte(schema.deposits.balance, withdrawalAmount)
          ));

        // Check if update succeeded (rowCount = 0 means insufficient balance in transit)
        if (updateResult.rowCount === 0) {
          throw new Error('INSUFFICIENT_IN_TRANSIT');
        }

        // Update withdrawal request status
        await tx.update(schema.withdrawalRequests)
          .set({
            status: 'completed',
            processedByAdminId: adminId,
            processedAt: new Date(),
            adminNote: adminNote || null,
          })
          .where(eq(schema.withdrawalRequests.id, withdrawalId));

        // Create transaction record for completion
        await tx.insert(schema.depositTransactions).values({
          depositId: inTransitDeposit.id,
          type: 'withdrawal_completed',
          amount: -withdrawalAmount,
          reference: `Withdrawal completed #${withdrawalId}`,
          status: 'completed',
          withdrawalRequestId: withdrawalId,
        });
      });

      return { success: true };
    } catch (error: unknown) {
      console.error('Complete withdrawal error:', error);
      if (error instanceof Error && error.message === 'INSUFFICIENT_IN_TRANSIT') {
        return { success: false, error: 'Insufficient balance in transit' };
      }
      return { success: false, error: 'Transaction failed' };
    }
  }

  // Reject withdrawal: return funds from in_transit to source account
  // Uses database transaction to ensure all-or-nothing behavior
  async rejectWithdrawal(
    withdrawalId: number,
    adminId: number,
    adminNote?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const withdrawal = await this.getWithdrawalRequestById(withdrawalId);
      if (!withdrawal) {
        return { success: false, error: 'Withdrawal request not found' };
      }

      if (withdrawal.status !== 'pending' && withdrawal.status !== 'processing') {
        return { success: false, error: 'Withdrawal already processed' };
      }

      // Get in_transit deposit
      const inTransitDeposit = await this.getDepositByUserIdAndType(withdrawal.userId, 'in_transit');
      if (!inTransitDeposit) {
        return { success: false, error: 'In transit account not found' };
      }

      // Get source deposit
      const sourceDeposit = await this.getDepositByUserIdAndType(
        withdrawal.userId, 
        withdrawal.sourceAccountType as 'main' | 'partner_reward'
      );
      if (!sourceDeposit) {
        return { success: false, error: 'Source account not found' };
      }

      // Convert amount to number for transaction records
      const withdrawalAmount = parseFloat(String(withdrawal.amount));

      // Use database transaction for atomic operations with SQL-level arithmetic
      await db.transaction(async (tx) => {
        // Atomically return funds from in_transit ONLY IF balance is sufficient (prevents overdraft)
        const updateResult = await tx.update(schema.deposits)
          .set({ balance: sql`${schema.deposits.balance} - ${withdrawalAmount}` })
          .where(and(
            eq(schema.deposits.id, inTransitDeposit.id),
            gte(schema.deposits.balance, withdrawalAmount)
          ));

        // Check if update succeeded (rowCount = 0 means insufficient balance in transit)
        if (updateResult.rowCount === 0) {
          throw new Error('INSUFFICIENT_IN_TRANSIT');
        }

        // Atomically add to source
        await tx.update(schema.deposits)
          .set({ balance: sql`${schema.deposits.balance} + ${withdrawalAmount}` })
          .where(eq(schema.deposits.id, sourceDeposit.id));

        // Update withdrawal request status
        await tx.update(schema.withdrawalRequests)
          .set({
            status: 'rejected',
            processedByAdminId: adminId,
            processedAt: new Date(),
            adminNote: adminNote || null,
          })
          .where(eq(schema.withdrawalRequests.id, withdrawalId));

        // Create transaction records for refund
        await tx.insert(schema.depositTransactions).values({
          depositId: inTransitDeposit.id,
          type: 'transfer_out',
          amount: -withdrawalAmount,
          reference: `Withdrawal rejected #${withdrawalId} - funds returned`,
          status: 'completed',
        });

        await tx.insert(schema.depositTransactions).values({
          depositId: sourceDeposit.id,
          type: 'transfer_in',
          amount: withdrawalAmount,
          reference: `Funds returned - Withdrawal #${withdrawalId} rejected`,
          status: 'completed',
        });
      });

      return { success: true };
    } catch (error: unknown) {
      console.error('Reject withdrawal error:', error);
      if (error instanceof Error && error.message === 'INSUFFICIENT_IN_TRANSIT') {
        return { success: false, error: 'Insufficient balance in transit' };
      }
      return { success: false, error: 'Transaction failed' };
    }
  }

  // Admin Reports - Balance report at a specific date
  async getDepositBalanceReport(asOfDate: Date): Promise<{
    users: {
      userId: number;
      displayName: string;
      phone: string;
      userType: string;
      inn: string | null;
      pinfl: string | null;
      main: number;
      blocked: number;
      in_transit: number;
      partner_reward: number;
      total: number;
    }[];
    totals: {
      main: number;
      blocked: number;
      in_transit: number;
      partner_reward: number;
      total: number;
    };
  }> {
    // Get all users with their current balances and profile info
    const usersData = await db.select({
      userId: schema.users.id,
      displayName: schema.users.displayName,
      phone: schema.users.phone,
      userType: schema.users.userType,
      inn: schema.profiles.inn,
      pinfl: schema.profiles.pinfl,
    })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.users.id, schema.profiles.userId));

    const userBalances: {
      userId: number;
      displayName: string;
      phone: string;
      userType: string;
      inn: string | null;
      pinfl: string | null;
      main: number;
      blocked: number;
      in_transit: number;
      partner_reward: number;
      total: number;
    }[] = [];

    const totals = {
      main: 0,
      blocked: 0,
      in_transit: 0,
      partner_reward: 0,
      total: 0,
    };

    for (const user of usersData) {
      // Get deposits for this user - use the balance field directly (same source as user's Deposit section)
      const deposits = await db.select()
        .from(schema.deposits)
        .where(eq(schema.deposits.userId, user.userId));

      const balances = {
        main: 0,
        blocked: 0,
        in_transit: 0,
        partner_reward: 0,
      };

      for (const deposit of deposits) {
        // Use the maintained balance field directly - this is the source of truth
        // and matches what users see in their Deposit section
        const balance = parseFloat(deposit.balance as string || '0');
        balances[deposit.accountType as keyof typeof balances] = balance;
      }

      const total = balances.main + balances.blocked + balances.in_transit + balances.partner_reward;

      if (total !== 0 || deposits.length > 0) {
        userBalances.push({
          userId: user.userId,
          displayName: user.displayName,
          phone: user.phone,
          userType: user.userType,
          inn: user.inn,
          pinfl: user.pinfl,
          ...balances,
          total,
        });

        totals.main += balances.main;
        totals.blocked += balances.blocked;
        totals.in_transit += balances.in_transit;
        totals.partner_reward += balances.partner_reward;
        totals.total += total;
      }
    }

    return { users: userBalances, totals };
  }

  // Admin Reports - Turnover report for a period
  async getDepositTurnoverReport(startDate: Date, endDate: Date): Promise<{
    users: {
      userId: number;
      displayName: string;
      phone: string;
      userType: string;
      creditMain: number;
      debitMain: number;
      creditBlocked: number;
      debitBlocked: number;
      creditInTransit: number;
      debitInTransit: number;
      creditPartnerReward: number;
      debitPartnerReward: number;
    }[];
    totals: {
      creditMain: number;
      debitMain: number;
      creditBlocked: number;
      debitBlocked: number;
      creditInTransit: number;
      debitInTransit: number;
      creditPartnerReward: number;
      debitPartnerReward: number;
    };
  }> {
    const usersData = await db.select({
      userId: schema.users.id,
      displayName: schema.users.displayName,
      phone: schema.users.phone,
      userType: schema.users.userType,
    }).from(schema.users);

    const userTurnovers: {
      userId: number;
      displayName: string;
      phone: string;
      userType: string;
      creditMain: number;
      debitMain: number;
      creditBlocked: number;
      debitBlocked: number;
      creditInTransit: number;
      debitInTransit: number;
      creditPartnerReward: number;
      debitPartnerReward: number;
    }[] = [];

    const totals = {
      creditMain: 0,
      debitMain: 0,
      creditBlocked: 0,
      debitBlocked: 0,
      creditInTransit: 0,
      debitInTransit: 0,
      creditPartnerReward: 0,
      debitPartnerReward: 0,
    };

    for (const user of usersData) {
      const deposits = await db.select()
        .from(schema.deposits)
        .where(eq(schema.deposits.userId, user.userId));

      const turnovers = {
        creditMain: 0,
        debitMain: 0,
        creditBlocked: 0,
        debitBlocked: 0,
        creditInTransit: 0,
        debitInTransit: 0,
        creditPartnerReward: 0,
        debitPartnerReward: 0,
      };

      let hasActivity = false;

      for (const deposit of deposits) {
        const transactions = await db.select({
          amount: schema.depositTransactions.amount,
          type: schema.depositTransactions.type,
        })
        .from(schema.depositTransactions)
        .where(
          and(
            eq(schema.depositTransactions.depositId, deposit.id),
            eq(schema.depositTransactions.status, 'completed'),
            gte(schema.depositTransactions.createdAt, startDate),
            lte(schema.depositTransactions.createdAt, endDate)
          )
        );

        // Determine credit/debit by transaction type (same logic as user cabinet)
        // Credit types increase balance, Debit types decrease balance
        const creditTypes = ['topup', 'unblock', 'escrow_release', 'escrow_refund', 'transfer_in', 'registration_bonus'];
        
        for (const tx of transactions) {
          hasActivity = true;
          const accountType = deposit.accountType;
          // Always use absolute value - sign is determined by transaction type
          const amount = Math.abs(parseFloat(tx.amount as string || '0'));
          const isCredit = creditTypes.includes(tx.type);
          
          if (isCredit) {
            if (accountType === 'main') turnovers.creditMain += amount;
            else if (accountType === 'blocked') turnovers.creditBlocked += amount;
            else if (accountType === 'in_transit') turnovers.creditInTransit += amount;
            else if (accountType === 'partner_reward') turnovers.creditPartnerReward += amount;
          } else {
            if (accountType === 'main') turnovers.debitMain += amount;
            else if (accountType === 'blocked') turnovers.debitBlocked += amount;
            else if (accountType === 'in_transit') turnovers.debitInTransit += amount;
            else if (accountType === 'partner_reward') turnovers.debitPartnerReward += amount;
          }
        }
      }

      if (hasActivity) {
        userTurnovers.push({
          userId: user.userId,
          displayName: user.displayName,
          phone: user.phone,
          userType: user.userType,
          ...turnovers,
        });

        totals.creditMain += turnovers.creditMain;
        totals.debitMain += turnovers.debitMain;
        totals.creditBlocked += turnovers.creditBlocked;
        totals.debitBlocked += turnovers.debitBlocked;
        totals.creditInTransit += turnovers.creditInTransit;
        totals.debitInTransit += turnovers.debitInTransit;
        totals.creditPartnerReward += turnovers.creditPartnerReward;
        totals.debitPartnerReward += turnovers.debitPartnerReward;
      }
    }

    return { users: userTurnovers, totals };
  }

  // Admin Reports - Orders report with filtering and pagination
  async getOrdersReport(filters: {
    startDate?: Date;
    endDate?: Date;
    status?: string[];
    includeDeleted?: boolean;
    page: number;
    pageSize: number;
  }): Promise<{
    orders: any[];
    total: number;
    statusCounts: Record<string, number>;
    deletedCount: number;
  }> {
    const conditions: SQL[] = [];
    
    // Include deleted orders if requested, otherwise exclude them
    if (!filters.includeDeleted) {
      conditions.push(isNull(schema.orders.deletedAt));
    }

    if (filters.startDate) {
      conditions.push(gte(schema.orders.createdAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(schema.orders.createdAt, filters.endDate));
    }
    if (filters.status && filters.status.length > 0) {
      // Handle 'deleted' status specially
      if (filters.status.includes('deleted')) {
        const otherStatuses = filters.status.filter(s => s !== 'deleted');
        if (otherStatuses.length > 0) {
          // Show deleted orders OR orders with other specified statuses
          conditions.push(
            or(
              isNotNull(schema.orders.deletedAt),
              inArray(schema.orders.status, otherStatuses as any)
            )!
          );
        } else {
          // Only show deleted orders
          conditions.push(isNotNull(schema.orders.deletedAt));
        }
      } else {
        conditions.push(inArray(schema.orders.status, filters.status as any));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(schema.orders)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);

    // Get status counts for the filtered period (without status filter, but respect includeDeleted)
    const statusConditions: SQL[] = [];
    if (!filters.includeDeleted) {
      statusConditions.push(isNull(schema.orders.deletedAt));
    }
    if (filters.startDate) {
      statusConditions.push(gte(schema.orders.createdAt, filters.startDate));
    }
    if (filters.endDate) {
      statusConditions.push(lte(schema.orders.createdAt, filters.endDate));
    }

    const statusCountsResult = await db.select({
      status: schema.orders.status,
      count: sql<number>`count(*)`,
    })
    .from(schema.orders)
    .where(statusConditions.length > 0 ? and(...statusConditions) : undefined)
    .groupBy(schema.orders.status);

    const statusCounts: Record<string, number> = {};
    for (const row of statusCountsResult) {
      statusCounts[row.status] = Number(row.count);
    }

    // Get count of deleted orders (for filter badge)
    const deletedConditions: SQL[] = [isNotNull(schema.orders.deletedAt)];
    if (filters.startDate) {
      deletedConditions.push(gte(schema.orders.createdAt, filters.startDate));
    }
    if (filters.endDate) {
      deletedConditions.push(lte(schema.orders.createdAt, filters.endDate));
    }
    const deletedCountResult = await db.select({ count: sql<number>`count(*)` })
      .from(schema.orders)
      .where(and(...deletedConditions));
    const deletedCount = Number(deletedCountResult[0]?.count || 0);

    // Get paginated orders with customer info and profile
    const offset = (filters.page - 1) * filters.pageSize;
    const ordersData = await db.select({
      order: schema.orders,
      customer: schema.users,
      customerProfile: schema.profiles,
    })
    .from(schema.orders)
    .leftJoin(schema.users, eq(schema.orders.customerId, schema.users.id))
    .leftJoin(schema.profiles, eq(schema.orders.customerId, schema.profiles.userId))
    .where(whereClause)
    .orderBy(desc(schema.orders.createdAt))
    .limit(filters.pageSize)
    .offset(offset);

    // Get offer counts for each order
    const orderIds = ordersData.map(row => row.order.id);
    const offerCountsMap: Record<number, number> = {};
    
    if (orderIds.length > 0) {
      const offerCounts = await db.select({
        orderId: schema.offers.orderId,
        count: sql<number>`count(*)`,
      })
      .from(schema.offers)
      .where(inArray(schema.offers.orderId, orderIds))
      .groupBy(schema.offers.orderId);
      
      for (const row of offerCounts) {
        offerCountsMap[row.orderId] = Number(row.count);
      }
    }

    const orders = ordersData.map(row => ({
      ...row.order,
      offersCount: offerCountsMap[row.order.id] || 0,
      isDeleted: row.order.deletedAt !== null,
      customer: row.customer ? {
        id: row.customer.id,
        displayName: row.customer.displayName,
        phone: row.customer.phone,
        inn: row.customerProfile?.inn || null,
        pinfl: row.customerProfile?.pinfl || null,
      } : null,
    }));

    return { orders, total, statusCounts, deletedCount };
  }

  // Admin Reports - Contracts report with filtering and pagination
  async getContractsReport(filters: {
    startDate?: Date;
    endDate?: Date;
    status?: string[];
    page: number;
    pageSize: number;
  }): Promise<{
    contracts: any[];
    total: number;
    statusCounts: Record<string, number>;
  }> {
    const conditions: SQL[] = [];

    if (filters.startDate) {
      conditions.push(gte(schema.contracts.generatedAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(schema.contracts.generatedAt, filters.endDate));
    }
    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(schema.contracts.status, filters.status as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(schema.contracts)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);

    // Get status counts for the filtered period (without status filter)
    const statusConditions: SQL[] = [];
    if (filters.startDate) {
      statusConditions.push(gte(schema.contracts.generatedAt, filters.startDate));
    }
    if (filters.endDate) {
      statusConditions.push(lte(schema.contracts.generatedAt, filters.endDate));
    }

    const statusCountsResult = await db.select({
      status: schema.contracts.status,
      count: sql<number>`count(*)`,
    })
    .from(schema.contracts)
    .where(statusConditions.length > 0 ? and(...statusConditions) : undefined)
    .groupBy(schema.contracts.status);

    const statusCounts: Record<string, number> = {};
    for (const row of statusCountsResult) {
      statusCounts[row.status] = Number(row.count);
    }

    // Get paginated contracts with customer and carrier info
    const offset = (filters.page - 1) * filters.pageSize;
    const contractsData = await db.select({
      contract: schema.contracts,
      customer: schema.users,
      customerProfile: schema.profiles,
      order: schema.orders,
    })
    .from(schema.contracts)
    .leftJoin(schema.users, eq(schema.contracts.customerId, schema.users.id))
    .leftJoin(schema.profiles, eq(schema.contracts.customerId, schema.profiles.userId))
    .leftJoin(schema.orders, eq(schema.contracts.orderId, schema.orders.id))
    .where(whereClause)
    .orderBy(desc(schema.contracts.generatedAt))
    .limit(filters.pageSize)
    .offset(offset);

    // Get carrier info separately with profile
    const contracts = await Promise.all(contractsData.map(async (row) => {
      const carrierData = await db.select({
        user: schema.users,
        profile: schema.profiles,
      })
      .from(schema.users)
      .leftJoin(schema.profiles, eq(schema.users.id, schema.profiles.userId))
      .where(eq(schema.users.id, row.contract.carrierId))
      .limit(1);

      const carrier = carrierData[0];

      // Determine signedAt - use the later of customer and carrier signed dates
      const customerSigned = row.contract.customerSignedAt;
      const carrierSigned = row.contract.carrierSignedAt;
      let signedAt: Date | null = null;
      if (customerSigned && carrierSigned) {
        signedAt = customerSigned > carrierSigned ? customerSigned : carrierSigned;
      } else if (customerSigned) {
        signedAt = customerSigned;
      } else if (carrierSigned) {
        signedAt = carrierSigned;
      }

      return {
        ...row.contract,
        totalPrice: row.order?.priceWithVat || null,
        signedAt,
        customer: row.customer ? {
          id: row.customer.id,
          displayName: row.customer.displayName,
          phone: row.customer.phone,
          inn: row.customerProfile?.inn || null,
          pinfl: row.customerProfile?.pinfl || null,
        } : null,
        carrier: carrier?.user ? {
          id: carrier.user.id,
          displayName: carrier.user.displayName,
          phone: carrier.user.phone,
          inn: carrier.profile?.inn || null,
          pinfl: carrier.profile?.pinfl || null,
        } : null,
        order: row.order ? {
          id: row.order.id,
          title: row.order.title,
          priceWithVat: row.order.priceWithVat,
        } : null,
      };
    }));

    return { contracts, total, statusCounts };
  }

  // Admin Reports - Partner rewards report with filtering and pagination
  async getPartnerRewardsReport(filters: {
    startDate?: Date;
    endDate?: Date;
    page: number;
    pageSize: number;
  }): Promise<{
    rewards: any[];
    total: number;
  }> {
    const conditions: SQL[] = [];

    if (filters.startDate) {
      conditions.push(gte(schema.partnerCommissions.createdAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(schema.partnerCommissions.createdAt, filters.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(schema.partnerCommissions)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);

    // Get paginated rewards with all required joins
    const offset = (filters.page - 1) * filters.pageSize;
    const rewardsData = await db.select({
      commission: schema.partnerCommissions,
      partner: schema.partners,
      partnerUser: schema.users,
      order: schema.orders,
    })
    .from(schema.partnerCommissions)
    .leftJoin(schema.partners, eq(schema.partnerCommissions.partnerId, schema.partners.id))
    .leftJoin(schema.users, eq(schema.partners.userId, schema.users.id))
    .leftJoin(schema.orders, eq(schema.partnerCommissions.orderId, schema.orders.id))
    .where(whereClause)
    .orderBy(desc(schema.partnerCommissions.createdAt))
    .limit(filters.pageSize)
    .offset(offset);

    // Enrich with additional data (profiles, contract, customer, carrier)
    const rewards = await Promise.all(rewardsData.map(async (row) => {
      // Get partner profile
      const partnerProfile = row.partner?.userId 
        ? await this.getProfileByUserId(row.partner.userId)
        : null;

      // Get contract for this order
      const contractData = row.order?.id 
        ? await db.select().from(schema.contracts).where(eq(schema.contracts.orderId, row.order.id)).limit(1)
        : [];
      const contract = contractData[0];

      // Get customer info
      const customerData = row.order?.customerId
        ? await db.select({
            user: schema.users,
            profile: schema.profiles,
          })
          .from(schema.users)
          .leftJoin(schema.profiles, eq(schema.users.id, schema.profiles.userId))
          .where(eq(schema.users.id, row.order.customerId))
          .limit(1)
        : [];
      const customer = customerData[0];

      // Get carrier info from contract
      const carrierData = contract?.carrierId
        ? await db.select({
            user: schema.users,
            profile: schema.profiles,
          })
          .from(schema.users)
          .leftJoin(schema.profiles, eq(schema.users.id, schema.profiles.userId))
          .where(eq(schema.users.id, contract.carrierId))
          .limit(1)
        : [];
      const carrier = carrierData[0];

      // Get accepted offer price (contract amount)
      const acceptedOfferData = (contract && row.order?.id)
        ? await db.select()
          .from(schema.offers)
          .where(and(
            eq(schema.offers.orderId, row.order.id),
            eq(schema.offers.carrierId, contract.carrierId),
            eq(schema.offers.status, 'accepted')
          ))
          .limit(1)
        : [];
      const acceptedOffer = acceptedOfferData[0];

      // Determine partner display based on user type
      const userType = row.partnerUser?.userType;
      const isOrganization = userType === 'legal' || userType === 'ip';
      
      return {
        id: row.commission.id,
        amount: row.commission.amount,
        createdAt: row.commission.createdAt,
        status: row.commission.status,
        partner: {
          userType: userType || null,
          // For individuals: show name fields; for orgs: show null
          lastName: !isOrganization ? (row.partnerUser?.lastName || null) : null,
          firstName: !isOrganization ? (row.partnerUser?.firstName || null) : null,
          middleName: !isOrganization ? (row.partnerUser?.middleName || null) : null,
          // For orgs: show company name or displayName; for individuals: show profile company if exists
          companyName: isOrganization 
            ? (partnerProfile?.companyName || row.partnerUser?.displayName || null)
            : (partnerProfile?.companyName || null),
          // INN only for legal entities
          inn: userType === 'legal' ? (partnerProfile?.inn || null) : null,
          // PINFL for individuals and IPs
          pinfl: (userType === 'individual' || userType === 'ip') ? (partnerProfile?.pinfl || null) : null,
        },
        customer: customer?.user ? {
          displayName: customer.user.displayName,
          companyName: customer.profile?.companyName || null,
        } : null,
        carrier: carrier?.user ? {
          displayName: carrier.user.displayName,
          companyName: carrier.profile?.companyName || null,
        } : null,
        contract: contract ? {
          id: contract.id,
          generatedAt: contract.generatedAt,
          status: contract.status,
          // Contract amount is the accepted offer price
          amount: acceptedOffer?.price || null,
        } : null,
        order: row.order ? {
          id: row.order.id,
          priceWithVat: row.order.priceWithVat,
        } : null,
      };
    }));

    return { rewards, total };
  }

  async getPlatformCommissionReport(filters: {
    startDate?: Date;
    endDate?: Date;
    status?: string[];
    page: number;
    pageSize: number;
  }): Promise<{
    commissions: any[];
    total: number;
    totalCommission: number;
  }> {
    const conditions: SQL[] = [];

    if (filters.startDate) {
      conditions.push(gte(schema.contracts.generatedAt, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(schema.contracts.generatedAt, filters.endDate));
    }
    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(schema.contracts.status, filters.status as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(schema.contracts)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);

    // Get paginated contracts with joins
    const offset = (filters.page - 1) * filters.pageSize;
    const contractsData = await db.select({
      contract: schema.contracts,
      order: schema.orders,
    })
    .from(schema.contracts)
    .leftJoin(schema.orders, eq(schema.contracts.orderId, schema.orders.id))
    .where(whereClause)
    .orderBy(desc(schema.contracts.generatedAt))
    .limit(filters.pageSize)
    .offset(offset);

    // Enrich with customer, carrier, and offer data
    let totalCommissionSum = 0;
    const commissions = await Promise.all(contractsData.map(async (row) => {
      // Get customer info
      const customerData = row.order?.customerId
        ? await db.select({
            user: schema.users,
            profile: schema.profiles,
          })
          .from(schema.users)
          .leftJoin(schema.profiles, eq(schema.users.id, schema.profiles.userId))
          .where(eq(schema.users.id, row.order.customerId))
          .limit(1)
        : [];
      const customer = customerData[0];

      // Get carrier info
      const carrierData = row.contract?.carrierId
        ? await db.select({
            user: schema.users,
            profile: schema.profiles,
          })
          .from(schema.users)
          .leftJoin(schema.profiles, eq(schema.users.id, schema.profiles.userId))
          .where(eq(schema.users.id, row.contract.carrierId))
          .limit(1)
        : [];
      const carrier = carrierData[0];

      // Get accepted offer for contract amount and commission
      const acceptedOfferData = (row.contract && row.order?.id)
        ? await db.select()
          .from(schema.offers)
          .where(and(
            eq(schema.offers.orderId, row.order.id),
            eq(schema.offers.carrierId, row.contract.carrierId),
            eq(schema.offers.status, 'accepted')
          ))
          .limit(1)
        : [];
      const acceptedOffer = acceptedOfferData[0];

      // Contract amount is accepted offer price
      const contractAmount = acceptedOffer?.price || row.order?.priceWithVat || 0;
      // Platform commission is 2% of contract amount
      const commissionAmount = Math.floor(contractAmount * 0.02);
      totalCommissionSum += commissionAmount;

      // Get commission source account from accepted offer
      const commissionSourceAccount = acceptedOffer?.commissionSourceAccount || 'main';
      // Calculate commission breakdown by source account
      const commissionFromMain = commissionSourceAccount === 'main' ? commissionAmount : 0;
      const commissionFromBonus = commissionSourceAccount === 'registration_bonus' ? commissionAmount : 0;

      // Determine carrier type for INN/PINFL display
      const carrierUserType = carrier?.user?.userType;

      return {
        id: row.contract.id,
        customer: customer?.user ? {
          displayName: customer.user.displayName,
          companyName: customer.profile?.companyName || null,
          userType: customer.user.userType,
        } : null,
        carrier: carrier?.user ? {
          displayName: carrier.user.displayName,
          companyName: carrier.profile?.companyName || null,
          userType: carrierUserType,
          // INN only for legal entities
          inn: carrierUserType === 'legal' ? (carrier.profile?.inn || null) : null,
          // PINFL for individuals and IPs
          pinfl: (carrierUserType === 'individual' || carrierUserType === 'ip') ? (carrier.profile?.pinfl || null) : null,
        } : null,
        order: row.order ? {
          id: row.order.id,
          createdAt: row.order.createdAt,
        } : null,
        contract: {
          id: row.contract.id,
          generatedAt: row.contract.generatedAt,
          status: row.contract.status,
          amount: contractAmount,
        },
        commissionAmount,
        commissionFromMain,
        commissionFromBonus,
        commissionSourceAccount,
      };
    }));

    // For total commission across all records (not just this page), we need a separate query
    const allContractsForSum = await db.select({
      contract: schema.contracts,
      order: schema.orders,
    })
    .from(schema.contracts)
    .leftJoin(schema.orders, eq(schema.contracts.orderId, schema.orders.id))
    .where(whereClause);

    let grandTotalCommission = 0;
    for (const row of allContractsForSum) {
      if (row.contract && row.order) {
        const offerData = await db.select()
          .from(schema.offers)
          .where(and(
            eq(schema.offers.orderId, row.order.id),
            eq(schema.offers.carrierId, row.contract.carrierId),
            eq(schema.offers.status, 'accepted')
          ))
          .limit(1);
        const offer = offerData[0];
        const amount = offer?.price || row.order.priceWithVat || 0;
        grandTotalCommission += Math.floor(amount * 0.02);
      }
    }

    return { commissions, total, totalCommission: grandTotalCommission };
  }

  // Telegram Notifications
  async getTelegramNotificationByOrderId(orderId: number, chatId: string): Promise<TelegramNotification | undefined> {
    const result = await db.select()
      .from(schema.telegramNotifications)
      .where(and(
        eq(schema.telegramNotifications.orderId, orderId),
        eq(schema.telegramNotifications.chatId, chatId)
      ));
    return result[0];
  }

  async createTelegramNotification(data: { orderId: number; chatId: string; messageId: number; lastStatus: string }): Promise<TelegramNotification> {
    const result = await db.insert(schema.telegramNotifications).values({
      orderId: data.orderId,
      chatId: data.chatId,
      messageId: data.messageId,
      lastStatus: data.lastStatus,
    }).returning();
    return result[0];
  }

  async updateTelegramNotification(orderId: number, chatId: string, updates: { messageId?: number; lastStatus?: string }): Promise<TelegramNotification | undefined> {
    const result = await db.update(schema.telegramNotifications)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(schema.telegramNotifications.orderId, orderId),
        eq(schema.telegramNotifications.chatId, chatId)
      ))
      .returning();
    return result[0];
  }

  // Telegram Channels
  async getActiveTelegramChannels(channelType?: TelegramChannelType): Promise<TelegramChannel[]> {
    const conditions = [eq(schema.telegramChannels.isActive, true)];
    if (channelType) {
      conditions.push(eq(schema.telegramChannels.channelType, channelType));
    }
    return db.select()
      .from(schema.telegramChannels)
      .where(and(...conditions))
      .orderBy(schema.telegramChannels.name);
  }

  async getAllTelegramChannels(channelType?: TelegramChannelType): Promise<TelegramChannel[]> {
    if (channelType) {
      return db.select()
        .from(schema.telegramChannels)
        .where(eq(schema.telegramChannels.channelType, channelType))
        .orderBy(desc(schema.telegramChannels.createdAt));
    }
    return db.select()
      .from(schema.telegramChannels)
      .orderBy(desc(schema.telegramChannels.createdAt));
  }

  async getTelegramChannelById(id: number): Promise<TelegramChannel | undefined> {
    const result = await db.select()
      .from(schema.telegramChannels)
      .where(eq(schema.telegramChannels.id, id));
    return result[0];
  }

  async getTelegramChannelByChatId(chatId: string, channelType?: TelegramChannelType): Promise<TelegramChannel | undefined> {
    const conditions = [eq(schema.telegramChannels.chatId, chatId)];
    if (channelType) {
      conditions.push(eq(schema.telegramChannels.channelType, channelType));
    }
    const result = await db.select()
      .from(schema.telegramChannels)
      .where(and(...conditions));
    return result[0];
  }

  async createTelegramChannel(data: { chatId: string; name: string; channelType?: TelegramChannelType; createdBy?: number; intervalMinutes?: number; activeHoursFrom?: number; activeHoursTo?: number; timezone?: string; blockedUserIds?: string[] }): Promise<TelegramChannel> {
    const result = await db.insert(schema.telegramChannels).values({
      chatId: data.chatId,
      name: data.name,
      channelType: data.channelType || 'orders',
      isActive: true,
      createdBy: data.createdBy,
      intervalMinutes: data.intervalMinutes ?? 5,
      timezone: data.timezone ?? 'Asia/Tashkent',
      activeHoursFrom: data.activeHoursFrom ?? 9,
      activeHoursTo: data.activeHoursTo ?? 21,
      blockedUserIds: data.blockedUserIds ?? null,
    }).returning();
    return result[0];
  }

  async updateTelegramChannel(id: number, updates: { name?: string; isActive?: boolean; intervalMinutes?: number; activeHoursFrom?: number; activeHoursTo?: number; timezone?: string; lastSentAt?: Date; blockedUserIds?: string[] }): Promise<TelegramChannel | undefined> {
    const result = await db.update(schema.telegramChannels)
      .set(updates)
      .where(eq(schema.telegramChannels.id, id))
      .returning();
    return result[0];
  }

  async deleteTelegramChannel(id: number): Promise<boolean> {
    const result = await db.delete(schema.telegramChannels)
      .where(eq(schema.telegramChannels.id, id))
      .returning();
    return result.length > 0;
  }

  // Mark channel as sent now
  async markTelegramChannelSent(id: number): Promise<void> {
    await db.update(schema.telegramChannels)
      .set({ lastSentAt: new Date() })
      .where(eq(schema.telegramChannels.id, id));
  }

  async updateTelegramChannelPromoIndex(id: number, idx: number): Promise<void> {
    await db.update(schema.telegramChannels)
      .set({ promoRotationIndex: idx })
      .where(eq(schema.telegramChannels.id, id));
  }

  // ── Telegram processed updates (dedup) ──────────────────────────
  async isTelegramUpdateProcessed(updateId: string): Promise<boolean> {
    const r = await db.select().from(schema.telegramProcessedUpdates)
      .where(eq(schema.telegramProcessedUpdates.updateId, updateId));
    return r.length > 0;
  }

  async markTelegramUpdateProcessed(updateId: string): Promise<void> {
    try {
      await db.insert(schema.telegramProcessedUpdates).values({ updateId });
    } catch {
      // ignore duplicate primary key
    }
  }

  // ── Telegram broadcast log ───────────────────────────────────────
  async insertBroadcastLog(channelId: number, announcementId: number): Promise<void> {
    await db.insert(schema.telegramBroadcastLog).values({ channelId, announcementId });
  }

  async getAnnouncementsForBroadcast(channelId: number, intervalMinutes: number): Promise<schema.Announcement[]> {
    // Announcements sent to this channel within the interval window are excluded
    const recentSentSubq = db.select({ announcementId: schema.telegramBroadcastLog.announcementId })
      .from(schema.telegramBroadcastLog)
      .where(and(
        eq(schema.telegramBroadcastLog.channelId, channelId),
        gte(schema.telegramBroadcastLog.sentAt, new Date(Date.now() - intervalMinutes * 60 * 1000)),
      ));

    // Fetch ALL eligible announcements (no per-tick cap — all must be sent)
    return db.select().from(schema.announcements)
      .where(and(
        inArray(schema.announcements.status, ['new', 'active']),
        isNull(schema.announcements.deletedAt),
        eq(schema.announcements.createdByBot, false),
        notInArray(schema.announcements.id, recentSentSubq),
      ))
      .orderBy(desc(schema.announcements.createdAt));
  }

  // ── Telegram skipped/failed AI-source messages ──────────────────
  async listTelegramSkippedMessages(limit: number = 100): Promise<schema.TelegramSkippedMessage[]> {
    return db.select().from(schema.telegramSkippedMessages)
      .orderBy(desc(schema.telegramSkippedMessages.createdAt))
      .limit(limit);
  }

  async countTelegramSkippedMessages(sinceMs?: number): Promise<number> {
    const conditions = sinceMs
      ? [gte(schema.telegramSkippedMessages.createdAt, new Date(Date.now() - sinceMs))]
      : [];
    const r = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.telegramSkippedMessages)
      .where(conditions.length ? and(...conditions) : sql`true`);
    return Number(r[0]?.count ?? 0);
  }

  async getTelegramSkippedMessage(id: number): Promise<schema.TelegramSkippedMessage | undefined> {
    const r = await db.select().from(schema.telegramSkippedMessages)
      .where(eq(schema.telegramSkippedMessages.id, id));
    return r[0];
  }

  async recordTelegramSkippedMessage(data: schema.InsertTelegramSkippedMessage): Promise<schema.TelegramSkippedMessage> {
    // Upsert on (chatId, messageId): if the same message comes back with a
    // newer reason/error, update it instead of creating duplicates.
    const r = await db.insert(schema.telegramSkippedMessages)
      .values(data)
      .onConflictDoUpdate({
        target: [schema.telegramSkippedMessages.chatId, schema.telegramSkippedMessages.messageId],
        set: {
          text: data.text,
          chatTitle: data.chatTitle ?? null,
          reason: data.reason,
          errorDetail: data.errorDetail ?? null,
          createdAt: new Date(),
        },
      })
      .returning();
    return r[0];
  }

  async deleteTelegramSkippedMessage(id: number): Promise<boolean> {
    const r = await db.delete(schema.telegramSkippedMessages)
      .where(eq(schema.telegramSkippedMessages.id, id))
      .returning();
    return r.length > 0;
  }

  // ── Telegram Promo Messages ─────────────────────────────────────
  async getAllTelegramPromoMessages(): Promise<schema.TelegramPromoMessage[]> {
    return db.select().from(schema.telegramPromoMessages)
      .orderBy(schema.telegramPromoMessages.displayOrder, schema.telegramPromoMessages.id);
  }

  async getActiveTelegramPromoMessages(): Promise<schema.TelegramPromoMessage[]> {
    return db.select().from(schema.telegramPromoMessages)
      .where(eq(schema.telegramPromoMessages.isActive, true))
      .orderBy(schema.telegramPromoMessages.displayOrder, schema.telegramPromoMessages.id);
  }

  async createTelegramPromoMessage(data: { textRu: string; textUz: string; isActive?: boolean; displayOrder?: number; createdBy?: number }): Promise<schema.TelegramPromoMessage> {
    const r = await db.insert(schema.telegramPromoMessages).values({
      textRu: data.textRu,
      textUz: data.textUz,
      isActive: data.isActive ?? true,
      displayOrder: data.displayOrder ?? 0,
      createdBy: data.createdBy,
    }).returning();
    return r[0];
  }

  async updateTelegramPromoMessage(id: number, updates: { textRu?: string; textUz?: string; isActive?: boolean; displayOrder?: number }): Promise<schema.TelegramPromoMessage | undefined> {
    const r = await db.update(schema.telegramPromoMessages).set(updates)
      .where(eq(schema.telegramPromoMessages.id, id)).returning();
    return r[0];
  }

  async deleteTelegramPromoMessage(id: number): Promise<boolean> {
    const r = await db.delete(schema.telegramPromoMessages)
      .where(eq(schema.telegramPromoMessages.id, id)).returning();
    return r.length > 0;
  }

  // Bot announcement helpers (for closer + broadcast)
  async getOpenAnnouncementsForBroadcast(limit: number = 30): Promise<schema.Announcement[]> {
    return db.select().from(schema.announcements)
      .where(and(
        inArray(schema.announcements.status, ['new', 'active']),
        isNull(schema.announcements.deletedAt)
      ))
      .orderBy(desc(schema.announcements.createdAt))
      .limit(limit);
  }

  async getExpiredBotAnnouncements(olderThan: Date): Promise<schema.Announcement[]> {
    return db.select().from(schema.announcements)
      .where(and(
        eq(schema.announcements.createdByBot, true),
        inArray(schema.announcements.status, ['new', 'active']),
        lt(schema.announcements.createdAt, olderThan)
      ));
  }

  async findDuplicateActiveAnnouncement(
    originRegion: string,
    destinationRegion: string,
    transportType: string,
    contactPhone: string,
  ): Promise<boolean> {
    // Check for any active announcement with the same route + transport + phone
    const result = await db.select({ id: schema.announcements.id })
      .from(schema.announcements)
      .where(and(
        inArray(schema.announcements.status, ['new', 'active']),
        isNull(schema.announcements.deletedAt),
        eq(schema.announcements.contactPhone, contactPhone),
        sql`${schema.announcements.transportType}::text = ${transportType}`,
        sql`${schema.announcements.originRegions} @> ARRAY[${originRegion}]::text[]`,
        sql`${schema.announcements.destinationRegions} @> ARRAY[${destinationRegion}]::text[]`,
      ))
      .limit(1);
    return result.length > 0;
  }

  // Telegram Auth Requests
  async createTelegramAuthRequest(token: string, expiresAt: Date): Promise<schema.TelegramAuthRequest> {
    const result = await db.insert(schema.telegramAuthRequests).values({
      token,
      status: 'pending',
      expiresAt,
    }).returning();
    return result[0];
  }

  async getTelegramAuthRequest(token: string): Promise<schema.TelegramAuthRequest | undefined> {
    const result = await db.select()
      .from(schema.telegramAuthRequests)
      .where(eq(schema.telegramAuthRequests.token, token));
    return result[0];
  }

  async updateTelegramAuthRequest(token: string, updates: Partial<schema.TelegramAuthRequest>): Promise<schema.TelegramAuthRequest | undefined> {
    const result = await db.update(schema.telegramAuthRequests)
      .set(updates)
      .where(eq(schema.telegramAuthRequests.token, token))
      .returning();
    return result[0];
  }

  async getUserByTelegramId(telegramId: string): Promise<schema.User | undefined> {
    const result = await db.select()
      .from(schema.users)
      .where(eq(schema.users.telegramId, telegramId));
    return result[0];
  }

  async getUsersWithTelegramId(): Promise<schema.User[]> {
    return await db.select()
      .from(schema.users)
      .where(isNotNull(schema.users.telegramId))
      .orderBy(desc(schema.users.createdAt));
  }

  async cleanupExpiredTelegramAuthRequests(): Promise<void> {
    await db.delete(schema.telegramAuthRequests)
      .where(lt(schema.telegramAuthRequests.expiresAt, new Date()));
  }

  // Partner Reward Statements
  async createPartnerRewardStatement(data: { periodMonth: string; createdByAdminId: number }): Promise<PartnerRewardStatement> {
    const result = await db.insert(schema.partnerRewardStatements).values({
      periodMonth: data.periodMonth,
      createdByAdminId: data.createdByAdminId,
      status: 'draft',
    }).returning();
    return result[0];
  }

  async getPartnerRewardStatementById(id: number): Promise<PartnerRewardStatement | undefined> {
    const result = await db.select()
      .from(schema.partnerRewardStatements)
      .where(eq(schema.partnerRewardStatements.id, id));
    return result[0];
  }

  async getAllPartnerRewardStatements(): Promise<PartnerRewardStatement[]> {
    return db.select()
      .from(schema.partnerRewardStatements)
      .orderBy(desc(schema.partnerRewardStatements.createdAt));
  }

  async updatePartnerRewardStatement(id: number, updates: Partial<PartnerRewardStatement>): Promise<PartnerRewardStatement | undefined> {
    const result = await db.update(schema.partnerRewardStatements)
      .set(updates)
      .where(eq(schema.partnerRewardStatements.id, id))
      .returning();
    return result[0];
  }

  async deletePartnerRewardStatement(id: number): Promise<boolean> {
    // First delete all items
    await db.delete(schema.partnerRewardStatementItems)
      .where(eq(schema.partnerRewardStatementItems.statementId, id));
    // Then delete the statement
    const result = await db.delete(schema.partnerRewardStatements)
      .where(eq(schema.partnerRewardStatements.id, id))
      .returning();
    return result.length > 0;
  }

  // Partner Reward Statement Items
  async createPartnerRewardStatementItem(data: InsertPartnerRewardStatementItem): Promise<PartnerRewardStatementItem> {
    const result = await db.insert(schema.partnerRewardStatementItems).values(data).returning();
    return result[0];
  }

  async getPartnerRewardStatementItems(statementId: number): Promise<PartnerRewardStatementItem[]> {
    return db.select()
      .from(schema.partnerRewardStatementItems)
      .where(eq(schema.partnerRewardStatementItems.statementId, statementId))
      .orderBy(schema.partnerRewardStatementItems.displayName);
  }

  async updatePartnerRewardStatementItem(id: number, updates: Partial<PartnerRewardStatementItem>): Promise<PartnerRewardStatementItem | undefined> {
    const result = await db.update(schema.partnerRewardStatementItems)
      .set(updates)
      .where(eq(schema.partnerRewardStatementItems.id, id))
      .returning();
    return result[0];
  }

  async deletePartnerRewardStatementItem(id: number): Promise<boolean> {
    const result = await db.delete(schema.partnerRewardStatementItems)
      .where(eq(schema.partnerRewardStatementItems.id, id))
      .returning();
    return result.length > 0;
  }

  // Generate statement items for all users with partner_reward balance
  async generatePartnerRewardStatementItems(statementId: number): Promise<number> {
    const statement = await this.getPartnerRewardStatementById(statementId);
    if (!statement) return 0;

    // Get all users with partner_reward deposit > 0
    const depositsWithBalance = await db.select({
      deposit: schema.deposits,
      user: schema.users,
      profile: schema.profiles,
    })
    .from(schema.deposits)
    .innerJoin(schema.users, eq(schema.deposits.userId, schema.users.id))
    .leftJoin(schema.profiles, eq(schema.users.id, schema.profiles.userId))
    .where(and(
      eq(schema.deposits.accountType, 'partner_reward'),
      sql`${schema.deposits.balance}::numeric > 0`
    ));

    let count = 0;
    let totalAmount = 0;

    for (const row of depositsWithBalance) {
      const balance = parseFloat(row.deposit.balance || '0');
      
      // Create statement item
      await db.insert(schema.partnerRewardStatementItems).values({
        statementId,
        userId: row.user.id,
        displayName: row.user.displayName,
        userType: row.user.userType,
        inn: row.profile?.inn || null,
        pinfl: row.profile?.pinfl || null,
        bankAccount: row.profile?.bankAccount || null,
        bankName: row.profile?.bankName || null,
        bankCode: row.profile?.bankCode || null,
        openingBalance: toDbNum(0), // TODO: Calculate from previous statements
        accruedAmount: toDbNum(balance), // Current balance = accrued for this period
        previousPaidAmount: toDbNum(0), // TODO: Calculate from previous statements
        closingBalance: toDbNum(balance), // Amount to be paid
        paidAmount: toDbNum(0),
        status: 'pending',
      });
      
      count++;
      totalAmount += balance;
    }

    // Update statement totals
    await db.update(schema.partnerRewardStatements)
      .set({ totalAmount: toDbNum(totalAmount) })
      .where(eq(schema.partnerRewardStatements.id, statementId));

    return count;
  }

  // Audit Logs
  async createAuditLog(data: { entityType: string; entityId: number; action: string; performedBy: number; data?: string }): Promise<AuditLog> {
    const result = await db.insert(schema.auditLogs).values(data).returning();
    return result[0];
  }

  async getAuditLogsByEntity(entityType: string, entityId: number): Promise<AuditLog[]> {
    return db.select()
      .from(schema.auditLogs)
      .where(and(
        eq(schema.auditLogs.entityType, entityType),
        eq(schema.auditLogs.entityId, entityId)
      ))
      .orderBy(desc(schema.auditLogs.createdAt));
  }

  // Admin user update with audit logging
  async updateUserByAdmin(userId: number, updates: Partial<User>, adminId: number): Promise<User | undefined> {
    const currentUser = await this.getUserById(userId);
    if (!currentUser) return undefined;

    // Log changes for each field
    const changes: { field: string; oldValue: any; newValue: any }[] = [];
    for (const [key, newValue] of Object.entries(updates)) {
      const oldValue = (currentUser as any)[key];
      if (oldValue !== newValue) {
        changes.push({ field: key, oldValue, newValue });
      }
    }

    if (changes.length > 0) {
      // Update user
      const result = await db.update(schema.users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.users.id, userId))
        .returning();

      // Create audit log
      await this.createAuditLog({
        entityType: 'user',
        entityId: userId,
        action: 'update',
        performedBy: adminId,
        data: JSON.stringify(changes),
      });

      return result[0];
    }

    return currentUser;
  }

  async updateProfileByAdmin(userId: number, updates: Partial<Profile>, adminId: number): Promise<Profile | undefined> {
    const currentProfile = await this.getProfileByUserId(userId);
    if (!currentProfile) return undefined;

    // Log changes for each field
    const changes: { field: string; oldValue: any; newValue: any }[] = [];
    for (const [key, newValue] of Object.entries(updates)) {
      const oldValue = (currentProfile as any)[key];
      if (oldValue !== newValue) {
        changes.push({ field: key, oldValue, newValue });
      }
    }

    if (changes.length > 0) {
      // Update profile
      const result = await db.update(schema.profiles)
        .set(updates)
        .where(eq(schema.profiles.userId, userId))
        .returning();

      // Create audit log
      await this.createAuditLog({
        entityType: 'profile',
        entityId: userId,
        action: 'update',
        performedBy: adminId,
        data: JSON.stringify(changes),
      });

      return result[0];
    }

    return currentProfile;
  }

  // Notifications
  async createNotification(data: InsertNotification): Promise<Notification> {
    const result = await db.insert(schema.notifications).values(data).returning();
    return result[0];
  }

  async getNotificationsByUserId(userId: number, limit: number = 50): Promise<Notification[]> {
    return db.select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationsCount(userId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.notifications)
      .where(and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.isRead, false)
      ));
    return result[0]?.count || 0;
  }

  async markNotificationAsRead(id: number, userId: number): Promise<Notification | undefined> {
    const result = await db.update(schema.notifications)
      .set({ isRead: true })
      .where(and(
        eq(schema.notifications.id, id),
        eq(schema.notifications.userId, userId)
      ))
      .returning();
    return result[0];
  }

  async markAllNotificationsAsRead(userId: number): Promise<number> {
    const result = await db.update(schema.notifications)
      .set({ isRead: true })
      .where(and(
        eq(schema.notifications.userId, userId),
        eq(schema.notifications.isRead, false)
      ))
      .returning();
    return result.length;
  }

  // User Notification Settings
  async getUserNotificationSettings(userId: number): Promise<UserNotificationSetting[]> {
    return db.select()
      .from(schema.userNotificationSettings)
      .where(eq(schema.userNotificationSettings.userId, userId));
  }

  async getUserNotificationSetting(userId: number, notificationType: string): Promise<UserNotificationSetting | undefined> {
    const result = await db.select()
      .from(schema.userNotificationSettings)
      .where(and(
        eq(schema.userNotificationSettings.userId, userId),
        eq(schema.userNotificationSettings.notificationType, notificationType as any)
      ));
    return result[0];
  }

  async upsertUserNotificationSetting(userId: number, notificationType: string, smsEnabled: boolean, inAppEnabled: boolean): Promise<UserNotificationSetting> {
    const existing = await this.getUserNotificationSetting(userId, notificationType);
    if (existing) {
      const result = await db.update(schema.userNotificationSettings)
        .set({ smsEnabled, inAppEnabled, updatedAt: new Date() })
        .where(eq(schema.userNotificationSettings.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(schema.userNotificationSettings)
        .values({
          userId,
          notificationType: notificationType as any,
          smsEnabled,
          inAppEnabled,
        })
        .returning();
      return result[0];
    }
  }

  // Announcements (for individual customers)
  async getAnnouncementById(id: number): Promise<Announcement | undefined> {
    const result = await db.select()
      .from(schema.announcements)
      .where(and(
        eq(schema.announcements.id, id),
        isNull(schema.announcements.deletedAt)
      ));
    return result[0];
  }

  async getAnnouncementsByCustomerId(customerId: number, statusFilter?: string, includeDeleted?: boolean): Promise<Announcement[]> {
    const conditions: SQL<unknown>[] = [
      eq(schema.announcements.customerId, customerId)
    ];
    
    // Only exclude deleted if not showing all
    if (!includeDeleted) {
      conditions.push(isNull(schema.announcements.deletedAt));
    }
    
    if (statusFilter && statusFilter !== 'all') {
      conditions.push(eq(schema.announcements.status, statusFilter as any));
    }
    
    return db.select()
      .from(schema.announcements)
      .where(and(...conditions))
      .orderBy(desc(schema.announcements.createdAt));
  }

  async getPublicAnnouncements(filters?: { status?: string; originRegions?: string[]; destinationRegions?: string[]; transportTypes?: string[]; excludeBot?: boolean }): Promise<Announcement[]> {
    const conditions: SQL<unknown>[] = [
      isNull(schema.announcements.deletedAt),
      or(
        eq(schema.announcements.status, 'new'),
        eq(schema.announcements.status, 'active')
      ) as SQL<unknown>
    ];

    if (filters?.originRegions && filters.originRegions.length > 0) {
      const orConds = filters.originRegions.map(r =>
        sql`${r} = ANY(${schema.announcements.originRegions})` as SQL<unknown>
      );
      conditions.push((orConds.length === 1 ? orConds[0] : or(...orConds)) as SQL<unknown>);
    }

    if (filters?.destinationRegions && filters.destinationRegions.length > 0) {
      const orConds = filters.destinationRegions.map(r =>
        sql`${r} = ANY(${schema.announcements.destinationRegions})` as SQL<unknown>
      );
      conditions.push((orConds.length === 1 ? orConds[0] : or(...orConds)) as SQL<unknown>);
    }

    if (filters?.transportTypes && filters.transportTypes.length > 0) {
      conditions.push(inArray(schema.announcements.transportType, filters.transportTypes as any[]));
    }

    if (filters?.excludeBot) {
      conditions.push(eq(schema.announcements.createdByBot, false));
    }

    return db.select()
      .from(schema.announcements)
      .where(and(...conditions))
      .orderBy(desc(schema.announcements.createdAt));
  }

  async createAnnouncement(announcement: InsertAnnouncement & { customerId: number }): Promise<Announcement> {
    const result = await db.insert(schema.announcements)
      .values({
        customerId: announcement.customerId,
        title: announcement.title,
        originRegions: announcement.originRegions,
        originDistrict: announcement.originDistrict || [],
        destinationRegions: announcement.destinationRegions,
        destinationDistrict: announcement.destinationDistrict || [],
        originPoints: announcement.originPoints,
        destinationPoints: announcement.destinationPoints,
        transportType: announcement.transportType,
        vehicleCount: announcement.vehicleCount || 1,
        weightTons: announcement.weightTons != null && announcement.weightTons !== '' && Number(announcement.weightTons) > 0
          ? toDbNum(announcement.weightTons)
          : null,
        loadDate: announcement.loadDate,
        loadingTime: announcement.loadingTime,
        price: toDbNum(announcement.price),
        paymentTypes: announcement.paymentTypes,
        contactPhone: announcement.contactPhone,
        notes: announcement.notes,
        isDangerous: announcement.isDangerous,
        isNonstandard: announcement.isNonstandard,
        isPartialLoad: announcement.isPartialLoad,
        photoUrls: announcement.photoUrls ?? [],
      })
      .returning();
    return result[0];
  }

  async updateAnnouncement(id: number, updates: Partial<Announcement>): Promise<Announcement | undefined> {
    const updateData: any = { ...updates };
    
    if (updates.weightTons !== undefined) {
      updateData.weightTons = toDbNum(updates.weightTons);
    }
    if (updates.price !== undefined) {
      updateData.price = toDbNum(updates.price);
    }
    
    const result = await db.update(schema.announcements)
      .set(updateData)
      .where(eq(schema.announcements.id, id))
      .returning();
    return result[0];
  }

  async softDeleteAnnouncement(id: number, customerId: number): Promise<boolean> {
    const result = await db.update(schema.announcements)
      .set({ deletedAt: new Date(), status: 'cancelled' })
      .where(and(
        eq(schema.announcements.id, id),
        eq(schema.announcements.customerId, customerId)
      ))
      .returning();
    return result.length > 0;
  }

  async getAdminAnnouncementsList(filters: { status?: string; search?: string; createdBy?: string; page: number; pageSize: number }): Promise<{ announcements: any[]; total: number }> {
    const conditions: SQL[] = [isNull(schema.announcements.deletedAt)];
    if (filters.status && filters.status !== 'all') {
      conditions.push(eq(schema.announcements.status, filters.status as any));
    }
    if (filters.createdBy === 'bot') {
      conditions.push(eq(schema.announcements.createdByBot, true));
    } else if (filters.createdBy === 'user') {
      conditions.push(eq(schema.announcements.createdByBot, false));
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          like(schema.announcements.title, term),
          like(schema.announcements.contactPhone, term),
          like(schema.users.phone, term),
          like(schema.users.name, term),
        )!
      );
    }
    const where = and(...conditions);
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(schema.announcements)
      .leftJoin(schema.users, eq(schema.announcements.customerId, schema.users.id))
      .where(where);
    const total = Number(countResult[0]?.count || 0);
    const offset = (filters.page - 1) * filters.pageSize;
    const rows = await db.select({ ann: schema.announcements, customer: schema.users })
      .from(schema.announcements)
      .leftJoin(schema.users, eq(schema.announcements.customerId, schema.users.id))
      .where(where)
      .orderBy(desc(schema.announcements.createdAt))
      .limit(filters.pageSize)
      .offset(offset);
    return { announcements: rows.map(r => ({ ...r.ann, customerName: r.customer?.name, customerPhone: r.customer?.phone })), total };
  }

  async adminUpdateAnnouncementStatus(id: number, status: string): Promise<void> {
    await db.update(schema.announcements).set({ status: status as any }).where(eq(schema.announcements.id, id));
  }

  async adminUpdateAnnouncementFields(id: number, data: Partial<any>): Promise<void> {
    const allowed = ['title', 'transportType', 'weightTons', 'price', 'loadDate', 'loadingTime', 'contactPhone', 'notes', 'vehicleCount'];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (key in data) update[key] = data[key];
    }
    if (Object.keys(update).length === 0) return;
    await db.update(schema.announcements).set(update).where(eq(schema.announcements.id, id));
  }

  async adminDeleteAnnouncement(id: number): Promise<void> {
    await db.update(schema.announcements)
      .set({ deletedAt: new Date(), status: 'cancelled' })
      .where(eq(schema.announcements.id, id));
  }

  // Announcement Templates
  async getAnnouncementTemplateById(id: number): Promise<AnnouncementTemplate | undefined> {
    const result = await db.select()
      .from(schema.announcementTemplates)
      .where(eq(schema.announcementTemplates.id, id));
    return result[0];
  }

  async getAnnouncementTemplatesByCustomerId(customerId: number): Promise<AnnouncementTemplate[]> {
    return db.select()
      .from(schema.announcementTemplates)
      .where(eq(schema.announcementTemplates.customerId, customerId))
      .orderBy(desc(schema.announcementTemplates.createdAt));
  }

  async createAnnouncementTemplate(template: InsertAnnouncementTemplate & { customerId: number }): Promise<AnnouncementTemplate> {
    const result = await db.insert(schema.announcementTemplates)
      .values({
        customerId: template.customerId,
        name: template.name,
        title: template.title,
        originRegions: template.originRegions,
        originDistrict: template.originDistrict,
        destinationRegions: template.destinationRegions,
        destinationDistrict: template.destinationDistrict,
        originPoints: template.originPoints,
        destinationPoints: template.destinationPoints,
        transportType: template.transportType,
        vehicleCount: template.vehicleCount,
        weightTons: template.weightTons ? toDbNum(template.weightTons) : null,
        loadingTime: template.loadingTime,
        price: template.price ? toDbNum(template.price) : null,
        paymentTypes: template.paymentTypes,
        contactPhone: template.contactPhone,
        notes: template.notes,
        isDangerous: template.isDangerous,
        isNonstandard: template.isNonstandard,
        isPartialLoad: template.isPartialLoad,
      })
      .returning();
    return result[0];
  }

  async updateAnnouncementTemplate(id: number, updates: Partial<AnnouncementTemplate>): Promise<AnnouncementTemplate | undefined> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    
    if (updates.weightTons !== undefined) {
      updateData.weightTons = updates.weightTons ? toDbNum(updates.weightTons) : null;
    }
    if (updates.price !== undefined) {
      updateData.price = updates.price ? toDbNum(updates.price) : null;
    }
    
    const result = await db.update(schema.announcementTemplates)
      .set(updateData)
      .where(eq(schema.announcementTemplates.id, id))
      .returning();
    return result[0];
  }

  async deleteAnnouncementTemplate(id: number, customerId: number): Promise<boolean> {
    const result = await db.delete(schema.announcementTemplates)
      .where(and(
        eq(schema.announcementTemplates.id, id),
        eq(schema.announcementTemplates.customerId, customerId)
      ))
      .returning();
    return result.length > 0;
  }

  // Representatives methods
  async getRepresentativeById(id: number): Promise<Representative | undefined> {
    const result = await db.select()
      .from(schema.representatives)
      .where(eq(schema.representatives.id, id));
    return result[0];
  }

  async getRepresentativesByCustomerId(customerId: number): Promise<Representative[]> {
    return db.select()
      .from(schema.representatives)
      .where(eq(schema.representatives.customerId, customerId))
      .orderBy(desc(schema.representatives.createdAt));
  }

  async getRepresentativeByCustomerAndUser(customerId: number, representativeUserId: number): Promise<Representative | undefined> {
    const result = await db.select()
      .from(schema.representatives)
      .where(and(
        eq(schema.representatives.customerId, customerId),
        eq(schema.representatives.representativeUserId, representativeUserId)
      ));
    return result[0];
  }

  async getPrincipalsByRepresentativeUserId(representativeUserId: number): Promise<Representative[]> {
    return db.select()
      .from(schema.representatives)
      .where(and(
        eq(schema.representatives.representativeUserId, representativeUserId),
        eq(schema.representatives.isActive, true)
      ))
      .orderBy(desc(schema.representatives.createdAt));
  }

  async createRepresentative(data: InsertRepresentative): Promise<Representative> {
    const result = await db.insert(schema.representatives)
      .values({
        customerId: data.customerId,
        representativeUserId: data.representativeUserId,
        permissions: data.permissions || [],
        isActive: data.isActive ?? true,
      })
      .returning();
    return result[0];
  }

  async updateRepresentative(id: number, updates: Partial<Representative>): Promise<Representative | undefined> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    const result = await db.update(schema.representatives)
      .set(updateData)
      .where(eq(schema.representatives.id, id))
      .returning();
    return result[0];
  }

  async deleteRepresentative(id: number): Promise<boolean> {
    const result = await db.delete(schema.representatives)
      .where(eq(schema.representatives.id, id))
      .returning();
    return result.length > 0;
  }

  async checkRepresentativePermission(customerId: number, representativeUserId: number, permission: string): Promise<boolean> {
    const rep = await this.getRepresentativeByCustomerAndUser(customerId, representativeUserId);
    if (!rep || !rep.isActive) return false;
    return (rep.permissions as string[]).includes(permission);
  }
}

export const storage = new DbStorage();
