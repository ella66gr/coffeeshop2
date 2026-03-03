package FulfilDrinkOrchestration {
    private import ScalarValues::*;
    private import TemporalMetadata::*;
    private import CoffeeShop::*;

    doc /* Orchestration-level action flow for drink fulfilment.
         *
         * This models HOW THE SYSTEM MANAGES the drink fulfilment
         * process — activity boundaries, signal waits, and timeout
         * points. It is distinct from the domain-level FulfilDrink
         * action flow (in coffeeshop-exercise) which models WHAT
         * THE BARISTA DOES.
         *
         * The Temporal workflow generator reads this action def and
         * its metadata annotations to produce a TypeScript workflow
         * function. The domain-level action flow remains the
         * governance-readable process description.
         *
         * Mapping to domain flow:
         *   validateOrder    → receiveOrder (domain)
         *   waitBaristaStart → barista picks up order
         *   prepareDrink     → checkDrinkType..assembleDrink (domain)
         *   waitDrinkReady   → markReady (domain)
         *   waitCollected    → customer collection
         *   completeOrder    → order closure
         */

    action def FulfilDrinkWorkflow {
        doc /* Temporal workflow orchestrating drink fulfilment. */

        @TemporalWorkflow {
            workflowName = "fulfilDrink";
            taskQueue = "coffeeshop";
        }

        in item orderDetails : OrderLine;

        // -- Step 1: Validate the incoming order --

        action validateOrder {
            doc /* Validate order details before processing. */
            @TemporalActivity { activityName = "validateOrder"; }
            @StateTransitionTrigger { eventName = "OrderPlaced"; }
        }
        then waitBaristaStart;

        // -- Step 2: Wait for barista to pick up the order --

        action waitBaristaStart {
            doc /* Suspend until a barista signals they have started.
                 * In clinical context: clinician picks up referral. */
            @TemporalSignal { signalName = "baristaStarted"; timeoutMinutes = 30; }
            @StateTransitionTrigger { eventName = "PreparationStarted"; }
        }
        then prepareDrink;

        // -- Step 3: Prepare the drink --

        action prepareDrink {
            doc /* Record that drink preparation has occurred.
                 * The domain-level detail (hot/cold path, milk choice)
                 * is modelled in the FulfilDrink domain action flow. */
            @TemporalActivity { activityName = "prepareDrink"; }
        }
        then waitDrinkReady;

        // -- Step 4: Wait for drink to be marked ready --

        action waitDrinkReady {
            doc /* Suspend until barista marks drink as ready.
                 * In clinical context: lab results returned. */
            @TemporalSignal { signalName = "drinkReady"; timeoutMinutes = 15; }
            @StateTransitionTrigger { eventName = "PreparationComplete"; }
        }
        then waitCollected;

        // -- Step 5: Wait for customer to collect --

        action waitCollected {
            doc /* Suspend until customer collects their drink.
                 * In clinical context: patient attends appointment. */
            @TemporalSignal { signalName = "drinkCollected"; timeoutMinutes = 60; }
            @StateTransitionTrigger { eventName = "OrderCollected"; }
        }
        then completeOrder;

        // -- Step 6: Close the order --

        action completeOrder {
            doc /* Finalise the order after collection. */
            @TemporalActivity { activityName = "completeOrder"; }
        }
    }
}
