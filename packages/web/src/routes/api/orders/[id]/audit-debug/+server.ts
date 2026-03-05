/**
 * GET /api/orders/[id]/audit-debug — Debug endpoint to inspect raw Temporal history events
 *
 * Temporary: remove after fixing the audit event parsing.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTemporalClient } from '$lib/server/temporal';

export const GET: RequestHandler = async ({ params }) => {
  const workflowId = params.id;
  if (!workflowId) throw error(400, 'Missing order ID');

  const client = await getTemporalClient();
  const handle = client.workflow.getHandle(workflowId);
  const history = await handle.fetchHistory();

  if (!history || !history.events) {
    return json({ error: 'No events' });
  }

  // Return the first 10 events with their raw shape
  const sample = history.events.slice(0, 15).map((event, i) => ({
    index: i,
    eventId: event.eventId?.toString(),
    eventType: event.eventType,
    eventTypeType: typeof event.eventType,
    eventTime: event.eventTime,
    // List all attribute keys present on this event
    attributeKeys: Object.keys(event).filter(k =>
      k !== 'eventId' && k !== 'eventType' && k !== 'eventTime' &&
      event[k as keyof typeof event] != null
    ),
  }));

  return json({ eventCount: history.events.length, sample });
};
