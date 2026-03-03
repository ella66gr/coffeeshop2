// ==============================================
// Generated from SysML v2 model — DO NOT EDIT
// Source: model/domain/order-lifecycle.sysml
// Generator: gen_state_machines.py
// ==============================================

import { setup } from "xstate";

// Event types derived from SysML attribute defs
export type OrderEvent =
  { type: "OrderPlaced" }
  | { type: "PreparationStarted" }
  | { type: "PreparationComplete" }
  | { type: "OrderCollected" }
  | { type: "CancellationRequested" };

export type OrderState = "placed" | "inPreparation" | "ready" | "collected" | "cancelled";

export const orderLifecycleMachine = setup({
  types: {
    events: {} as OrderEvent,
  },
}).createMachine({
  id: "OrderLifecycle",
  initial: "placed",
  states: {
    placed: {
      on: {
        PreparationStarted: "inPreparation",
        CancellationRequested: "cancelled",
      },
    },
    inPreparation: {
      on: {
        PreparationComplete: "ready",
        CancellationRequested: "cancelled",
      },
    },
    ready: {
      on: {
        OrderCollected: "collected",
      },
    },
    collected: {
      type: "final",
    },
    cancelled: {
      type: "final",
    },
  },
});
