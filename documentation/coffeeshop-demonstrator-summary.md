# Coffee Shop Demonstrator

## Project Summary and Key Learning

*SysML v2 Model-Driven Execution — Proof of Concept*

GenderSense Development Programme · 4 March 2026 · Ella

---

## 1. Project Overview

The Coffee Shop Action Flow Demonstrator was a proof-of-concept project within the GenderSense development programme. Its purpose was to validate a model-driven architecture in which SysML v2 models serve as the single source of truth for business processes, generating both executable runtime code and governance documentation from the same source.

The coffee shop domain was chosen deliberately for its simplicity. The architectural patterns were always intended to transfer to GenderSense, where clinical pathways are long-running, involve multiple participants, require robust audit trails, and must demonstrably conform to defined governance processes.

### Core thesis

*SysML v2 model → generated Temporal workflow + generated XState state machine → **running system with audit trail + visual pathway documentation, all from a single source of truth.***

This thesis was validated. All four project phases completed successfully and all exit criteria were met.

## 2. Key Architectural Decisions

### Temporal for process orchestration

Four approaches to operationalising action flows were evaluated: dedicated BPMN engine (Camunda), lightweight application code, XState with durable backing, and Temporal. Temporal was selected because it offers durable execution of ordinary TypeScript async functions, zero-cost long waits via signals, automatic event history for audit, and a clear deployment path from local development through to managed cloud.

### XState for entity lifecycle enforcement

XState complements Temporal by enforcing entity lifecycle rules independently. Temporal orchestrates the procedural flow; XState guarantees only valid state transitions occur. If application code attempts an invalid transition, XState rejects it regardless of what Temporal requests. This defence-in-depth pattern proved clean and effective throughout the project.

### Two-layer action flow architecture

A significant design insight emerged during Phase B. The SysML model naturally separates into two layers:

- **Domain layer** — describes what the process involves (the clinical or business process). Audience: governance reviewers, clinical leads.
- **Orchestration layer** — describes how the system manages it (activity boundaries, signal waits, timeouts). Audience: runtime execution.

Each layer has its own generator targets: the domain layer produces visual pathway diagrams; the orchestration layer produces executable Temporal workflows. This separation maps directly to GenderSense, where clinical pathways have both a clinical process view and a systems orchestration view.

### Metadata-driven generation

SysML v2 metadata definitions proved to be the right mechanism for carrying generator configuration. Annotations such as @TemporalWorkflow, @TemporalActivity, @TemporalSignal, and @StateTransitionTrigger are first-class, tool-validated model elements rather than fragile doc-block conventions or auxiliary YAML files. Syside Modeler semantically validates them, catches typos immediately, and displays them alongside the annotated elements.

## 3. Phase Summary

The project was structured in four phases, each with defined deliverables and exit criteria. Detailed journal notes exist for each phase; this section captures only the key outcomes and learning.

### Phase A — Temporal Foundation

Objective: Validate that Temporal works for this use case before investing in generators.

A hand-coded Temporal workflow was built directly from the SysML FulfilDrink action flow. This established the runtime patterns — signal-based waits for human-in-the-loop steps, durable execution, and event history — before any generation was attempted. Worker restart mid-workflow was confirmed to preserve state.

**Key learning:** The "hand-code first, generate second" approach was essential. It built practical understanding of Temporal's programming model and identified the exact shape of code the generators would need to produce.

### Phase B — Generation

Objective: Build generators that produce Temporal workflow code and Mermaid pathway diagrams from SysML action flows.

Two new Python generators were created: one targeting Temporal TypeScript workflows from the orchestration-layer SysML, and one targeting Mermaid diagrams from the domain-layer SysML. The SysML model was extended with metadata definitions to carry generator configuration. The generated workflow was confirmed behaviourally identical to the Phase A hand-coded version.

**Key learning:** Metadata definitions are a robust annotation mechanism. Working backwards from known-good hand-coded output made generator development straightforward. The two-layer architecture (domain vs orchestration) emerged naturally and proved to be a strong organising principle.

### Phase C — Integration

Objective: Wire the generated Temporal workflow to the XState order lifecycle and build a minimal web interface.

XState v5's pure transition functions were successfully used inside Temporal's deterministic V8 isolate. Temporal query handlers exposed XState state to the SvelteKit web UI without affecting workflow execution. The full chain — SysML model to generated code to running web application with real-time state updates — was demonstrated end to end.

**Key learning:** XState's pure functional API (initialTransition, transition) is ideal for Temporal's V8 isolate. The actor-based API must be avoided in workflows. Temporal queries provide a clean read-only mechanism for state visibility.

### Phase D — Governance Outputs

Objective: Demonstrate the governance and audit trail capabilities that justify this architecture for clinical use.

A pathway diagram page, audit report page, and orders list were added to the web application. The audit report queries Temporal workflow event history and compares actual step timings against expected durations derived from the SysML model. Anonymised case references replace customer identifiers throughout.

**Key learning:** Temporal's event history is a comprehensive, timestamped, tamper-evident audit trail that requires no additional infrastructure. The main technical gotcha was that the Temporal TypeScript SDK returns event types as numeric protobuf enums rather than string names.

## 4. Success Criteria

| Criterion | Status | Evidence |
|---|---|---|
| Model-to-execution fidelity | ✅ Met | SysML change → regeneration → changed workflow behaviour without hand-editing |
| XState and Temporal cooperation | ✅ Met | XState rejects invalid transitions independently of Temporal |
| Durable long-running behaviour | ✅ Met | Signal-based suspension/resumption; worker restart preserves state |
| Audit output | ✅ Met | Timestamped compliance table with step name, expected/actual timing, status |
| Visual pathway output | ✅ Met | Generated Mermaid diagram accessible from web UI |
| Single source of truth | ✅ Met | All artefacts trace to SysML model |

## 5. Technical Insights

The following insights emerged during the project and are recorded here for reference during GenderSense development. They are summarised rather than exhaustive; the phase journals contain full detail.

### SysML v2 and Syside Modeler

- Syside Modeler 0.8.4 does not support decide/merge control nodes or standalone succession syntax in action flows. Decision points must be modelled as regular action nodes with multiple outgoing then chains. This is a tooling limitation, not a language limitation.
- Guard conditions on action flow branches are not yet available in Syside. Decision logic is handled by activity return values at the implementation layer. This is acceptable for orchestration-layer models where the decision is "what does the activity return" rather than "what does the model specify."
- Constraint body expressions must be bare boolean expressions with no trailing semicolon. This tripped up initial modelling several times.
- Metadata annotations require the action step to have a body (braces). Simple action declarations cannot carry annotations.

### Temporal

- The Temporal TypeScript SDK returns eventType as a numeric protobuf enum, not a string. Any code parsing event history must compare against numeric values. This was the main bug in Phase D.
- Temporal's ITimestamp has seconds as a string, not a number. Conversion via Number() is required.
- Activity completion events do not carry the activity name. Completions are linked to their scheduling via scheduledEventId, requiring a lookup map during history parsing.
- XState v5's pure transition functions (initialTransition, transition) work correctly inside Temporal's V8 isolate. The actor-based API (createActor, subscribe) must not be used in workflow code.
- Temporal query handlers provide a clean, read-only mechanism for externalising workflow state. They do not affect execution and survive replay.

### Generation pipeline

- Regex-based SysML parsing was adequate for consistently formatted .sysml files throughout the demonstrator. Formatting conventions must be maintained for this to remain viable.
- The "hand-code first, generate second" approach eliminated uncertainty about what the generator needed to produce.
- Generated files carry DO NOT EDIT headers. The discipline of never editing generated code was maintained throughout, reinforcing the single-source-of-truth principle.

## 6. Syntax Reference

The SysML v2 syntax reference was maintained as a living document throughout the project and reached version 3.0 by project completion. It covers verified patterns for structural foundations, state machines, action flows, requirements and constraints, generation pipelines, metadata definitions, and integration patterns. This document should continue to travel with the project repository and be consulted before writing new .sysml files for GenderSense.

## 7. Recommendations for GenderSense

The demonstrator has validated the core architecture. The following recommendations address the transition from proof-of-concept to operational clinical pathway management.

### 7.1 Adopt the two-layer action flow pattern

Clinical pathways should be modelled at two layers from the outset. The domain layer describes the clinical process in terms meaningful to clinicians, governance reviewers, and regulators. The orchestration layer describes how the system manages execution, including activity boundaries, signal waits, timeouts, and state transition triggers. Each layer has distinct generator targets and audiences. This separation was the most significant design insight from the demonstrator and should be a foundational principle.

### 7.2 Start with a single clinical pathway

Choose one well-understood GenderSense pathway — hormone therapy initiation is a natural candidate — and model it end to end using the validated architecture. This pathway involves long-running waits (lab results, specialist referrals), multiple participants (patient, GP, endocrinologist, phlebotomy), and clear governance requirements (consent, clinical review intervals, monitoring schedules). It will exercise all the patterns established in the demonstrator at realistic complexity.

### 7.3 Replace regex generators with Syside Automator

Regex-based parsing was appropriate for the demonstrator's controlled formatting. For GenderSense, where models will be larger and maintained over longer periods, Syside Automator should replace the regex generators. Automator provides semantic model access, eliminating the fragility of text-pattern matching and enabling more sophisticated generation logic.

### 7.4 Implement generator-based extraction of audit constants

The demonstrator manually transcribed expected timing values from SysML annotations into TypeScript constants. For GenderSense, a dedicated generator should extract these values directly from the model. Clinical timing targets (referral-to-appointment intervals, lab turnaround expectations, review schedules) are governance-critical and must be demonstrably traceable to the model definition.

### 7.5 Extend the metadata library for clinical patterns

The TemporalMetadata package should be extended with metadata definitions for clinical-specific patterns: consent requirements, clinical review gates, multi-participant handoff points, and regulatory reporting triggers. These should be maintained as a shared library, imported by all GenderSense pathway models, and validated by Syside Modeler.

### 7.6 Develop the satisfy/verify traceability chain

SysML v2 requirement-to-constraint traceability (satisfy/verify relationships) was not verified in the demonstrator. For GenderSense, this chain is essential: clinical requirements must trace to evaluable constraints, which must trace to runtime checks, which must trace to audit evidence. Verifying this syntax in Syside and extending the generators to produce compliance check logic should be an early priority.

### 7.7 Plan for Temporal deployment

The demonstrator validated the development environment (temporal server start-lite). GenderSense will require a durable deployment. The recommended path is self-hosted Temporal on a small cloud VM with PostgreSQL persistence for early deployment, with Temporal Cloud as an option if operational overhead becomes the bottleneck. Workflow code is identical across all environments; migration requires only changing the connection endpoint.

### 7.8 Preserve the governance output pattern

The pathway diagram and compliance audit report pattern demonstrated in Phase D transfers directly to GenderSense. For clinical pathways, this means: a generated visual pathway for clinical governance review, a timestamped compliance table for each patient case showing whether care followed the defined pathway within expected timeframes, and anonymised case references throughout. This pattern meets the traceability and accountability requirements of a regulated healthcare context and should be implemented from the first clinical pathway.

---

**Document status:** Final. Detailed phase journals are available for Phases A through D. The syntax reference (v3.0, 3 March 2026) is a companion document.
