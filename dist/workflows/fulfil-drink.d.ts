import type * as activities from '../activities/barista.js';
export declare const baristaStartedSignal: import("@temporalio/workflow").SignalDefinition<[], "baristaStarted">;
export declare const drinkReadySignal: import("@temporalio/workflow").SignalDefinition<[], "drinkReady">;
export declare const drinkCollectedSignal: import("@temporalio/workflow").SignalDefinition<[], "drinkCollected">;
export declare function fulfilDrink(order: activities.OrderDetails): Promise<string>;
//# sourceMappingURL=fulfil-drink.d.ts.map