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
