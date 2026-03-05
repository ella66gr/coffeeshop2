/**
 * GET /api/orders/list — List recent workflows
 *
 * Queries Temporal for recent fulfilDrink workflow executions.
 * Returns a list suitable for browsing and navigating to audit reports.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTemporalClient } from '$lib/server/temporal';
import { WORKFLOW_NAME, anonymiseCaseRef } from '@coffeeshop/shared';

export const GET: RequestHandler = async () => {
  const client = await getTemporalClient();

  try {
    const workflows: Array<{
      workflowId: string;
      caseRef: string;
      status: string;
      startTime: string | null;
      closeTime: string | null;
    }> = [];

    // Use the list API with a query for our workflow type.
    const iterator = client.workflow.list({
      query: `WorkflowType = '${WORKFLOW_NAME}'`,
    });

    let count = 0;
    for await (const workflow of iterator) {
      if (count >= 50) break; // Limit to 50 most recent

      workflows.push({
        workflowId: workflow.workflowId,
        caseRef: anonymiseCaseRef(workflow.workflowId),
        status: workflow.status.name,
        startTime: workflow.startTime?.toISOString() ?? null,
        closeTime: workflow.closeTime?.toISOString() ?? null,
      });

      count++;
    }

    return json({ workflows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw error(500, `Failed to list workflows: ${message}`);
  }
};
