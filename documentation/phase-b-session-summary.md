# Coffee Shop Demonstrator — Session Summary (3 March 2026)

## Purpose

This summary captures the full state of the coffeeshop-demonstrator project at the end of a long working session. It is intended to be provided to Claude at the start of a new chat so work can continue without loss of context.

---

## Project Context

The coffeeshop-demonstrator is a proof of concept for SysML v2 model-driven execution using Temporal workflows. Its strategic purpose is to validate architecture patterns that will transfer to GenderSense clinical pathways. The project follows a phased approach defined in `coffeeshop-demonstrator-spec.md`.

**Environment:** macOS (MacBook Pro), Node.js v25.7.0, Syside Modeler 0.8.4 (VS Code extension)

**MCP filesystem access:** Connected and working. The filesystem MCP server provides read/write access to the gsl-tech directory tree. Key fix applied this session: the `cp06` directory had to be removed from the allowed directories list because it no longer existed, causing the server to crash on startup with ENOENT.

---

## Phase A — COMPLETE (verified 3 March 2026)

All five deliverables met. A detailed journal note with full reproducible instructions was created and delivered as `phase-a-journal.md`.

### What was built

A hand-coded Temporal workflow (`FulfilDrink`) with three activities (`validateOrder`, `prepareDrink`, `completeOrder`) and three signal-based waits (`baristaStarted`, `drinkReady`, `drinkCollected`). The workflow runs end-to-end via Temporal's local dev server, and durable execution was confirmed by killing and restarting the worker mid-workflow.

### Key files (coffeeshop-demonstrator project)

```
~/Developer/gsl-tech/coffeeshop-demonstrator/
├── src/
│   ├── activities/barista.ts          # Activity implementations
│   ├── workflows/fulfil-drink.ts      # Hand-coded workflow with signals
│   ├── workers/worker.ts              # Worker bootstrap (ESM-compatible)
│   └── client/start-order.ts          # Test script that runs the full workflow
├── dist/                              # Compiled output (npx tsc)
├── model/
│   └── domain/
│       └── fulfil-drink-orchestration.sysml   # NEW — Phase B orchestration model
├── package.json                       # "type": "module"
└── tsconfig.json                      # "module": "nodenext", "types": ["node"]
```

### Key technical decisions from Phase A

- **ESM throughout:** `"type": "module"` in package.json, `.js` extensions in import paths, `import.meta.url` instead of `require.resolve()` for workflow path resolution in worker.ts.
- **Compile-then-run:** `npx tsc && node dist/...js` rather than ts-node, which is unreliable in ESM mode.
- **fetchHistory() API:** Returns `Promise<IHistory>` not an async iterable. Use `const { events } = await handle.fetchHistory()`.
- **ITimestamp:** Protobuf timestamp, not JS Date. Requires manual conversion.

---

## Phase B — IN PROGRESS

### Objective (from spec section 6.2)

Build generators that produce Temporal workflow code and Mermaid diagrams from SysML action flows.

### Deliverables

1. SysML-to-Temporal-workflow generator (`gen_temporal_workflow.py`) — **NOT YET WRITTEN**
2. SysML-to-Mermaid generator (`gen_mermaid.py`) — **NOT YET WRITTEN**
3. SysML model extensions — **COMPLETE AND VERIFIED**
4. Updated syntax reference — **NOT YET DONE**
5. Generated workflow confirmed identical in behaviour to Phase A — **NOT YET TESTED**

### Architecture decision: two-layer action flow model

We decided to keep the existing domain-level action flow (`FulfilDrink` in coffeeshop-exercise) as the governance-readable process description (what the barista does), and create a separate orchestration-level action flow (`FulfilDrinkWorkflow` in coffeeshop-demonstrator) that describes how the system manages the process (activity boundaries, signal waits, timeouts). The Temporal generator reads the orchestration layer. The Mermaid generator reads the domain layer.

This two-layer pattern maps directly to GenderSense: clinical pathways will have both a clinical process view (what the clinician does) and an orchestration view (how the system manages it).

### SysML metadata annotations — VERIFIED AND WORKING

We explored four approaches for carrying generator configuration in the SysML model:

1. `doc` block annotations — fragile, no tooling validation
2. SysML `attribute` declarations — semantically impure
3. Separate metadata file (YAML) — breaks single-source-of-truth
4. SysML `metadata def` annotations — **CHOSEN — proper SysML v2, full Syside validation**

We verified in Syside Modeler 0.8.4 that:

- `metadata def` with `attribute` declarations parses correctly
- `@MetadataName { attr = "value"; }` annotations parse inside action bodies
- `@MetadataName` at action def level (not just inside action steps) works
- Syside semantically validates annotations — typos in `@Name` produce errors
- Hover tooltips show the metadata def's doc string and source location
- Multiple metadata annotations on a single action step work
- Cross-project imports resolve correctly in a multi-project workspace

### Shared metadata library

Created as a reusable library at a shared location, not embedded in any single project:

```
~/Developer/gsl-tech/sysml-metadata-lib/
└── temporal/
    └── temporal-metadata.sysml
```

**Package:** `TemporalMetadata`

**Metadata definitions:**

| Metadata def | Purpose | Attributes |
|---|---|---|
| `TemporalWorkflow` | Marks an action def as a Temporal workflow | `workflowName : String`, `taskQueue : String` |
| `TemporalActivity` | Marks a step as a Temporal activity call | `activityName : String` |
| `TemporalSignal` | Marks a step as a signal wait point | `signalName : String`, `timeoutMinutes : Integer` |
| `StateTransitionTrigger` | Links a step to a state machine event | `eventName : String` |

### Full content of temporal-metadata.sysml

```sysml
package TemporalMetadata {
    private import ScalarValues::*;

    doc /* Metadata definitions for Temporal workflow generation.
         *
         * These annotations are applied to action flow steps in
         * orchestration-level action defs. The SysML-to-Temporal
         * generator reads them to produce workflow code.
         *
         * Usage:
         *   private import TemporalMetadata::*;
         *
         *   action def MyOrchestration {
         *       @TemporalWorkflow { workflowName = "myWorkflow"; taskQueue = "my-queue"; }
         *
         *       action doSomething {
         *           @TemporalActivity { activityName = "doSomething"; }
         *       }
         *       then waitForApproval;
         *
         *       action waitForApproval {
         *           @TemporalSignal { signalName = "approved"; timeoutMinutes = 1440; }
         *       }
         *   }
         *
         * Maintained at: gsl-tech/sysml-metadata-lib/temporal/
         * Consumed by:   gen_temporal_workflow.py
         */

    metadata def TemporalWorkflow {
        doc /* Marks an action def as a Temporal workflow orchestration.
             * The generator uses this to identify which action defs
             * to process and to configure the emitted workflow.
             */
        attribute workflowName : String;
        attribute taskQueue : String;
    }

    metadata def TemporalActivity {
        doc /* Marks an action as a Temporal activity invocation.
             * The generator emits an await activityName(input) call
             * for this step.
             */
        attribute activityName : String;
    }

    metadata def TemporalSignal {
        doc /* Marks an action as a signal wait point.
             * The generator emits a defineSignal + condition(await)
             * pattern for this step. The workflow suspends here
             * until an external signal is received.
             */
        attribute signalName : String;
        attribute timeoutMinutes : Integer;
    }

    metadata def StateTransitionTrigger {
        doc /* Links an action step to the state machine event it
             * triggers upon completion. Used for traceability between
             * the orchestration flow and the domain lifecycle.
             *
             * The generator can optionally emit a log statement or
             * event emission at this point.
             */
        attribute eventName : String;
    }
}
```

### Orchestration action flow

File: `~/Developer/gsl-tech/coffeeshop-demonstrator/model/domain/fulfil-drink-orchestration.sysml`

**Package:** `FulfilDrinkOrchestration`
**Imports:** `ScalarValues::*`, `TemporalMetadata::*`, `CoffeeShop::*`

**Action def:** `FulfilDrinkWorkflow` with `@TemporalWorkflow { workflowName = "fulfilDrink"; taskQueue = "coffeeshop"; }`

**Steps (in order):**

| Step | Type | Metadata | State trigger |
|---|---|---|---|
| `validateOrder` | Activity | `activityName = "validateOrder"` | `OrderPlaced` |
| `waitBaristaStart` | Signal | `signalName = "baristaStarted"`, `timeoutMinutes = 30` | `PreparationStarted` |
| `prepareDrink` | Activity | `activityName = "prepareDrink"` | (none) |
| `waitDrinkReady` | Signal | `signalName = "drinkReady"`, `timeoutMinutes = 15` | `PreparationComplete` |
| `waitCollected` | Signal | `signalName = "drinkCollected"`, `timeoutMinutes = 60` | `OrderCollected` |
| `completeOrder` | Activity | `activityName = "completeOrder"` | (none) |

Input parameter: `in item orderDetails : OrderLine`

### Full content of fulfil-drink-orchestration.sysml

```sysml
package FulfilDrinkOrchestration {
    private import ScalarValues::*;
    private import TemporalMetadata::*;
    private import CoffeeShop::*;

    doc /* Orchestration-level action flow for drink fulfilment.
         *
         * This models HOW THE SYSTEM MANAGES the drink fulfilment
         * process - activity boundaries, signal waits, and timeout
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
         *   validateOrder    -> receiveOrder (domain)
         *   waitBaristaStart -> barista picks up order
         *   prepareDrink     -> checkDrinkType..assembleDrink (domain)
         *   waitDrinkReady   -> markReady (domain)
         *   waitCollected    -> customer collection
         *   completeOrder    -> order closure
         */

    action def FulfilDrinkWorkflow {
        doc /* Temporal workflow orchestrating drink fulfilment. */

        @TemporalWorkflow {
            workflowName = "fulfilDrink";
            taskQueue = "coffeeshop";
        }

        in item orderDetails : OrderLine;

        action validateOrder {
            doc /* Validate order details before processing. */
            @TemporalActivity { activityName = "validateOrder"; }
            @StateTransitionTrigger { eventName = "OrderPlaced"; }
        }
        then waitBaristaStart;

        action waitBaristaStart {
            doc /* Suspend until a barista signals they have started.
                 * In clinical context: clinician picks up referral. */
            @TemporalSignal { signalName = "baristaStarted"; timeoutMinutes = 30; }
            @StateTransitionTrigger { eventName = "PreparationStarted"; }
        }
        then prepareDrink;

        action prepareDrink {
            doc /* Record that drink preparation has occurred.
                 * The domain-level detail (hot/cold path, milk choice)
                 * is modelled in the FulfilDrink domain action flow. */
            @TemporalActivity { activityName = "prepareDrink"; }
        }
        then waitDrinkReady;

        action waitDrinkReady {
            doc /* Suspend until barista marks drink as ready.
                 * In clinical context: lab results returned. */
            @TemporalSignal { signalName = "drinkReady"; timeoutMinutes = 15; }
            @StateTransitionTrigger { eventName = "PreparationComplete"; }
        }
        then waitCollected;

        action waitCollected {
            doc /* Suspend until customer collects their drink.
                 * In clinical context: patient attends appointment. */
            @TemporalSignal { signalName = "drinkCollected"; timeoutMinutes = 60; }
            @StateTransitionTrigger { eventName = "OrderCollected"; }
        }
        then completeOrder;

        action completeOrder {
            doc /* Finalise the order after collection. */
            @TemporalActivity { activityName = "completeOrder"; }
        }
    }
}
```

All annotations verified in Syside with no errors. Cross-project type resolution confirmed (OrderLine resolves to CoffeeShop::OrderLine in coffeeshop-exercise).

### Cleanup needed

The file `~/Developer/gsl-tech/coffeeshop-exercise/model/domain/metadata-test.sysml` should be deleted. It was a temporary test file for verifying metadata def syntax. The metadata defs now live in the shared library.

---

## Existing generators (coffeeshop-exercise, for reference)

The exercise project has two working generators that establish the pattern:

```
~/Developer/gsl-tech/coffeeshop-exercise/generators/
├── gen_typescript_types.py    # SysML part defs -> TypeScript interfaces
└── gen_state_machines.py      # SysML state defs -> XState v5 machines
```

Both use:
- Regex-based text parsing of `.sysml` files
- CLI pattern: `python gen_x.py input.sysml output.ts`
- `DO NOT EDIT` headers on generated output
- Consistent code style (Python 3, type hints, pathlib)

Generated output goes to `coffeeshop-exercise/generated/`.

### What the new generator must produce

The generated TypeScript workflow must be **behaviourally identical** to the hand-coded Phase A workflow. Specifically it must:

- Import `proxyActivities`, `defineSignal`, `setHandler`, `condition`, `log` from `@temporalio/workflow`
- Import activity types from `../activities/barista.js`
- Create a `proxyActivities` proxy with `startToCloseTimeout: '1 minute'` and `retry: { maximumAttempts: 3 }`
- Define signal constants using `defineSignal()` for each `@TemporalSignal` step
- Export an async workflow function that:
  - Declares mutable boolean state for each signal
  - Registers signal handlers via `setHandler`
  - Executes activity calls and signal waits in sequence
  - Returns a completion message string

The test script (`start-order.ts`) should work without modification against the generated workflow.

---

## Domain model files (coffeeshop-exercise, unchanged)

```
~/Developer/gsl-tech/coffeeshop-exercise/model/domain/
├── coffeeshop.sysml              # Enums, part defs (MenuItem, Drink, Order, OrderLine, etc.)
├── order-lifecycle.sysml          # State machine (OrderLifecycle) with events and transitions
├── drink-fulfilment.sysml         # Domain-level action flow (FulfilDrink - barista process)
└── business-rules.sysml           # Requirements and constraints
```

These are unchanged and should not be modified for the demonstrator.

---

## Syntax reference

Located at: `~/Developer/gsl-tech/coffeeshop-exercise/EG docs & notes/sysml-v2-syntax-reference.md`

This needs updating with the newly verified `metadata def` patterns (Phase B deliverable #4). The current content covers Phases 1-6 of the coffeeshop exercise but does not include metadata definitions.

---

## What to do next

1. **Write `gen_temporal_workflow.py`** — the main generator. Place in `coffeeshop-demonstrator/generators/`. It reads `model/domain/fulfil-drink-orchestration.sysml` and emits a TypeScript workflow file equivalent to the hand-coded `src/workflows/fulfil-drink.ts`.

2. **Write `gen_mermaid.py`** — reads the domain-level `drink-fulfilment.sysml` from coffeeshop-exercise and emits a Mermaid flowchart. Place in `coffeeshop-demonstrator/generators/`.

3. **Test the generated workflow** — replace the hand-coded workflow with the generated one, compile, run the test script, verify identical behaviour.

4. **Update the syntax reference** — add the `metadata def` section with verified patterns.

5. **Verify the exit criterion** — modify the SysML orchestration model (e.g. add or remove a signal wait step), regenerate, and confirm the workflow behaviour changes correspondingly.

---

## Important notes for Claude

- **Always check the syntax reference** (`EG docs & notes/sysml-v2-syntax-reference.md` in coffeeshop-exercise) before writing any new `.sysml` code.
- The MCP filesystem server is connected and provides read/write access to the gsl-tech directory tree. Use the filesystem MCP tools to read and write files directly on Ella's machine.
- Ella's development environment is macOS (MacBook Pro).
- Ella is working in the Claude desktop app, not the web interface.
- The project uses ESM modules throughout — `.js` extensions in imports, `"type": "module"` in package.json.
- Python version available: 3.9.6.
- The coffeeshop-demonstrator spec document should be read from the project directory if detailed phase requirements are needed.
