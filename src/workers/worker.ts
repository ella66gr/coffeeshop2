/**
 * Temporal Worker - Phase A
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

const TASK_QUEUE = 'coffeeshop';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run(): Promise<void> {
  // Connect to the local Temporal server (default localhost:7233)
  const connection = await NativeConnection.connect({
    address: 'localhost:7233',
  });

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: TASK_QUEUE,

    // Workflows are loaded by path and bundled into the V8 isolate.
    // This is a Temporal requirement - workflows cannot be imported directly.
    workflowsPath: path.resolve(__dirname, '../workflows/fulfil-drink.js'),

    // Activities are passed directly as they run in normal Node.js.
    activities,
  });

  console.log(`Worker started, polling task queue: ${TASK_QUEUE}`);
  console.log('Press Ctrl+C to stop.');

  // This call blocks until the worker is shut down (e.g. via SIGINT).
  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
