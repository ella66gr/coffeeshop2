# Phase C — Integration: Implementation Plan

**Project:** Coffee Shop Action Flow Demonstrator
**Date:** 3 March 2026
**Predecessor:** Phase A (Temporal Foundation) ✅ · Phase B (Generators) ✅

---

## Objective

Wire the generated Temporal workflow to the XState order lifecycle and build a minimal web interface.

**Exit criterion:** An order can be placed in the web UI, progressed through all workflow steps via UI buttons, with state changes visible in real time.

---

## Architectural Decisions (settled)

### XState actor location: Temporal worker (in-process)

The XState actor lives in-process with the Temporal worker, not in the SvelteKit server. Activities drive state transitions as part of workflow execution. The SvelteKit front end is a stateless view layer that reads state via Temporal workflow queries.

**Rationale:** State enforcement is protected by Temporal's durable execution model. The front end can be changed or replaced without touching the state logic. This is the pattern required for GenderSense clinical pathways, where lifecycle state must not depend on browser sessions.

**Communication mechanism:** Temporal workflow queries. The workflow maintains XState state internally and exposes it via a query handler. SvelteKit API routes call `handle.query()` to read current state.

### Project structure: pnpm workspace monorepo

The existing `coffeeshop-demonstrator` project is restructured in place as a pnpm workspace monorepo. No new repository.

**Workspaces:**

| Workspace | Package name | Purpose |
|---|---|---|
| `packages/shared` | `@coffeeshop/shared` | Generated types, XState machine definition, shared interfaces |
| `packages/temporal` | `@coffeeshop/temporal` | Temporal worker, activities, workflow code |
| `packages/web` | `@coffeeshop/web` | SvelteKit application |

**Rationale:** Preserves git history, maintains atomic commits (model + generated + implementation), keeps all Phase A–D artefacts in a single repo as the spec defines.

---

## Implementation Steps

### Step 0 — Prerequisite: install pnpm

If not already installed:

```bash
brew install pnpm
```

Verify:

```bash
pnpm --version
```

Note: The project currently uses npm. After migration, all package management commands use pnpm. The existing `package-lock.json` will be replaced by `pnpm-lock.yaml`.

---

### Step 1 — Restructure project as pnpm workspace monorepo

**Goal:** Convert the existing flat TypeScript project into a workspace monorepo without breaking the existing CLI test flow.

#### 1.1 Create workspace configuration

Create `pnpm-workspace.yaml` at the project root:

```yaml
packages:
  - 'packages/*'
```

#### 1.2 Create the root package.json

Replace the existing root `package.json` with a workspace root configuration. The root package is private (not published) and holds generation scripts and dev orchestration:

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
    "sync-generated": "cp generated/*.ts packages/shared/src/generated/",
    "build": "pnpm -r build",
    "dev:temporal": "pnpm --filter @coffeeshop/temporal dev",
    "dev:web": "pnpm --filter @coffeeshop/web dev"
  }
}
```

#### 1.3 Create tsconfig.base.json

Extract the shared compiler options from the existing `tsconfig.json` into a new `tsconfig.base.json` at the project root. Each workspace package will extend this:

```json
{
  "compilerOptions": {
    "target": "esnext",
    "lib": ["esnext"],
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedSideEffectImports": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true
  }
}
```

#### 1.4 Create packages/shared

```bash
mkdir -p packages/shared/src/generated
```

Create `packages/shared/package.json`:

```json
{
  "name": "@coffeeshop/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  }
}
```

Create `packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",
    "rootDir": "./src",
    "outDir": "./dist",
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

Create `packages/shared/src/index.ts` — this will re-export generated code for clean imports by other packages. Initial content (will expand as generated files are copied in):

```typescript
// Re-exports from generated code
export * from './generated/types.js';
export { orderLifecycleMachine } from './generated/order-lifecycle-machine.js';
```

**Note:** The generated workflow file (`fulfil-drink.ts`) is NOT re-exported from shared. It must live in `packages/temporal` because Temporal loads workflows by filesystem path into a V8 isolate — it cannot resolve workspace package imports inside the isolate.

#### 1.5 Create packages/temporal

```bash
mkdir -p packages/temporal/src/{activities,workflows,workers,client}
```

Move existing source files:

```bash
mv src/activities/barista.ts packages/temporal/src/activities/
mv src/workers/worker.ts packages/temporal/src/workers/
mv src/client/start-order.ts packages/temporal/src/client/
```

The workflow file is a special case — it is generated, so it will be copied from `generated/` into `packages/temporal/src/workflows/` as part of the `sync-generated` script (or a separate step, since it doesn't go to `packages/shared`).

Update the root `sync-generated` script to handle this:

```json
"sync-generated": "cp generated/types.ts generated/order-lifecycle-machine.ts packages/shared/src/generated/ && cp generated/fulfil-drink.ts packages/temporal/src/workflows/"
```

Create `packages/temporal/package.json`:

```json
{
  "name": "@coffeeshop/temporal",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@temporalio/client": "latest",
    "@temporalio/worker": "latest",
    "@temporalio/workflow": "latest",
    "@temporalio/activity": "latest",
    "@coffeeshop/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^22.0.0"
  }
}
```

Create `packages/temporal/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",
    "rootDir": "./src",
    "outDir": "./dist",
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

#### 1.6 Update import paths in moved files

After moving files into the new package structure, import paths will need updating:

- `worker.ts`: update `workflowsPath` to resolve relative to its new location; update the activities import path.
- `start-order.ts`: update the workflow/signal imports to the new relative path.
- `barista.ts`: likely unchanged (no cross-package imports in Phase A).

#### 1.7 Remove old structure

```bash
rm -rf src/ dist/
rm tsconfig.json  # replaced by tsconfig.base.json + per-package configs
rm package-lock.json  # pnpm uses pnpm-lock.yaml
```

#### 1.8 Install dependencies and verify

```bash
pnpm install
pnpm -r build
```

#### 1.9 Run the existing CLI test to confirm nothing broke

Terminal 1:

```bash
temporal server start-dev
```

Terminal 2:

```bash
node packages/temporal/dist/workers/worker.js
```

Terminal 3:

```bash
node packages/temporal/dist/client/start-order.js
```

Verify the same output as Phase A: workflow completes, three signals processed, history printed.

#### 1.10 Commit checkpoint

```bash
git add -A
git commit -m "chore: restructure as pnpm workspace monorepo for Phase C"
git tag v0.3.0-restructure
```

---

### Step 2 — XState integration layer

**Goal:** Wire the generated XState OrderLifecycle machine into Temporal activities so that workflow progression drives state transitions, with XState validating each one. Testable from CLI — no UI required yet.

#### 2.1 Generate and sync the XState machine

Ensure the `gen_state_machines.py` generator is available (copy from `coffeeshop-exercise/generators/` if not already present in `coffeeshop-demonstrator/generators/`).

Run generation:

```bash
pnpm generate:statemachine
pnpm sync-generated
```

Verify `packages/shared/src/generated/order-lifecycle-machine.ts` exists and contains a valid XState v5 `createMachine()` definition.

#### 2.2 Install XState

```bash
pnpm --filter @coffeeshop/shared add xstate
```

XState is a dependency of `@coffeeshop/shared` because the generated machine definition imports from it, and both the temporal and web packages need access.

#### 2.3 Write the order state manager

Create `packages/shared/src/order-state-manager.ts`.

This module provides:

- A function to create a new order state actor (wrapping `createActor()` from XState with the generated OrderLifecycle machine).
- A `transition(eventName: string)` function that sends an event to the actor and returns the new state (or throws/returns an error if the transition is invalid).
- A `getState()` function returning the current state value.

This is the integration glue that both the Temporal activities and the web layer will use. It encapsulates XState so that consumers don't need to know XState API details.

Export it from `packages/shared/src/index.ts`.

#### 2.4 Integrate XState into Temporal workflow via queries

The XState actor must live inside the workflow function (not the activities), because:

- Workflow state must be deterministically reconstructable during Temporal replay.
- Queries can only read workflow-scoped state.
- Activities run in the Node.js environment outside the V8 isolate and cannot share memory with the workflow.

**However**, XState v5's `createActor()` may have side effects (timers, subscriptions) that violate Temporal's determinism requirements for workflow code. Two approaches to resolve this:

**Option A — Lightweight state tracking (recommended for demonstrator):** Instead of running a full XState actor in the workflow, maintain a simple state variable that tracks the current state string. Use the generated machine definition to validate transitions by calling the machine's pure `transition()` function (which is deterministic and side-effect-free). This gives you XState's validation guarantees without the actor runtime. Expose the state via a Temporal query handler.

```typescript
// Inside the workflow function:
import { defineQuery, setHandler } from '@temporalio/workflow';

export const orderStateQuery = defineQuery<string>('orderState');

export async function fulfilDrink(order: OrderDetails): Promise<string> {
  let currentState = 'placed';

  setHandler(orderStateQuery, () => currentState);

  // After each activity/signal step, validate and advance state:
  // currentState = nextState (validated against XState machine definition)
  // ...
}
```

**Option B — XState actor in activities with external state store:** Activities create transient XState actors, validate transitions, and persist state to an external store. More infrastructure, less elegant for the demonstrator.

**Decision needed:** Option A is simpler and sufficient for the demonstrator. Option B is closer to a production pattern but adds complexity. Recommend Option A, noting it as a simplification to revisit for GenderSense.

#### 2.5 Add state transition logic to the workflow

Modify the generated workflow (or, more precisely, modify the generator to emit this pattern) so that after each activity completion and signal receipt, the workflow:

1. Reads the `@StateTransitionTrigger { eventName }` for that step.
2. Validates the transition against the XState machine definition.
3. Advances `currentState` if valid.
4. Logs the transition (for audit trail in Phase D).

For the demonstrator, this can be done by hand-writing a thin wrapper around the generated workflow, or by extending `gen_temporal_workflow.py` to emit transition logic. The manual approach is faster and avoids generator complexity in Phase C; generator extension is a cleanup task.

#### 2.6 Test from CLI

Run the existing test script (`start-order.ts`). Modify it to also query the workflow state after each signal:

```typescript
const state = await handle.query(orderStateQuery);
console.log(`Current state: ${state}`);
```

**Expected state progression:**

| After step | XState state |
|---|---|
| validateOrder | `placed` |
| baristaStarted signal | `inPreparation` |
| drinkReady signal | `ready` |
| drinkCollected signal | `collected` |

Verify that the XState machine rejects invalid transitions (e.g., attempting to go from `placed` directly to `collected`).

#### 2.7 Commit checkpoint

```bash
git add -A
git commit -m "feat: XState order lifecycle integrated with Temporal workflow queries"
git tag v0.3.1-xstate-integration
```

---

### Step 3 — SvelteKit application scaffold

**Goal:** Create a minimal SvelteKit application with a Temporal client connection and API routes for starting workflows, sending signals, and querying state.

#### 3.1 Scaffold SvelteKit

```bash
cd packages/web
pnpm create svelte@latest .
```

When prompted:

- Template: Skeleton project
- TypeScript: Yes
- ESLint: Optional (yes if you want it)
- Prettier: Optional
- Playwright/Vitest: Skip for now

#### 3.2 Install dependencies

```bash
pnpm --filter @coffeeshop/web add @temporalio/client
```

The web package also needs a workspace dependency on shared:

```bash
# In packages/web/package.json, add:
# "@coffeeshop/shared": "workspace:*"
```

Then:

```bash
pnpm install
```

#### 3.3 Configure the Temporal client connection

Create `packages/web/src/lib/server/temporal.ts` (the `server/` subdirectory ensures this code only runs server-side in SvelteKit):

```typescript
import { Client, Connection } from '@temporalio/client';

let client: Client | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (!client) {
    const connection = await Connection.connect({ address: 'localhost:7233' });
    client = new Client({ connection });
  }
  return client;
}
```

#### 3.4 Create API routes

**POST `/api/orders`** — Start a new workflow:

Create `packages/web/src/routes/api/orders/+server.ts`:

- Accepts JSON body with `customerName`, `drinkType`, `size`.
- Generates an `orderId` (e.g., `order-${Date.now()}`).
- Starts the `fulfilDrink` workflow via the Temporal client.
- Returns `{ orderId, workflowId }`.

**GET `/api/orders/[id]`** — Query workflow state:

Create `packages/web/src/routes/api/orders/[id]/+server.ts`:

- Gets a workflow handle by ID.
- Calls `handle.query(orderStateQuery)` to get the current XState state.
- Calls `handle.describe()` to get workflow status (running/completed/failed).
- Returns `{ orderId, state, workflowStatus }`.

**POST `/api/orders/[id]/signal`** — Send a signal:

Create `packages/web/src/routes/api/orders/[id]/signal/+server.ts`:

- Accepts JSON body with `signal` (one of `baristaStarted`, `drinkReady`, `drinkCollected`).
- Gets a workflow handle by ID.
- Sends the appropriate signal.
- Returns the updated state (via query).

**Implementation note:** The signal names must match the exported signal definitions from the workflow. Since the web package cannot import workflow code directly (it runs in Temporal's V8 isolate), the signal names should be passed as strings and the API route should use `handle.signal(signalName)` with the string-based signal reference. Alternatively, export the signal definitions from `@coffeeshop/shared` as constants.

#### 3.5 Verify API routes

With Temporal server and worker running, use curl or a simple script to test:

```bash
# Start an order
curl -X POST http://localhost:5173/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerName":"Ella","drinkType":"flat white","size":"medium"}'

# Query state
curl http://localhost:5173/api/orders/order-123

# Send signal
curl -X POST http://localhost:5173/api/orders/order-123/signal \
  -H 'Content-Type: application/json' \
  -d '{"signal":"baristaStarted"}'
```

#### 3.6 Commit checkpoint

```bash
git add -A
git commit -m "feat: SvelteKit scaffold with Temporal API routes"
git tag v0.3.2-sveltekit-scaffold
```

---

### Step 4 — UI pages

**Goal:** Build minimal UI pages that allow placing an order, viewing its state, and advancing it through the workflow via buttons.

#### 4.1 Order form page

`packages/web/src/routes/+page.svelte`

A simple form with fields for customer name, drink type (dropdown), and size (dropdown). On submit, POST to `/api/orders` and redirect to the order status page.

No styling requirements — functional HTML only (spec §3.2: production-quality UI is out of scope).

#### 4.2 Order status page

`packages/web/src/routes/orders/[id]/+page.svelte`

Displays:

- Order ID
- Current state (from XState via Temporal query), prominently displayed
- Workflow status (running/completed)
- Action buttons appropriate to the current state:

| Current state | Available button | Signal sent |
|---|---|---|
| `placed` | "Barista: Start Preparation" | `baristaStarted` |
| `inPreparation` | "Barista: Mark Ready" | `drinkReady` |
| `ready` | "Customer: Collect Drink" | `drinkCollected` |
| `collected` | (none — workflow complete) | — |

Each button POSTs to `/api/orders/[id]/signal` with the appropriate signal name. After the signal is sent, the page re-fetches state and updates the display.

#### 4.3 Real-time updates

For the demonstrator, **polling** is sufficient. The order status page polls `GET /api/orders/[id]` every 1–2 seconds while the workflow is running and updates the displayed state.

If time permits, Server-Sent Events (SSE) from SvelteKit would be a nicer experience, but polling meets the exit criterion and avoids additional complexity.

#### 4.4 Orders list page (optional)

A simple page listing recent workflow executions, fetched via the Temporal client's `listWorkflows` API. This is not required by the exit criterion but is useful for testing multiple orders.

#### 4.5 Verify end-to-end in browser

1. Start Temporal server: `temporal server start-dev`
2. Start worker: `pnpm dev:temporal` (in packages/temporal)
3. Start web: `pnpm dev:web` (in packages/web)
4. Open browser to `http://localhost:5173`
5. Place an order via the form.
6. Observe state = `placed`.
7. Click "Barista: Start Preparation" → state = `inPreparation`.
8. Click "Barista: Mark Ready" → state = `ready`.
9. Click "Customer: Collect Drink" → state = `collected`.
10. Confirm workflow shows as Completed in Temporal Web UI (http://localhost:8233).

#### 4.6 Commit checkpoint

```bash
git add -A
git commit -m "feat: minimal UI for order placement and workflow progression"
git tag v0.3.3-ui-pages
```

---

### Step 5 — Durable execution verification (end-to-end)

**Goal:** Confirm that the durable execution property validated in Phase A still holds through the full integrated stack.

#### 5.1 Test worker restart mid-workflow

1. Place an order via the web UI.
2. Click "Barista: Start Preparation" (state → `inPreparation`).
3. Kill the Temporal worker process (Ctrl+C).
4. Restart the worker.
5. Click "Barista: Mark Ready" in the web UI.
6. Verify state advances to `ready` — the workflow recovered.
7. Complete the order normally.

#### 5.2 Test invalid transition rejection

Attempt to send signals out of order (e.g., send `drinkCollected` while state is `placed`). Verify that the XState machine rejects the transition and the workflow state does not advance. The API should return an appropriate error.

#### 5.3 Confirm in Temporal Web UI

For a completed order, verify in the Temporal Web UI (http://localhost:8233):

- Full event history with all activities and signals
- Workflow queries show the final state
- Worker restart is visible in the event history (Workflow Task Timed Out event)

---

### Step 6 — Phase C exit criterion verification

**Exit criterion (from spec §6.3):** An order can be placed in the web UI, progressed through all workflow steps via UI buttons, with state changes visible in real time.

**Verification checklist:**

| Criterion | Evidence |
|---|---|
| Order placed via web UI | Order form submits, workflow starts, redirect to status page |
| Workflow steps progressed via UI buttons | Each signal button advances the workflow and state |
| State changes visible in real time | Polling updates the displayed state within 1–2 seconds |
| XState validates transitions | Invalid signals rejected, only valid buttons shown per state |
| Temporal durable execution | Worker restart mid-workflow does not lose progress |

#### 6.1 Final commit and tag

```bash
git add -A
git commit -m "feat: Phase C complete — integrated Temporal + XState + SvelteKit"
git tag v0.3.0
```

---

## Target Directory Structure (Phase C complete)

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
├── generated/                              # Generator output (canonical)
│   ├── fulfil-drink.ts
│   ├── fulfil-drink-pathway.mmd
│   ├── order-lifecycle-machine.ts
│   └── types.ts
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── generated/                  # Copied from root generated/
│   │       │   ├── order-lifecycle-machine.ts
│   │       │   └── types.ts
│   │       ├── order-state-manager.ts      # XState integration glue
│   │       └── index.ts
│   ├── temporal/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── activities/
│   │       │   └── barista.ts
│   │       ├── workflows/
│   │       │   └── fulfil-drink.ts         # Generated (copied from generated/)
│   │       ├── workers/
│   │       │   └── worker.ts
│   │       └── client/
│   │           └── start-order.ts
│   └── web/
│       ├── package.json
│       ├── svelte.config.js
│       ├── tsconfig.json
│       └── src/
│           ├── routes/
│           │   ├── +page.svelte
│           │   ├── orders/
│           │   │   └── [id]/
│           │   │       └── +page.svelte
│           │   └── api/
│           │       └── orders/
│           │           ├── +server.ts
│           │           └── [id]/
│           │               ├── +server.ts
│           │               └── signal/
│           │                   └── +server.ts
│           └── lib/
│               └── server/
│                   └── temporal.ts
├── pnpm-workspace.yaml
├── package.json                            # Root: scripts, workspace config
├── tsconfig.base.json                      # Shared TS options
├── coffeeshop-demonstrator-spec.md
└── sysml-v2-syntax-reference-v2.0.md
```

---

## Decisions Deferred

| Decision | Current approach | Revisit when |
|---|---|---|
| XState actor runtime vs pure transition function in workflow | Pure transition function (Option A) — deterministic, no side effects | GenderSense clinical pathways — may need full actor with guards and delayed transitions |
| Polling vs SSE for real-time updates | Polling (1–2s interval) | If UI latency becomes unacceptable; Phase D may benefit from SSE for audit reporting |
| Generator extension for state transition logic | Hand-written wrapper around generated workflow | After Phase C validates the pattern; extend `gen_temporal_workflow.py` to emit transition + query code |
| Signal name sharing between web and temporal | String constants or shared export from `@coffeeshop/shared` | Settle during Step 3.4 implementation |
| Turborepo addition | Not yet — pnpm workspaces sufficient | If build orchestration across packages becomes tedious |

---

## Risks Specific to Phase C

| Risk | Likelihood | Mitigation |
|---|---|---|
| Temporal workflow V8 isolate cannot import from workspace packages | Confirmed | Workflow file lives in `packages/temporal`, loaded by filesystem path. Types imported via `@coffeeshop/shared` at compile time only. |
| XState v5 `createActor()` has side effects incompatible with Temporal workflow determinism | High | Use pure `machine.transition()` function instead of actor runtime inside the workflow. |
| SvelteKit and Temporal client conflict on Node.js APIs or module resolution | Medium | SvelteKit server-side code runs in normal Node.js. Keep Temporal client in `$lib/server/` to ensure server-only execution. |
| pnpm workspace hoisting causes Temporal SDK resolution issues | Low | Temporal SDK is sensitive to module resolution. If issues arise, use `.npmrc` with `shamefully-hoist=true` or `public-hoist-pattern` for `@temporalio/*`. |
| Generated XState machine import fails inside Temporal V8 isolate | Medium | XState machine is used for validation only via pure function calls, not imported into workflow isolate. State validation logic accesses the machine definition at build time or via activity-side validation. |

---

## Dependencies Added in Phase C

| Dependency | Workspace | Notes |
|---|---|---|
| `xstate` | `@coffeeshop/shared` | State machine runtime |
| `@temporalio/client` | `@coffeeshop/web` | Temporal client for API routes |
| `@sveltejs/kit` | `@coffeeshop/web` | Web framework (installed by scaffolding) |
| `svelte` | `@coffeeshop/web` | UI framework (installed by scaffolding) |
| `pnpm` | global | Package manager (replaces npm) |

---

## Journal Convention

As with Phases A and B, maintain a `phase-c-journal.md` capturing:

- Actual commands run and their output
- Gotchas and workarounds encountered
- Deviations from this plan and rationale
- Syside Modeler verification notes (if any model changes needed)
- Exact versions of newly installed dependencies
