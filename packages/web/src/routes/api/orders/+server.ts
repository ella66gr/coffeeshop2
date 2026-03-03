/**
 * POST /api/orders — Start a new FulfilDrink workflow
 *
 * Accepts: { customerName, drinkType, size }
 * Returns: { orderId, workflowId }
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTemporalClient } from '$lib/server/temporal';
import {
  TASK_QUEUE,
  WORKFLOW_NAME,
  QUERY_ORDER_STATE,
} from '@coffeeshop/shared';

export const POST: RequestHandler = async ({ request }) => {
  let body: { customerName?: string; drinkType?: string; size?: string };

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  const { customerName, drinkType, size } = body;

  if (!customerName || !drinkType || !size) {
    throw error(400, 'Missing required fields: customerName, drinkType, size');
  }

  if (!['small', 'medium', 'large'].includes(size)) {
    throw error(400, 'Invalid size: must be small, medium, or large');
  }

  const orderId = `order-${Date.now()}`;

  const client = await getTemporalClient();

  const handle = await client.workflow.start(WORKFLOW_NAME, {
    taskQueue: TASK_QUEUE,
    workflowId: orderId,
    args: [
      {
        orderId,
        customerName,
        drinkType,
        size,
      },
    ],
  });

  // Brief pause to let the workflow initialise and register the query handler.
  await new Promise((resolve) => setTimeout(resolve, 500));

  let state = 'unknown';
  try {
    state = await handle.query(QUERY_ORDER_STATE);
  } catch {
    // Query handler may not be registered yet — that's fine for the response.
  }

  return json({
    orderId,
    workflowId: handle.workflowId,
    state,
  });
};
