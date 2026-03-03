/**
 * Barista Activities — Hand-written Phase A implementation
 * 
 * These are the activity implementations for the FulfilDrink workflow.
 * Activities contain the actual business logic and are the only place
 * where side effects (logging, I/O, etc.) are permitted.
 * 
 * In later phases, activity function *signatures* will be generated
 * from the SysML model; the *bodies* remain hand-written.
 */

import { log } from '@temporalio/activity';

// ── Types (hand-written for Phase A; generated from SysML in Phase B) ──

export interface OrderDetails {
  orderId: string;
  customerName: string;
  drinkType: string;
  size: 'small' | 'medium' | 'large';
}

export interface OrderResult {
  orderId: string;
  status: string;
  timestamp: string;
}

// ── Activities ──

/**
 * Validate the incoming order.
 * Maps to the first step of the FulfilDrink action flow.
 */
export async function validateOrder(order: OrderDetails): Promise<OrderResult> {
  log.info('Validating order', { orderId: order.orderId, drinkType: order.drinkType });

  // In a real system this would check menu availability, pricing, etc.
  if (!order.drinkType || !order.customerName) {
    throw new Error(`Invalid order ${order.orderId}: missing required fields`);
  }

  return {
    orderId: order.orderId,
    status: 'validated',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Prepare the drink.
 * Called after the barista signals that they have started preparation.
 */
export async function prepareDrink(order: OrderDetails): Promise<OrderResult> {
  log.info('Preparing drink', { orderId: order.orderId, drinkType: order.drinkType, size: order.size });

  return {
    orderId: order.orderId,
    status: 'prepared',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Complete the order after customer collection.
 * Final step in the FulfilDrink action flow.
 */
export async function completeOrder(order: OrderDetails): Promise<OrderResult> {
  log.info('Completing order', { orderId: order.orderId });

  return {
    orderId: order.orderId,
    status: 'completed',
    timestamp: new Date().toISOString(),
  };
}
