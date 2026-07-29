import { db } from '../db';
import { didoxUserTokens, didoxDocuments, users, profiles, contracts, orders, offers } from '@shared/schema';
import { eq, and, or, desc } from 'drizzle-orm';

// Test environment: https://stage.goodsign.biz/
// Production environment: https://api-partners.didox.uz/
const DIDOX_API_URL = process.env.DIDOX_API_URL || 'https://stage.goodsign.biz';
const DIDOX_PARTNER_TOKEN = process.env.DIDOX_PARTNER_TOKEN;

// Document type codes in Didox
const DOC_TYPES = {
  factura: 'Factura',
  waybill: 'Waybill',
} as const;

// Status mapping from Didox to our system
const STATUS_MAP: Record<number, string> = {
  0: 'draft',
  1: 'sent',
  2: 'pending',
  3: 'signed',
  4: 'rejected',
  5: 'deleted',
};

interface DidoxAuthResponse {
  token: string;
  company?: {
    name: string;
    taxId: string;
    address?: string;
  };
  related_companies?: Array<{
    taxId: string;
    name: string;
    permissions: string[];
  }>;
}

interface DidoxCompanyInfo {
  taxId: string;
  name: string;
  address?: string;
  director?: string;
  bankAccount?: string;
  bankName?: string;
  bankMfo?: string;
  oked?: string;
  phone?: string;
  // Additional fields from Didox API response
  tin?: string;
  account?: string;
  bankId?: string;
  mobile?: string;
  email?: string;
  regionId?: string;
  districtId?: string;
  soato?: string;
  vat?: boolean;
  vatRegCode?: string;
  accountant?: string;
}

interface DidoxDocumentResponse {
  _id: string;
  status: number;
  doctype: string;
  name: string;
  date: string;
  data: {
    json: Record<string, unknown>;
  };
}

// Helper to make API requests to Didox
async function didoxRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    userToken?: string;
    body?: Record<string, unknown>;
  } = {}
): Promise<T> {
  const { method = 'GET', userToken, body } = options;

  if (!DIDOX_PARTNER_TOKEN) {
    throw new Error('DIDOX_PARTNER_TOKEN is not configured');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Partner-Authorization': DIDOX_PARTNER_TOKEN,
  };

  if (userToken) {
    headers['user-key'] = userToken;
  }

  const response = await fetch(`${DIDOX_API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Didox API error: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<T>;
}

// Auth: Login with password (for users registered in Didox)
export async function loginWithPassword(taxId: string, password: string, locale: 'ru' | 'uz' = 'ru'): Promise<DidoxAuthResponse> {
  const response = await didoxRequest<DidoxAuthResponse>(
    `/v1/auth/${taxId}/password/${locale}`,
    {
      method: 'POST',
      body: { password },
    }
  );

  return response;
}

// Auth: Login with E-IMZO signature
export async function loginWithEimzo(taxId: string, signature: string, locale: 'ru' | 'uz' = 'ru'): Promise<DidoxAuthResponse> {
  const response = await didoxRequest<DidoxAuthResponse>(
    `/v1/auth/${taxId}/token/${locale}`,
    {
      method: 'POST',
      body: { sign: signature },
    }
  );

  return response;
}

// Get company profile by INN (using /v1/profile/{taxId} endpoint)
// According to Didox API docs: returns name, address, director, bank details, etc.
// Note: This endpoint works with INN (TIN) for legal entities and IPs
export async function getCompanyInfo(taxId: string): Promise<DidoxCompanyInfo | null> {
  try {
    // Using the profile endpoint as per Didox API documentation
    const response = await didoxRequest<DidoxCompanyInfo>(
      `/v1/profile/${taxId}`,
      { method: 'GET' }
    );
    
    console.log('Didox API response for', taxId, ':', JSON.stringify(response, null, 2));
    
    // Map response fields to our interface, preserving all fields from Didox
    return {
      taxId: response.taxId || response.tin || taxId,
      name: response.name || '',
      address: response.address || '',
      director: response.director || '',
      bankAccount: response.bankAccount || response.account || '',
      bankName: response.bankName || '',
      bankMfo: response.bankMfo || response.bankId || '',
      oked: response.oked || '',
      phone: response.phone || response.mobile || '',
      // Additional fields
      tin: response.tin,
      account: response.account,
      bankId: response.bankId,
      mobile: response.mobile,
      email: response.email,
      regionId: response.regionId,
      districtId: response.districtId,
      soato: response.soato,
      vat: response.vat,
      vatRegCode: response.vatRegCode,
      accountant: response.accountant,
    };
  } catch (error) {
    console.error('Error fetching company info from Didox:', error);
    return null;
  }
}

// Store or update Didox token for user
export async function saveUserToken(
  userId: number,
  token: string,
  taxId: string,
  companyName?: string
): Promise<void> {
  const tokenExpiresAt = new Date(Date.now() + 360 * 60 * 1000); // 360 minutes

  const existing = await db
    .select()
    .from(didoxUserTokens)
    .where(eq(didoxUserTokens.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(didoxUserTokens)
      .set({
        didoxToken: token,
        tokenExpiresAt,
        taxId,
        companyName,
        updatedAt: new Date(),
      })
      .where(eq(didoxUserTokens.userId, userId));
  } else {
    await db.insert(didoxUserTokens).values({
      userId,
      didoxToken: token,
      tokenExpiresAt,
      taxId,
      companyName,
    });
  }
}

// Get valid Didox token for user
export async function getUserToken(userId: number): Promise<string | null> {
  const [tokenRecord] = await db
    .select()
    .from(didoxUserTokens)
    .where(eq(didoxUserTokens.userId, userId))
    .limit(1);

  if (!tokenRecord) return null;

  // Check if token is still valid (with 5 minute buffer)
  const now = new Date();
  const expiresAt = new Date(tokenRecord.tokenExpiresAt);
  expiresAt.setMinutes(expiresAt.getMinutes() - 5);

  if (now > expiresAt) {
    return null; // Token expired
  }

  return tokenRecord.didoxToken;
}

// Create invoice (Счет-фактура) document
export async function createInvoice(
  userToken: string,
  invoiceData: {
    contractId: number;
    docNumber: string;
    docDate: Date;
    sellerTaxId: string;
    sellerName: string;
    buyerTaxId: string;
    buyerName: string;
    items: Array<{
      name: string;
      unitCode: string;
      unitName: string;
      quantity: number;
      price: number;
      vatRate: number;
    }>;
    contractNumber?: string;
    contractDate?: string;
  }
): Promise<string> {
  // Format items for Didox
  const productList = invoiceData.items.map((item, index) => ({
    ordNo: index + 1,
    name: item.name,
    catalogCode: '',
    catalogName: '',
    barCode: '',
    packageCode: '',
    packageName: '',
    count: item.quantity,
    summa: item.price * item.quantity,
    deliverySum: item.price * item.quantity,
    vatRate: item.vatRate,
    vatSum: (item.price * item.quantity * item.vatRate) / 100,
    deliverySumWithVat: (item.price * item.quantity) * (1 + item.vatRate / 100),
    measuriId: item.unitCode,
    measuriName: item.unitName,
  }));

  const totalSum = productList.reduce((sum, p) => sum + p.deliverySum, 0);
  const totalVat = productList.reduce((sum, p) => sum + p.vatSum, 0);
  const totalWithVat = totalSum + totalVat;

  const documentJson = {
    facturaId: '',
    facturaNo: invoiceData.docNumber,
    facturaDate: invoiceData.docDate.toISOString().split('T')[0],
    subType: 0, // Standard
    singleType: null,
    oldFacturaId: '',
    oldFacturaNo: '',
    oldFacturaDate: '',
    contractNo: invoiceData.contractNumber || '',
    contractDate: invoiceData.contractDate || '',
    sellerTin: invoiceData.sellerTaxId,
    sellerName: invoiceData.sellerName,
    buyerTin: invoiceData.buyerTaxId,
    buyerName: invoiceData.buyerName,
    productList,
    facturaType: 0,
    itemReleasedDoc: '',
    sellerBranchCode: '',
    sellerBranchName: '',
    buyerBranchCode: '',
    buyerBranchName: '',
  };

  const response = await didoxRequest<DidoxDocumentResponse>(
    `/v1/documents/${DOC_TYPES.factura}/create`,
    {
      method: 'POST',
      userToken,
      body: documentJson,
    }
  );

  return response._id;
}

// Create waybill (ТТН) document
export async function createWaybill(
  userToken: string,
  waybillData: {
    contractId: number;
    docNumber: string;
    docDate: Date;
    consignorTaxId: string; // Грузоотправитель
    consignorName: string;
    consigneeTaxId: string; // Грузополучатель
    consigneeName: string;
    carrierTaxId?: string; // Перевозчик
    carrierName?: string;
    loadingPoint: string;
    unloadingPoint: string;
    items: Array<{
      name: string;
      unitCode: string;
      unitName: string;
      quantity: number;
      price: number;
    }>;
    vehicleNumber?: string;
    driverName?: string;
    contractNumber?: string;
    contractDate?: string;
  }
): Promise<string> {
  // Format items for Didox TTN
  const productList = waybillData.items.map((item, index) => ({
    ordNo: index + 1,
    name: item.name,
    catalogCode: '',
    catalogName: '',
    barCode: '',
    packageCode: '',
    packageName: '',
    count: item.quantity,
    summa: item.price * item.quantity,
    measuriId: item.unitCode,
    measuriName: item.unitName,
  }));

  const totalSum = productList.reduce((sum, p) => sum + p.summa, 0);

  const documentJson = {
    waybillNo: waybillData.docNumber,
    waybillDate: waybillData.docDate.toISOString().split('T')[0],
    subType: 0, // Standard
    consignorTin: waybillData.consignorTaxId,
    consignorName: waybillData.consignorName,
    consigneeTin: waybillData.consigneeTaxId,
    consigneeName: waybillData.consigneeName,
    carrierTin: waybillData.carrierTaxId || '',
    carrierName: waybillData.carrierName || '',
    loadingPoint: waybillData.loadingPoint,
    unloadingPoint: waybillData.unloadingPoint,
    productList,
    totalSum,
    contractNo: waybillData.contractNumber || '',
    contractDate: waybillData.contractDate || '',
    vehicleNo: waybillData.vehicleNumber || '',
    driverFio: waybillData.driverName || '',
    responsiblePerson: '',
    responsiblePersonTin: '',
  };

  const response = await didoxRequest<DidoxDocumentResponse>(
    `/v1/documents/${DOC_TYPES.waybill}/create`,
    {
      method: 'POST',
      userToken,
      body: documentJson,
    }
  );

  return response._id;
}

// Sign document with E-IMZO
export async function signDocument(
  userToken: string,
  documentId: string,
  signature: string
): Promise<void> {
  await didoxRequest(
    `/v1/documents/${documentId}/sign`,
    {
      method: 'POST',
      userToken,
      body: { sign: signature },
    }
  );
}

// Get document by ID
export async function getDocument(
  userToken: string,
  documentId: string
): Promise<DidoxDocumentResponse> {
  return didoxRequest<DidoxDocumentResponse>(
    `/v1/documents/${documentId}?owner=1`,
    {
      method: 'GET',
      userToken,
    }
  );
}

// Get documents list (for syncing)
export async function getDocumentsList(
  userToken: string,
  options: {
    owner?: 0 | 1; // 0 = incoming, 1 = outgoing
    page?: number;
    limit?: number;
    doctype?: 'Factura' | 'Waybill';
    dateFrom?: string;
    dateTo?: string;
  } = {}
): Promise<{ data: DidoxDocumentResponse[]; total: number }> {
  const params = new URLSearchParams();
  if (options.owner !== undefined) params.append('owner', String(options.owner));
  if (options.page) params.append('page', String(options.page));
  if (options.limit) params.append('limit', String(options.limit));
  if (options.doctype) params.append('doctype', options.doctype);
  if (options.dateFrom) params.append('dateFromCreated', options.dateFrom);
  if (options.dateTo) params.append('dateToCreated', options.dateTo);

  return didoxRequest(
    `/v2/documents?${params.toString()}`,
    {
      method: 'GET',
      userToken,
    }
  );
}

// Get contract data prefilled for invoice/waybill
export async function getContractPrefillData(contractId: number): Promise<{
  contract: typeof contracts.$inferSelect;
  order: typeof orders.$inferSelect;
  customer: typeof users.$inferSelect & { profile: typeof profiles.$inferSelect | null };
  carrier: typeof users.$inferSelect & { profile: typeof profiles.$inferSelect | null };
  offerPrice: number | null;
} | null> {
  const [contract] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))
    .limit(1);

  if (!contract) return null;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, contract.orderId))
    .limit(1);

  if (!order) return null;

  // Get customer with profile
  const [customer] = await db
    .select()
    .from(users)
    .where(eq(users.id, contract.customerId))
    .limit(1);

  const [customerProfile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, contract.customerId))
    .limit(1);

  // Get carrier with profile
  const [carrier] = await db
    .select()
    .from(users)
    .where(eq(users.id, contract.carrierId))
    .limit(1);

  const [carrierProfile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, contract.carrierId))
    .limit(1);

  // Get accepted offer price
  const [offer] = await db
    .select()
    .from(offers)
    .where(and(
      eq(offers.orderId, order.id),
      eq(offers.status, 'accepted')
    ))
    .limit(1);

  return {
    contract,
    order,
    customer: { ...customer, profile: customerProfile || null },
    carrier: { ...carrier, profile: carrierProfile || null },
    offerPrice: offer ? Number(offer.price) : null,
  };
}

// Save document to local DB
export async function saveDocument(data: {
  contractId: number;
  didoxDocId?: string;
  docType: 'factura' | 'waybill';
  docNumber: string;
  docDate: Date;
  senderId: number;
  senderTaxId: string;
  senderName: string;
  receiverId?: number;
  receiverTaxId: string;
  receiverName: string;
  documentJson: Record<string, unknown>;
  status?: 'draft' | 'sent' | 'pending' | 'signed' | 'rejected' | 'deleted' | 'error';
  totalSum?: number;
  totalSumWithVat?: number;
}): Promise<number> {
  const [inserted] = await db
    .insert(didoxDocuments)
    .values({
      contractId: data.contractId,
      didoxDocId: data.didoxDocId,
      docType: data.docType,
      docNumber: data.docNumber,
      docDate: data.docDate,
      senderId: data.senderId,
      senderTaxId: data.senderTaxId,
      senderName: data.senderName,
      receiverId: data.receiverId,
      receiverTaxId: data.receiverTaxId,
      receiverName: data.receiverName,
      documentJson: data.documentJson,
      status: data.status || 'draft',
      totalSum: data.totalSum?.toString(),
      totalSumWithVat: data.totalSumWithVat?.toString(),
    })
    .returning({ id: didoxDocuments.id });

  return inserted.id;
}

// Get documents for user (sent or received)
export async function getUserDocuments(
  userId: number,
  type: 'sent' | 'received',
  docType?: 'factura' | 'waybill'
): Promise<typeof didoxDocuments.$inferSelect[]> {
  const conditions = type === 'sent'
    ? eq(didoxDocuments.senderId, userId)
    : eq(didoxDocuments.receiverId, userId);

  let query = db
    .select()
    .from(didoxDocuments)
    .where(docType
      ? and(conditions, eq(didoxDocuments.docType, docType))
      : conditions)
    .orderBy(desc(didoxDocuments.createdAt));

  return query;
}

// Find user by tax ID (INN) on platform
export async function findUserByTaxId(taxId: string): Promise<typeof users.$inferSelect | null> {
  // INN is stored in profiles table
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.inn, taxId))
    .limit(1);

  if (!profile) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, profile.userId))
    .limit(1);

  return user || null;
}

// Check if Didox is configured
export function isDidoxConfigured(): boolean {
  return !!DIDOX_PARTNER_TOKEN;
}

export const didoxService = {
  loginWithPassword,
  loginWithEimzo,
  getCompanyInfo,
  saveUserToken,
  getUserToken,
  createInvoice,
  createWaybill,
  signDocument,
  getDocument,
  getDocumentsList,
  getContractPrefillData,
  saveDocument,
  getUserDocuments,
  findUserByTaxId,
  isDidoxConfigured,
};
