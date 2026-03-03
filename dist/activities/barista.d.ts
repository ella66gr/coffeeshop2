/**
 * Barista Activities — Hand-written Phase A implementation
 *
 * These are the activity implementations for the FulfilDrink workflow.
 * Activities contain the actual business logic and are the only place
 * where side effects (logging, I/O, etc.) are permitted.
 *
 * In later phases, activity function *signatures* will be generated
 * from the SysML model; the *bodies* remain hand-written.
 */
export interface OrderDetails {
    orderId: string;
    customerName: string;
    drinkType: string;
    size: 'small' | 'medium' | 'large';
}
export interface OrderResult {
    orderId: string;
    status: string;
    timestamp: string;
}
/**
 * Validate the incoming order.
 * Maps to the first step of the FulfilDrink action flow.
 */
export declare function validateOrder(order: OrderDetails): Promise<OrderResult>;
/**
 * Prepare the drink.
 * Called after the barista signals that they have started preparation.
 */
export declare function prepareDrink(order: OrderDetails): Promise<OrderResult>;
/**
 * Complete the order after customer collection.
 * Final step in the FulfilDrink action flow.
 */
export declare function completeOrder(order: OrderDetails): Promise<OrderResult>;
//# sourceMappingURL=barista.d.ts.map