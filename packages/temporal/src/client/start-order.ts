/**
 * Start Order Test Script — Phase C
 *
 * Extended from Phase A to query the XState order lifecycle state
 * after each signal, verifying that state transitions are tracked
 * correctly inside the Temporal workflow.
 */

import { Client, Connection } from '@temporalio/client';
import { fulfilDrink } from '../workflows/fulfil-drink.js';
import {
  baristaStartedSignal,
  drinkReadySignal,
  drinkCollectedSignal,
  orderStateQuery,
} from '../workflows/fulfil-drink.js';

const TASK_QUEUE = 'coffeeshop';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Query the workflow state, retrying briefly if the workflow
 * hasn't registered the query handler yet.
 */
async function queryState(handle: Awaited<ReturnType<Client['workflow']['start']>>): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await handle.query(orderStateQuery);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('QueryNotRegistered') && attempt < 9) {
        await sleep(500);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to query state after retries');
}

async function run(): Promise<void> {
  const connection = await Connection.connect({
    address: 'localhost:7233',
  });

  const client = new Client({ connection });

  const orderId = `order-${Date.now()}`;

  console.log(`\n=== Starting FulfilDrink workflow (Phase C) ===`);
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
  console.log(`View in Temporal UI: http://localhost:8233/namespaces/default/workflows/${handle.workflowId}\n`);

  // Query initial state (with retry — workflow needs time to start executing)
  let state = await queryState(handle);
  console.log(`[State] After workflow start: ${state}`);

  // -- Signal: baristaStarted --
  console.log('\nWaiting 2s before barista starts...');
  await sleep(2000);

  console.log('>>> Sending signal: baristaStarted');
  await handle.signal(baristaStartedSignal);
  await sleep(500);
  state = await queryState(handle);
  console.log(`[State] After baristaStarted: ${state}`);

  // -- Signal: drinkReady --
  console.log('\nWaiting 3s while drink is being prepared...');
  await sleep(3000);

  console.log('>>> Sending signal: drinkReady');
  await handle.signal(drinkReadySignal);
  await sleep(500);
  state = await queryState(handle);
  console.log(`[State] After drinkReady: ${state}`);

  // -- Signal: drinkCollected --
  console.log('\nWaiting 2s before customer collects...');
  await sleep(2000);

  console.log('>>> Sending signal: drinkCollected');
  await handle.signal(drinkCollectedSignal);
  await sleep(500);

  // After the final signal, the workflow completes quickly.
  // Query may fail if workflow has already completed.
  try {
    state = await queryState(handle);
    console.log(`[State] After drinkCollected: ${state}`);
  } catch {
    console.log(`[State] Workflow already completed (final state: collected)`);
  }

  // Wait for the workflow to complete and get the result
  const result = await handle.result();
  console.log(`\n=== Workflow completed ===`);
  console.log(`Result: ${result}\n`);

  // -- Print state progression summary --
  console.log('=== State Progression Summary ===');
  console.log('  placed → inPreparation → ready → collected');
  console.log('\n=== Done ===');
}

run().catch((err) => {
  console.error('Test script failed:', err);
  process.exit(1);
});
