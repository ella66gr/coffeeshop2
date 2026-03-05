/**
 * GET /api/orders/[id]/audit — Fetch audit trail for a completed workflow
 *
 * Queries Temporal workflow execution history, parses events into a
 * structured audit trail, and compares actual durations against expected
 * timing from the SysML model (via WORKFLOW_STEPS constants).
 *
 * Returns: {
 *   caseRef: string,           // Anonymised case reference
 *   workflowId: string,
 *   workflowStatus: string,
 *   startTime: string | null,  // ISO timestamp
 *   endTime: string | null,    // ISO timestamp
 *   steps: AuditStep[]
 * }
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTemporalClient } from '$lib/server/temporal';
import { WORKFLOW_STEPS, anonymiseCaseRef } from '@coffeeshop/shared';

interface AuditStep {
  stepId: string;
  label: string;
  type: 'activity' | 'signal';
  expectedMinutes: number | null;
  startTime: string | null;
  endTime: string | null;
  durationSeconds: number | null;
  durationMinutes: number | null;
  compliance: 'within_target' | 'exceeded' | 'no_target' | 'pending';
}

// -----------------------------------------------------------------------
// Temporal event type numeric enum values (from protobuf).
// The TypeScript SDK returns these as numbers, not strings.
// Reference: temporal.api.enums.v1.EventType
// -----------------------------------------------------------------------
const EVENT = {
  WORKFLOW_EXECUTION_STARTED: 1,
  WORKFLOW_EXECUTION_COMPLETED: 2,
  ACTIVITY_TASK_SCHEDULED: 10,
  ACTIVITY_TASK_STARTED: 11,
  ACTIVITY_TASK_COMPLETED: 12,
  WORKFLOW_EXECUTION_SIGNALED: 26,
} as const;

/**
 * Convert a protobuf ITimestamp to a JavaScript Date.
 *
 * The Temporal SDK returns eventTime as { seconds: string, nanos: number }.
 * `seconds` is a string representation of a 64-bit integer.
 */
function protoTimestampToDate(ts: { seconds?: string | bigint | number | null; nanos?: number | null } | null | undefined): Date | null {
  if (!ts) return null;
  const seconds = Number(ts.seconds ?? 0);
  const nanos = Number(ts.nanos ?? 0);
  if (isNaN(seconds)) return null;
  return new Date(seconds * 1000 + nanos / 1_000_000);
}

export const GET: RequestHandler = async ({ params }) => {
  const workflowId = params.id;

  if (!workflowId) {
    throw error(400, 'Missing order ID');
  }

  const client = await getTemporalClient();
  const handle = client.workflow.getHandle(workflowId);

  try {
    // Verify workflow exists.
    const description = await handle.describe();
    const workflowStatus = description.status.name;

    // Fetch the full event history.
    const history = await handle.fetchHistory();

    if (!history || !history.events) {
      throw error(500, 'No event history available');
    }

    const events = history.events;

    // Parse events into a timeline.
    let workflowStartTime: Date | null = null;
    let workflowEndTime: Date | null = null;

    // Track activity scheduling and completion by activity type.
    const activityScheduled = new Map<string, Date>();
    const activityCompleted = new Map<string, Date>();

    // Track signal receipt times.
    const signalReceived = new Map<string, Date>();

    // Map scheduledEventId → activity name for linking completions.
    const activityNameByScheduledId = new Map<number, string>();

    for (const event of events) {
      const eventTime = protoTimestampToDate(event.eventTime);
      const eventType = event.eventType as number;

      if (eventType === EVENT.WORKFLOW_EXECUTION_STARTED) {
        workflowStartTime = eventTime;
      }

      if (eventType === EVENT.WORKFLOW_EXECUTION_COMPLETED) {
        workflowEndTime = eventTime;
      }

      // Activity scheduled — extract activity name.
      if (eventType === EVENT.ACTIVITY_TASK_SCHEDULED) {
        const attrs = event.activityTaskScheduledEventAttributes;
        if (attrs?.activityType?.name && eventTime) {
          const activityName = attrs.activityType.name;
          activityScheduled.set(activityName, eventTime);
          const eventId = Number(event.eventId);
          activityNameByScheduledId.set(eventId, activityName);
        }
      }

      // Activity completed — find the matching scheduled event.
      if (eventType === EVENT.ACTIVITY_TASK_COMPLETED) {
        const attrs = event.activityTaskCompletedEventAttributes;
        if (attrs && eventTime) {
          const scheduledId = Number(attrs.scheduledEventId);
          const activityName = activityNameByScheduledId.get(scheduledId);
          if (activityName) {
            activityCompleted.set(activityName, eventTime);
          }
        }
      }

      // Signal received.
      if (eventType === EVENT.WORKFLOW_EXECUTION_SIGNALED) {
        const attrs = event.workflowExecutionSignaledEventAttributes;
        if (attrs?.signalName && eventTime) {
          signalReceived.set(attrs.signalName, eventTime);
        }
      }
    }

    // Build audit steps by matching WORKFLOW_STEPS against the event timeline.
    let previousStepEndTime: Date | null = workflowStartTime;
    const auditSteps: AuditStep[] = [];

    for (const stepDef of WORKFLOW_STEPS) {
      let startTime: Date | null = null;
      let endTime: Date | null = null;

      if (stepDef.type === 'activity') {
        startTime = activityScheduled.get(stepDef.temporalName) ?? null;
        endTime = activityCompleted.get(stepDef.temporalName) ?? null;
      } else {
        // Signal step: the wait starts when the previous step ended.
        startTime = previousStepEndTime;
        endTime = signalReceived.get(stepDef.temporalName) ?? null;
      }

      let durationSeconds: number | null = null;
      let durationMinutes: number | null = null;
      let compliance: AuditStep['compliance'] = 'pending';

      if (startTime && endTime) {
        durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
        durationMinutes = Math.round(durationSeconds / 6) / 10; // 1 decimal place

        if (stepDef.expectedMinutes === null) {
          compliance = 'no_target';
        } else if (durationMinutes <= stepDef.expectedMinutes) {
          compliance = 'within_target';
        } else {
          compliance = 'exceeded';
        }
      } else if (workflowStatus === 'COMPLETED') {
        compliance = 'no_target';
      }

      auditSteps.push({
        stepId: stepDef.stepId,
        label: stepDef.label,
        type: stepDef.type,
        expectedMinutes: stepDef.expectedMinutes,
        startTime: startTime?.toISOString() ?? null,
        endTime: endTime?.toISOString() ?? null,
        durationSeconds,
        durationMinutes,
        compliance,
      });

      // Advance the "previous step end time" for the next signal step.
      if (endTime) {
        previousStepEndTime = endTime;
      }
    }

    return json({
      caseRef: anonymiseCaseRef(workflowId),
      workflowId,
      workflowStatus,
      startTime: workflowStartTime?.toISOString() ?? null,
      endTime: workflowEndTime?.toISOString() ?? null,
      steps: auditSteps,
    });
  } catch (err: unknown) {
    // Re-throw SvelteKit errors.
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }

    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('not found') || message.includes('NOT_FOUND')) {
      throw error(404, `Workflow not found: ${workflowId}`);
    }

    throw error(500, `Failed to fetch audit trail: ${message}`);
  }
};
