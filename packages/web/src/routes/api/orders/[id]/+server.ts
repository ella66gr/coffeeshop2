/**
 * GET /api/orders/[id] — Query workflow state
 *
 * Returns: { orderId, state, workflowStatus }
 *
 * state: current XState lifecycle state (from Temporal query)
 * workflowStatus: Temporal workflow execution status
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTemporalClient } from '$lib/server/temporal';
import { QUERY_ORDER_STATE } from '@coffeeshop/shared';

export const GET: RequestHandler = async ({ params }) => {
  const orderId = params.id;

  if (!orderId) {
    throw error(400, 'Missing order ID');
  }

  const client = await getTemporalClient();
  const handle = client.workflow.getHandle(orderId);

  try {
    const description = await handle.describe();

    const workflowStatus = description.status.name;

    // If the workflow is completed, we can't query it — return the final state.
    if (workflowStatus === 'COMPLETED') {
      return json({
        orderId,
        state: 'collected',
        workflowStatus,
      });
    }

    if (workflowStatus === 'FAILED' || workflowStatus === 'CANCELLED' || workflowStatus === 'TERMINATED') {
      return json({
        orderId,
        state: 'unknown',
        workflowStatus,
      });
    }

    // Workflow is running — query the current state.
    const state = await handle.query(QUERY_ORDER_STATE);

    return json({
      orderId,
      state,
      workflowStatus,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('not found') || message.includes('NOT_FOUND')) {
      throw error(404, `Workflow not found: ${orderId}`);
    }

    throw error(500, `Failed to query workflow: ${message}`);
  }
};
