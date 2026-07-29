import { storage } from './storage';
import type { Order, Offer } from '@shared/schema';

const PROCESS_INTERVAL_MS = 60 * 1000;

async function processExpiredOrder(order: Order): Promise<void> {
  console.log(`[ORDER_EXPIRY] Processing expired order ${order.id}`);
  
  try {
    const offers = await storage.getOffersByOrderId(order.id);
    const activeOffers = offers.filter(o => o.status === 'active');
    
    if (activeOffers.length === 0) {
      console.log(`[ORDER_EXPIRY] Order ${order.id}: No active offers, extending by 1 hour`);
      await storage.extendOrderExpiry(order.id);
      return;
    }
    
    const customerProfile = await storage.getProfileByUserId(order.customerId);
    const isNdsPayer = customerProfile?.ndsPayer ?? false;
    
    let lowestOffer: Offer | null = null;
    let lowestPrice = Infinity;
    
    for (const offer of activeOffers) {
      const priceToCompare = isNdsPayer ? offer.priceWithoutVat : offer.price;
      if (priceToCompare < lowestPrice) {
        lowestPrice = priceToCompare;
        lowestOffer = offer;
      }
    }
    
    if (!lowestOffer) {
      console.log(`[ORDER_EXPIRY] Order ${order.id}: No valid offers found, extending by 1 hour`);
      await storage.extendOrderExpiry(order.id);
      return;
    }
    
    // If customer is VAT payer, compare WITHOUT VAT prices
    // If customer is NOT VAT payer, compare WITH VAT prices
    // Calculate priceWithoutVat: priceWithVat * 100 / 112 (removing 12% VAT)
    const orderPriceWithoutVat = Math.round(order.priceWithVat * 100 / 112);
    const customerPriceToCompare = isNdsPayer ? orderPriceWithoutVat : order.priceWithVat;
    
    console.log(`[ORDER_EXPIRY] Order ${order.id}: Customer ndsPayer=${isNdsPayer}, comparing prices: offer=${lowestPrice}, order=${customerPriceToCompare}`);
    
    if (lowestPrice >= customerPriceToCompare) {
      console.log(`[ORDER_EXPIRY] Order ${order.id}: Lowest offer ${lowestPrice} >= customer price ${customerPriceToCompare}, extending by 1 hour`);
      await storage.extendOrderExpiry(order.id);
      return;
    }
    
    console.log(`[ORDER_EXPIRY] Order ${order.id}: Accepting offer ${lowestOffer.id} with price ${lowestPrice} < customer price ${customerPriceToCompare}`);
    await acceptOfferAutomatically(order, lowestOffer, offers);
    
  } catch (error) {
    console.error(`[ORDER_EXPIRY] Error processing order ${order.id}:`, error);
  }
}

async function acceptOfferAutomatically(order: Order, offer: Offer, allOffers: Offer[]): Promise<void> {
  await storage.updateOffer(offer.id, { status: 'accepted' });
  await storage.updateOrder(offer.orderId, { status: 'assigned' });
  
  const carrierBlockedAccount = await storage.getDepositByUserIdAndType(offer.carrierId, 'blocked');
  
  if (carrierBlockedAccount) {
    const commissionAmount = offer.blockedCommissionAmount || Math.floor(offer.price * 0.02);
    
    await storage.deductFunds(offer.carrierId, 'blocked', commissionAmount);
    
    await storage.createDepositTransaction({
      depositId: carrierBlockedAccount.id,
      type: 'charge_for_service',
      amount: commissionAmount,
      reference: `Снятие комиссии платформы по заказу №${order.id} (авто)`,
      status: 'completed',
    });
    
    console.log(`[ORDER_EXPIRY] Commission ${commissionAmount} deducted from carrier ${offer.carrierId} for order ${order.id}`);
    
    const customer = await storage.getUserById(order.customerId);
    if (customer && customer.referredByPartnerId) {
      const partnerRewardAmount = Math.floor(offer.price * 0.006);
      const partner = await storage.getPartnerById(customer.referredByPartnerId);
      
      if (partner) {
        const partnerRewardAccount = await storage.getDepositByUserIdAndType(partner.userId, 'partner_reward');
        if (partnerRewardAccount) {
          await storage.addFunds(partner.userId, 'partner_reward', partnerRewardAmount);
          
          await storage.createDepositTransaction({
            depositId: partnerRewardAccount.id,
            type: 'topup',
            amount: partnerRewardAmount,
            reference: `Вознаграждение партнёра по заказу №${order.id} (авто)`,
            status: 'completed',
          });
          
          await storage.createCommission({
            partnerId: partner.id,
            clientId: order.customerId,
            orderId: order.id,
            amount: partnerRewardAmount,
            periodMonth: new Date().toISOString().slice(0, 7),
            status: 'paid',
          });
          
          console.log(`[ORDER_EXPIRY] Partner ${partner.id} received ${partnerRewardAmount} reward for order ${order.id}`);
        }
      }
    }
  }
  
  const customerForContract = await storage.getUserById(order.customerId);
  const carrier = await storage.getUserById(offer.carrierId);
  const customerProfile = await storage.getProfileByUserId(order.customerId);
  const carrierProfile = await storage.getProfileByUserId(offer.carrierId);
  
  if (customerForContract && carrier) {
    const now = new Date();
    // NEW MECHANISM: Contracts are auto-signed based on E-IMZO certificate registered at signup
    const contract = await storage.createContract({
      orderId: order.id,
      customerId: order.customerId,
      carrierId: offer.carrierId,
      contractDocPath: null,
      contractDocDocxPath: null,
      status: 'awaiting_prepayment',
      documentHash: null,
      contractContent: null,
      customerSignature: `CERT_BOUND_${order.customerId}_${now.getTime()}`,
      carrierSignature: `CERT_BOUND_${offer.carrierId}_${now.getTime()}`,
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
      customerPrepaymentBlocked: 0,
    });
    
    console.log(`[ORDER_EXPIRY] Contract ${contract.id} created automatically for order ${order.id}`);
  }
  
  for (const otherOffer of allOffers) {
    if (otherOffer.id !== offer.id && otherOffer.status === 'active') {
      await storage.updateOffer(otherOffer.id, { status: 'rejected' });
      
      await storage.transferBetweenAccounts(
        otherOffer.carrierId,
        'blocked',
        'main',
        otherOffer.blockedAmount,
        `Возврат залога по заказу №${order.id} (авто)`
      );
      
      const commissionToReturn = otherOffer.blockedCommissionAmount || Math.floor(otherOffer.price * 0.02);
      const commissionDestination = (otherOffer.commissionSourceAccount === 'registration_bonus' ? 'registration_bonus' : 'main') as 'main' | 'registration_bonus';
      await storage.transferBetweenAccounts(
        otherOffer.carrierId,
        'blocked',
        commissionDestination,
        commissionToReturn,
        commissionDestination === 'registration_bonus' 
          ? `Возврат комиссии на бонусный счёт по заказу №${order.id} (авто)`
          : `Возврат комиссии по заказу №${order.id} (авто)`
      );
      
      console.log(`[ORDER_EXPIRY] Rejected offer ${otherOffer.id} and returned funds to carrier ${otherOffer.carrierId}`);
    }
  }
}

async function processExpiredOrders(): Promise<void> {
  try {
    const expiredOrders = await storage.getExpiredNewOrders();
    
    if (expiredOrders.length > 0) {
      console.log(`[ORDER_EXPIRY] Found ${expiredOrders.length} expired orders to process`);
    }
    
    for (const order of expiredOrders) {
      await processExpiredOrder(order);
    }
  } catch (error) {
    console.error('[ORDER_EXPIRY] Error in processExpiredOrders:', error);
  }
}

let processorInterval: NodeJS.Timeout | null = null;

export function startOrderExpiryProcessor(): void {
  if (processorInterval) {
    console.log('[ORDER_EXPIRY] Processor already running');
    return;
  }
  
  console.log('[ORDER_EXPIRY] Starting order expiry processor (interval: 60 seconds)');
  
  processExpiredOrders();
  
  processorInterval = setInterval(processExpiredOrders, PROCESS_INTERVAL_MS);
}

export function stopOrderExpiryProcessor(): void {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
    console.log('[ORDER_EXPIRY] Stopped order expiry processor');
  }
}
