/**
 * FulfilDrink Workflow - Hand-written Phase A implementation
 *
 * This workflow orchestrates the drink fulfilment process, mapping
 * directly to the SysML FulfilDrink action flow. In Phase B, this
 * file will be *generated* from the SysML model.
 *
 * Workflow code runs in a sandboxed V8 isolate. It must be
 * deterministic: no I/O, no Date.now(), no Math.random().
 * All side effects happen in activities.
 *
 * The three signal-based waits correspond to human-in-the-loop
 * steps in the action flow:
 *   1. Barista starts preparation
 *   2. Barista marks drink ready
 *   3. Customer collects drink
 *
 * These map directly to the Temporal signal pattern that will
 * support clinical pathway waits (e.g. lab results returned,
 * clinician review completed) in GenderSense.
 */
import { proxyActivities, defineSignal, setHandler, condition, log, } from '@temporalio/workflow';
// -- Activity proxy --
const { validateOrder, prepareDrink, completeOrder, } = proxyActivities({
    startToCloseTimeout: '1 minute',
    retry: {
        maximumAttempts: 3,
    },
});
// -- Signal definitions --
// Each signal represents an external event that advances the workflow.
/** Barista has started making the drink */
export const baristaStartedSignal = defineSignal('baristaStarted');
/** Barista has finished making the drink - it is ready for collection */
export const drinkReadySignal = defineSignal('drinkReady');
/** Customer has collected the drink */
export const drinkCollectedSignal = defineSignal('drinkCollected');
// -- Workflow function --
export async function fulfilDrink(order) {
    // Mutable state that signal handlers will update.
    // workflow.condition() polls these to decide when to resume.
    let baristaStarted = false;
    let drinkReady = false;
    let drinkCollected = false;
    // Register signal handlers
    setHandler(baristaStartedSignal, () => {
        log.info('Signal received: barista started', { orderId: order.orderId });
        baristaStarted = true;
    });
    setHandler(drinkReadySignal, () => {
        log.info('Signal received: drink ready', { orderId: order.orderId });
        drinkReady = true;
    });
    setHandler(drinkCollectedSignal, () => {
        log.info('Signal received: drink collected', { orderId: order.orderId });
        drinkCollected = true;
    });
    // -- Step 1: Validate the order --
    log.info('Workflow started: fulfilDrink', { orderId: order.orderId });
    const validationResult = await validateOrder(order);
    log.info('Order validated', {
        orderId: order.orderId,
        result: validationResult.status,
    });
    // -- Step 2: Wait for barista to start preparation --
    // The workflow suspends here with zero resource cost.
    // In a clinical context, this is equivalent to waiting for
    // a clinician to pick up a referral.
    log.info('Waiting for barista to start preparation', { orderId: order.orderId });
    await condition(() => baristaStarted);
    // -- Step 3: Prepare the drink --
    const prepResult = await prepareDrink(order);
    log.info('Drink preparation recorded', {
        orderId: order.orderId,
        result: prepResult.status,
    });
    // -- Step 4: Wait for barista to mark drink as ready --
    // Equivalent to waiting for lab results to come back.
    log.info('Waiting for drink to be marked ready', { orderId: order.orderId });
    await condition(() => drinkReady);
    // -- Step 5: Wait for customer to collect --
    // Equivalent to waiting for a patient to attend an appointment.
    log.info('Waiting for customer to collect drink', { orderId: order.orderId });
    await condition(() => drinkCollected);
    // -- Step 6: Complete the order --
    const completionResult = await completeOrder(order);
    log.info('Order completed', {
        orderId: order.orderId,
        result: completionResult.status,
    });
    return `Order ${order.orderId} fulfilled successfully`;
}
//# sourceMappingURL=fulfil-drink.handcoded.js.map