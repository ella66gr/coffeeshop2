/**
 * @coffeeshop/shared — Re-exports from generated code and shared constants
 *
 * This package provides shared types, enums, the XState machine
 * definition, and workflow constants to both the Temporal worker
 * and the SvelteKit web application.
 */

// Domain types generated from SysML structural model
export * from './generated/types.js';

// XState order lifecycle machine generated from SysML state def
export {
  orderLifecycleMachine,
  type OrderEvent,
  type OrderState,
} from './generated/order-lifecycle-machine.js';

// Workflow constants shared between Temporal and SvelteKit
export * from './workflow-constants.js';
