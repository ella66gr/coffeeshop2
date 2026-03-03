# Phase A — Temporal Foundation: Journal Notes

**Date:** 3 March 2026
**Project:** Coffee Shop Action Flow Demonstrator
**Environment:** macOS (MacBook Pro), Node.js v25.7.0

---

## Objective

Validate that Temporal works for process orchestration before investing in generators.
Hand-code a Temporal workflow based on the FulfilDrink action flow. No generation. Get
comfortable with how Temporal feels.

## Deliverables (from spec section 6.1)

1. Temporal CLI installed and local dev server running.
2. TypeScript project scaffolded with Temporal SDK dependencies.
3. Hand-written FulfilDrink workflow with activities and signal-based waits.
4. Test script that starts a workflow, sends signals to simulate barista/customer actions,
   and prints the execution history.
5. Verification that worker restart mid-workflow does not lose progress.

**Exit criterion:** A complete order fulfilment workflow runs end-to-end via Temporal with
durable execution confirmed.

---

## Step 1: Install Temporal CLI

```bash
brew install temporal
```

This installs the Temporal CLI and adds it to the PATH automatically.

### Verify installation

```bash
temporal server start-dev
```

Expected output:

```
Temporal CLI 1.6.1 (Server 1.30.1, UI 2.45.3)

Temporal Server:  localhost:7233
Temporal UI:      http://localhost:8233
Temporal Metrics: http://localhost:58341/metrics
```

The web UI should be accessible at http://localhost:8233 showing an empty default
namespace.

**Note:** The spec references `temporal server start-lite` which was the older command
name. Current versions use `temporal server start-dev`. They are equivalent.

Stop the server with Ctrl+C when done verifying. You will restart it later.

---

## Step 2: Scaffold the TypeScript project

### Create directory and initialise

```bash
mkdir coffeeshop-demonstrator && cd coffeeshop-demonstrator
npm init -y
```

### Install Temporal SDK packages

**Important:** Ensure all four package names are on one line or properly continued with
backslash. A line break mid-package-name (e.g. splitting `@temporalio/activity` across
lines) will cause an `EINVALIDTAGNAME` error.

```bash
npm install @temporalio/client @temporalio/worker @temporalio/workflow @temporalio/activity
```

### Install development dependencies

```bash
npm install -D typescript @types/node ts-node
```

### Initialise TypeScript

```bash
npx tsc --init
```

### Configure package.json for ESM

The default `npm init -y` creates `"type": "commonjs"`. This must be changed to
`"type": "module"` because the project uses ESM imports and the tsconfig uses
`"module": "nodenext"`.

In `package.json`, change:

```json
"type": "module"
```

**Why this matters:** Without this, Node.js treats `.js` files as CommonJS and will throw
`SyntaxError: Cannot use import statement outside a module` when running compiled output.

### Configure tsconfig.json

Replace the generated `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",

    "module": "nodenext",
    "target": "esnext",

    "lib": ["esnext"],
    "types": ["node"],

    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,

    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,

    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true,
    "moduleDetection": "force",
    "skipLibCheck": true
  }
}
```

**Key points:**

- `"types": ["node"]` must not be an empty array `[]`, otherwise TypeScript will not
  pick up `@types/node` and the Temporal SDK will fail to compile.
- `"module": "nodenext"` requires `.js` extensions in import paths even when importing
  `.ts` source files. This is a TypeScript/Node ESM convention.
- `"exactOptionalPropertyTypes": true` is stricter than many libraries expect.
  `"skipLibCheck": true` absorbs most issues this causes with third-party types.
- `"verbatimModuleSyntax": true` enforces `import type` for type-only imports. May
  cause friction with some SDK patterns.
- `"jsx": "react-jsx"` is not needed for Phase A. Will be needed when SvelteKit is
  added in Phase C.

### Create source directory structure

```bash
mkdir -p src/activities src/workflows src/workers src/client
```

---

## Step 3: Write the source files

### src/activities/barista.ts

```typescript
/**
 * Barista Activities — Hand-written Phase A implementation
 *
 * These are the activity implementations for the FulfilDrink workflow.
 * Activities contain the actual business logic and are the only place
 * where side effects (logging, I/O, etc.) are permitted.
 *
 * In later phases, activity function *signatures* will be generated
 * from the SysML model; the *bodies* remain hand-written.
 */

import { log } from '@temporalio/activity';

// Types (hand-written for Phase A; generated from SysML in Phase B)

export interface OrderDetails {
  orderId: string;
  customerName: string;
  drinkType: string;
  size: 'small' | 'medium' | 'large';
}

export interface OrderResult {
  orderId: string;
  status: string;
  timestamp: string;
}

// Activities

/**
 * Validate the incoming order.
 * Maps to the first step of the FulfilDrink action flow.
 */
export async function validateOrder(order: OrderDetails): Promise<OrderResult> {
  log.info('Validating order', { orderId: order.orderId, drinkType: order.drinkType });

  if (!order.drinkType || !order.customerName) {
    throw new Error(`Invalid order ${order.orderId}: missing required fields`);
  }

  return {
    orderId: order.orderId,
    status: 'validated',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Prepare the drink.
 * Called after the barista signals that they have started preparation.
 */
export async function prepareDrink(order: OrderDetails): Promise<OrderResult> {
  log.info('Preparing drink', {
    orderId: order.orderId,
    drinkType: order.drinkType,
    size: order.size,
  });

  return {
    orderId: order.orderId,
    status: 'prepared',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Complete the order after customer collection.
 * Final step in the FulfilDrink action flow.
 */
export async function completeOrder(order: OrderDetails): Promise<OrderResult> {
  log.info('Completing order', { orderId: order.orderId });

  return {
    orderId: order.orderId,
    status: 'completed',
    timestamp: new Date().toISOString(),
  };
}
```

### src/workflows/fulfil-drink.ts

```typescript
/**
 * FulfilDrink Workflow — Hand-written Phase A implementation
 *
 * This workflow orchestrates the drink fulfilment process, mapping
 * directly to the SysML FulfilDrink action flow. In Phase B, this
 * file will be *generated* from the SysML model.
 *
 * Workflow code runs in a sandboxed V8 isolate. It must be
 * deterministic: no I/O, no Date.now(), no Math.random().
 * All side effects happen in activities.
 *
 * The three signal-based waits correspond to human-in-the-loop
 * steps in the action flow:
 *   1. Barista starts preparation
 *   2. Barista marks drink ready
 *   3. Customer collects drink
 *
 * These map directly to the Temporal signal pattern that will
 * support clinical pathway waits (e.g. lab results returned,
 * clinician review completed) in GenderSense.
 */

import {
  proxyActivities,
  defineSignal,
  setHandler,
  condition,
  log,
} from '@temporalio/workflow';

import type * as activities from '../activities/barista.js';

// Activity proxy

const {
  validateOrder,
  prepareDrink,
  completeOrder,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 3,
  },
});

// Signal definitions
// Each signal represents an external event that advances the workflow.

/** Barista has started making the drink */
export const baristaStartedSignal = defineSignal('baristaStarted');

/** Barista has finished making the drink — it is ready for collection */
export const drinkReadySignal = defineSignal('drinkReady');

/** Customer has collected the drink */
export const drinkCollectedSignal = defineSignal('drinkCollected');

// Workflow function

export async function fulfilDrink(order: activities.OrderDetails): Promise<string> {
  let baristaStarted = false;
  let drinkReady = false;
  let drinkCollected = false;

  // Register signal handlers
  setHandler(baristaStartedSignal, () => {
    log.info('Signal received: barista started', { orderId: order.orderId });
    baristaStarted = true;
  });

  setHandler(drinkReadySignal, () => {
    log.info('Signal received: drink ready', { orderId: order.orderId });
    drinkReady = true;
  });

  setHandler(drinkCollectedSignal, () => {
    log.info('Signal received: drink collected', { orderId: order.orderId });
    drinkCollected = true;
  });

  // Step 1: Validate the order
  log.info('Workflow started: fulfilDrink', { orderId: order.orderId });
  const validationResult = await validateOrder(order);
  log.info('Order validated', {
    orderId: order.orderId,
    result: validationResult.status,
  });

  // Step 2: Wait for barista to start preparation
  log.info('Waiting for barista to start preparation', { orderId: order.orderId });
  await condition(() => baristaStarted);

  // Step 3: Prepare the drink
  const prepResult = await prepareDrink(order);
  log.info('Drink preparation recorded', {
    orderId: order.orderId,
    result: prepResult.status,
  });

  // Step 4: Wait for barista to mark drink as ready
  log.info('Waiting for drink to be marked ready', { orderId: order.orderId });
  await condition(() => drinkReady);

  // Step 5: Wait for customer to collect
  log.info('Waiting for customer to collect drink', { orderId: order.orderId });
  await condition(() => drinkCollected);

  // Step 6: Complete the order
  const completionResult = await completeOrder(order);
  log.info('Order completed', {
    orderId: order.orderId,
    result: completionResult.status,
  });

  return `Order ${order.orderId} fulfilled successfully`;
}
```

### src/workers/worker.ts

```typescript
/**
 * Temporal Worker — Phase A
 *
 * The worker hosts workflow and activity code and polls the Temporal
 * server for tasks. Workflows run in a sandboxed V8 isolate (hence
 * workflowsPath rather than a direct import), while activities run
 * in the normal Node.js environment.
 *
 * Task queue name 'coffeeshop' is shared between worker and client
 * so Temporal routes work to the correct worker(s).
 */

import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from '../activities/barista.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASK_QUEUE = 'coffeeshop';

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: 'localhost:7233',
  });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: TASK_QUEUE,

    // Workflows are loaded by path and bundled into the V8 isolate.
    // This is a Temporal requirement — workflows cannot be imported directly.
    // The path must resolve to the *compiled* .js file in dist/.
    workflowsPath: path.resolve(__dirname, '../workflows/fulfil-drink.js'),

    // Activities are passed directly as they run in normal Node.js.
    activities,
  });

  console.log(`Worker started, polling task queue: ${TASK_QUEUE}`);
  console.log('Press Ctrl+C to stop.');

  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
```

**Key point — ESM compatibility:** The original implementation used `require.resolve()`
for `workflowsPath`, which does not exist in ESM mode (`"type": "module"`). The fix is
to derive `__dirname` from `import.meta.url` using `fileURLToPath` and `path.dirname`,
then use `path.resolve()` to construct the path to the compiled workflow file.

### src/client/start-order.ts

```typescript
/**
 * Start Order Test Script — Phase A
 *
 * Phase A deliverable #4: a test script that starts a workflow,
 * sends signals to simulate barista/customer actions, and prints
 * the execution history.
 *
 * Run this while the worker is running in another terminal.
 */

import { Client, Connection } from '@temporalio/client';
import { fulfilDrink } from '../workflows/fulfil-drink.js';
import {
  baristaStartedSignal,
  drinkReadySignal,
  drinkCollectedSignal,
} from '../workflows/fulfil-drink.js';

const TASK_QUEUE = 'coffeeshop';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(): Promise<void> {
  const connection = await Connection.connect({
    address: 'localhost:7233',
  });

  const client = new Client({ connection });

  const orderId = `order-${Date.now()}`;

  console.log(`\n=== Starting FulfilDrink workflow ===`);
  console.log(`Order ID: ${orderId}\n`);

  const handle = await client.workflow.start(fulfilDrink, {
    taskQueue: TASK_QUEUE,
    workflowId: orderId,
    args: [
      {
        orderId,
        customerName: 'Ella',
        drinkType: 'flat white',
        size: 'medium' as const,
      },
    ],
  });

  console.log(`Workflow started (workflowId: ${handle.workflowId})`);
  console.log(
    `View in Temporal UI: http://localhost:8233/namespaces/default/workflows/${handle.workflowId}\n`
  );

  // Simulate the human-in-the-loop steps with pauses between them.
  console.log('Waiting 2s before barista starts...');
  await sleep(2000);

  console.log('>>> Sending signal: baristaStarted');
  await handle.signal(baristaStartedSignal);

  console.log('Waiting 3s while drink is being prepared...');
  await sleep(3000);

  console.log('>>> Sending signal: drinkReady');
  await handle.signal(drinkReadySignal);

  console.log('Waiting 2s before customer collects...');
  await sleep(2000);

  console.log('>>> Sending signal: drinkCollected');
  await handle.signal(drinkCollectedSignal);

  // Wait for completion
  const result = await handle.result();
  console.log(`\n=== Workflow completed ===`);
  console.log(`Result: ${result}\n`);

  // Print the execution history
  console.log('=== Workflow Execution History ===\n');

  const { events } = await handle.fetchHistory();
  for (const event of events ?? []) {
    // ITimestamp requires conversion — it is a protobuf timestamp,
    // not a JS Date. Convert seconds + nanos to a readable string.
    const seconds = Number(
      event.eventTime?.seconds?.low ?? event.eventTime?.seconds ?? 0
    );
    const timestamp =
      seconds > 0 ? new Date(seconds * 1000).toISOString() : 'unknown';
    const eventType = event.eventType ?? 'UNKNOWN';
    console.log(`  [${timestamp}] ${eventType}`);
  }

  console.log('\n=== Done ===');
}

run().catch((err) => {
  console.error('Test script failed:', err);
  process.exit(1);
});
```

**Note on fetchHistory():** The original code used `handle.fetchHistory()` as an async
iterable (`for await...of`). This is incorrect. `fetchHistory()` returns
`Promise<IHistory>`, not an async iterator. The fix is
`const { events } = await handle.fetchHistory()` followed by a regular `for...of` loop.

**Note on eventTime:** The `eventTime` field is a protobuf `ITimestamp` (with `seconds`
and `nanos` fields), not a JS `Date`. Calling `.toISOString()` directly on it will fail
at compile time. The timestamp must be converted manually. The exact shape may vary
depending on the protobuf library version. Check your actual compiled output if the
timestamps appear wrong.

---

## Step 4: Compile and run

### Build

```bash
npx tsc
```

This compiles `src/` into `dist/`. Verify no errors.

### Run (requires three terminal windows)

**Terminal 1 — Temporal server:**

```bash
temporal server start-dev
```

**Terminal 2 — Worker:**

```bash
node dist/workers/worker.js
```

Expected output:

```
Worker started, polling task queue: coffeeshop
Press Ctrl+C to stop.
```

**Terminal 3 — Test script:**

```bash
node dist/client/start-order.js
```

Expected output: the workflow progresses through the three signals with pauses, prints
the result ("fulfilled successfully"), and lists the execution history events.

### Verify in Temporal Web UI

Open http://localhost:8233 and navigate to the completed workflow. You should see:

- Workflow Type: fulfilDrink
- Task Queue: coffeeshop
- Status: Completed
- Event History: approximately 35 events including validateOrder, baristaStarted signal,
  prepareDrink, drinkReady signal, drinkCollected signal, completeOrder
- Input: JSON showing orderId, customerName, drinkType, size
- Result: "Order {orderId} fulfilled successfully"

---

## Step 5: Verify durable execution (worker restart)

This validates Phase A deliverable #5.

1. Ensure the Temporal server is running (Terminal 1).
2. Start the worker (Terminal 2): `node dist/workers/worker.js`
3. Start a workflow (Terminal 3): `node dist/client/start-order.js`
4. Wait for the first signal ("baristaStarted") to be sent by the test script.
5. **Kill the worker** (Ctrl+C in Terminal 2) while the workflow is still running.
6. **Restart the worker** (Terminal 2): `node dist/workers/worker.js`
7. The test script continues sending remaining signals. The workflow completes.

### What to verify in the Temporal Web UI

- **Workers: 2** — confirms two different worker instances handled this workflow.
- **Workflow Task Timed Out** event in the history — this is the moment the first worker
  died.
- **Status: Completed** — the workflow completed successfully despite the worker restart.
- **Result** is identical to a normal run.

This confirms durable execution: Temporal replayed the workflow from its event history
on the new worker, skipping already-completed steps, and resumed at the exact point
of interruption.

---

## Gotchas and lessons learned

### 1. Package name line breaks

When installing the four `@temporalio/*` packages, ensure the package names are not
split across lines. A line break inside `@temporalio/activity` will cause npm to try
to install a package called `@temporal` which does not exist (EINVALIDTAGNAME).

### 2. ESM module configuration

The project uses ESM (`"type": "module"` in package.json, `"module": "nodenext"` in
tsconfig.json). This has several consequences:

- Import paths must include `.js` extensions even when the source files are `.ts`.
  This is the TypeScript/Node ESM convention. TypeScript resolves `.js` imports to the
  corresponding `.ts` source file during compilation.
- `require()` and `require.resolve()` are not available. Use `import.meta.url` with
  `fileURLToPath` and `path.resolve()` instead.
- `ts-node` requires ESM mode (`node --loader ts-node/esm`) which is experimental
  and can be flaky. The more reliable approach is to compile with `npx tsc` first and
  run from `dist/`.

### 3. Do not use ts-node to run the worker

The simplest and most reliable approach is:

```bash
npx tsc            # compile
node dist/...js    # run compiled output
```

Using `npx ts-node` or `node --loader ts-node/esm` introduces additional failure modes
(module resolution differences, require not defined in ESM, experimental loader
warnings). For development iteration, use `npx tsc --watch` in a separate terminal.

### 4. fetchHistory() API

`handle.fetchHistory()` returns `Promise<IHistory>`, not an async iterable. Use:

```typescript
const { events } = await handle.fetchHistory();
for (const event of events ?? []) { ... }
```

Not:

```typescript
for await (const event of handle.fetchHistory()) { ... }  // WRONG
```

### 5. Protobuf ITimestamp vs JS Date

Event timestamps from Temporal's history API are protobuf `ITimestamp` objects (with
`seconds` and `nanos` fields), not JavaScript Date objects. You cannot call
`.toISOString()` on them directly. Convert the seconds field to a Date first.

### 6. workflowsPath must point to compiled JS

The `workflowsPath` option in `Worker.create()` must resolve to a `.js` file (the
compiled workflow). Temporal's worker bundler reads this file and bundles it into a V8
isolate. It does not understand TypeScript source files.

### 7. tsconfig types array

The default `tsc --init` output may include `"types": []` (empty array). This
explicitly tells TypeScript to include no type packages, which prevents `@types/node`
from being loaded. Change it to `"types": ["node"]`.

---

## Final directory structure

```
coffeeshop-demonstrator/
├── dist/                          # Compiled output (npx tsc)
│   ├── activities/
│   │   └── barista.js
│   ├── workflows/
│   │   └── fulfil-drink.js
│   ├── workers/
│   │   └── worker.js
│   └── client/
│       └── start-order.js
├── src/
│   ├── activities/
│   │   └── barista.ts             # Activity implementations
│   ├── workflows/
│   │   └── fulfil-drink.ts        # Workflow function with signals
│   ├── workers/
│   │   └── worker.ts              # Worker bootstrap
│   └── client/
│       └── start-order.ts         # Test script (deliverable #4)
├── node_modules/
├── package.json                   # "type": "module"
├── package-lock.json
├── tsconfig.json
└── coffeeshop-demonstrator-spec.md
```

---

## Phase A exit criterion: MET

A complete order fulfilment workflow runs end-to-end via Temporal with durable execution
confirmed. Worker restart mid-workflow does not lose progress.

**Verified:** 3 March 2026

---

## Temporal concepts validated

| Concept | Validation |
|---|---|
| Workflow as async function | FulfilDrink workflow is a single async function with sequential steps |
| Activities for side effects | Three activities handle validation, preparation, and completion |
| Signals for human-in-the-loop | Three signals suspend/resume workflow at zero resource cost |
| Durable execution | Worker killed and restarted mid-workflow; workflow completed successfully |
| Event history | Full timestamped history available via API and Web UI |
| Task queue routing | Worker and client share 'coffeeshop' task queue name |

These patterns map directly to the GenderSense clinical pathway requirements:
signals become clinical events (lab results, clinician decisions, patient attendance),
durable execution ensures long-running pathways survive infrastructure changes, and
event history provides the audit trail for governance and compliance.
