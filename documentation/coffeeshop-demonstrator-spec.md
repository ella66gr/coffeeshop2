# Coffee Shop Action Flow Demonstrator

**Project Specification and Plan**
*Proof of Concept: SysML v2 Model-Driven Execution*

Version 1.0 · 1 March 2026 · GenderSense / CoffeeShop Learning Exercise

---

## 1. Purpose and Context

### 1.1 Background

This project extends a completed SysML v2 learning exercise (the CoffeeShop model) into a proof of concept for model-driven process execution. The learning exercise established working patterns for structural modelling, state machines, action flows, requirements and constraints, and code generation using SysML v2 with Syside Modeler.

The demonstrator addresses a key question identified during that exercise: how to operationalise SysML v2 action flows as running business processes with minimal distance between the model (the single source of truth) and the executing system.

### 1.2 Strategic Purpose

While the coffee shop domain is deliberately simple, the architectural patterns established here are intended to transfer directly to GenderSense, where clinical pathways are long-running, involve multiple participants and external dependencies, require robust audit trails, and must demonstrably conform to defined governance processes.

The demonstrator must therefore validate not just that the approach works technically, but that it supports the governance and traceability requirements of a regulated healthcare context.

### 1.3 Core Thesis

SysML v2 model → generated Temporal workflow + generated XState state machine → **running system with audit trail + visual pathway documentation, all from a single source of truth.**

---

## 2. Architectural Decisions

### 2.1 Why Temporal for Process Orchestration

Four approaches to operationalising action flows were evaluated during project scoping:

- **Dedicated workflow engine (Camunda/BPMN):** Powerful but introduces a second mental model (BPMN alongside SysML), heavy infrastructure (Java/database), and a translation step from SysML to BPMN.
- **Lightweight application code:** Simple to deploy but requires building durability, recovery, audit trails, and process visibility from scratch. Process logic risks entanglement with application logic.
- **XState with durable backing (hybrid):** State machines generated from SysML, backed by persistent storage and event logging. Elegant for entity lifecycles but awkward for complex sequential processes with long waits and branching.
- **Temporal:** Workflows expressed as ordinary TypeScript async functions with durable execution guaranteed by the Temporal server. Long waits (days/weeks) cost zero resources. Complete event history provided automatically. Open source, self-hostable, with a managed cloud option for later.

**Decision:** Use Temporal for process orchestration, with XState for entity lifecycle state enforcement. This provides the shortest path from SysML action flows to executable code while gaining durability, audit trails, and process visibility without building custom infrastructure.

### 2.2 Why XState Alongside Temporal

Temporal orchestrates the procedural flow (what happens and in what order). XState enforces the entity lifecycle (what states are valid and what transitions are legal). They complement each other:

- The SysML `state def` (OrderLifecycle) generates an XState machine that guarantees only valid state transitions occur.
- The SysML `action def` (FulfilDrink) generates a Temporal workflow that orchestrates the fulfilment process and drives transitions on the XState machine as it progresses.
- If a bug in application code attempts an invalid transition, XState rejects it regardless of what Temporal requests. Defence in depth.

### 2.3 Temporal Deployment Strategy

Temporal is open source (MIT licensed). The deployment progression is:

1. **Development:** `temporal server start-lite` (single binary, no external dependencies, includes web UI).
2. **Early deployment:** Self-hosted Temporal server on cloud compute (e.g. small VM) with PostgreSQL persistence. Minimal cost beyond existing infrastructure.
3. **Scale:** Temporal Cloud (managed service) if and when operational burden of self-hosting becomes the bottleneck.

Workflow code is identical across all three environments. Migration requires only changing the connection endpoint.

### 2.4 Generation Pipeline Design

The SysML v2 model serves as the single source of truth. Three generation targets produce outputs for different audiences:

| Generation Target | Output | Audience |
|---|---|---|
| SysML → Temporal workflow | TypeScript workflow functions | Runtime execution (the system runs these) |
| SysML → XState machine | TypeScript state machine defs | Runtime state enforcement |
| SysML → Visual pathway | Mermaid/SVG/PDF diagrams | Governance reviewers, clinical leads, regulators |
| SysML → TypeScript types | Interfaces and enums | Developers (type safety in implementation) |

Additionally, Temporal execution history combined with SysML requirements produces audit compliance reports for governance reviewers.

---

## 3. Demonstrator Scope

### 3.1 In Scope

One end-to-end pathway: an order is placed, a drink is fulfilled, the order lifecycle progresses through its states, and the complete execution is visible as both a running process and an auditable record.

**Functional elements:**

- Minimal web interface (SvelteKit): Place an order, view order status updating in real time, simulate barista actions (start preparation, mark complete), simulate customer collection.
- Temporal server running locally via `temporal server start-lite`.
- Temporal workflow generated from the SysML FulfilDrink action flow, using signals for human-in-the-loop steps (barista confirms preparation started, barista marks drink ready, customer collects).
- XState machine generated from the SysML OrderLifecycle state definition, running in the application layer and enforcing valid state transitions driven by the Temporal workflow.
- Visual pathway diagram generated from the SysML action flow (Mermaid target).
- Audit report page displaying Temporal workflow event history for completed orders as a timestamped compliance table.

**Generation pipeline:**

- SysML → TypeScript types (existing generator, extended as needed).
- SysML → XState v5 machine (existing generator, extended as needed).
- SysML → Temporal workflow (new generator).
- SysML → Mermaid pathway diagram (new generator).

### 3.2 Out of Scope

- Production-quality UI design or styling.
- Real payment processing, inventory management, or other operational systems.
- Multi-user authentication or authorisation.
- Deployment to cloud infrastructure (local development only for this demonstrator).
- Syside Automator integration (generators will use regex/text parsing as established in the learning exercise; Automator is a future enhancement).
- Guard condition syntax in SysML action flows (not yet verified in Syside Modeler; decision logic will be handled by activity return values).

### 3.3 SysML Model Extensions

The existing CoffeeShop SysML model will require minor extensions to carry information needed by the new generators:

- Decision criteria annotations on action flow branch points (to generate if/else logic in Temporal workflows).
- Timeout durations on wait states (to generate Temporal timeout configurations).
- Mapping metadata connecting action flow steps to the state transitions they trigger on the OrderLifecycle state machine.

These extensions must remain valid SysML v2 syntax as verified against Syside Modeler. The syntax reference file will be updated accordingly.

---

## 4. Success Criteria

The demonstrator is successful if it proves the following:

**4.1 Model-to-execution fidelity:** A change to the SysML action flow, followed by regeneration, produces a changed running workflow without hand-editing orchestration code.

**4.2 XState and Temporal cooperation:** The XState machine rejects invalid state transitions independently of the Temporal workflow. The Temporal workflow drives valid transitions on the XState machine as it progresses through the action flow.

**4.3 Durable long-running behaviour:** At least one workflow step involves a realistic wait (simulated but architecturally real), demonstrating Temporal signal-based suspension and resumption. A Temporal worker restart mid-workflow does not lose progress.

**4.4 Audit output:** Every completed workflow execution produces a timestamped event trail rendered as a human-readable compliance table showing step name, expected timing (from SysML requirements), actual timing (from Temporal history), and compliance status.

**4.5 Visual pathway output:** The same SysML action flow that generates the Temporal workflow also generates a visual pathway diagram suitable for a non-technical reviewer.

**4.6 Single source of truth:** All generated artefacts (workflow code, state machine, pathway diagram, type definitions) trace back to the SysML model. No process knowledge exists only in hand-written code.

---

## 5. Technical Architecture

### 5.1 System Components

| Component | Technology | Role |
|---|---|---|
| SysML Model | SysML v2 / Syside Modeler | Single source of truth for structure, behaviour, requirements |
| Generators | Python scripts | Transform SysML into executable and documentary artefacts |
| Temporal Server | `temporal server start-lite` | Durable workflow execution, event history, web UI |
| Temporal Workers | TypeScript (`@temporalio/worker`) | Execute workflow and activity code |
| Application Server | SvelteKit | Web UI, API endpoints, XState state management |
| State Enforcement | XState v5 | Entity lifecycle validation (OrderLifecycle) |
| Pathway Diagrams | Mermaid | Generated visual process documentation |

### 5.2 Runtime Interaction Flow

The following describes how the components interact during a typical order fulfilment:

1. User places an order via the SvelteKit web interface.
2. SvelteKit API endpoint starts a Temporal workflow (`fulfilDrink`), passing the order data.
3. Temporal executes the workflow function step by step. Each step calls an activity (the real implementation).
4. Activities that require human input (barista confirms, customer collects) send the workflow into a signal-wait state. The workflow suspends with zero resource cost.
5. The SvelteKit UI provides buttons for simulating these human actions. Clicking a button sends a Temporal signal to the waiting workflow.
6. As the workflow progresses, activities update the order state via the XState machine. XState validates each transition before accepting it.
7. The SvelteKit UI polls or subscribes to order state changes and updates the display in real time.
8. On completion, the full Temporal event history is available for rendering as an audit report.

### 5.3 Separation of Generated and Hand-Written Code

A critical architectural principle: generated code handles orchestration (what happens in what order), while hand-written code handles implementation (how each step actually works).

| Layer | Generated (DO NOT EDIT) | Hand-written |
|---|---|---|
| Workflow orchestration | Temporal workflow function (step sequence, branching, signals) | None — fully generated |
| Activity implementation | Activity function signatures | Activity function bodies (business logic) |
| State enforcement | XState machine definition | Integration code connecting Temporal to XState |
| Type definitions | TypeScript interfaces and enums | None — fully generated |
| Pathway diagrams | Mermaid source and rendered output | None — fully generated |
| Web UI | None | SvelteKit pages and components |

---

## 6. Project Plan

### 6.1 Phase A — Temporal Foundation

**Objective:** Validate that Temporal works for this use case before investing in generators.

**Approach:** Hand-code a Temporal workflow based on the FulfilDrink action flow. No generation. Get comfortable with how Temporal feels.

**Deliverables:**

- Temporal CLI installed and local dev server running.
- TypeScript project scaffolded with Temporal SDK dependencies.
- Hand-written FulfilDrink workflow with activities and signal-based waits.
- Test script that starts a workflow, sends signals to simulate barista/customer actions, and prints the execution history.
- Verification that worker restart mid-workflow does not lose progress.

**Exit criteria:** A complete order fulfilment workflow runs end-to-end via Temporal with durable execution confirmed.

### 6.2 Phase B — Generation

**Objective:** Build generators that produce Temporal workflow code and Mermaid diagrams from SysML action flows.

**Approach:** Work backwards from the hand-coded Phase A workflow. Determine what the generator must read from the SysML and what it must emit. Extend the SysML model minimally to carry required metadata.

**Deliverables:**

- SysML-to-Temporal-workflow generator (Python script) producing a TypeScript workflow function from a SysML `action def`.
- SysML-to-Mermaid generator (Python script) producing a visual pathway diagram from the same SysML `action def`.
- Any required extensions to the SysML model (decision criteria, timeout annotations, state transition mappings) verified against Syside Modeler.
- Updated syntax reference file documenting new patterns.
- Generated workflow confirmed identical in behaviour to Phase A hand-coded version.

**Exit criteria:** Regenerating the Temporal workflow from SysML produces a working workflow. Modifying the SysML action flow and regenerating produces correspondingly changed behaviour.

### 6.3 Phase C — Integration

**Objective:** Wire the generated Temporal workflow to the XState order lifecycle and build a minimal web interface.

**Deliverables:**

- XState OrderLifecycle machine integrated with Temporal workflow activities (activities drive state transitions, XState validates them).
- SvelteKit application with pages for: placing an order, viewing order status (real-time updates), simulating barista actions (start preparation, mark ready), simulating customer collection.
- Temporal workflow signals triggered from UI actions.
- Order state reflected in UI via XState machine state.

**Exit criteria:** An order can be placed in the web UI, progressed through all workflow steps via UI buttons, with state changes visible in real time.

### 6.4 Phase D — Governance Outputs

**Objective:** Demonstrate the governance and audit trail capabilities that justify this architecture for clinical use.

**Deliverables:**

- Mermaid pathway diagram generated from SysML, rendered as SVG, accessible from the web UI.
- Audit report page that queries Temporal workflow execution history for a completed order and renders it as a timestamped compliance table.
- Compliance table shows: step name, expected timing (from SysML requirements/constraints), actual timing (from Temporal event history), duration, and compliance status (within target / exceeded).
- Report uses anonymised case references (not customer identifiers).

**Exit criteria:** A non-technical reviewer can inspect the generated pathway diagram and the audit report for a completed order and understand what process was defined and whether this case followed it.

---

## 7. Project Structure

The following directory structure extends the established CoffeeShop exercise conventions:

```
coffeeshop-demonstrator/
├── model/
│   └── domain/
│       ├── coffeeshop.sysml              # Phase 1: structural
│       ├── order-lifecycle.sysml          # Phase 2: state machine
│       ├── drink-fulfilment.sysml         # Phase 3: action flow
│       └── business-rules.sysml           # Phase 4: requirements & constraints
├── generators/
│   ├── gen_typescript_types.py            # SysML → TypeScript interfaces
│   ├── gen_state_machines.py              # SysML → XState v5 machines
│   ├── gen_temporal_workflow.py           # SysML → Temporal workflow (NEW)
│   └── gen_mermaid_pathway.py             # SysML → Mermaid diagram (NEW)
├── generated/                             # ALL generated output — DO NOT EDIT
│   ├── types.ts
│   ├── order-lifecycle-machine.ts
│   ├── fulfil-drink-workflow.ts
│   └── fulfil-drink-pathway.mmd
├── src/
│   ├── activities/                        # Hand-written Temporal activity implementations
│   ├── workers/                           # Temporal worker configuration
│   ├── app/                               # SvelteKit application
│   └── lib/                               # Shared utilities (XState integration, Temporal client)
├── docs/                                  # Generated governance documentation
├── tests/
├── sysml-v2-syntax-reference.md           # Living syntax reference
└── coffeeshop-demonstrator-spec.md        # This document
```

### 7.1 Git Practices

- Atomic commits: model change + regenerated artefacts + implementation updates together.
- Generated code committed to the repository with DO NOT EDIT headers (regeneration verified in CI is a future enhancement).
- Semver tags at milestones where model, generators, and implementation are known-good.

---

## 8. Dependencies and Prerequisites

| Dependency | Version | Notes |
|---|---|---|
| Syside Modeler | 0.8.4+ | VS Code extension for SysML v2 editing and validation |
| Temporal CLI | Latest | Provides `temporal server start-lite` for local development |
| Node.js | 18+ (LTS) | Runtime for Temporal workers and SvelteKit |
| TypeScript | 5.x | Type-safe implementation language |
| `@temporalio/client`, `/worker`, `/workflow`, `/activity` | Latest | Temporal TypeScript SDK |
| XState | 5.x | State machine runtime |
| SvelteKit | Latest | Web application framework |
| Python | 3.10+ | Generator scripts |
| Mermaid CLI (`mmdc`) | Latest | Rendering Mermaid diagrams to SVG/PDF |

---

## 9. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| SysML action flow lacks guard condition syntax in Syside | Confirmed | Decision logic handled by activity return values rather than model-level guards. Revisit when Syside supports guards. |
| Temporal TypeScript SDK complexity exceeds expectations | Medium | Phase A validates this before investing in generators. Hand-code first, generate second. |
| Regex-based SysML parsing proves fragile for new generators | Medium | Maintain strict `.sysml` formatting conventions. Long-term: migrate to Syside Automator for semantic model access. |
| XState and Temporal state management conflicts | Low | Clear separation: Temporal owns process orchestration, XState owns entity lifecycle validation. Activities mediate between them. |
| Scope creep into production features | Medium | This document defines scope. The demonstrator proves architecture, not product features. |

---

## 10. Future Direction

This demonstrator is explicitly a proof of concept. The following are not in scope but are anticipated next steps if the approach validates successfully:

- **Syside Automator integration:** Replace regex-based generators with semantic model access for more robust and maintainable generation.
- **Guard condition support:** When Syside Modeler supports guard syntax in action flows, extend the Temporal generator to produce conditional branching from model-level guards.
- **Parallel execution:** SysML fork/join constructs mapped to Temporal `Promise.all()` for concurrent activity execution.
- **satisfy/verify relationships:** SysML requirement-to-constraint traceability used to auto-generate compliance check logic in audit reports.
- **Temporal Cloud evaluation:** Assess managed hosting vs self-hosted for production GenderSense deployment.
- **Clinical pathway demonstrator:** Apply the validated architecture to a real GenderSense clinical pathway (e.g. hormone therapy initiation) as the next domain exercise.

---

## Appendix A: Key Architectural Concepts

### A.1 Temporal Workflow Durability

A Temporal workflow function is an ordinary TypeScript async function. Each `await` in the function is a durability point. If the worker process crashes and restarts, Temporal replays the function from its event history, skipping already-completed steps, and resumes execution at the exact point of interruption. The developer writes straightforward sequential code; Temporal makes it durable transparently.

### A.2 Temporal Signals for Human-in-the-Loop

When a workflow needs to wait for an external event (a barista confirming preparation is complete, or in clinical terms, a lab returning blood results), it uses Temporal signals. The workflow function suspends at an `await`, consuming zero resources. When the signal arrives (via an API call from the web UI or an integration), the workflow resumes exactly where it left off. Suspensions can last seconds or months.

### A.3 XState Entity Lifecycle Enforcement

An XState state machine defines the valid states and transitions for an entity (e.g. an Order). It acts as a runtime guard: if any code attempts a transition that the model does not permit, XState silently rejects it. This provides defence in depth independent of the Temporal workflow. The machine definition is generated from the SysML `state def`, ensuring the runtime enforcement matches the model exactly.

### A.4 Generation as the Bridge

Code generation is the mechanism that keeps model and execution in sync. By generating workflow orchestration, state machine definitions, type definitions, and pathway diagrams from the same SysML source, changes to the model propagate automatically to all downstream artefacts. The principle is that process knowledge exists only in the model; generated code is a derived artefact, not a source of truth.
