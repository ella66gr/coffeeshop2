/**
 * Workflow Constants — shared between Temporal and SvelteKit packages
 *
 * These string constants are the single source of truth for signal names,
 * query names, task queue, and workflow identifiers. Both the Temporal
 * workflow (which uses defineSignal/defineQuery with these strings) and
 * the SvelteKit API routes (which use handle.signal/handle.query with
 * these strings) reference the same constants.
 *
 * The values must match exactly what the workflow code passes to
 * defineSignal() and defineQuery() in fulfil-drink.ts.
 */

// -- Task queue --

export const TASK_QUEUE = 'coffeeshop';

// -- Workflow name --

/** The workflow function name, used with client.workflow.start(). */
export const WORKFLOW_NAME = 'fulfilDrink';

// -- Signal names --

/** Barista has started making the drink. */
export const SIGNAL_BARISTA_STARTED = 'baristaStarted';

/** Barista has finished — drink is ready for collection. */
export const SIGNAL_DRINK_READY = 'drinkReady';

/** Customer has collected the drink. */
export const SIGNAL_DRINK_COLLECTED = 'drinkCollected';

/** All valid signal names, for runtime validation in API routes. */
export const VALID_SIGNALS = [
  SIGNAL_BARISTA_STARTED,
  SIGNAL_DRINK_READY,
  SIGNAL_DRINK_COLLECTED,
] as const;

export type SignalName = (typeof VALID_SIGNALS)[number];

// -- Query names --

/** Query the current XState order lifecycle state. */
export const QUERY_ORDER_STATE = 'orderState';

// -- Signal-to-state mapping --
// Maps each signal to the XState state the order should be in
// AFTER the signal is processed. Useful for UI button logic.

export const SIGNAL_STATE_MAP: Record<SignalName, string> = {
  [SIGNAL_BARISTA_STARTED]: 'inPreparation',
  [SIGNAL_DRINK_READY]: 'ready',
  [SIGNAL_DRINK_COLLECTED]: 'collected',
};

// -- State-to-available-signal mapping --
// Maps each XState state to the signal that can be sent from that state.
// Used by the UI to show the correct action button.

export const STATE_AVAILABLE_SIGNAL: Record<string, { signal: SignalName; label: string } | null> = {
  placed: { signal: SIGNAL_BARISTA_STARTED, label: 'Barista: Start Preparation' },
  inPreparation: { signal: SIGNAL_DRINK_READY, label: 'Barista: Mark Ready' },
  ready: { signal: SIGNAL_DRINK_COLLECTED, label: 'Customer: Collect Drink' },
  collected: null,
  cancelled: null,
};

// ==========================================================================
// Phase D — Governance & Audit
//
// Expected timing values sourced from SysML model annotations:
//   @TemporalSignal { signalName = "baristaStarted"; timeoutMinutes = 30; }
//   @TemporalSignal { signalName = "drinkReady";     timeoutMinutes = 15; }
//   @TemporalSignal { signalName = "drinkCollected";  timeoutMinutes = 60; }
//
// For the demonstrator these are transcribed as manual constants.
// A future generator (gen_audit_constants.py) could extract them
// directly from the SysML model for full single-source-of-truth.
// ==========================================================================

// -- Workflow step definitions for audit reporting --

export interface WorkflowStepDef {
  /** Identifier matching the SysML action name. */
  readonly stepId: string;
  /** Human-readable step name for the compliance table. */
  readonly label: string;
  /** Step type: 'activity' (Temporal activity), 'signal' (human-in-the-loop wait). */
  readonly type: 'activity' | 'signal';
  /**
   * Expected maximum duration in minutes.
   * For signal steps: from the SysML @TemporalSignal timeoutMinutes.
   * For activity steps: a reasonable processing expectation.
   * null means no timing expectation (informational only).
   */
  readonly expectedMinutes: number | null;
  /**
   * The Temporal signal name (for signal steps) or activity name (for
   * activity steps). Used to match against Temporal event history.
   */
  readonly temporalName: string;
}

/**
 * Ordered list of workflow steps as defined in the SysML
 * FulfilDrinkWorkflow action def. The order matches the
 * action flow succession.
 */
export const WORKFLOW_STEPS: readonly WorkflowStepDef[] = [
  {
    stepId: 'validateOrder',
    label: 'Validate Order',
    type: 'activity',
    expectedMinutes: 1,
    temporalName: 'validateOrder',
  },
  {
    stepId: 'waitBaristaStart',
    label: 'Wait for Barista',
    type: 'signal',
    expectedMinutes: 30,
    temporalName: 'baristaStarted',
  },
  {
    stepId: 'prepareDrink',
    label: 'Prepare Drink',
    type: 'activity',
    expectedMinutes: 1,
    temporalName: 'prepareDrink',
  },
  {
    stepId: 'waitDrinkReady',
    label: 'Wait for Drink Ready',
    type: 'signal',
    expectedMinutes: 15,
    temporalName: 'drinkReady',
  },
  {
    stepId: 'waitCollected',
    label: 'Wait for Collection',
    type: 'signal',
    expectedMinutes: 60,
    temporalName: 'drinkCollected',
  },
  {
    stepId: 'completeOrder',
    label: 'Complete Order',
    type: 'activity',
    expectedMinutes: 1,
    temporalName: 'completeOrder',
  },
] as const;

// -- Anonymisation --

/**
 * Produce an anonymised case reference from a workflow/order ID.
 * Uses a simple hash to avoid exposing customer-identifiable data
 * in audit reports.
 *
 * Example: "order-1772576981645" → "CASE-A3F7"
 */
export function anonymiseCaseRef(workflowId: string): string {
  let hash = 0;
  for (let i = 0; i < workflowId.length; i++) {
    const ch = workflowId.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().slice(0, 4).padStart(4, '0');
  return `CASE-${hex}`;
}
