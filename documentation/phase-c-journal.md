# Phase C — Integration: Journal Notes

**Date:** 3 March 2026
**Project:** Coffee Shop Action Flow Demonstrator
**Environment:** macOS (MacBook Pro), Node.js v25.7.0, pnpm v10.30.3, Svelte 5 / SvelteKit (latest), Vite v7.3.1

## Objective

Wire the generated Temporal workflow to the XState order lifecycle and build a minimal web interface.

**Exit criterion:** An order can be placed in the web UI, progressed through all workflow steps via UI buttons, with state changes visible in real time.

## Deliverables (from spec section 6.3)

1. XState OrderLifecycle machine integrated with Temporal workflow (activities drive state transitions, XState validates them).
2. SvelteKit application with pages for: placing an order, viewing order status (real-time updates), simulating barista actions (start preparation, mark ready), simulating customer collection.
3. Temporal workflow signals triggered from UI actions.
4. Order state reflected in UI via XState machine state.

---

## Architecture decision: XState actor location

**Decision: Pure transition functions inside the Temporal workflow V8 isolate (Option A from plan).**

XState v5 provides pure `initialTransition()` and `transition()` functions (imported from `'xstate'`). These are deterministic and side-effect-free — no timers, no subscriptions, no actor runtime. They are safe for Temporal's sandboxed V8 isolate, which requires all workflow code to be deterministic.

The workflow maintains XState state as a variable (`machineState`) and exposes it via a Temporal query handler (`orderStateQuery`). The SvelteKit front end is a stateless view layer that reads state via `handle.query()`.

Key validation: Temporal's webpack bundler successfully resolved XState (v5.28.0, 161 KiB, 7 modules) into the V8 isolate. This was the biggest technical risk for Phase C.

**Rationale:** State enforcement is protected by Temporal's durable execution. The front end can be replaced without touching the state logic. This is the pattern required for GenderSense clinical pathways, where lifecycle state must not depend on browser sessions.

**Deferred:** Full XState actor runtime with guards and delayed transitions. Revisit for GenderSense if pathway complexity requires it.

---

## Architecture decision: Signal/query name sharing

**Decision: String constants in `@coffeeshop/shared` (workflow-constants.ts).**

The SvelteKit web package cannot import from the Temporal workflow file (which runs in Temporal's V8 isolate). Instead, signal names, query names, task queue, and workflow identifiers are defined as string constants in `@coffeeshop/shared` and used by both the Temporal workflow (`defineSignal('baristaStarted')`) and the SvelteKit API routes (`handle.signal('baristaStarted')`).

This gives a single place to maintain identifiers, with TypeScript type safety via `VALID_SIGNALS` and `SignalName`.

---

## Architecture decision: Project structure

**Decision: pnpm workspace monorepo with three packages.**

| Workspace | Package name | Purpose |
|---|---|---|
| packages/shared | @coffeeshop/shared | Generated types, XState machine definition, workflow constants |
| packages/temporal | @coffeeshop/temporal | Temporal worker, activities, workflow code |
| packages/web | @coffeeshop/web | SvelteKit application |

The existing `coffeeshop-demonstrator` project was restructured in place. Git history preserved. Package manager changed from npm to pnpm.

---

## Step 1: Restructure project as pnpm workspace monorepo

*(Completed in previous chat session — documented here for continuity.)*

### 1.1 Workspace configuration

Created `pnpm-workspace.yaml` at project root:

```yaml
packages:
  - 'packages/*'
```

### 1.2 Root package.json

Replaced with workspace root configuration:

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

Note: `build` script deliberately excludes web package (SvelteKit uses Vite, not tsc). `build:all` includes it.

### 1.3 tsconfig.base.json

Shared strict compiler options extracted to root:

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

Each workspace package (shared, temporal) extends this. The web package uses SvelteKit's own tsconfig (extends `.svelte-kit/tsconfig.json`).

### 1.4 packages/shared

Created with generated types and XState machine re-exported from `index.ts`. XState added as a dependency.

### 1.5 packages/temporal

Moved existing source files from `src/` into `packages/temporal/src/`. Updated import paths. The workflow file lives here (not in shared) because Temporal loads it by filesystem path into a V8 isolate.

### 1.6 Verified

`pnpm install`, `pnpm build`, and CLI test all pass — identical behaviour to Phase A/B.

**Commit tag:** `v0.3.0-restructure`

---

## Step 2: XState integration layer

*(Completed in previous chat session — documented here for continuity.)*

### 2.1 Pure transition approach

Modified `packages/temporal/src/workflows/fulfil-drink.ts` to use XState pure functions:

```typescript
import { initialTransition, transition } from 'xstate';
import { orderLifecycleMachine } from '@coffeeshop/shared';
import type { OrderEvent } from '@coffeeshop/shared';

function tryTransition(
  currentSnapshot: ReturnType<typeof initialTransition>[0],
  eventType: string,
): ReturnType<typeof initialTransition>[0] {
  const event = { type: eventType } as OrderEvent;
  const [nextSnapshot] = transition(orderLifecycleMachine, currentSnapshot, event);
  return nextSnapshot;
}
```

State initialised with `let [machineState] = initialTransition(orderLifecycleMachine);` and advanced after each signal with `machineState = tryTransition(machineState, 'PreparationStarted');`.

### 2.2 Query handler

```typescript
export const orderStateQuery = defineQuery<string>('orderState');

setHandler(orderStateQuery, () => {
  const value = machineState.value;
  return typeof value === 'string' ? value : JSON.stringify(value);
});
```

### 2.3 State progression

| After step | XState event | State |
|---|---|---|
| validateOrder | — | placed |
| baristaStarted signal | PreparationStarted | inPreparation |
| drinkReady signal | PreparationComplete | ready |
| drinkCollected signal | OrderCollected | collected |

### 2.4 Test verification

CLI test script extended with query calls and retry logic for `QueryNotRegisteredError`. Verified output:

```
[State] After workflow start: placed
[State] After baristaStarted: inPreparation
[State] After drinkReady: ready
[State] After drinkCollected: collected
```

**Commit tag:** `v0.3.1-xstate-integration`

---

## Step 3: SvelteKit application scaffold

### 3.1 SvelteKit scaffolding

The `create-svelte` package has been deprecated. The current scaffolding tool is `sv`:

```bash
cd packages/web
npx sv create .
```

**Prompts:**
- Template: SvelteKit minimal (skeleton project)
- Type checking: Yes, using TypeScript
- Additional options: None selected (no prettier, eslint, tailwind — functional UI only for demonstrator)

This produces a **Svelte 5** project. Svelte 5 has significant syntax changes from Svelte 4 — see the "Svelte 5 syntax reference" section below.

The scaffold created its own `+page.svelte` (overwriting the pre-created file) and `+layout.svelte`. Config files (`svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `app.html`, `app.d.ts`) were created by the scaffold.

### 3.2 SvelteKit configuration (as scaffolded)

**svelte.config.js:**

```javascript
import adapter from '@sveltejs/adapter-auto';

const config = {
  kit: {
    adapter: adapter()
  }
};

export default config;
```

Note: No `vitePreprocess()` needed — Svelte 5 / SvelteKit latest handles TypeScript and preprocessing natively.

**vite.config.ts:**

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()]
});
```

**tsconfig.json (web package):**

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "rewriteRelativeImportExtensions": true,
    "allowJs": true,
    "checkJs": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "strict": true,
    "moduleResolution": "bundler"
  }
}
```

Important: The web package does NOT extend `tsconfig.base.json`. SvelteKit generates its own tsconfig at `.svelte-kit/tsconfig.json` and the web package extends that. This is correct — SvelteKit's Vite pipeline handles its own TypeScript compilation independently from tsc.

### 3.3 Package.json (web)

```json
{
  "name": "@coffeeshop/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@coffeeshop/shared": "workspace:*",
    "@temporalio/client": "^1.15.0"
  },
  "devDependencies": {
    "@sveltejs/adapter-auto": "latest",
    "@sveltejs/kit": "latest",
    "@sveltejs/vite-plugin-svelte": "latest",
    "svelte": "latest",
    "typescript": "^5.9.3",
    "vite": "latest"
  }
}
```

### 3.4 Workflow constants (shared)

Created `packages/shared/src/workflow-constants.ts` — the single source of truth for signal names, query names, task queue, and workflow identifiers shared between Temporal and SvelteKit packages.

Exports:
- `TASK_QUEUE`, `WORKFLOW_NAME` — workflow configuration
- `SIGNAL_BARISTA_STARTED`, `SIGNAL_DRINK_READY`, `SIGNAL_DRINK_COLLECTED` — signal name strings
- `VALID_SIGNALS`, `SignalName` — runtime validation array and type
- `QUERY_ORDER_STATE` — query name string
- `SIGNAL_STATE_MAP` — maps each signal to the resulting XState state
- `STATE_AVAILABLE_SIGNAL` — maps each XState state to the signal/label available from that state (used by UI)

Re-exported from `packages/shared/src/index.ts`.

### 3.5 Temporal client connection

Created `packages/web/src/lib/server/temporal.ts`:

```typescript
import { Client, Connection } from '@temporalio/client';

let client: Client | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (!client) {
    const connection = await Connection.connect({
      address: 'localhost:7233',
    });
    client = new Client({ connection });
  }
  return client;
}
```

The `$lib/server/` directory ensures SvelteKit never bundles this into client-side code.

### 3.6 API routes

**POST /api/orders** (`packages/web/src/routes/api/orders/+server.ts`):

- Accepts JSON body: `{ customerName, drinkType, size }`
- Validates required fields and size enum
- Generates orderId as `order-${Date.now()}`
- Starts `fulfilDrink` workflow via Temporal client using `WORKFLOW_NAME` string
- 500ms pause to let workflow initialise and register query handler
- Returns `{ orderId, workflowId, state }`

**GET /api/orders/[id]** (`packages/web/src/routes/api/orders/[id]/+server.ts`):

- Gets workflow handle by ID
- Calls `handle.describe()` for workflow status
- If COMPLETED, returns `state: 'collected'` (can't query completed workflows)
- If RUNNING, calls `handle.query(QUERY_ORDER_STATE)` for current XState state
- Returns `{ orderId, state, workflowStatus }`

**POST /api/orders/[id]/signal** (`packages/web/src/routes/api/orders/[id]/signal/+server.ts`):

- Accepts JSON body: `{ signal }`
- Validates signal name against `VALID_SIGNALS`
- Verifies workflow is RUNNING before sending
- Sends signal using string-based API: `handle.signal(signal)`
- 300ms pause for workflow to process
- Queries and returns updated state

Important: The SvelteKit API routes use `handle.signal(signalName)` with a raw string, not with a `defineSignal()` reference. This works because Temporal's client SDK accepts string signal names. The `defineSignal()` references are only needed inside the workflow code (V8 isolate).

### 3.7 API verification

Tested with curl:

```bash
# Start an order
curl -s -X POST http://localhost:5173/api/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerName":"Ella","drinkType":"flat white","size":"medium"}'
```

Response: `{"orderId":"order-1772576981645","workflowId":"order-1772576981645","state":"placed"}`

All three API routes verified working.

---

## Step 4: UI pages

### 4.1 Order form page

`packages/web/src/routes/+page.svelte` — simple form with customer name text input, drink type dropdown, size dropdown. On submit, POSTs to `/api/orders` and uses SvelteKit's `goto()` to redirect to the order status page.

### 4.2 Order status page

`packages/web/src/routes/orders/[id]/+page.svelte` — displays order ID, current XState state (prominently), workflow status, and contextual action buttons:

| Current state | Available button | Signal sent |
|---|---|---|
| placed | "Barista: Start Preparation" | baristaStarted |
| inPreparation | "Barista: Mark Ready" | drinkReady |
| ready | "Customer: Collect Drink" | drinkCollected |
| collected | (none — workflow complete) | — |

State labels are human-readable: "placed" displays as "Placed", "inPreparation" as "In Preparation", etc.

A state history table shows timestamped entries for each state transition, giving a simple client-side audit trail.

Real-time updates via polling at 2-second intervals. Polling stops when the workflow reaches a terminal state.

After the final signal (`drinkCollected`), the page does one extra fetch after 500ms to catch the COMPLETED workflow status from Temporal.

### 4.3 Layout

The scaffold-generated `+layout.svelte` uses Svelte 5 syntax:

```svelte
<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';
  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
```

---

## Step 5: Durable execution verification (end-to-end)

### 5.1 Test procedure

1. Placed a new order via the web UI.
2. Clicked "Barista: Start Preparation" — state moved to In Preparation.
3. Killed the Temporal worker process (Ctrl+C).
4. UI showed "Error: Failed to query Workflow" — expected, no worker to execute queries.
5. Restarted the worker: `node packages/temporal/dist/workers/worker.js`
6. Clicked "Barista: Mark Ready" — state advanced to Ready for Collection.
7. Clicked "Customer: Collect Drink" — state advanced to Collected, workflow completed.

### 5.2 Temporal Web UI verification

- **Workers: 2** — confirmed two different worker instances handled the workflow (first worker identity `27501@...`, second worker identity `28458@...`).
- **Status: Completed** — workflow completed successfully despite worker restart.
- **Event History: 35 events** — full activity and signal history visible.
- No `WorkflowTaskTimedOut` event visible — the worker was killed during a signal-wait period (zero-resource suspension), so Temporal had no outstanding workflow task to time out. The worker handoff is confirmed by the identity change in the event history.

### 5.3 Behaviour during worker outage

While the worker was down, the Temporal server continued to hold the workflow state. Signals could still be sent to the workflow (they queue on the Temporal server). When the new worker started, it replayed the workflow from the event history, processed the queued signals, and resumed normal execution. The SvelteKit UI recovered automatically via polling once queries started returning responses again.

---

## Svelte 5 / SvelteKit Syntax Reference

The SvelteKit scaffold (as of March 2026) produces a **Svelte 5** project. Svelte 5 introduces significant syntax changes from Svelte 4. The following documents the patterns verified as working in this project.

### Scaffolding tool

`create-svelte` has been deprecated. The current tool is `sv`:

```bash
npx sv create .          # scaffold in current directory
npx sv create myproject  # scaffold in new directory
```

Prompts: Template (SvelteKit minimal), Type checking (TypeScript), Additional options (select as needed).

### Reactive state: `$state` replaces `let` reactivity

Svelte 4:
```svelte
<script>
  let count = 0;        // reactive by default
  let items = [];       // reactive by default
</script>
```

Svelte 5:
```svelte
<script lang="ts">
  let count = $state(0);
  let items = $state<string[]>([]);
</script>
```

All reactive variables must use `$state()`. Plain `let` declarations are no longer automatically reactive. TypeScript generics are supported: `$state<Type>(initialValue)`.

### Derived values: `$derived` replaces `$:`

Svelte 4:
```svelte
<script>
  $: doubled = count * 2;
  $: isActive = status === 'active';
</script>
```

Svelte 5:
```svelte
<script lang="ts">
  let doubled = $derived(count * 2);
  let isActive = $derived(status === 'active');
</script>
```

`$derived()` replaces reactive statements for computed values.

### Component props: `$props()` replaces `export let`

Svelte 4:
```svelte
<script>
  export let name;
  export let count = 0;
</script>
```

Svelte 5:
```svelte
<script lang="ts">
  let { name, count = 0 } = $props();
</script>
```

### Slots: `{@render children()}` replaces `<slot />`

Svelte 4:
```svelte
<slot />
```

Svelte 5:
```svelte
<script lang="ts">
  let { children } = $props();
</script>
{@render children()}
```

The layout file generated by the scaffold demonstrates this pattern.

### Event handlers: `onclick` replaces `on:click`

Svelte 4:
```svelte
<button on:click={handleClick}>Click</button>
<button on:click={() => doSomething(arg)}>Click</button>
```

Svelte 5:
```svelte
<button onclick={handleClick}>Click</button>
<button onclick={() => doSomething(arg)}>Click</button>
```

All event handler directives (`on:click`, `on:submit`, etc.) are replaced with standard HTML event attributes (`onclick`, `onsubmit`, etc.). Note lowercase — these are native DOM event attributes, not Svelte directives.

### `bind:value` is unchanged

```svelte
<input type="text" bind:value={name} />
<select bind:value={size}>...</select>
```

`bind:value` works the same in Svelte 5 as in Svelte 4.

### Page data: `$app/state` replaces `$app/stores`

Svelte 4:
```svelte
<script>
  import { page } from '$app/stores';
  $: orderId = $page.params.id;
</script>
```

Svelte 5:
```svelte
<script lang="ts">
  import { page } from '$app/state';
  let orderId = $derived(page.params.id ?? '');
</script>
```

Note: `page` from `$app/state` is accessed directly (no `$` prefix), not as a store. Combined with `$derived()` for reactive derivation.

**Compatibility warning:** Some component libraries (e.g. Flowbite Svelte as of v1.6.4) still use `$app/stores` internally. Check library compatibility before migrating existing projects.

### Lifecycle: `onMount` and `onDestroy` are unchanged

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  onMount(() => {
    // setup code
    return () => {
      // cleanup code (replaces onDestroy for this use case)
    };
  });
</script>
```

`onMount` returning a cleanup function is the idiomatic pattern for setup/teardown (e.g. starting and clearing an interval).

### Control flow: `{#if}`, `{#each}`, `{:else}` are unchanged

```svelte
{#if loading}
  <p>Loading...</p>
{:else}
  <p>Content</p>
{/if}

{#each items as item}
  <p>{item.name}</p>
{/each}
```

These are identical to Svelte 4.

### Strict HTML validation

Svelte 5 enforces strict HTML compliance. For example, `<tr>` cannot be a direct child of `<table>` — it must be wrapped in `<tbody>`:

```svelte
<!-- WRONG — Svelte 5 compilation error -->
<table>
  <tr><td>Data</td></tr>
</table>

<!-- CORRECT -->
<table>
  <tbody>
    <tr><td>Data</td></tr>
  </tbody>
</table>
```

This applies to all HTML nesting rules. The error message is: `<tr> cannot be a child of <table>. <table> only allows these children: <caption>, <colgroup>, <tbody>, <thead>, <tfoot>, <style>, <script>, <template>`.

### SvelteKit API routes

Server-side API routes (`+server.ts`) are unchanged from SvelteKit conventions:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, params }) => {
  const body = await request.json();
  // ... business logic ...
  return json({ result: 'ok' });
};

export const GET: RequestHandler = async ({ params }) => {
  return json({ data: 'value' });
};
```

### Server-only code: `$lib/server/`

Files in `$lib/server/` are guaranteed to only run server-side. SvelteKit will error at build time if client-side code attempts to import from this directory. Used for the Temporal client connection.

---

## Gotchas and lessons learned

### 1. `create-svelte` is deprecated

Running `pnpm create svelte@latest` produces a deprecation warning and suggests `npx sv create` instead. The `sv` tool is the current scaffolding CLI for SvelteKit projects.

### 2. Svelte 5 syntax is required

The SvelteKit scaffold generates Svelte 5 code. All `.svelte` files must use Svelte 5 syntax (`$state`, `$derived`, `$props`, `onclick`, `{@render children()}`). Using Svelte 4 syntax (`on:click`, `export let`, `<slot />`, reactive `$:` statements) will produce warnings or errors.

### 3. Strict HTML nesting enforcement

Svelte 5 enforces strict HTML nesting rules at compile time. `<tr>` directly inside `<table>` causes a compilation error (`node_invalid_placement`). Always wrap table rows in `<tbody>`.

### 4. pnpm strict dependency resolution

The Temporal workflow file imports from `'xstate'` directly (inside the V8 isolate), but XState was only declared as a dependency of `@coffeeshop/shared`. pnpm's strict hoisting meant `@coffeeshop/temporal` couldn't see it.

Fix: `pnpm add -F @coffeeshop/temporal xstate`

### 5. Temporal query handler race condition

When the workflow is started, there's a race between the client querying state and the workflow registering the query handler. The first query can fail with `QueryNotRegisteredError`.

Fix: Implement retry logic in the test client and a 500ms delay in the API route after starting a workflow.

### 6. Polling produces duplicate state history entries

The signal response immediately updates client state, then the next poll tick sees the same state and records it again.

Fix: Guard against duplicate entries in state history using `!stateHistory.some((h) => h.state === currentState)`.

### 7. Workflow status shows RUNNING after completion

After the final signal (`drinkCollected`), the workflow still needs to execute `completeOrder` and return. The polling may catch `state: collected` (from XState) before the workflow finishes.

Fix: After sending the final signal, wait 500ms and do one extra `fetchState()` call to catch the COMPLETED workflow status before stopping the poll.

### 8. SvelteKit tsconfig is independent

The web package's `tsconfig.json` extends `.svelte-kit/tsconfig.json`, NOT the project's `tsconfig.base.json`. SvelteKit generates its own tsconfig and manages TypeScript compilation through Vite. This is correct and should not be changed.

### 9. Cannot query completed workflows

Temporal workflow queries only work while the workflow is RUNNING. Once the workflow completes, `handle.query()` throws an error. The GET API route handles this by checking `description.status.name` and returning `state: 'collected'` directly for completed workflows.

### 10. `$app/state` vs `$app/stores`

Svelte 5 / SvelteKit introduces `$app/state` as the replacement for `$app/stores`. The `page` object from `$app/state` is accessed directly (not as a store with `$` prefix). However, some component libraries (Flowbite Svelte as of v1.6.4) still depend on `$app/stores` internally. For the demonstrator (no component library), `$app/state` is used exclusively.

---

## Final directory structure

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
│   ├── fulfil-drink-pathway.svg
│   ├── order-lifecycle-machine.ts
│   └── types.ts
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json                   # extends ../../tsconfig.base.json
│   │   └── src/
│   │       ├── generated/
│   │       │   ├── order-lifecycle-machine.ts
│   │       │   └── types.ts
│   │       ├── workflow-constants.ts       # Signal/query/task queue constants
│   │       └── index.ts
│   ├── temporal/
│   │   ├── package.json
│   │   ├── tsconfig.json                   # extends ../../tsconfig.base.json
│   │   └── src/
│   │       ├── activities/
│   │       │   └── barista.ts
│   │       ├── workflows/
│   │       │   └── fulfil-drink.ts         # Generated + XState + query handler
│   │       ├── workers/
│   │       │   └── worker.ts
│   │       └── client/
│   │           └── start-order.ts
│   └── web/
│       ├── package.json
│       ├── svelte.config.js
│       ├── vite.config.ts
│       ├── tsconfig.json                   # extends .svelte-kit/tsconfig.json
│       ├── static/
│       │   └── robots.txt
│       └── src/
│           ├── app.html
│           ├── app.d.ts
│           ├── lib/
│           │   ├── assets/
│           │   │   └── favicon.svg
│           │   ├── index.ts
│           │   └── server/
│           │       └── temporal.ts         # Temporal client singleton
│           └── routes/
│               ├── +layout.svelte          # Svelte 5: $props() + {@render}
│               ├── +page.svelte            # Order form
│               ├── orders/
│               │   └── [id]/
│               │       └── +page.svelte    # Order status + action buttons
│               └── api/
│                   └── orders/
│                       ├── +server.ts      # POST: start workflow
│                       └── [id]/
│                           ├── +server.ts  # GET: query state
│                           └── signal/
│                               └── +server.ts  # POST: send signal
├── pnpm-workspace.yaml
├── package.json                            # Root: scripts, workspace config
├── tsconfig.base.json                      # Shared TS options (shared + temporal)
└── coffeeshop-demonstrator-spec.md
```

---

## Dependency versions (as installed)

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
| @sveltejs/vite-plugin-svelte | latest | web |
| vite | 7.3.1 | web |

---

## How to run the project

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

## Phase C exit criterion: MET

| Criterion | Evidence |
|---|---|
| Order placed via web UI | Order form submits, workflow starts, redirect to status page |
| Workflow steps progressed via UI buttons | Each signal button advances the workflow and state |
| State changes visible in real time | Polling updates the displayed state within 2 seconds |
| XState validates transitions | Only valid buttons shown per state |
| Temporal durable execution | Worker killed mid-flow, restarted, workflow completed (Workers: 2 in Temporal UI) |

An order can be placed in the web UI, progressed through all workflow steps via UI buttons, with state changes visible in real time. Worker restart mid-workflow does not lose progress.

**Verified: 3 March 2026**

---

## Concepts validated

| Concept | Validation |
|---|---|
| XState pure functions in Temporal V8 isolate | `initialTransition()` and `transition()` are deterministic, bundled successfully (161 KiB) |
| Temporal queries for state visibility | `defineQuery` + `setHandler` exposes XState state to external clients |
| pnpm workspace monorepo | Three packages with workspace dependencies, atomic builds |
| String-based signal/query sharing | Constants in @coffeeshop/shared used by both Temporal workflow and SvelteKit API routes |
| Stateless front end | SvelteKit reads state via Temporal queries — no state ownership in browser |
| Durable execution through full stack | Worker restart mid-workflow, UI recovers via polling, workflow completes on new worker |

These patterns transfer directly to GenderSense:

- **XState pure transitions** → clinical pathway lifecycle validation inside Temporal workflows
- **Temporal queries** → pathway state visibility for clinician dashboards
- **Stateless web layer** → clinical UI can be replaced or extended without touching pathway logic
- **Signal-based progression** → clinical events (lab results, clinician decisions, patient attendance) advance pathways
- **Durable execution** → long-running clinical pathways (weeks/months) survive infrastructure changes
- **pnpm workspace monorepo** → shared types and domain models across clinical and web packages

---

## Cleanup items

The following should be done when convenient:

- Pin `svelte`, `@sveltejs/kit`, `@sveltejs/adapter-auto`, `@sveltejs/vite-plugin-svelte`, and `vite` to specific versions in `packages/web/package.json` (currently `"latest"`)
- Consider adding an orders list page (`/orders`) showing recent workflows via Temporal's `listWorkflows` API
- Consider SSE (Server-Sent Events) for real-time updates instead of polling if latency becomes unacceptable
- Run `pnpm approve-builds` to suppress native addon build script warnings
