# SysML v2 Syntax Reference — Syside Modeler
## Verified Patterns from CoffeeShop Exercise & Demonstrator

> **Version:** 3.1 — 5 March 2026
> **Previous version:** `sysml-v2-syntax-reference-v3.0-2026-03-03.md` (v3.0, 3 March 2026)
> **Purpose:** Capture working SysML v2 syntax as verified against Syside Modeler.
> This file should travel with the project repo and be consulted before writing new `.sysml` files.
> Update as new patterns are verified or corrected.
>
> **What's new in v3.1:** Syside Modeler updated to 0.8.5 (released 1 March 2026). Verified `use case def` syntax in the GenderSense package hierarchy. Documented significant new Syside 0.8.5 capabilities (use case diagrams, sequence diagrams, SysML v2 views, CLI diagram generation, Automator filter evaluation and user-defined calculation support). Updated TODO list.

---

## Environment

- **Syside Modeler** 0.8.5 (VS Code extension, released 1 March 2026)
  - Tom Sawyer SysML v2 Viewer v1.3 (sequence diagrams, use case diagrams, colour rendering)
  - SysML v2 `view` element support for scoped diagram generation
  - Modeler CLI with headless diagram generation (`viz` command) for CI/CD
  - Python runtime now bundled (no external Python dependency)
  - Sensmetry claim full SysML v2.0 support as of October 2025; OMG conformance test suite not yet completed industry-wide
  - Syside v1.0.0 targeted for Q1 2026 (stable Automator API, Sysand integration)
  - Extension shows "Preview" badge in VS Code — this is a VS Code Marketplace pre-release/preview designation, not a Syside limitation
- **Syside Automator** 0.8.5 (Python, available on PyPI)
  - `Compiler.evaluate_filter` for metadata-based element filtering
  - User-defined calculation evaluation via `Compiler.evaluate_feature`
  - Relevant for future generator migration from regex to semantic model access
- **SysML v2.0** (OMG ratified July 2025, formal PDFs September 2025)
- **KerML 1.0** (ratified alongside SysML v2.0)
- **Standard library import:** `private import ScalarValues::*;` required at top of each package
- **Cross-project imports:** Syside resolves `private import PackageName::*;` across projects in the same workspace, provided the target package is in a `.sysml` file within the workspace folder tree

---

## Phase 1: Structural Foundations ✅

### Working constructs

```sysml
package CoffeeShop {
    private import ScalarValues::*;

    doc /* Package-level documentation is valid here */

    // Enumerations
    enum def DrinkSize { small; medium; large; }

    // Part definitions (structural "nouns")
    part def MenuItem {
        attribute name : String;
        attribute price : Real;
    }

    // Specialisation (inheritance)
    part def Drink :> MenuItem {
        attribute size : DrinkSize;
    }

    // References vs composition
    part def Order {
        ref customer : Customer;          // reference (independent existence)
        part orderLines : OrderLine[1..*]; // composition (contained)
    }
}
```

### Key points
- `doc /* ... */` is valid inside `package`, `part def`, `action def`, `state def` bodies
- `:>` is specialisation (like inheritance)
- `ref` = reference to independent element; `part` = composition/containment
- `[1..*]` = multiplicity constraints
- Diagrams show `«variation»` for enum defs, `«part def»` for parts

---

## Phase 2: State Machines ✅

### Working constructs

```sysml
package OrderLifeCycle {
    private import ScalarValues::*;

    // Events as attribute definitions
    attribute def PreparationStarted;
    attribute def PreparationComplete;
    attribute def OrderCollected;
    attribute def CancellationRequested;

    state def OrderLifecycle {

        initial;          // ← standalone pseudostate (the black dot)
        state placed;     // ← first real state (separate declaration)

        state inPreparation;
        state ready;
        state collected;
        state cancelled;

        // Named transitions
        transition placed_to_inPreparation
            first placed
            accept PreparationStarted
            then inPreparation;

        transition inPreparation_to_ready
            first inPreparation
            accept PreparationComplete
            then ready;
    }
}
```

### Connecting to structural model

```sysml
// In the Order part def (coffeeshop.sysml):
private import OrderLifeCycle::*;

part def Order {
    // ... attributes ...
    exhibit state orderLifecycle : OrderLifecycle;
}
```

### ⚠️ Syntax traps

| What you might write | What Syside actually wants | Error |
|---|---|---|
| `entry state placed;` | `initial;` then `state placed;` | Parse error |
| `initial state placed;` | `initial;` then `state placed;` | Parse error |
| `entry; state placed;` | `initial;` then `state placed;` | Parse error |

**Rule:** `initial;` must be a standalone declaration. It is the pseudostate (entry arrow), not a modifier on a state.

---

## Phase 3: Action Flows ✅

### Working constructs

```sysml
package DrinkFulfilment {
    private import ScalarValues::*;
    private import CoffeeShop::*;

    action def FulfilDrink {
        in item orderLine : OrderLine;     // input parameter

        action receiveOrder;
        then checkDrinkType;               // chained from preceding action

        action checkDrinkType;
        then prepareHotBase;               // branch 1
        then prepareColdBase;              // branch 2

        action prepareHotBase {
            doc /* Pull espresso shot or brew tea. */
        }
        then assembleDrink;                // converge

        action prepareColdBase {
            doc /* Blend or mix iced drink base. */
        }
        then checkMilk;

        action checkMilk;
        then addMilk;
        then assembleDrink;

        action addMilk {
            doc /* Steam or pour milk according to milkChoice. */
        }
        then assembleDrink;

        action assembleDrink {
            doc /* Combine base, milk, extras, and finish. */
        }
        then markReady;

        action markReady;
    }
}
```

### Key points
- `in item orderLine : OrderLine;` — input parameter declaration; `item` indicates a discrete thing (vs continuous flow)
- `out` parameters flow out of the action; `inout` parameters flow both ways
- Actions can be simple declarations (`action name;`) or have bodies (`action name { ... }`)
- Actions with bodies can contain `doc /* ... */` blocks and nested sub-actions
- `then` is positional — it chains from the action declaration immediately above it in the source text
- Multiple `then` lines after a single action create **branching** (divergence)
- Multiple actions with `then` pointing to the same target create **convergence** (merge)

### ⚠️ Syntax traps

| What you might write | What Syside actually wants | Error |
|---|---|---|
| `decide hotOrCold;` then reference in `succession` | Use `action` nodes for decisions | "No Feature named 'X' found" (reference-error) |
| `merge afterBasePrep;` then reference in `succession` | Use `then` chaining to converge | "No Feature named 'X' found" (reference-error) |
| `succession X then Y;` (standalone) | `then Y;` chained after action declaration | Reference error on source node |
| `X then Y;` (standalone, bare) | `then Y;` chained after action declaration | Reference error on source node |
| `then X if true then Y;` | Not supported; drop guards for now | Parse error |

**Rules:**
1. `then` must be **chained immediately after an action declaration** — it cannot be used as a standalone `source then target` statement
2. `decide` and `merge` control nodes are **not referenceable features** in successions — use regular `action` nodes as decision points instead
3. Multiple `then` lines after a single action create **branching** (multiple outgoing paths)
4. Multiple actions with `then` pointing to the same target create **convergence** (merge)
5. Guard conditions (`if`) on action flow branches: syntax TBD — not yet verified in Syside

---

## Phase 4: Requirements & Constraints ✅

### Working constructs

```sysml
package BusinessRules {
    private import ScalarValues::*;
    private import CoffeeShop::*;

    // Requirements — traceable, human-readable intent
    requirement def LoyaltyDiscountRequired {
        doc /* Members must receive a minimum 10% discount. */
        subject order : Order;
    }

    // Constraints — evaluable boolean rules
    constraint def LoyaltyDiscountConstraint {
        doc /* If the customer is a member, discount >= 10%. */

        in isMember : Boolean;
        in discount : Real;

        isMember implies discount >= 10.0
    }

    constraint def OrderSizeConstraint {
        in lineCount : Integer;

        lineCount >= 1 and lineCount <= 10
    }

    constraint def VeganMilkConstraint {
        in isVegan : Boolean;
        in milkChoice : MilkOption;

        isVegan implies (
            milkChoice == MilkOption::oat or
            milkChoice == MilkOption::soy or
            milkChoice == MilkOption::almond or
            milkChoice == MilkOption::none
        )
    }
}
```

### Key points
- `requirement def` — traceable statement with `subject` indicating what it applies to
- `constraint def` — evaluable boolean rule with `in` parameters
- `subject X : Type;` — declares what the requirement is about
- `in` parameters decouple constraints from specific parts (reusable, testable in isolation)
- Constraint body is a **bare boolean expression with no trailing semicolon**
- `satisfy` / `verify` relationships (linking requirements to constraints) not yet verified

### Verified boolean operators in constraint bodies

| Operator | Example | Meaning |
|---|---|---|
| `implies` | `A implies B` | If A then B must be true |
| `and` | `A and B` | Both must be true |
| `or` | `A or B` | At least one must be true |
| `>=` | `x >= 1` | Greater than or equal |
| `<=` | `x <= 10` | Less than or equal |
| `==` | `x == EnumDef::val` | Equality |
| `::` | `MilkOption::oat` | Enum variant reference |
| `( )` | `A implies (B or C)` | Grouping |

### ⚠️ Syntax traps

| What you might write | What Syside actually wants |
|---|---|
| `isMember implies discount >= 10.0;` | `isMember implies discount >= 10.0` (no semicolon) |
| Constraint body with trailing `;` | Bare expression, no terminator |

---

## Phase 5: Generation Pipeline ✅

No new SysML v2 syntax — this phase validates that the model constructs from Phases 1–4 can be read and transformed into executable code.

### Type mapping: SysML v2 → TypeScript

| SysML v2 | TypeScript |
|---|---|
| `String` | `string` |
| `Boolean` | `boolean` |
| `Integer` | `number` |
| `Real` | `number` |
| `enum def X` | `enum X` |
| `part def X` | `interface X` |
| `part def X :> Y` | `interface X extends Y` |
| `ref x : Type;` | `x: Type;` (reference) |
| `part x : Type[1..*];` | `x: Type[];` (array) |

### Running the generator

```bash
python generators/gen_typescript_types.py model/domain/coffeeshop.sysml generated/types.ts
```

### Key principles
- Generated files carry a `DO NOT EDIT` header — changes go in the model
- Current generator uses regex text parsing (adequate for consistent `.sysml` structure)
- For production / GenderSense: replace with Syside Automator for semantic model access
- Generation policy decisions (e.g. `ref` → full object vs ID-only) are generator config, not model concerns

---

## Phase 6: State Machine Generator ✅

Generates executable XState v5 state machines from SysML v2 `state def` blocks.

### Mapping: SysML v2 → XState v5

| SysML v2 | XState v5 |
|---|---|
| `state def OrderLifecycle` | `createMachine({ id: "OrderLifecycle" })` |
| `initial;` + first `state` | `initial: "placed"` |
| `state placed;` | `states: { placed: { ... } }` |
| `transition X first A accept Event then B;` | `A: { on: { Event: "B" } }` |
| `attribute def Event;` | `{ type: "Event" }` in event union type |
| States with no outgoing transitions | `type: "final"` |

### Running the generator

```bash
python generators/gen_state_machines.py model/domain/order-lifecycle.sysml generated/order-lifecycle-machine.ts
```

### Dependencies
- `npm install xstate` required in the project for the generated import to resolve

### Key points
- Events map from SysML `attribute def` declarations to a TypeScript union type
- Terminal states (no outgoing transitions) automatically get `type: "final"`
- The generated machine is directly usable with `createActor()` from XState
- XState provides runtime guarantees: invalid transitions are ignored, final states cannot be exited

---

## Demonstrator Phase B: Metadata Definitions ✅

*New in v2.0 — verified 3 March 2026 in Syside Modeler 0.8.4*

### Purpose

SysML v2 `metadata def` provides a standards-compliant mechanism for annotating model elements with generator configuration. This replaces fragile approaches (doc block parsing, auxiliary YAML files) with first-class, tool-validated annotations.

### Defining metadata

```sysml
package TemporalMetadata {
    private import ScalarValues::*;

    doc /* Metadata definitions for Temporal workflow generation. */

    metadata def TemporalWorkflow {
        doc /* Marks an action def as a Temporal workflow orchestration. */
        attribute workflowName : String;
        attribute taskQueue : String;
    }

    metadata def TemporalActivity {
        doc /* Marks an action as a Temporal activity invocation. */
        attribute activityName : String;
    }

    metadata def TemporalSignal {
        doc /* Marks an action as a signal wait point. */
        attribute signalName : String;
        attribute timeoutMinutes : Integer;
    }

    metadata def StateTransitionTrigger {
        doc /* Links an action step to the state machine event it triggers. */
        attribute eventName : String;
    }
}
```

### Key points for `metadata def`
- Declared with `metadata def Name { ... }` inside a `package`
- Contains `attribute` declarations with types from `ScalarValues::*`
- Supports `doc /* ... */` blocks for documentation
- Requires `private import ScalarValues::*;` in the containing package for `String`, `Integer`, etc.
- Can be defined in a shared library package and imported by multiple projects

### Applying metadata annotations

```sysml
package FulfilDrinkOrchestration {
    private import ScalarValues::*;
    private import TemporalMetadata::*;
    private import CoffeeShop::*;

    action def FulfilDrinkWorkflow {
        doc /* Temporal workflow orchestrating drink fulfilment. */

        // Annotation at the action def level — marks the whole def
        @TemporalWorkflow {
            workflowName = "fulfilDrink";
            taskQueue = "coffeeshop";
        }

        in item orderDetails : OrderLine;

        // Annotations inside action step bodies
        action validateOrder {
            doc /* Validate order details before processing. */
            @TemporalActivity { activityName = "validateOrder"; }
            @StateTransitionTrigger { eventName = "OrderPlaced"; }
        }
        then waitBaristaStart;

        action waitBaristaStart {
            doc /* Suspend until a barista signals they have started. */
            @TemporalSignal { signalName = "baristaStarted"; timeoutMinutes = 30; }
            @StateTransitionTrigger { eventName = "PreparationStarted"; }
        }
        then prepareDrink;

        action prepareDrink {
            doc /* Record that drink preparation has occurred. */
            @TemporalActivity { activityName = "prepareDrink"; }
        }
        then waitDrinkReady;

        action waitDrinkReady {
            @TemporalSignal { signalName = "drinkReady"; timeoutMinutes = 15; }
            @StateTransitionTrigger { eventName = "PreparationComplete"; }
        }
        then waitCollected;

        action waitCollected {
            @TemporalSignal { signalName = "drinkCollected"; timeoutMinutes = 60; }
            @StateTransitionTrigger { eventName = "OrderCollected"; }
        }
        then completeOrder;

        action completeOrder {
            @TemporalActivity { activityName = "completeOrder"; }
        }
    }
}
```

### Annotation syntax rules

| Pattern | Example | Notes |
|---|---|---|
| Annotation on action def | `@TemporalWorkflow { ... }` inside `action def` body | Marks the whole definition |
| Annotation on action step | `@TemporalActivity { ... }` inside `action name { ... }` | Step must have a body (braces) to hold annotations |
| String attribute value | `workflowName = "fulfilDrink";` | Double-quoted, semicolon-terminated |
| Integer attribute value | `timeoutMinutes = 30;` | Bare integer, semicolon-terminated |
| Multiple annotations | Two `@` annotations in the same action body | Both parse correctly |
| Cross-project import | `private import TemporalMetadata::*;` | Resolves across workspace projects |

### ⚠️ Syntax traps

| What you might write | What Syside actually wants | Notes |
|---|---|---|
| `@TemporalActivity { activityName = "x"; }` on a simple `action name;` | `action name { @TemporalActivity { ... } }` | Simple action declarations (no braces) cannot carry annotations — the step needs a body |
| `@UnknownMetadata { ... }` | Must match a `metadata def` in scope | Syside gives a semantic error for unresolved `@Name` references |
| `attribute name = "value"` (with `attribute` keyword in annotation) | `name = "value";` | Inside an `@` annotation, use bare attribute assignment without the `attribute` keyword |

### Verified Syside behaviours
- Syside semantically validates `@Name` references — typos produce errors immediately
- Hover tooltips on `@Name` annotations show the metadata def's doc string and source location
- Cross-project imports resolve correctly in a multi-project workspace
- Multiple metadata annotations on a single action step parse and validate correctly
- Annotations appear in the Syside definition view alongside the annotated element

### Shared metadata library pattern

For reusable metadata definitions shared across projects, maintain a separate library project:

```
~/Developer/gsl-tech/sysml-metadata-lib/
└── temporal/
    └── temporal-metadata.sysml    # Package: TemporalMetadata
```

Consuming projects import with `private import TemporalMetadata::*;` — Syside resolves this as long as the library is within the VS Code workspace folder tree.

---

## Demonstrator Phase B: Temporal Workflow Generator ✅

*New in v2.0 — verified 3 March 2026*

Generates Temporal TypeScript workflow functions from SysML v2 orchestration-level action flows annotated with `TemporalMetadata`.

### Two-layer action flow architecture

| Layer | SysML file | Audience | Generator |
|---|---|---|---|
| **Domain** | `drink-fulfilment.sysml` (coffeeshop-exercise) | Governance reviewers, clinical leads | `gen_mermaid_pathway.py` |
| **Orchestration** | `fulfil-drink-orchestration.sysml` (coffeeshop-demonstrator) | Runtime execution | `gen_temporal_workflow.py` |

The domain layer describes **what the barista does** (the clinical process). The orchestration layer describes **how the system manages it** (activity boundaries, signal waits, timeouts). This separation maps directly to GenderSense: clinical pathways have both a clinical process view and an orchestration view.

### Mapping: SysML v2 orchestration → Temporal TypeScript

| SysML v2 | Temporal TypeScript |
|---|---|
| `action def X` with `@TemporalWorkflow` | `export async function workflowName(...)` |
| `@TemporalWorkflow { workflowName; taskQueue; }` | Function name + task queue config |
| `action step { @TemporalActivity { activityName; } }` | `await activityName(order)` |
| `action step { @TemporalSignal { signalName; } }` | `defineSignal()` + `setHandler()` + `await condition()` |
| `then nextStep;` (succession) | Sequential ordering in the async function body |
| `in item orderDetails : OrderLine;` | Function parameter type |

### Running the generators

```bash
# Temporal workflow from orchestration model
python generators/gen_temporal_workflow.py \
    model/domain/fulfil-drink-orchestration.sysml \
    generated/fulfil-drink.ts

# Mermaid pathway diagram from domain model
python generators/gen_mermaid_pathway.py \
    ../coffeeshop-exercise/model/domain/drink-fulfilment.sysml \
    generated/fulfil-drink-pathway.mmd
```

### Exit criterion verified
The generated workflow is behaviourally identical to the Phase A hand-coded workflow. The existing test script (`start-order.ts`) runs without modification against the generated workflow, producing the same activity sequence, signal handling, and completion result.

---

## Demonstrator Phase C: Integration — XState in Temporal + SvelteKit ✅

*New in v3.0 — verified 3 March 2026*

Phase C validates the complete end-to-end chain: SysML model → generated XState machine + generated Temporal workflow → XState state enforcement inside Temporal → web UI reading state via Temporal queries.

### XState pure transition functions in Temporal V8 isolate

XState v5 provides pure, side-effect-free functions for state machine transition logic. These are safe for Temporal's deterministic V8 isolate (no timers, no subscriptions, no I/O):

```typescript
import { initialTransition, transition } from 'xstate';
import { orderLifecycleMachine } from '@coffeeshop/shared';
import type { OrderEvent } from '@coffeeshop/shared';

// Initialise — deterministic, returns [snapshot, actions]
let [machineState] = initialTransition(orderLifecycleMachine);

// Transition — pure function, returns [nextSnapshot, actions]
function tryTransition(
  currentSnapshot: ReturnType<typeof initialTransition>[0],
  eventType: string,
): ReturnType<typeof initialTransition>[0] {
  const event = { type: eventType } as OrderEvent;
  const [nextSnapshot] = transition(orderLifecycleMachine, currentSnapshot, event);
  return nextSnapshot;
}

// Usage after each signal:
machineState = tryTransition(machineState, 'PreparationStarted');
```

**Key validation:** Temporal's webpack bundler successfully resolved XState (v5.28.0, 161 KiB, 7 modules) into the V8 isolate. The `initialTransition()` and `transition()` functions are deterministic and survive Temporal replay without side effects.

### Temporal query handler for state visibility

Temporal queries allow external clients (web UI, CLI) to read workflow-internal state without affecting the workflow execution:

```typescript
import { defineQuery, setHandler } from '@temporalio/workflow';

export const orderStateQuery = defineQuery<string>('orderState');

// Inside the workflow function:
setHandler(orderStateQuery, () => {
  const value = machineState.value;
  return typeof value === 'string' ? value : JSON.stringify(value);
});
```

The SvelteKit API routes call `handle.query('orderState')` to read the current XState state. This is a read-only operation — the query handler cannot modify workflow state.

### Complete mapping: SysML → XState → Temporal → Web UI

This table shows the full traceability chain for each step of the order lifecycle:

| SysML orchestration step | SysML metadata | Temporal behaviour | XState event | XState state | Web UI |
|---|---|---|---|---|---|
| `validateOrder` | `@TemporalActivity` | `await validateOrder(order)` | — | placed | Order placed |
| `waitBaristaStart` | `@TemporalSignal { signalName = "baristaStarted" }` | `await condition(() => baristaStarted)` | PreparationStarted | inPreparation | "Barista: Start Preparation" button |
| `prepareDrink` | `@TemporalActivity` | `await prepareDrink(order)` | — | (unchanged) | — |
| `waitDrinkReady` | `@TemporalSignal { signalName = "drinkReady" }` | `await condition(() => drinkReady)` | PreparationComplete | ready | "Barista: Mark Ready" button |
| `waitCollected` | `@TemporalSignal { signalName = "drinkCollected" }` | `await condition(() => drinkCollected)` | OrderCollected | collected | "Customer: Collect Drink" button |
| `completeOrder` | `@TemporalActivity` | `await completeOrder(order)` | — | (unchanged) | Order complete |

### `@StateTransitionTrigger` — linking orchestration to lifecycle

The `@StateTransitionTrigger { eventName = "..."; }` metadata annotation connects orchestration steps to XState events. This serves two purposes:

1. **Traceability:** Documents which orchestration step triggers which lifecycle state change.
2. **Code generation (future):** The Temporal generator can emit transition logic automatically from these annotations.

Currently the mapping is implemented by hand in the workflow code. Generator extension to emit `tryTransition()` calls from `@StateTransitionTrigger` annotations is a cleanup task.

### Signal name chain

The signal names flow through three layers, all matching by string identity:

```
SysML:      @TemporalSignal { signalName = "baristaStarted"; }
                    ↓
Temporal:   export const baristaStartedSignal = defineSignal('baristaStarted');
                    ↓
Shared:     export const SIGNAL_BARISTA_STARTED = 'baristaStarted';
                    ↓
SvelteKit:  await handle.signal('baristaStarted');
```

The `@coffeeshop/shared` package holds the string constants used by both the Temporal workflow and the SvelteKit API routes. The SysML model is the authoritative source; the shared constants must match what the generator emits.

### XState as defence in depth

The XState machine rejects invalid transitions independently of the Temporal workflow. If application code attempts to transition from `placed` directly to `collected`, the pure `transition()` function returns the unchanged state — the invalid event is silently ignored. This provides runtime safety even if the orchestration logic has bugs.

Verified: Attempting to send `drinkCollected` while the order is in `placed` state does not advance the state machine. Only the correct signal sequence progresses the lifecycle.

### Durable execution through the full stack

Verified: killing the Temporal worker mid-workflow (while the order was in `inPreparation` state), restarting the worker, and continuing via the web UI. The Temporal server replays the workflow from its event history on the new worker, XState pure transition functions produce the same deterministic state, and the web UI recovers via polling. The Temporal Web UI shows Workers: 2, confirming the handoff.

---

## General Patterns

### Package structure
```sysml
package MyPackage {
    private import ScalarValues::*;
    private import OtherPackage::*;

    doc /* Package documentation */

    // declarations...
}
```

### Documentation
- `doc /* ... */` is valid inside any definition body (`package`, `part def`, `action def`, `state def`, `metadata def`)
- It attaches to the enclosing element
- It is NOT an orphaned comment — ignore AI assistants that claim otherwise
- Documentation renders in Syside hover tooltips on usage references

### Import resolution
- `private import PackageName::*;` imports all public members of a package
- `private` limits visibility to the importing package (standard practice)
- Syside resolves imports across all `.sysml` files in the VS Code workspace
- Cross-project imports work provided both projects are within the workspace folder tree
- Import resolution does not require any build step or explicit project configuration

### Diagram capabilities (Syside 0.8.4)
- **Definition view** (structural/class-style) renders for all element types
- **State machine diagram** (rounded rectangles + arrows) not yet available
- **Action flow diagram** (activity diagram) not yet verified
- Tom Sawyer SysML v2 Viewer or Syside Cloud may offer better behavioural diagrams
- **Mermaid generation** provides a practical alternative for visual pathway documentation

---

## File / Repo Conventions

### CoffeeShop exercise (learning project)
```
coffeeshop-exercise/
├── model/
│   └── domain/
│       ├── coffeeshop.sysml              # Phase 1: structural
│       ├── order-lifecycle.sysml          # Phase 2: state machine
│       ├── drink-fulfilment.sysml         # Phase 3: action flow (domain layer)
│       └── business-rules.sysml           # Phase 4: requirements & constraints
├── generators/
│   ├── gen_typescript_types.py            # Phase 5: SysML → TypeScript interfaces
│   └── gen_state_machines.py              # Phase 6: SysML → XState v5 machines
├── generated/
│   ├── types.ts
│   └── order-lifecycle-machine.ts
└── EG docs & notes/
```

### CoffeeShop demonstrator (proof of concept) — Phase C structure
```
coffeeshop-demonstrator/
├── model/
│   └── domain/
│       └── fulfil-drink-orchestration.sysml   # Orchestration-level action flow
├── generators/
│   ├── gen_temporal_workflow.py                # SysML → Temporal workflow
│   ├── gen_mermaid_pathway.py                 # SysML → Mermaid diagram
│   ├── gen_typescript_types.py                # SysML → TypeScript interfaces
│   └── gen_state_machines.py                  # SysML → XState v5 machines
├── generated/                                 # Generator output (canonical)
│   ├── fulfil-drink.ts                        # Generated workflow
│   ├── fulfil-drink-pathway.mmd               # Generated pathway diagram
│   ├── order-lifecycle-machine.ts             # Generated XState machine
│   └── types.ts                               # Generated TypeScript types
├── packages/
│   ├── shared/                                # @coffeeshop/shared
│   │   └── src/
│   │       ├── generated/                     # Copied from root generated/
│   │       │   ├── order-lifecycle-machine.ts
│   │       │   └── types.ts
│   │       ├── workflow-constants.ts          # Signal/query/task queue constants
│   │       └── index.ts                       # Re-exports
│   ├── temporal/                              # @coffeeshop/temporal
│   │   └── src/
│   │       ├── activities/barista.ts          # Hand-written activities
│   │       ├── workflows/fulfil-drink.ts      # Generated + XState integration
│   │       ├── workers/worker.ts              # Worker bootstrap
│   │       └── client/start-order.ts          # CLI test script
│   └── web/                                   # @coffeeshop/web (SvelteKit)
│       └── src/
│           ├── lib/server/temporal.ts          # Temporal client singleton
│           └── routes/
│               ├── +page.svelte               # Order form
│               ├── orders/[id]/+page.svelte   # Order status + action buttons
│               └── api/orders/                # REST API routes
├── pnpm-workspace.yaml
├── package.json                               # Root: generation + build scripts
└── tsconfig.base.json                         # Shared TS options
```

### Shared metadata library
```
sysml-metadata-lib/
└── temporal/
    └── temporal-metadata.sysml                # Package: TemporalMetadata
```

### Git practices for model-driven development
- `.sysml` files are plain text — clean diffs, merge, blame all work
- **Atomic commits:** model change + regenerated artefacts + implementation updates together
- **Generated code:** either gitignore (regenerate in CI) or commit with sync verification
- **Tagging:** semver tags where model + generators + implementation are known-good
- **Phase C tags:** `v0.3.0-restructure` (monorepo), `v0.3.1-xstate-integration` (XState in Temporal), `v0.3.0` (Phase C complete)

---

## Appendix A: Complete Metadata Def Syntax Reference

This section consolidates all verified `metadata def` syntax patterns for quick reference.

### Declaration

```sysml
metadata def MetadataName {
    doc /* Documentation for this metadata definition. */
    attribute attrName : String;       // String attribute
    attribute attrName : Integer;      // Integer attribute
    attribute attrName : Boolean;      // Boolean attribute
    attribute attrName : Real;         // Real (float) attribute
}
```

### Application (annotation)

```sysml
// On an action def (marks the whole definition):
action def MyWorkflow {
    @MetadataName {
        stringAttr = "value";       // String: double-quoted, semicolon
        integerAttr = 42;           // Integer: bare number, semicolon
    }
}

// On a nested action step (step must have braces):
action myStep {
    @MetadataName { attrName = "value"; }
}

// Multiple annotations on the same element:
action myStep {
    @FirstMetadata { attr1 = "x"; }
    @SecondMetadata { attr2 = "y"; }
}
```

### Rules summary
1. `metadata def` is declared like any other definition — in a `package`, with `attribute` members
2. Applied with `@MetadataName { ... }` inside the body of the annotated element
3. The annotated element must have a body (braces) — simple declarations like `action name;` cannot carry annotations
4. Attribute values use bare assignment: `name = "value";` (not `attribute name = "value";`)
5. String values must be double-quoted; integer values are bare numbers
6. All attribute assignments are semicolon-terminated
7. Syside validates `@Name` references — typos produce semantic errors
8. Annotations are visible in Syside hover tooltips, showing the metadata def's doc and source

---

## Appendix B: End-to-End Generation Pipeline Summary

*New in v3.0*

This appendix summarises the complete generation chain from SysML model to running system, as validated across Phases B and C.

### Generators

| Generator | Input | Output | Audience |
|---|---|---|---|
| `gen_typescript_types.py` | `coffeeshop.sysml` (structural model) | `types.ts` (interfaces, enums) | Developers |
| `gen_state_machines.py` | `order-lifecycle.sysml` (state def) | `order-lifecycle-machine.ts` (XState v5) | Runtime state enforcement |
| `gen_temporal_workflow.py` | `fulfil-drink-orchestration.sysml` (annotated action def) | `fulfil-drink.ts` (Temporal workflow) | Runtime execution |
| `gen_mermaid_pathway.py` | `drink-fulfilment.sysml` (domain action def) | `fulfil-drink-pathway.mmd` (Mermaid) | Governance reviewers |

### Generation and sync commands

```bash
cd ~/Developer/gsl-tech/coffeeshop-demonstrator

# Run all generators and sync to workspace packages
pnpm generate

# Or individually:
pnpm generate:types
pnpm generate:statemachine
pnpm generate:workflow
pnpm generate:pathway
pnpm sync-generated
```

The `sync-generated` script copies generated `.ts` files to the correct workspace packages:
- `types.ts` and `order-lifecycle-machine.ts` → `packages/shared/src/generated/`
- `fulfil-drink.ts` → `packages/temporal/src/workflows/`

### Single source of truth verification

All generated artefacts trace back to the SysML model. No process knowledge exists only in hand-written code:

| Artefact | Source | Verified |
|---|---|---|
| TypeScript interfaces and enums | `coffeeshop.sysml` structural model | Phase 5 ✅ |
| XState v5 machine definition | `order-lifecycle.sysml` state def | Phase 6 ✅ |
| Temporal workflow function | `fulfil-drink-orchestration.sysml` annotated action def | Phase B ✅ |
| Mermaid pathway diagram | `drink-fulfilment.sysml` domain action def | Phase B ✅ |
| XState state enforcement in Temporal | Generated machine + pure transition functions | Phase C ✅ |

---

## GenderSense Package Hierarchy: Use Case Definitions ✅

*New in v3.1 — verified 5 March 2026 in Syside Modeler 0.8.5*

### Purpose

The GenderSense package hierarchy (`gendersense-package-hierarchy.sysml`) establishes the full namespace structure for the GenderSense business system. It uses `use case def` extensively to define placeholder capabilities at each package level.

### Working constructs

```sysml
package ServiceDelivery {
    private import ScalarValues::*;

    package PatientJourney {
        private import ScalarValues::*;

        doc /* Top-level lifecycle from acquisition through to discharge. */

        use case def AcquirePatient {
            doc /* Patient discovers and engages with GenderSense. */
        }

        use case def RegisterPatient {
            doc /* Patient registration, identity verification,
                 * demographic capture, consent collection. */
        }
    }
}
```

### Key points
- `use case def` is a first-class SysML v2 language element for defining actor-system interactions
- Supports `doc /* ... */` inside the body, same as `part def`, `action def`, etc.
- Can be nested inside any `package`
- Syside Modeler 0.8.5 parses `use case def` without errors (verified with 50+ use case defs in a single file)
- Tom Sawyer SysML v2 Viewer v1.3 adds use case diagram rendering (not yet tested for GenderSense hierarchy)
- `include use case` and `extend use case` relationships: not yet tested but expected to work given full v2.0 spec support
- `subject` declaration inside `use case def`: not yet tested
- `actor` parts and `actor def`: not yet tested

### Verified in this exercise
- Deep package nesting (6 top-level packages, ~40 sub-packages, 3 levels deep) in a single `.sysml` file
- Mixed content: `package`, `part def`, `enum def`, `state def`, `metadata def`, `use case def`, `attribute def`, and `constraint def` all coexisting in one file
- `doc /* ... */` blocks on all element types including `use case def`
- No Syside validation errors on the complete 1,100+ line file

---

## Satisfy Traceability: Requirements to Constraints ✅

*New in v3.1 — verified 5 March 2026 in Syside Modeler 0.8.5*

### Purpose

The governance traceability chain requires that regulatory requirements trace to evaluable constraints, which trace to runtime checks, which trace to audit evidence. SysML v2 `satisfy` relationships provide the formal link between `requirement def` and `constraint def` elements.

### Working constructs

```sysml
package Regulation {
    private import ScalarValues::*;

    requirement def BloodMonitoringRequired {
        doc /* Patients on hormone therapy must have blood tests
             * performed at defined monitoring intervals. */
        subject patient : ClinicalEntities::Patient;
        attribute monitoringIntervalWeeks : Integer;
    }
}

package ConstraintLibrary {
    private import ScalarValues::*;
    private import Enterprise::Regulation::*;    // import requirements into scope

    constraint def BloodMonitoringIntervalConstraint {
        doc /* Weeks since last test must not exceed required interval. */
        in weeksSinceLastTest : Integer;
        in requiredIntervalWeeks : Integer;

        weeksSinceLastTest <= requiredIntervalWeeks
    }

    // Usage (feature) typed by the constraint def
    constraint bloodMonitoringCheck : BloodMonitoringIntervalConstraint;

    // Traceability: this constraint satisfies that requirement
    satisfy requirement BloodMonitoringRequired
        by bloodMonitoringCheck;
}
```

### Key points
- `requirement def` with `subject` and `attribute` declarations parses correctly
- `subject patient : ClinicalEntities::Patient;` — cross-package type reference works inside `requirement def`
- `satisfy requirement X by Y;` creates a `SatisfyRequirementUsage` element that Syside semantically validates
- The `by` target **must be a feature (usage), not a definition**. Use `constraint myCheck : MyConstraintDef;` to create a usage, then reference `myCheck` in the `by` clause
- Requirements must be **imported into scope** before referencing in `satisfy`. Use `private import Enterprise::Regulation::*;` in the package containing the `satisfy` relationship
- **Do not use fully-qualified paths starting from the root package** (e.g. `GenderSense::Enterprise::...`) from inside the same root package — this triggers `namespace-distinguishability` shadowing warnings. Use relative paths or imports instead

### ⚠️ Syntax traps

| What you might write | What Syside actually wants | Error |
|---|---|---|
| `satisfy requirement R by MyConstraintDef;` | `constraint c : MyConstraintDef; satisfy requirement R by c;` | `feature-reference-expression-referent-is-feature` |
| `satisfy requirement GenderSense::Enterprise::Regulation::R by c;` | `private import Enterprise::Regulation::*;` then `satisfy requirement R by c;` | `namespace-distinguishability` + `reference-error` |
| `satisfy requirement Enterprise::Regulation::R by c;` (from sibling package) | `private import Enterprise::Regulation::*;` then `satisfy requirement R by c;` | `reference-error` (can't navigate to sibling without import) |

### Not yet verified
- `verify` relationship (linking verification cases to requirements)
- `requirement def` specialisation (one requirement extending another)
- `requirement` usages within `use case def` bodies
- Runtime generation from `satisfy` relationships (e.g. producing compliance check code)

---

## TODO: Patterns Not Yet Verified

- [ ] `decide` / `merge` control nodes — proper syntax for Syside
- [ ] Guard conditions on action flow transitions
- [ ] `fork` / `join` for parallel actions
- [x] ~~`satisfy` relationships (linking requirements to constraints)~~ — verified 5 March 2026; see "Satisfy/Verify Traceability" section
- [ ] `verify` relationships — not yet tested
- [ ] Port definitions and connections
- [x] ~~Syside Automator programmatic model access~~ — Automator 0.8.5 now on PyPI with `Compiler.evaluate_filter` and `Compiler.evaluate_feature`; full evaluation deferred to generator migration
- [ ] `metadata def` with non-scalar attribute types (e.g. enum-valued metadata attributes)
- [ ] `metadata def` specialisation (one metadata def extending another)
- [ ] `metadata def` applied to `part def`, `state def`, or `requirement def` elements (only verified on `action def` and `action` so far)
- [ ] Generator extension: `gen_temporal_workflow.py` emitting `tryTransition()` calls from `@StateTransitionTrigger` annotations
- [ ] Temporal `Promise.all()` generation from SysML `fork` / `join` constructs
- [x] ~~`use case def` — basic declaration with `doc` blocks~~ — verified 5 March 2026 (GenderSense package hierarchy)
- [ ] `use case def` with `include use case`, `extend use case`, `subject`, `actor` — advanced use case relationships
- [ ] SysML v2 `view` and `viewpoint` elements for scoped diagram generation
- [ ] Syside CLI `viz` command for headless diagram export
- [ ] Re-test `decide`/`merge`, `fork`/`join` against Syside 0.8.5 (may now work given full v2.0 support claim)

---

*End of document. Previous version preserved as `sysml-v2-syntax-reference-v3.0-2026-03-03.md`.*
