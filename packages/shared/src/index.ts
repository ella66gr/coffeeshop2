/**
 * @coffeeshop/shared — Re-exports from generated code
 *
 * This package provides shared types, enums, and the XState
 * machine definition to both the Temporal worker and the
 * SvelteKit web application.
 */

// Domain types generated from SysML structural model
export * from './generated/types.js';

// XState order lifecycle machine generated from SysML state def
export {
  orderLifecycleMachine,
  type OrderEvent,
  type OrderState,
} from './generated/order-lifecycle-machine.js';
