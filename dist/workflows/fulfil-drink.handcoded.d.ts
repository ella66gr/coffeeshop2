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
import type * as activities from '../activities/barista.js';
/** Barista has started making the drink */
export declare const baristaStartedSignal: import("@temporalio/workflow").SignalDefinition<[], "baristaStarted">;
/** Barista has finished making the drink - it is ready for collection */
export declare const drinkReadySignal: import("@temporalio/workflow").SignalDefinition<[], "drinkReady">;
/** Customer has collected the drink */
export declare const drinkCollectedSignal: import("@temporalio/workflow").SignalDefinition<[], "drinkCollected">;
export declare function fulfilDrink(order: activities.OrderDetails): Promise<string>;
//# sourceMappingURL=fulfil-drink.handcoded.d.ts.map