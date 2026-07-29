// API Configuration
// Change this to your production API URL when deploying
declare const __DEV__: boolean;

// Always use production server for real user data
// Set to false to use Replit dev server for development
const USE_PRODUCTION = true;

const REPLIT_DEV_URL = 'https://711e37ed-cec1-4cf8-8611-a462b1b0e931-00-3ul2wl5ih24mw.spock.replit.dev';
const PRODUCTION_URL = 'https://yukbozor.uz';

export const API_BASE_URL = USE_PRODUCTION ? PRODUCTION_URL : REPLIT_DEV_URL;

export const API_ENDPOINTS = {
  // Auth
  login: '/api/auth/login',
  register: '/api/auth/register',
  logout: '/api/auth/logout',
  me: '/api/auth/me',
  
  // Orders
  orders: '/api/orders',
  myOrders: '/api/orders/my',
  publicOrders: '/api/orders/public/new',
  
  // Offers
  offers: '/api/offers',
  myOffers: '/api/offers/my',
  orderOffers: (orderId: number) => `/api/orders/${orderId}/offers`,
  createOffer: '/api/offers',
  
  // Contracts
  contracts: '/api/contracts',
  myContracts: '/api/contracts/my',
  publicContracts: '/api/contracts/public/concluded',
  requestSignCode: (contractId: number) => `/api/contracts/${contractId}/request-sign-code`,
  signContract: (contractId: number) => `/api/contracts/${contractId}/sign`,
  
  // Deposits
  deposits: '/api/deposits',
  depositAccounts: '/api/deposit-accounts',
  depositTransactions: '/api/deposit-transactions',
  
  // Partners
  partners: '/api/partners',
  referralCode: '/api/partners/referral-code',
  
  // Ratings
  ratings: '/api/ratings',
  
  // Profile
  profile: '/api/profile',
  
  // Announcements
  announcements: '/api/announcements',
  publicAnnouncements: '/api/announcements/public',
  myAnnouncements: '/api/announcements/my',
  announcementTemplates: '/api/announcement-templates',

  // Push notifications
  pushRegister: '/api/push/register',
  pushUnregister: '/api/push/unregister',

  // AI Voice Assistant
  aiTranscribe: '/api/ai/transcribe',
  aiVoiceAnnouncement: '/api/ai/voice-announcement',

  // Chat
  chatRooms: '/api/chat/rooms',
  chatMessages: (roomId: number) => `/api/chat/rooms/${roomId}/messages`,
  chatVoiceToken: (roomId: number) => `/api/chat/rooms/${roomId}/voice-token`,
};
