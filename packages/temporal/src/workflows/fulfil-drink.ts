// ==============================================
// Generated from SysML v2 model — DO NOT EDIT
// Source: model/domain/fulfil-drink-orchestration.sysml
// Generator: gen_temporal_workflow.py
//
// Phase C: Extended with XState lifecycle tracking
// and Temporal query handler for state visibility.
// ==============================================

import {
  proxyActivities,
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  log,
} from '@temporalio/workflow';

// XState pure transition function — no side effects, safe for
// Temporal's deterministic V8 isolate.
import {
  initialTransition,
  transition,
} from 'xstate';

import { orderLifecycleMachine } from '@coffeeshop/shared';
import type { OrderEvent } from '@coffeeshop/shared';

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

// -- Query definitions --

/** Query the current XState order lifecycle state. */
export const orderStateQuery = defineQuery<string>('orderState');

// -- State transition helper --

/**
 * Attempt a state transition on the XState machine using the pure
 * transition() function. Returns the new state value if the
 * transition is valid, or the unchanged state value if invalid
 * (XState silently ignores invalid transitions).
 */
function tryTransition(
  currentSnapshot: ReturnType<typeof initialTransition>[0],
  eventType: string,
): ReturnType<typeof initialTransition>[0] {
  const event = { type: eventType } as OrderEvent;
  const [nextSnapshot] = transition(orderLifecycleMachine, currentSnapshot, event);
  return nextSnapshot;
}

// -- Workflow function --

export async function fulfilDrink(order: activities.OrderDetails): Promise<string> {
  // Initialise XState machine state using the pure initialTransition function.
  // This is deterministic and side-effect-free.
  let [machineState] = initialTransition(orderLifecycleMachine);

  // Mutable state that signal handlers will update.
  let baristaStarted = false;
  let drinkReady = false;
  let drinkCollected = false;

  // -- Register query handler --
  // Returns the current XState state value as a string.
  setHandler(orderStateQuery, () => {
    const value = machineState.value;
    return typeof value === 'string' ? value : JSON.stringify(value);
  });

  // -- Register signal handlers --
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
  // State remains 'placed' after validation (order was placed when workflow started).

  // -- Step 2: waitBaristaStart --
  log.info('Waiting for barista started', { orderId: order.orderId });
  await condition(() => baristaStarted);

  // Transition: placed → inPreparation (event: PreparationStarted)
  machineState = tryTransition(machineState, 'PreparationStarted');
  log.info('State transition: PreparationStarted', {
    orderId: order.orderId,
    newState: machineState.value,
  });

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

  // Transition: inPreparation → ready (event: PreparationComplete)
  machineState = tryTransition(machineState, 'PreparationComplete');
  log.info('State transition: PreparationComplete', {
    orderId: order.orderId,
    newState: machineState.value,
  });

  // -- Step 5: waitCollected --
  log.info('Waiting for drink collected', { orderId: order.orderId });
  await condition(() => drinkCollected);

  // Transition: ready → collected (event: OrderCollected)
  machineState = tryTransition(machineState, 'OrderCollected');
  log.info('State transition: OrderCollected', {
    orderId: order.orderId,
    newState: machineState.value,
  });

  // -- Step 6: completeOrder --
  log.info('complete order', { orderId: order.orderId });
  const completionResult = await completeOrder(order);
  log.info('Order completed', {
    orderId: order.orderId,
    result: completionResult.status,
  });

  return `Order ${order.orderId} fulfilled successfully`;
}
