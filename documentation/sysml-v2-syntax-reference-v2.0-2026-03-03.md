# SysML v2 Syntax Reference — Syside Modeler
## Verified Patterns from CoffeeShop Exercise & Demonstrator

> **Version:** 2.0 — 3 March 2026 18:30
> **Previous version:** `sysml-v2-syntax-reference.md` (undated, Phases 1–6 only)
> **Purpose:** Capture working SysML v2 syntax as verified against Syside Modeler 0.8.4.
> This file should travel with the project repo and be consulted before writing new `.sysml` files.
> Update as new patterns are verified or corrected.

---

## Environment

- **Syside Modeler** 0.8.4 (VS Code extension)
- **SysML v2.0** (OMG ratified July 2025)
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

### CoffeeShop demonstrator (proof of concept)
```
coffeeshop-demonstrator/
├── model/
│   └── domain/
│       └── fulfil-drink-orchestration.sysml   # Orchestration-level action flow
├── generators/
│   ├── gen_temporal_workflow.py                # SysML → Temporal workflow
│   └── gen_mermaid_pathway.py                 # SysML → Mermaid diagram
├── generated/
│   ├── fulfil-drink.ts                        # Generated workflow
│   └── fulfil-drink-pathway.mmd               # Generated pathway diagram
├── src/
│   ├── activities/barista.ts                  # Hand-written activity implementations
│   ├── workflows/fulfil-drink.ts              # Generated (copied from generated/)
│   ├── workers/worker.ts                      # Worker bootstrap
│   └── client/start-order.ts                  # Test script
└── tsconfig.json                              # include: src/**/* ; exclude: generated/
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

---

## Appendix: Complete Metadata Def Syntax Reference

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

## TODO: Patterns Not Yet Verified

- [ ] `decide` / `merge` control nodes — proper syntax for Syside
- [ ] Guard conditions on action flow transitions
- [ ] `fork` / `join` for parallel actions
- [ ] `satisfy` / `verify` relationships (linking requirements to constraints)
- [ ] Port definitions and connections
- [ ] Syside Automator programmatic model access
- [ ] `metadata def` with non-scalar attribute types (e.g. enum-valued metadata attributes)
- [ ] `metadata def` specialisation (one metadata def extending another)
- [ ] `metadata def` applied to `part def`, `state def`, or `requirement def` elements (only verified on `action def` and `action` so far)

---

*End of document. Previous version preserved as `sysml-v2-syntax-reference.md` in the same directory.*
