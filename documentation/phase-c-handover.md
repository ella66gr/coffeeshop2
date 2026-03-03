# Phase C Handover Document

**Project:** Coffee Shop Action Flow Demonstrator
**Date:** 3 March 2026
**Purpose:** Enable continuation of Phase C implementation in a new chat session without loss of context.

---

## 1. Strategic Context

The Coffee Shop Demonstrator is a proof of concept for SysML v2 model-driven execution. The strategic goal is to validate a four-layer architecture (authoritative SysML v2 models → generated scaffolding → implementation code → configurable infrastructure) for eventual use in GenderSense clinical pathways, where the model is the single source of truth for process orchestration, state enforcement, and governance documentation.

The demonstrator uses Temporal for process orchestration and XState for entity lifecycle enforcement, with SysML v2 as the authoritative model.

---

## 2. Phase Status

| Phase | Status | Tag |
|---|---|---|
| A — Temporal Foundation | ✅ Complete | (see phase-a-journal.md) |
| B — Generation | ✅ Complete | (see phase-b-journal.md) |
| C — Integration | 🔶 In progress (Steps 1-2 complete, Step 3 next) | v0.3.0-restructure, v0.3.1-xstate-integration |
| D — Governance Outputs | Not started | — |

---

## 3. What Was Accomplished in This Chat

### 3.1 Architectural Decisions (settled)

**XState actor location — in-process with Temporal worker:**

- The XState state machine runs inside the Temporal workflow V8 isolate using XState v5's pure `transition()` and `initialTransition()` functions (imported from `'xstate'`). These are deterministic and side-effect-free, safe for Temporal's sandbox.
- The workflow maintains XState state as a variable (`machineState`) and exposes it via a Temporal query handler (`orderStateQuery`).
- The SvelteKit front end will be a stateless view layer that reads state via `handle.query()` — it never owns state.
- Rationale: State enforcement is protected by Temporal's durable execution. The front end can be replaced without touching the state logic. This is the pattern required for GenderSense clinical pathways.

**Project structure — pnpm workspace monorepo:**

- The existing `coffeeshop-demonstrator` project was restructured in place (not a new repo).
- Package manager changed from npm to pnpm (v10.30.3).
- Three workspaces: `@coffeeshop/shared`, `@coffeeshop/temporal`, `@coffeeshop/web` (web not yet created).

**Monorepo tooling decision:**

- Using pnpm workspaces directly, no Turborepo or Nx.
- Turborepo can be layered on later if build orchestration becomes tedious.

### 3.2 Step 1 — Monorepo Restructuring (complete, committed)

Converted the flat TypeScript project into a pnpm workspace monorepo:

- Created `pnpm-workspace.yaml` defining `packages/*`.
- Created root `package.json` with generation scripts and workspace build orchestration.
- Created `tsconfig.base.json` with shared strict compiler options (extracted from old `tsconfig.json`).
- Created `packages/shared/` with generated types (`types.ts`) and XState machine (`order-lifecycle-machine.ts`), plus `index.ts` re-exporting them.
- Created `packages/temporal/` with moved source files: `activities/barista.ts`, `workflows/fulfil-drink.ts`, `workers/worker.ts`, `client/start-order.ts`.
- Copied `gen_state_machines.py` and `gen_typescript_types.py` from `coffeeshop-exercise/generators/` into `coffeeshop-demonstrator/generators/`.
- Removed old `src/`, `dist/`, `tsconfig.json`, `package-lock.json`.
- Root `sync-generated` script copies generated `.ts` files to appropriate workspace packages.
- Verified: `pnpm install`, `pnpm build`, and CLI test all pass — identical behaviour to Phase A/B.
- **Commit tag:** `v0.3.0-restructure`

### 3.3 Step 2 — XState Integration Layer (complete, committed)

Integrated XState order lifecycle state machine into the Temporal workflow:

- Modified `packages/temporal/src/workflows/fulfil-drink.ts` to:
  - Import `initialTransition` and `transition` from `'xstate'` (pure functions).
  - Import `orderLifecycleMachine` from `'@coffeeshop/shared'`.
  - Initialise state with `initialTransition(orderLifecycleMachine)`.
  - Advance state after each signal using a `tryTransition()` helper that calls the pure `transition()` function.
  - Define and register a `defineQuery<string>('orderState')` handler that returns the current XState state value.
- Added `xstate` as a direct dependency of `@coffeeshop/temporal` (pnpm strict resolution requires this even though `@coffeeshop/shared` also depends on it).
- Modified `packages/temporal/src/client/start-order.ts` to:
  - Import and use `orderStateQuery` to query state after each signal.
  - Include retry logic (`queryState()` function) to handle the race condition where the query arrives before the workflow has registered the handler (up to 10 retries, 500ms apart).
- **Key validation:** Temporal's webpack bundler successfully resolved XState (v5.28.0, 161 KiB, 7 modules) into the V8 isolate. This was the biggest technical risk.
- **Verified output:**
  ```
  [State] After workflow start: placed
  [State] After baristaStarted: inPreparation
  [State] After drinkReady: ready
  [State] After drinkCollected: collected
  ```
- **Commit tag:** `v0.3.1-xstate-integration`

### 3.4 Gotchas Encountered

1. **pnpm strict dependency resolution:** The workflow file imports from `'xstate'` directly, but XState was only declared as a dependency of `@coffeeshop/shared`. pnpm's strictness meant `@coffeeshop/temporal` couldn't see it. Fix: `pnpm add -F @coffeeshop/temporal xstate`.

2. **Temporal query handler race condition:** The initial test script queried the workflow state with only a 500ms sleep after starting the workflow. The `QueryNotRegisteredError` occurred because the workflow function hadn't yet executed far enough to call `setHandler(orderStateQuery, ...)`. Fix: implemented a retry loop in the test client that catches `QueryNotRegisteredError` and retries up to 10 times with 500ms delay.

3. **pnpm build script warning:** `pnpm install` warned about ignored build scripts for `@swc/core@1.15.18` and `protobufjs@7.5.4`. These are native addon compilation scripts, harmless. Can be resolved with `pnpm approve-builds` if desired.

---

## 4. Phase C Plan — Remaining Steps

A full implementation plan was generated as `phase-c-plan.md` (delivered as a file earlier in this chat). The remaining steps are:

### Step 3 — SvelteKit Application Scaffold (NEXT)

- Scaffold SvelteKit in `packages/web/` using `pnpm create svelte@latest`.
- Set up server-side Temporal client connection in `packages/web/src/lib/server/temporal.ts`.
- Create API routes:
  - `POST /api/orders` — Start workflow (accepts customerName, drinkType, size).
  - `GET /api/orders/[id]` — Query workflow state via `handle.query(orderStateQuery)` and `handle.describe()`.
  - `POST /api/orders/[id]/signal` — Send signal to workflow (baristaStarted, drinkReady, drinkCollected).
- Add `@temporalio/client` and `@coffeeshop/shared` as dependencies of `@coffeeshop/web`.
- Verify API routes with curl before building UI.

### Step 4 — UI Pages

- Order form page (`+page.svelte`): customer name, drink type dropdown, size dropdown. POST to `/api/orders`, redirect to status page.
- Order status page (`orders/[id]/+page.svelte`): displays current XState state, workflow status, and action buttons contextual to current state:
  - `placed` → "Barista: Start Preparation" (sends `baristaStarted`)
  - `inPreparation` → "Barista: Mark Ready" (sends `drinkReady`)
  - `ready` → "Customer: Collect Drink" (sends `drinkCollected`)
  - `collected` → no buttons (workflow complete)
- Real-time updates via polling (1–2s interval). SSE is optional enhancement.
- Functional HTML only — no styling requirements (spec §3.2: production-quality UI is out of scope).

### Step 5 — Durable Execution Verification

- Full browser flow: place order, progress through all signals, confirm state changes visible.
- Kill worker mid-flow, restart, confirm UI recovers.
- Test invalid transition rejection.

### Step 6 — Exit Criterion Verification

**Exit criterion (spec §6.3):** An order can be placed in the web UI, progressed through all workflow steps via UI buttons, with state changes visible in real time.

---

## 5. Mapping: Temporal Signals ↔ XState Events

The workflow uses Temporal signals to receive external input, and maps them to XState events for state transitions. This mapping is critical for Step 3 (API routes must know which signal to send) and Step 4 (UI buttons must map to signals):

| Temporal Signal | XState Event | State Transition |
|---|---|---|
| `baristaStarted` | `PreparationStarted` | placed → inPreparation |
| `drinkReady` | `PreparationComplete` | inPreparation → ready |
| `drinkCollected` | `OrderCollected` | ready → collected |

The signal names are the Temporal identifiers (used in `defineSignal()` and `handle.signal()`). The XState events are the identifiers from the SysML state def (used in `tryTransition()`). The workflow maps between them internally.

---

## 6. Current Project Directory Structure

```
coffeeshop-demonstrator/              # ~/Developer/gsl-tech/coffeeshop-demonstrator
├── .gitignore                        # node_modules, dist, .DS_Store
├── pnpm-workspace.yaml               # packages: ['packages/*']
├── pnpm-lock.yaml
├── package.json                       # Root: generation scripts, build orchestration
├── tsconfig.base.json                 # Shared strict TS options
├── model/
│   └── domain/
│       └── fulfil-drink-orchestration.sysml
├── generators/
│   ├── gen_temporal_workflow.py        # Phase B
│   ├── gen_mermaid_pathway.py         # Phase B
│   ├── gen_state_machines.py          # Copied from exercise for Phase C
│   └── gen_typescript_types.py        # Copied from exercise for Phase C
├── generated/                         # Canonical generator output
│   ├── fulfil-drink.ts
│   ├── fulfil-drink-pathway.mmd
│   ├── fulfil-drink-pathway.svg
│   ├── order-lifecycle-machine.ts
│   └── types.ts
└── packages/
    ├── shared/                        # @coffeeshop/shared
    │   ├── package.json               # deps: xstate ^5.0.0
    │   ├── tsconfig.json              # extends ../../tsconfig.base.json
    │   └── src/
    │       ├── index.ts               # Re-exports generated types + XState machine
    │       └── generated/
    │           ├── types.ts           # Enums + interfaces from coffeeshop.sysml
    │           └── order-lifecycle-machine.ts  # XState v5 machine from order-lifecycle.sysml
    └── temporal/                      # @coffeeshop/temporal
        ├── package.json               # deps: @temporalio/* ^1.15.0, xstate ^5.28.0, @coffeeshop/shared workspace:*
        ├── tsconfig.json              # extends ../../tsconfig.base.json
        └── src/
            ├── activities/
            │   └── barista.ts         # Hand-written: validateOrder, prepareDrink, completeOrder
            ├── workflows/
            │   └── fulfil-drink.ts    # Generated + Phase C XState integration + query handler
            ├── workers/
            │   └── worker.ts          # Temporal worker: loads workflow by path, passes activities
            └── client/
                └── start-order.ts     # CLI test script with state query verification
```

Note: `packages/web/` does not yet exist. It will be created in Step 3.

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
    "dev:temporal": "pnpm --filter @coffeeshop/temporal dev",
    "dev:web": "pnpm --filter @coffeeshop/web dev"
  }
}
```

### 7.2 Workflow exports needed by web package

The SvelteKit API routes will need to reference:
- `fulfilDrink` — workflow function (for `client.workflow.start()`)
- `baristaStartedSignal`, `drinkReadySignal`, `drinkCollectedSignal` — signal definitions (for `handle.signal()`)
- `orderStateQuery` — query definition (for `handle.query()`)

**Important:** These are exported from `packages/temporal/src/workflows/fulfil-drink.ts`. The web package cannot import directly from the workflow file (it runs in Temporal's V8 isolate). The client test script imports them because TypeScript uses them for type checking only — at runtime, the client uses string-based signal/query references. For the SvelteKit API routes, we need to either:
1. Re-export the signal/query/workflow type definitions from `@coffeeshop/shared` as string constants, or
2. Import directly from `@coffeeshop/temporal` workflow file (works for type-level usage in the client SDK).

This decision should be made at the start of Step 3.

---

## 8. Dependency Versions (as installed)

| Package | Version | Workspace |
|---|---|---|
| pnpm | 10.30.3 | global |
| typescript | ^5.9.3 | shared, temporal |
| @temporalio/client | ^1.15.0 | temporal |
| @temporalio/worker | ^1.15.0 | temporal |
| @temporalio/workflow | ^1.15.0 | temporal |
| @temporalio/activity | ^1.15.0 | temporal |
| xstate | ^5.28.0 (resolved) | shared (^5.0.0), temporal (^5.28.0) |
| @types/node | ^22.0.0 | shared, temporal |
| Temporal CLI | 1.6.1 (Server 1.30.1, UI 2.45.3) | local dev server |
| Node.js | v25.7.0 | system |

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
| `coffeeshop-demonstrator-spec.md` | Full project specification (Phases A–D) |
| `sysml-v2-syntax-reference-v2.0-2026-03-03.md` | Syntax reference verified against Syside Modeler 0.8.4 |

---

## 10. Decisions Deferred to Later

| Decision | Current approach | Revisit when |
|---|---|---|
| XState actor runtime vs pure transition function | Pure transition function — deterministic, no side effects | GenderSense clinical pathways — may need full actor with guards and delayed transitions |
| Polling vs SSE for real-time updates | Polling (1–2s interval) | If UI latency becomes unacceptable |
| Generator extension for state transition logic | Hand-written wrapper around generated workflow | After Phase C validates the pattern |
| Signal name sharing between web and temporal | TBD — decide at start of Step 3 | Step 3 implementation |
| Turborepo addition | Not yet — pnpm workspaces sufficient | If build orchestration becomes tedious |
| `pnpm approve-builds` for native addons | Warning ignored, no functional impact | If warnings become annoying |

---

## 11. How to Run the Project

```bash
cd ~/Developer/gsl-tech/coffeeshop-demonstrator

# Build all packages (shared first, then temporal)
pnpm build

# Terminal 1: Start Temporal dev server
temporal server start-dev

# Terminal 2: Start the Temporal worker
node packages/temporal/dist/workers/worker.js

# Terminal 3: Run the CLI test
node packages/temporal/dist/client/start-order.js
```

Expected test output:
```
=== Starting FulfilDrink workflow (Phase C) ===
[State] After workflow start: placed
[State] After baristaStarted: inPreparation
[State] After drinkReady: ready
[State] After drinkCollected: collected
=== Workflow completed ===
```

---

## 12. Claude MCP Filesystem Access

Claude has read/write access to the project via MCP filesystem tools. Allowed directories include:
- `/Users/ellagreen/Developer/gsl-tech/coffeeshop-demonstrator`
- `/Users/ellagreen/Developer/gsl-tech/coffeeshop-exercise`
- `/Users/ellagreen/Developer/gsl-tech`
- `/Users/ellagreen/Developer`
- `/Users/ellagreen/Desktop`
- `/Users/ellagreen/Downloads`

Claude can create directories, write files, edit files, and read files directly. Claude cannot run shell commands — Ella runs those in her terminal.

---

## 13. Next Action

**Resume at Phase C, Step 3 — SvelteKit Application Scaffold.** Start by:
1. Scaffolding SvelteKit in `packages/web/`.
2. Deciding on signal/query name sharing between temporal and web packages.
3. Creating the Temporal client connection module.
4. Building the three API routes.
5. Testing with curl before proceeding to UI pages (Step 4).
