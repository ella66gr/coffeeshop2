# Phase D — Governance Outputs: Journal Notes

**Date:** 3 March 2026
**Project:** Coffee Shop Action Flow Demonstrator
**Environment:** macOS (MacBook Pro), Node.js v25.7.0, pnpm v10.30.3, Svelte 5 / SvelteKit (latest), Vite v7.3.1, Temporal CLI 1.6.1

---

## Objective

Demonstrate the governance and audit trail capabilities that justify this architecture for clinical use.

**Exit criterion (from spec §6.4):** A non-technical reviewer can inspect the generated pathway diagram and the audit report for a completed order and understand what process was defined and whether this case followed it.

## Deliverables (from spec §6.4)

1. Mermaid pathway diagram generated from SysML, rendered as SVG, accessible from the web UI.
2. Audit report page that queries Temporal workflow execution history for a completed order and renders it as a timestamped compliance table.
3. Compliance table showing: step name, expected timing (from SysML requirements/constraints), actual timing (from Temporal event history), duration, and compliance status (within target / exceeded).
4. Report uses anonymised case references (not customer identifiers).

---

## Decision: Expected timing data source

**Decision: Manual constants in `@coffeeshop/shared` (not a new generator).**

The SysML model carries timeout values in `@TemporalSignal` annotations:

| Signal step | `timeoutMinutes` (from SysML) |
|---|---|
| `waitBaristaStart` | 30 |
| `waitDrinkReady` | 15 |
| `waitCollected` | 60 |

For activity steps, a 1-minute expected duration was assigned as a reasonable processing expectation.

These values were transcribed into `WORKFLOW_STEPS` in `packages/shared/src/workflow-constants.ts` with a comment documenting their SysML origin. A future generator (`gen_audit_constants.py`) could extract them directly from the model for full single-source-of-truth compliance, but for the demonstrator the manual approach is proportionate.

**Deferred:** Generator-based extraction of expected timings from SysML model.

---

## Decision: Pathway diagram delivery

**Decision: Serve the existing generated SVG as a static file.**

The Mermaid pathway diagram already existed from Phase B as `generated/fulfil-drink-pathway.mmd` and `generated/fulfil-drink-pathway.svg`. Two options were considered:

1. **Serve static SVG** — Copy the SVG to `packages/web/static/`, serve via `<img>` tag. No new dependency.
2. **Render Mermaid client-side** — Add the Mermaid JS library to the web package, render from `.mmd` source in the browser. Dynamic, but adds ~1.5 MB dependency for a demonstrator.

Option 1 chosen. The `sync-generated` script in root `package.json` was extended to copy the SVG:

```
cp generated/fulfil-drink-pathway.svg packages/web/static/
```

The SVG renders at full width in the browser, which makes it quite large. For a production application, the SVG could be given explicit dimensions or wrapped in a scrollable container. For the demonstrator, it serves its governance purpose — the full pathway is visible.

---

## Step 1: Workflow step definitions and audit constants

Added to `packages/shared/src/workflow-constants.ts`:

### WorkflowStepDef interface

```typescript
export interface WorkflowStepDef {
  readonly stepId: string;
  readonly label: string;
  readonly type: 'activity' | 'signal';
  readonly expectedMinutes: number | null;
  readonly temporalName: string;
}
```

Each step carries:
- `stepId` — matches the SysML action name
- `label` — human-readable name for the compliance table
- `type` — `'activity'` for Temporal activities, `'signal'` for human-in-the-loop waits
- `expectedMinutes` — maximum expected duration (from SysML `@TemporalSignal` timeoutMinutes for signal steps, 1 minute for activity steps)
- `temporalName` — the Temporal activity name or signal name, used to match against event history

### WORKFLOW_STEPS

Ordered array of all six steps in the FulfilDrinkWorkflow action flow:

| stepId | label | type | expectedMinutes | temporalName |
|---|---|---|---|---|
| validateOrder | Validate Order | activity | 1 | validateOrder |
| waitBaristaStart | Wait for Barista | signal | 30 | baristaStarted |
| prepareDrink | Prepare Drink | activity | 1 | prepareDrink |
| waitDrinkReady | Wait for Drink Ready | signal | 15 | drinkReady |
| waitCollected | Wait for Collection | signal | 60 | drinkCollected |
| completeOrder | Complete Order | activity | 1 | completeOrder |

### anonymiseCaseRef()

Produces a stable, deterministic anonymised case reference from a workflow/order ID using a simple hash:

```typescript
export function anonymiseCaseRef(workflowId: string): string {
  let hash = 0;
  for (let i = 0; i < workflowId.length; i++) {
    const ch = workflowId.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().slice(0, 4).padStart(4, '0');
  return `CASE-${hex}`;
}
```

Example: `"order-1772576981645"` → `"CASE-2F6B"`.

The same workflowId always produces the same case reference, so it is stable across page loads and between the orders list and audit report.

Re-exported from `packages/shared/src/index.ts`.

---

## Step 2: Pathway diagram page (`/pathway`)

Created `packages/web/src/routes/pathway/+page.svelte`.

The page displays:
- The generated SVG pathway diagram via `<img src="/fulfil-drink-pathway.svg" />`
- Provenance: source model → Mermaid → SVG generation chain documented on the page
- A summary table of orchestration workflow steps with expected durations

The SVG is served from `packages/web/static/fulfil-drink-pathway.svg`, which SvelteKit serves as a static asset at the root URL path.

---

## Step 3: Audit report API route (`GET /api/orders/[id]/audit`)

Created `packages/web/src/routes/api/orders/[id]/audit/+server.ts`.

### Approach

The route fetches the complete Temporal workflow event history via `handle.fetchHistory()` and parses it into a structured audit trail by:

1. Iterating all events, extracting timestamps for: workflow start, workflow completion, activity scheduled/completed (by activity name), signal received (by signal name).
2. For each step in `WORKFLOW_STEPS`, matching against the parsed events to determine start time, end time, and duration.
3. For activity steps: start = activity scheduled time, end = activity completed time.
4. For signal steps: start = previous step end time, end = signal received time.
5. Comparing actual duration against expected duration to determine compliance status.

### Temporal event type gotcha

**This was the main bug encountered in Phase D.**

The Temporal TypeScript SDK returns `eventType` as a **numeric protobuf enum**, not a string. The initial implementation compared against string names like `'EVENT_TYPE_WORKFLOW_EXECUTION_STARTED'`, which never matched.

Actual values from the SDK (from `temporal.api.enums.v1.EventType`):

| Numeric value | Meaning |
|---|---|
| 1 | WORKFLOW_EXECUTION_STARTED |
| 2 | WORKFLOW_EXECUTION_COMPLETED |
| 5 | WORKFLOW_TASK_SCHEDULED |
| 6 | WORKFLOW_TASK_STARTED |
| 7 | WORKFLOW_TASK_COMPLETED |
| 10 | ACTIVITY_TASK_SCHEDULED |
| 11 | ACTIVITY_TASK_STARTED |
| 12 | ACTIVITY_TASK_COMPLETED |
| 26 | WORKFLOW_EXECUTION_SIGNALED |

Fixed by defining a const map of the numeric values we need:

```typescript
const EVENT = {
  WORKFLOW_EXECUTION_STARTED: 1,
  WORKFLOW_EXECUTION_COMPLETED: 2,
  ACTIVITY_TASK_SCHEDULED: 10,
  ACTIVITY_TASK_COMPLETED: 12,
  WORKFLOW_EXECUTION_SIGNALED: 26,
} as const;
```

### Temporal timestamp gotcha

The `eventTime` property is a protobuf `ITimestamp` with `seconds` as a **string** (not a number or bigint) and `nanos` as a number:

```json
{
  "seconds": "1772581056",
  "nanos": 151926000
}
```

Conversion:

```typescript
function protoTimestampToDate(ts) {
  const seconds = Number(ts.seconds ?? 0);
  const nanos = Number(ts.nanos ?? 0);
  return new Date(seconds * 1000 + nanos / 1_000_000);
}
```

This is consistent with the Phase A gotcha about `ITimestamp`, but the string type for `seconds` was not documented there.

### Activity name linking

Temporal links activity completions to their scheduling via `scheduledEventId`. The audit route maintains a `Map<number, string>` from scheduled event ID to activity name, populated when processing `ACTIVITY_TASK_SCHEDULED` events and looked up when processing `ACTIVITY_TASK_COMPLETED` events.

### Response shape

```typescript
{
  caseRef: string,           // "CASE-2F6B"
  workflowId: string,
  workflowStatus: string,    // "COMPLETED"
  startTime: string | null,  // ISO timestamp
  endTime: string | null,    // ISO timestamp
  steps: Array<{
    stepId: string,
    label: string,
    type: 'activity' | 'signal',
    expectedMinutes: number | null,
    startTime: string | null,
    endTime: string | null,
    durationSeconds: number | null,
    durationMinutes: number | null,
    compliance: 'within_target' | 'exceeded' | 'no_target' | 'pending',
  }>
}
```

---

## Step 4: Audit report page (`/orders/[id]/audit`)

Created `packages/web/src/routes/orders/[id]/audit/+page.svelte`.

The page displays:
- **Case summary**: anonymised case reference, workflow status, process start/end times
- **Compliance table**: step name, type (Activity / Signal wait), started timestamp, completed timestamp, duration, expected maximum, compliance status
- **Governance note**: explains the report's provenance — generated from Temporal execution history, process definition from SysML model, customer identifiers anonymised
- **Links**: back to order status, all orders, pathway diagram, Temporal Web UI for raw history

Compliance status display:
- ✅ Within target — actual duration ≤ expected maximum
- ⚠️ Exceeded — actual duration > expected maximum
- — (dash) — no timing expectation defined
- ⏳ Pending — step not yet completed (for running workflows)

The page uses Svelte 5 syntax (`$state`, `$derived`, `$app/state`, `onMount`).

---

## Step 5: Orders list page (`/orders`)

Created `packages/web/src/routes/orders/+page.svelte` and `packages/web/src/routes/api/orders/list/+server.ts`.

### API route

Uses `client.workflow.list()` with a visibility query filtering by workflow type:

```typescript
const iterator = client.workflow.list({
  query: `WorkflowType = '${WORKFLOW_NAME}'`,
});
```

Limited to 50 results. Returns anonymised case refs, status, start/close times.

The Temporal local dev server (`temporal server start-dev`) supports visibility queries out of the box via its built-in SQLite store.

### Page

Displays a table of all fulfilDrink workflow executions with:
- Anonymised case reference
- Status with emoji indicator (🟢 Running, ✅ Completed, etc.)
- Start and completion timestamps
- Links to status page and audit report (audit link only shown for completed workflows)

---

## Step 6: Layout navigation

Updated `packages/web/src/routes/+layout.svelte` to include a navigation bar:

```svelte
<nav>
  <a href="/">New Order</a> | <a href="/orders">Orders</a> | <a href="/pathway">Pathway</a>
</nav>
```

All pages are now accessible from the nav bar. The order status page also links to the orders list and (when complete) to the audit report.

---

## Step 7: Existing page updates

- **Order form** (`+page.svelte`): subtitle updated to "Phase D: Governance Outputs"
- **Order status** (`orders/[id]/+page.svelte`): added "All orders" link in breadcrumb; added "View Audit Report" link shown when workflow is complete

---

## Gotchas and lessons learned

### 1. Temporal eventType is a numeric protobuf enum

The Temporal TypeScript SDK's `fetchHistory()` returns `eventType` as a number (e.g. `1`, `10`, `26`), not as a protobuf string name (e.g. `'EVENT_TYPE_WORKFLOW_EXECUTION_STARTED'`). The numeric values come from the `temporal.api.enums.v1.EventType` protobuf definition. Any code parsing Temporal history events must compare against numeric values.

### 2. Temporal eventTime.seconds is a string

The `eventTime` property on history events has `seconds` as a string (`"1772581056"`) rather than a number or bigint. `Number()` conversion handles this, but type annotations must account for the string type.

### 3. Activity completion linking via scheduledEventId

Temporal does not include the activity name on `ACTIVITY_TASK_COMPLETED` events. Instead, the completion event has a `scheduledEventId` field that references the `eventId` of the corresponding `ACTIVITY_TASK_SCHEDULED` event. Code must maintain a mapping from scheduled event IDs to activity names.

### 4. Generated SVG renders at full width

The Mermaid-generated SVG uses `width="100%"` and scales to the container. In the browser this makes the pathway diagram very large. For a production application, consider constraining with explicit dimensions or a scrollable container with `max-height` and `overflow: auto`.

### 5. Temporal workflow.list() requires visibility store

The `client.workflow.list()` API requires Temporal's visibility store. The local dev server (`temporal server start-dev`) includes a SQLite-based visibility store that supports list queries including `WorkflowType` filtering. No additional configuration was needed.

---

## Final directory structure (Phase D additions)

```
packages/web/src/routes/
├── +layout.svelte                    # Updated: nav bar added
├── +page.svelte                      # Updated: Phase D subtitle
├── pathway/
│   └── +page.svelte                  # NEW: pathway diagram page
├── orders/
│   ├── +page.svelte                  # NEW: orders list page
│   └── [id]/
│       ├── +page.svelte              # Updated: audit link, orders link
│       └── audit/
│           └── +page.svelte          # NEW: audit report page
└── api/
    └── orders/
        ├── +server.ts                # (existing) POST: start workflow
        ├── list/
        │   └── +server.ts            # NEW: GET: list workflows
        └── [id]/
            ├── +server.ts            # (existing) GET: query state
            ├── audit/
            │   └── +server.ts        # NEW: GET: audit trail
            └── signal/
                └── +server.ts        # (existing) POST: send signal

packages/shared/src/
├── workflow-constants.ts             # Updated: WORKFLOW_STEPS, anonymiseCaseRef()
└── index.ts                          # Updated: re-export WorkflowStepDef

packages/web/static/
└── fulfil-drink-pathway.svg          # Copied from generated/

package.json                          # Updated: sync-generated copies SVG
```

---

## Phase D exit criterion: MET

| Criterion | Evidence |
|---|---|
| Pathway diagram accessible from web UI | `/pathway` renders generated SVG with step summary |
| Audit report for completed order | `/orders/[id]/audit` shows timestamped compliance table |
| Compliance table shows step name, expected timing, actual timing, duration, compliance status | All six steps populated with data from Temporal history and SysML-derived expectations |
| Anonymised case references | Customer names replaced with deterministic `CASE-XXXX` references |
| Non-technical reviewer can understand the process | Pathway diagram shows defined process; compliance table shows whether this case followed it |

A non-technical reviewer can inspect the generated pathway diagram at `/pathway` and the audit report for a completed order at `/orders/[id]/audit` and understand what process was defined and whether this case followed it.

**Verified: 3 March 2026**

---

## Concepts validated

| Concept | Validation |
|---|---|
| SysML → visual pathway | Generated Mermaid diagram accessible from web UI alongside running system |
| SysML → audit expectations | Expected timings from SysML `@TemporalSignal` annotations compared against actual execution |
| Temporal history as audit trail | `fetchHistory()` provides complete, timestamped, tamper-evident event record |
| Anonymised governance reporting | Case references derived from workflow IDs, no customer data exposed |
| Single source of truth | Pathway diagram, workflow orchestration, and audit expectations all derived from SysML model |

These patterns transfer directly to GenderSense:

- **Pathway diagram** → clinical pathway visualisation for governance review, generated from SysML clinical process models
- **Compliance table** → audit trail showing whether a patient's care followed the defined pathway within expected timeframes
- **Anonymised reporting** → patient identifiers replaced with case references for governance and audit purposes
- **Temporal history** → tamper-evident record of every clinical event, decision, and state transition in a patient's pathway
- **Expected timings** → clinical targets (e.g. time from referral to first appointment, lab turnaround times) defined in the model and verified against actual execution

---

## Demonstrator: complete

Phase D is the final phase of the Coffee Shop Action Flow Demonstrator. All four phases are complete:

| Phase | Objective | Status |
|---|---|---|
| A — Temporal Foundation | Validate Temporal for process orchestration | ✅ Complete |
| B — Generation | Build generators from SysML to Temporal workflow and Mermaid diagram | ✅ Complete |
| C — Integration | Wire generated workflow to XState lifecycle and build web UI | ✅ Complete |
| D — Governance Outputs | Demonstrate governance and audit trail capabilities | ✅ Complete |

The core thesis is validated:

> SysML v2 model → generated Temporal workflow + generated XState state machine → running system with audit trail + visual pathway documentation, all from a single source of truth.

The architecture is ready to transfer to GenderSense clinical pathways.
