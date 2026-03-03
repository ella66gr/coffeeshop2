/**
 * Start Order Test Script — Phase A / Phase C
 *
 * A test script that starts a workflow, sends signals to simulate
 * barista/customer actions, and prints the execution history.
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
  console.log(`View in Temporal UI: http://localhost:8233/namespaces/default/workflows/${handle.workflowId}\n`);

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

  const result = await handle.result();
  console.log(`\n=== Workflow completed ===`);
  console.log(`Result: ${result}\n`);

  console.log('=== Workflow Execution History ===\n');

  const { events } = await handle.fetchHistory();
  for (const event of events ?? []) {
    let timestamp = 'unknown';
    if (event.eventTime) {
      const seconds = Number(event.eventTime.seconds ?? 0);
      const nanos = event.eventTime.nanos ?? 0;
      timestamp = new Date(seconds * 1000 + nanos / 1000000).toISOString();
    }
    const eventType = event.eventType ?? 'UNKNOWN';
    console.log(`  [${timestamp}] ${eventType}`);
  }

  console.log('\n=== Done ===');
}

run().catch((err) => {
  console.error('Test script failed:', err);
  process.exit(1);
});
