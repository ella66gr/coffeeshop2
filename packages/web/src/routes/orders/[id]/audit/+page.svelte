<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';

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

  interface AuditReport {
    caseRef: string;
    workflowId: string;
    workflowStatus: string;
    startTime: string | null;
    endTime: string | null;
    steps: AuditStep[];
  }

  const COMPLIANCE_LABELS: Record<string, string> = {
    within_target: '✅ Within target',
    exceeded: '⚠️ Exceeded',
    no_target: '—',
    pending: '⏳ Pending',
  };

  let orderId = $derived(page.params.id ?? '');
  let report = $state<AuditReport | null>(null);
  let loading = $state(true);
  let errorMessage = $state('');

  function formatTimestamp(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString();
  }

  function formatDuration(seconds: number | null): string {
    if (seconds === null) return '—';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  function formatExpected(minutes: number | null): string {
    if (minutes === null) return '—';
    if (minutes < 1) return `${Math.round(minutes * 60)}s`;
    return `${minutes} min`;
  }

  async function fetchAudit() {
    if (!orderId) return;

    try {
      const response = await fetch(`/api/orders/${orderId}/audit`);

      if (!response.ok) {
        const data = await response.json();
        errorMessage = data.message || `Error: ${response.status}`;
        return;
      }

      report = await response.json();
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to fetch audit report';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchAudit();
  });
</script>

<h1>Audit Report</h1>
<p>
  <a href="/orders/{orderId}">&larr; Back to order status</a>
  &nbsp;|&nbsp;
  <a href="/orders">All orders</a>
</p>

<hr />

{#if loading}
  <p>Loading audit report…</p>
{:else if errorMessage}
  <p style="color: red;"><strong>Error:</strong> {errorMessage}</p>
  <p>
    The audit report is only available for workflows with execution history.
    Ensure the workflow has been started and has progressed through at least one step.
  </p>
{:else if report}
  <table>
    <tbody>
      <tr>
        <td><strong>Case Reference</strong></td>
        <td><code>{report.caseRef}</code></td>
      </tr>
      <tr>
        <td><strong>Workflow Status</strong></td>
        <td>{report.workflowStatus}</td>
      </tr>
      <tr>
        <td><strong>Process Started</strong></td>
        <td>{formatTimestamp(report.startTime)}</td>
      </tr>
      <tr>
        <td><strong>Process Completed</strong></td>
        <td>{formatTimestamp(report.endTime)}</td>
      </tr>
    </tbody>
  </table>

  <h2>Compliance Table</h2>
  <p style="font-size: 0.85em; color: #666;">
    Expected timings are defined in the SysML model (<code>@TemporalSignal</code> annotations).
    Actual timings are from the Temporal workflow execution history.
  </p>

  <table>
    <thead>
      <tr>
        <th>Step</th>
        <th>Type</th>
        <th>Started</th>
        <th>Completed</th>
        <th>Duration</th>
        <th>Expected</th>
        <th>Compliance</th>
      </tr>
    </thead>
    <tbody>
      {#each report.steps as step}
        <tr>
          <td><strong>{step.label}</strong></td>
          <td>{step.type === 'signal' ? 'Signal wait' : 'Activity'}</td>
          <td style="font-size: 0.85em;">{formatTimestamp(step.startTime)}</td>
          <td style="font-size: 0.85em;">{formatTimestamp(step.endTime)}</td>
          <td>{formatDuration(step.durationSeconds)}</td>
          <td>{formatExpected(step.expectedMinutes)}</td>
          <td>{COMPLIANCE_LABELS[step.compliance] ?? step.compliance}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  <hr />

  <p style="font-size: 0.85em; color: #666;">
    <strong>Governance note:</strong> This report is generated from the Temporal
    workflow execution history for case <code>{report.caseRef}</code>.
    The process definition is generated from the SysML v2 model — see the
    <a href="/pathway">pathway diagram</a> for the defined process.
    Customer identifiers are anonymised.
  </p>

  <p style="font-size: 0.85em; color: #666;">
    Temporal Web UI:
    <a href="http://localhost:8233/namespaces/default/workflows/{report.workflowId}" target="_blank">
      View raw execution history
    </a>
  </p>
{/if}
