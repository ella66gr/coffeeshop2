// ==============================================
// Generated from SysML v2 model — DO NOT EDIT
// Source: model/domain/fulfil-drink-orchestration.sysml
// Generator: gen_temporal_workflow.py
// ==============================================

import {
  proxyActivities,
  defineSignal,
  setHandler,
  condition,
  log,
} from '@temporalio/workflow';

import type * as activities from '../activities/barista.js';

// -- Activity proxy --

const {
  validateOrder,
  prepareDrink,
  completeOrder,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 3,
  },
});

// -- Signal definitions --

export const baristaStartedSignal = defineSignal('baristaStarted');
export const drinkReadySignal = defineSignal('drinkReady');
export const drinkCollectedSignal = defineSignal('drinkCollected');

// -- Workflow function --

export async function fulfilDrink(order: activities.OrderDetails): Promise<string> {
  // Mutable state that signal handlers will update.
  let baristaStarted = false;
  let drinkReady = false;
  let drinkCollected = false;

  // Register signal handlers
  setHandler(baristaStartedSignal, () => {
    log.info('Signal received: baristaStarted', { orderId: order.orderId });
    baristaStarted = true;
  });

  setHandler(drinkReadySignal, () => {
    log.info('Signal received: drinkReady', { orderId: order.orderId });
    drinkReady = true;
  });

  setHandler(drinkCollectedSignal, () => {
    log.info('Signal received: drinkCollected', { orderId: order.orderId });
    drinkCollected = true;
  });

  // -- Step 1: validateOrder --
  log.info('Workflow started: fulfilDrink', { orderId: order.orderId });
  const validationResult = await validateOrder(order);
  log.info('Order validated', {
    orderId: order.orderId,
    result: validationResult.status,
  });

  // -- Step 2: waitBaristaStart --
  log.info('Waiting for barista started', { orderId: order.orderId });
  await condition(() => baristaStarted);

  // -- Step 3: prepareDrink --
  log.info('prepare drink', { orderId: order.orderId });
  const prepareDrinkResult = await prepareDrink(order);
  log.info('prepare drink recorded', {
    orderId: order.orderId,
    result: prepareDrinkResult.status,
  });

  // -- Step 4: waitDrinkReady --
  log.info('Waiting for drink ready', { orderId: order.orderId });
  await condition(() => drinkReady);

  // -- Step 5: waitCollected --
  log.info('Waiting for drink collected', { orderId: order.orderId });
  await condition(() => drinkCollected);

  // -- Step 6: completeOrder --
  log.info('complete order', { orderId: order.orderId });
  const completionResult = await completeOrder(order);
  log.info('Order completed', {
    orderId: order.orderId,
    result: completionResult.status,
  });

  return `Order ${order.orderId} fulfilled successfully`;
}
