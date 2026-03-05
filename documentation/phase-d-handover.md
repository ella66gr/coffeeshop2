# Phase C→D Handover Document

**Project:** Coffee Shop Action Flow Demonstrator
**Date:** 3 March 2026
**Purpose:** Enable continuation of work in a new chat session without loss of context. Phase C is complete. Phase D (Governance Outputs) is the next and final phase.

---

## 1. Strategic Context

The Coffee Shop Demonstrator is a proof of concept for SysML v2 model-driven execution. The strategic goal is to validate a four-layer architecture (authoritative SysML v2 models → generated scaffolding → implementation code → configurable infrastructure) for eventual use in GenderSense clinical pathways, where the model is the single source of truth for process orchestration, state enforcement, and governance documentation.

The demonstrator uses Temporal for process orchestration and XState for entity lifecycle enforcement, with SysML v2 as the authoritative model.

---

## 2. Phase Status

| Phase | Status | Key tags |
|---|---|---|
| A — Temporal Foundation | ✅ Complete | see phase-a-journal |
| B — Generation | ✅ Complete | see phase-b-journal |
| C — Integration | ✅ Complete | v0.3.0-restructure, v0.3.1-xstate-integration, v0.3.0 |
| D — Governance Outputs | Not started | — |

---

## 3. What Was Accomplished in Phase C

### 3.1 Architectural Decisions (all settled)

**XState actor location — pure transition functions in Temporal V8 isolate:**

- XState v5's `initialTransition()` and `transition()` functions (imported from `'xstate'`) are deterministic and side-effect-free, safe for Temporal's sandboxed V8 isolate.
- The workflow maintains XState state as a variable (`machineState`) and exposes it via a Temporal query handler (`orderStateQuery`).
- The SvelteKit front end is a stateless view layer that reads state via `handle.query()` — it never owns state.
- Temporal's webpack bundler successfully resolved XState (v5.28.0, 161 KiB, 7 modules) into the V8 isolate.

**Project structure — pnpm workspace monorepo:**

| Workspace | Package name | Purpose |
|---|---|---|
| packages/shared | @coffeeshop/shared | Generated types, XState machine, workflow constants |
| packages/temporal | @coffeeshop/temporal | Temporal worker, activities, workflow code |
| packages/web | @coffeeshop/web | SvelteKit application (Svelte 5) |

Package manager: pnpm v10.30.3 (replaced npm).

**Signal/query name sharing — string constants in @coffeeshop/shared:**

- `packages/shared/src/workflow-constants.ts` is the single source of truth for signal names, query names, task queue, and workflow identifiers.
- Both the Temporal workflow (uses `defineSignal('baristaStarted')`) and SvelteKit API routes (uses `handle.signal('baristaStarted')`) reference the same string constants.
- Includes `VALID_SIGNALS` array and `SignalName` type for runtime validation, plus `STATE_AVAILABLE_SIGNAL` mapping for UI button logic.

**SvelteKit / Svelte 5:**

- Scaffolded using `npx sv create .` (the `create-svelte` package is deprecated).
- The scaffold produces a Svelte 5 project with significant syntax changes from Svelte 4: `$state()`, `$derived()`, `$props()`, `{@render children()}`, `onclick` (lowercase), `$app/state` replaces `$app/stores`.
- Strict HTML nesting enforced at compile time (e.g. `<tr>` must be inside `<tbody>`, not directly in `<table>`).
- No Tailwind, Flowbite, or styling framework — functional HTML only per spec §3.2.

### 3.2 Implementation summary

**Step 1 — Monorepo restructuring (committed as v0.3.0-restructure):**
Converted flat TypeScript project into pnpm workspace monorepo. Root `package.json` with generation scripts. `tsconfig.base.json` shared by `shared` and `temporal` packages. Web package uses SvelteKit's own tsconfig.

**Step 2 — XState integration (committed as v0.3.1-xstate-integration):**
Modified `packages/temporal/src/workflows/fulfil-drink.ts` to import `initialTransition` and `transition` from `'xstate'`, initialise state, advance after each signal via `tryTransition()`, and register a `defineQuery<string>('orderState')` handler. CLI test verified: placed → inPreparation → ready → collected.

**Step 3 — SvelteKit scaffold + API routes:**
SvelteKit scaffolded in `packages/web/`. Server-side Temporal client singleton in `$lib/server/temporal.ts`. Three API routes:

- `POST /api/orders` — starts a `fulfilDrink` workflow, returns `{ orderId, workflowId, state }`
- `GET /api/orders/[id]` — queries workflow state via `handle.query('orderState')` and `handle.describe()`
- `POST /api/orders/[id]/signal` — validates signal name, sends to workflow, returns updated state

API routes use string-based signal/query references from `@coffeeshop/shared`.

**Step 4 — UI pages:**
Order form (`+page.svelte`): customer name, drink type dropdown, size dropdown, POST to `/api/orders`, redirect to status page. Order status page (`orders/[id]/+page.svelte`): displays current state, workflow status, contextual action buttons per state, state history table, polling at 2s intervals.

**Step 5 — Durable execution verification:**
Worker killed mid-flow (state: inPreparation), restarted, workflow completed successfully. Temporal Web UI confirmed Workers: 2 (two different worker identities handled the workflow).

### 3.3 Gotchas documented in Phase C journal

1. `create-svelte` deprecated → use `npx sv create`
2. Svelte 5 syntax required (`$state`, `$derived`, `$props`, `onclick`, `{@render}`)
3. Strict HTML nesting (`<tr>` must be in `<tbody>`)
4. pnpm strict dependency resolution (xstate needed in both shared and temporal)
5. Temporal query handler race condition (retry logic needed)
6. Polling duplicate state history entries (guard added)
7. Workflow status shows RUNNING after final signal (extra fetch added)
8. SvelteKit tsconfig is independent of tsconfig.base.json
9. Cannot query completed workflows (status check first)
10. `$app/state` replaces `$app/stores` in Svelte 5

---

## 4. Signal ↔ XState Event ↔ State Mapping

| Temporal Signal | XState Event | State Before | State After | UI Button Label |
|---|---|---|---|---|
| `baristaStarted` | PreparationStarted | placed | inPreparation | "Barista: Start Preparation" |
| `drinkReady` | PreparationComplete | inPreparation | ready | "Barista: Mark Ready" |
| `drinkCollected` | OrderCollected | ready | collected | "Customer: Collect Drink" |

---

## 5. Phase D — Governance Outputs (NEXT)

### 5.1 Objective (from spec §6.4)

Demonstrate the governance and audit trail capabilities that justify this architecture for clinical use.

### 5.2 Deliverables

1. **Mermaid pathway diagram** generated from SysML, rendered as SVG, accessible from the web UI.
2. **Audit report page** that queries Temporal workflow execution history for a completed order and renders it as a timestamped compliance table.
3. **Compliance table** shows: step name, expected timing (from SysML requirements/constraints), actual timing (from Temporal event history), duration, and compliance status (within target / exceeded).
4. Report uses anonymised case references (not customer identifiers).

### 5.3 Exit criterion (from spec §6.4)

A non-technical reviewer can inspect the generated pathway diagram and the audit report for a completed order and understand what process was defined and whether this case followed it.

### 5.4 Implementation approach (suggested)

**Pathway diagram page:**

- The Mermaid pathway diagram already exists as `generated/fulfil-drink-pathway.mmd` (generated by `gen_mermaid_pathway.py` in Phase B).
- An SVG version exists at `generated/fulfil-drink-pathway.svg`.
- Add a route in SvelteKit (e.g. `/pathway`) that serves the SVG, or render the Mermaid source client-side using the Mermaid JS library.
- No new generation needed — the diagram already exists. The task is to make it accessible from the web UI.

**Audit report page:**

- Add a route (e.g. `/orders/[id]/audit`) that fetches the Temporal workflow execution history via the client SDK's `handle.fetchHistory()` API.
- Parse the history events to extract: activity starts/completions, signal receipts, timestamps, durations.
- Map event types to human-readable step names using the orchestration model's step names (these could come from `@coffeeshop/shared` as additional constants, or be derived from the Temporal event metadata).
- Render as a compliance table.
- For "expected timing": these are defined in the SysML model as `@TemporalSignal { timeoutMinutes = 30; }`. The generator could emit these as constants, or they could be added to `workflow-constants.ts` manually for the demonstrator.

**Expected timing data source:**

The SysML model contains timeout values in `@TemporalSignal` annotations:
- `waitBaristaStart`: timeoutMinutes = 30
- `waitDrinkReady`: timeoutMinutes = 15
- `waitCollected`: timeoutMinutes = 60

These need to be available to the audit report renderer. Options:
- Add them to `workflow-constants.ts` in `@coffeeshop/shared` (simplest for demonstrator)
- Write a new generator that extracts timing expectations from the SysML model (more aligned with single-source-of-truth principle)

**Anonymisation:**

Replace customer names with anonymised case references (e.g. `CASE-{orderId hash}`). The audit report should show the order workflow ID but not the customer name.

### 5.5 Temporal history API

The key API for Phase D is `handle.fetchHistory()`:

```typescript
import { Client } from '@temporalio/client';

const client = new Client({ connection });
const handle = client.workflow.getHandle(workflowId);
const history = await handle.fetchHistory();

// history is an IHistory with events array
// Each event has: eventId, eventTime, eventType, and type-specific attributes
// Relevant event types:
//   EVENT_TYPE_WORKFLOW_EXECUTION_STARTED
//   EVENT_TYPE_ACTIVITY_TASK_SCHEDULED (activityType in attributes)
//   EVENT_TYPE_ACTIVITY_TASK_COMPLETED (result in attributes)
//   EVENT_TYPE_WORKFLOW_EXECUTION_SIGNALED (signalName in attributes)
//   EVENT_TYPE_WORKFLOW_EXECUTION_COMPLETED
```

**Gotcha from Phase A:** `eventTime` is a protobuf `ITimestamp` (with `seconds` and `nanos` properties), not a JavaScript `Date`. Convert with:

```typescript
const ts = event.eventTime;
const date = new Date(
  Number(ts!.seconds!) * 1000 + Number(ts!.nanos!) / 1_000_000
);
```

### 5.6 Orders list page (optional but useful)

The Phase C plan mentioned an optional orders list page. This would be useful for Phase D as a way to browse completed orders and access their audit reports. Uses `client.workflow.list()` to query recent workflows.

---

## 6. Current Project Directory Structure

```
coffeeshop-demonstrator/
├── model/
│   └── domain/
│       └── fulfil-drink-orchestration.sysml
├── generators/
│   ├── gen_temporal_workflow.py
│   ├── gen_mermaid_pathway.py
│   ├── gen_typescript_types.py
│   └── gen_state_machines.py
├── generated/
│   ├── fulfil-drink.ts
│   ├── fulfil-drink-pathway.mmd
│   ├── fulfil-drink-pathway.svg
│   ├── order-lifecycle-machine.ts
│   └── types.ts
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json              # extends ../../tsconfig.base.json
│   │   └── src/
│   │       ├── generated/
│   │       │   ├── order-lifecycle-machine.ts
│   │       │   └── types.ts
│   │       ├── workflow-constants.ts   # Signal/query/task queue/UI mapping constants
│   │       └── index.ts               # Re-exports all shared code
│   ├── temporal/
│   │   ├── package.json
│   │   ├── tsconfig.json              # extends ../../tsconfig.base.json
│   │   └── src/
│   │       ├── activities/
│   │       │   └── barista.ts         # Hand-written activity implementations
│   │       ├── workflows/
│   │       │   └── fulfil-drink.ts    # Generated + XState integration + query handler
│   │       ├── workers/
│   │       │   └── worker.ts          # Temporal worker bootstrap
│   │       └── client/
│   │           └── start-order.ts     # CLI test script with state query verification
│   └── web/
│       ├── package.json
│       ├── svelte.config.js           # adapter-auto, no preprocessing needed
│       ├── vite.config.ts             # sveltekit() plugin only
│       ├── tsconfig.json              # extends .svelte-kit/tsconfig.json (NOT tsconfig.base)
│       ├── static/
│       │   └── robots.txt
│       └── src/
│           ├── app.html
│           ├── app.d.ts
│           ├── lib/
│           │   ├── assets/favicon.svg
│           │   ├── index.ts
│           │   └── server/
│           │       └── temporal.ts    # Temporal client singleton (server-only)
│           └── routes/
│               ├── +layout.svelte     # Svelte 5: $props() + {@render children()}
│               ├── +page.svelte       # Order form (Svelte 5: $state, onclick)
│               ├── orders/
│               │   └── [id]/
│               │       └── +page.svelte  # Order status + action buttons + polling
│               └── api/
│                   └── orders/
│                       ├── +server.ts           # POST: start workflow
│                       └── [id]/
│                           ├── +server.ts       # GET: query state
│                           └── signal/
│                               └── +server.ts   # POST: send signal
├── documentation/
│   ├── coffeeshop-demonstrator-spec.md
│   ├── phase-a-journal.md
│   ├── phase-b-journal.md
│   ├── phase-c-journal.md             # Includes Svelte 5 syntax reference
│   ├── phase-c-plan.md
│   ├── phase-c-handover.md            # Previous handover (Phase B→C)
│   ├── sysml-v2-syntax-reference-v1.0-2026-03-01.md
│   ├── sysml-v2-syntax-reference-v2.0-2026-03-03.md
│   └── sysml-v2-syntax-reference-v3.0-2026-03-03.md  # Current version
├── pnpm-workspace.yaml
├── package.json                       # Root: generation + build scripts
└── tsconfig.base.json                 # Shared TS options (shared + temporal only)
```

---

## 7. Key File Contents

### 7.1 Root package.json

```json
{
  "name": "coffeeshop-demonstrator",
  "private": true,
  "scripts": {
    "generate:workflow": "python3 generators/gen_temporal_workflow.py model/domain/fulfil-drink-orchestration.sysml generated/fulfil-drink.ts",
    "generate:pathway": "python3 generators/gen_mermaid_pathway.py ../coffeeshop-exercise/model/domain/drink-fulfilment.sysml generated/fulfil-drink-pathway.mmd",
    "generate:types": "python3 generators/gen_typescript_types.py ../coffeeshop-exercise/model/domain/coffeeshop.sysml generated/types.ts",
    "generate:statemachine": "python3 generators/gen_state_machines.py ../coffeeshop-exercise/model/domain/order-lifecycle.sysml generated/order-lifecycle-machine.ts",
    "generate": "pnpm generate:workflow && pnpm generate:pathway && pnpm generate:types && pnpm generate:statemachine && pnpm sync-generated",
    "sync-generated": "cp generated/types.ts generated/order-lifecycle-machine.ts packages/shared/src/generated/ && cp generated/fulfil-drink.ts packages/temporal/src/workflows/",
    "build": "pnpm --filter @coffeeshop/shared build && pnpm --filter @coffeeshop/temporal build",
    "build:all": "pnpm --filter @coffeeshop/shared build && pnpm --filter @coffeeshop/temporal build && pnpm --filter @coffeeshop/web build",
    "dev:temporal": "pnpm --filter @coffeeshop/temporal dev",
    "dev:web": "pnpm --filter @coffeeshop/web dev"
  }
}
```

### 7.2 Workflow exports needed by web package

The SvelteKit API routes reference workflow identifiers as string constants from `@coffeeshop/shared`:

- `TASK_QUEUE` = `'coffeeshop'`
- `WORKFLOW_NAME` = `'fulfilDrink'`
- `SIGNAL_BARISTA_STARTED` = `'baristaStarted'`
- `SIGNAL_DRINK_READY` = `'drinkReady'`
- `SIGNAL_DRINK_COLLECTED` = `'drinkCollected'`
- `QUERY_ORDER_STATE` = `'orderState'`
- `VALID_SIGNALS` — array of all signal names for runtime validation
- `STATE_AVAILABLE_SIGNAL` — maps each XState state to the signal/label available from that state

These are defined in `packages/shared/src/workflow-constants.ts` and re-exported from `index.ts`.

### 7.3 Temporal client connection (web)

`packages/web/src/lib/server/temporal.ts` provides a singleton `getTemporalClient()`. The `$lib/server/` path ensures SvelteKit never bundles this into client-side code.

---

## 8. Dependency Versions (as installed)

| Package | Version | Workspace |
|---|---|---|
| pnpm | 10.30.3 | global |
| Node.js | v25.7.0 | system |
| Temporal CLI | 1.6.1 (Server 1.30.1, UI 2.45.3) | local dev server |
| typescript | ^5.9.3 | shared, temporal, web |
| @temporalio/client | ^1.15.0 | temporal, web |
| @temporalio/worker | ^1.15.0 | temporal |
| @temporalio/workflow | ^1.15.0 | temporal |
| @temporalio/activity | ^1.15.0 | temporal |
| xstate | ^5.28.0 | shared, temporal |
| svelte | latest (5.x) | web |
| @sveltejs/kit | latest | web |
| @sveltejs/adapter-auto | latest | web |
| vite | 7.3.1 | web |

---

## 9. Related Projects and Files

| Path | Description |
|---|---|
| `~/Developer/gsl-tech/coffeeshop-demonstrator/` | Main project (this one) |
| `~/Developer/gsl-tech/coffeeshop-exercise/` | SysML v2 exercise project containing domain models |
| `~/Developer/gsl-tech/coffeeshop-exercise/model/domain/coffeeshop.sysml` | Structural model (types generator reads this) |
| `~/Developer/gsl-tech/coffeeshop-exercise/model/domain/order-lifecycle.sysml` | State machine model (state machine generator reads this) |
| `~/Developer/gsl-tech/coffeeshop-exercise/model/domain/drink-fulfilment.sysml` | Domain action flow (pathway generator reads this) |
| `~/Developer/gsl-tech/sysml-metadata-lib/temporal/temporal-metadata.sysml` | Shared metadata definitions for Temporal annotations |

---

## 10. Svelte 5 Syntax Summary

The web package uses Svelte 5 (scaffolded with `npx sv create`). Key syntax differences from Svelte 4:

| Svelte 4 | Svelte 5 |
|---|---|
| `let x = 0;` (reactive) | `let x = $state(0);` |
| `$: doubled = x * 2;` | `let doubled = $derived(x * 2);` |
| `export let name;` | `let { name } = $props();` |
| `<slot />` | `{@render children()}` (with `let { children } = $props();`) |
| `on:click={handler}` | `onclick={handler}` |
| `import { page } from '$app/stores';` then `$page.params` | `import { page } from '$app/state';` then `page.params` |
| `<table><tr>...</tr></table>` | `<table><tbody><tr>...</tr></tbody></table>` (strict HTML nesting) |

Full Svelte 5 syntax reference is in `documentation/phase-c-journal.md`.

---

## 11. Decisions Deferred

| Decision | Current approach | Revisit when |
|---|---|---|
| XState actor runtime vs pure transition function | Pure transition function — deterministic, no side effects | GenderSense clinical pathways — may need full actor with guards and delayed transitions |
| Polling vs SSE for real-time updates | Polling (2s interval) | If UI latency becomes unacceptable; Phase D audit reporting may benefit from SSE |
| Generator extension for state transition logic | Hand-written wrapper around generated workflow | After Phase C validates the pattern; extend gen_temporal_workflow.py to emit transition + query code |
| Expected timing data source for audit | TBD — manual constants or new generator | Decide at start of Phase D |
| Pin web package dependency versions | Currently `"latest"` for svelte, kit, vite | Before Phase D work or at Phase D commit |
| Orders list page | Not yet built | Useful for Phase D audit report browsing |

---

## 12. How to Run the Project

```bash
cd ~/Developer/gsl-tech/coffeeshop-demonstrator

# Build shared and temporal packages
pnpm build

# Terminal 1: Start Temporal dev server
temporal server start-dev

# Terminal 2: Start the Temporal worker
node packages/temporal/dist/workers/worker.js

# Terminal 3: Start the SvelteKit dev server
pnpm dev:web

# Open browser: http://localhost:5173
# Temporal UI: http://localhost:8233
```

---

## 13. Claude MCP Filesystem Access

Claude has read/write access to the project via MCP filesystem tools. Allowed directories include:

- `/Users/ellagreen/Developer/gsl-tech/coffeeshop-demonstrator`
- `/Users/ellagreen/Developer/gsl-tech/coffeeshop-exercise`
- `/Users/ellagreen/Developer/gsl-tech`
- `/Users/ellagreen/Developer`
- `/Users/ellagreen/Desktop`
- `/Users/ellagreen/Downloads`

Claude can create directories, write files, edit files, and read files directly. Claude cannot run shell commands — Ella runs those in her terminal.

---

## 14. Next Action

**Resume at Phase D — Governance Outputs.** Start by:

1. Deciding on the expected timing data source (manual constants in shared vs new generator).
2. Adding the Mermaid pathway diagram to the web UI (simplest: serve the existing SVG from `generated/`).
3. Building the audit report API route that fetches Temporal workflow history and parses it.
4. Building the audit report page that renders the compliance table.
5. Optionally adding an orders list page for browsing completed orders.

**Key documents to provide to the new chat:**
- This handover document
- `documentation/coffeeshop-demonstrator-spec.md` (full project specification)
- `documentation/sysml-v2-syntax-reference-v3.0-2026-03-03.md` (current syntax reference)
- `documentation/phase-c-journal.md` (implementation details and Svelte 5 reference)
