/**
 * POST /api/orders/[id]/signal — Send a signal to a running workflow
 *
 * Accepts: { signal: "baristaStarted" | "drinkReady" | "drinkCollected" }
 * Returns: { orderId, signal, state, workflowStatus }
 *
 * The signal name is validated against VALID_SIGNALS from @coffeeshop/shared.
 * After sending the signal, the route waits briefly then queries the
 * updated state for the response.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTemporalClient } from '$lib/server/temporal';
import {
  VALID_SIGNALS,
  QUERY_ORDER_STATE,
  type SignalName,
} from '@coffeeshop/shared';

export const POST: RequestHandler = async ({ params, request }) => {
  const orderId = params.id;

  if (!orderId) {
    throw error(400, 'Missing order ID');
  }

  let body: { signal?: string };

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  const { signal } = body;

  if (!signal) {
    throw error(400, 'Missing required field: signal');
  }

  if (!VALID_SIGNALS.includes(signal as SignalName)) {
    throw error(400, `Invalid signal: ${signal}. Valid signals: ${VALID_SIGNALS.join(', ')}`);
  }

  const client = await getTemporalClient();
  const handle = client.workflow.getHandle(orderId);

  try {
    // Verify workflow exists and is running.
    const description = await handle.describe();

    if (description.status.name !== 'RUNNING') {
      throw error(409, `Workflow is not running (status: ${description.status.name})`);
    }

    // Send the signal using the string-based API.
    await handle.signal(signal);

    // Brief pause to let the workflow process the signal and update state.
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Query the updated state.
    let state = 'unknown';
    let workflowStatus = 'RUNNING';

    try {
      state = await handle.query(QUERY_ORDER_STATE);
    } catch {
      // Workflow may have completed after the final signal.
      const desc = await handle.describe();
      workflowStatus = desc.status.name;
      if (workflowStatus === 'COMPLETED') {
        state = 'collected';
      }
    }

    return json({
      orderId,
      signal,
      state,
      workflowStatus,
    });
  } catch (err: unknown) {
    // Re-throw SvelteKit errors.
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }

    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('not found') || message.includes('NOT_FOUND')) {
      throw error(404, `Workflow not found: ${orderId}`);
    }

    throw error(500, `Failed to send signal: ${message}`);
  }
};
