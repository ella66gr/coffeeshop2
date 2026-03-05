<script lang="ts">
  import { onMount } from 'svelte';

  interface WorkflowSummary {
    workflowId: string;
    caseRef: string;
    status: string;
    startTime: string | null;
    closeTime: string | null;
  }

  const STATUS_LABELS: Record<string, string> = {
    RUNNING: '🟢 Running',
    COMPLETED: '✅ Completed',
    FAILED: '❌ Failed',
    CANCELLED: '🚫 Cancelled',
    TERMINATED: '🛑 Terminated',
    TIMED_OUT: '⏰ Timed out',
  };

  let workflows = $state<WorkflowSummary[]>([]);
  let loading = $state(true);
  let errorMessage = $state('');

  function formatTimestamp(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }

  async function fetchOrders() {
    try {
      const response = await fetch('/api/orders/list');

      if (!response.ok) {
        const data = await response.json();
        errorMessage = data.message || `Error: ${response.status}`;
        return;
      }

      const data = await response.json();
      workflows = data.workflows;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to fetch orders';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchOrders();
  });
</script>

<h1>Orders</h1>
<p><a href="/">&larr; Home</a></p>

<hr />

{#if loading}
  <p>Loading orders…</p>
{:else if errorMessage}
  <p style="color: red;"><strong>Error:</strong> {errorMessage}</p>
{:else if workflows.length === 0}
  <p>No orders found. <a href="/">Place a new order</a> to get started.</p>
{:else}
  <p>{workflows.length} order{workflows.length !== 1 ? 's' : ''} found.</p>

  <table>
    <thead>
      <tr>
        <th>Case Ref</th>
        <th>Status</th>
        <th>Started</th>
        <th>Completed</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each workflows as wf}
        <tr>
          <td><code>{wf.caseRef}</code></td>
          <td>{STATUS_LABELS[wf.status] ?? wf.status}</td>
          <td style="font-size: 0.85em;">{formatTimestamp(wf.startTime)}</td>
          <td style="font-size: 0.85em;">{formatTimestamp(wf.closeTime)}</td>
          <td>
            <a href="/orders/{wf.workflowId}">Status</a>
            {#if wf.status === 'COMPLETED'}
              &nbsp;|&nbsp;
              <a href="/orders/{wf.workflowId}/audit">Audit</a>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}
