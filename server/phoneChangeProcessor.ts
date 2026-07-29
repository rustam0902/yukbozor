import { db } from './db';
import * as schema from '@shared/schema';
import { eq, and, lte, inArray } from 'drizzle-orm';

const PROCESS_INTERVAL_MS = 60 * 1000;

async function isHighRiskAccount(userId: number): Promise<{ isHighRisk: boolean; reason: string }> {
  // Order status enum: 'new', 'assigned', 'completed', 'cancelled'
  // Active statuses: 'new' (pending offers/assignment), 'assigned' (order in progress)
  const activeOrders = await db.select()
    .from(schema.orders)
    .where(and(
      eq(schema.orders.customerId, userId),
      inArray(schema.orders.status, ['new', 'assigned'])
    ))
    .limit(1);

  if (activeOrders.length > 0) {
    return { isHighRisk: true, reason: 'active_customer_orders' };
  }

  // Active contracts: any contract not closed or terminated
  const activeCarrierContracts = await db.select()
    .from(schema.contracts)
    .where(and(
      eq(schema.contracts.carrierId, userId),
      inArray(schema.contracts.status, [
        'draft', 'pending_customer_signature', 'pending_carrier_signature',
        'signed_by_customer', 'signed_by_carrier', 'fully_signed',
        'awaiting_prepayment', 'prepayment_made', 'awaiting_completion_confirmation'
      ])
    ))
    .limit(1);

  if (activeCarrierContracts.length > 0) {
    return { isHighRisk: true, reason: 'active_carrier_contracts' };
  }

  const deposits = await db.select()
    .from(schema.deposits)
    .where(eq(schema.deposits.userId, userId));

  const hasNonZeroDeposit = deposits.some(d => 
    Number(d.balance) > 0 || 
    Number(d.blocked) > 0
  );

  if (hasNonZeroDeposit) {
    return { isHighRisk: true, reason: 'non_zero_deposits' };
  }

  return { isHighRisk: false, reason: '' };
}

async function processPhoneChangeRequest(request: typeof schema.phoneChangeRequests.$inferSelect): Promise<void> {
  console.log(`[PHONE_CHANGE] Processing phone change request ${request.id}`);
  
  try {
    const highRiskCheck = await isHighRiskAccount(request.userId);
    
    if (highRiskCheck.isHighRisk) {
      console.log(`[PHONE_CHANGE] Request ${request.id} blocked - high-risk account (${highRiskCheck.reason})`);
      await db.update(schema.phoneChangeRequests)
        .set({ 
          status: 'requires_support',
          cancelledAt: new Date() 
        })
        .where(eq(schema.phoneChangeRequests.id, request.id));
      return;
    }

    await db.update(schema.phoneChangeRequests)
      .set({ 
        status: 'completed', 
        completedAt: new Date() 
      })
      .where(eq(schema.phoneChangeRequests.id, request.id));

    await db.update(schema.users)
      .set({ phone: request.newPhone })
      .where(eq(schema.users.id, request.userId));

    console.log(`[PHONE_CHANGE] Phone change ${request.id} completed: ${request.oldPhone} -> ${request.newPhone}`);
  } catch (error) {
    console.error(`[PHONE_CHANGE] Error processing phone change ${request.id}:`, error);
  }
}

async function processPendingPhoneChanges(): Promise<void> {
  try {
    const now = new Date();
    
    const pendingChanges = await db.select()
      .from(schema.phoneChangeRequests)
      .where(and(
        eq(schema.phoneChangeRequests.status, 'pending_cooldown'),
        lte(schema.phoneChangeRequests.cooldownEndsAt, now)
      ));

    if (pendingChanges.length > 0) {
      console.log(`[PHONE_CHANGE] Found ${pendingChanges.length} phone change requests ready to apply`);
      
      for (const request of pendingChanges) {
        await processPhoneChangeRequest(request);
      }
    }
  } catch (error) {
    console.error('[PHONE_CHANGE] Error in processPendingPhoneChanges:', error);
  }
}

let processorInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

export function startPhoneChangeProcessor() {
  if (isRunning) {
    console.log('[PHONE_CHANGE] Processor already running');
    return;
  }

  console.log('[PHONE_CHANGE] Starting phone change processor (interval: 60 seconds)');
  isRunning = true;

  processPendingPhoneChanges();
  processorInterval = setInterval(processPendingPhoneChanges, PROCESS_INTERVAL_MS);
}

export function stopPhoneChangeProcessor() {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
    isRunning = false;
    console.log('[PHONE_CHANGE] Stopped phone change processor');
  }
}
