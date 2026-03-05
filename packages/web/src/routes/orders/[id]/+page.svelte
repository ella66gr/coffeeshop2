<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';

  // State-to-action mapping: which signal can be sent from each state.
  const STATE_ACTIONS: Record<string, { signal: string; label: string } | null> = {
    placed: { signal: 'baristaStarted', label: 'Barista: Start Preparation' },
    inPreparation: { signal: 'drinkReady', label: 'Barista: Mark Ready' },
    ready: { signal: 'drinkCollected', label: 'Customer: Collect Drink' },
    collected: null,
    cancelled: null,
  };

  const STATE_LABELS: Record<string, string> = {
    placed: 'Placed',
    inPreparation: 'In Preparation',
    ready: 'Ready for Collection',
    collected: 'Collected',
    cancelled: 'Cancelled',
    unknown: 'Unknown',
  };

  let orderId = $derived(page.params.id ?? '');
  let currentState = $state('unknown');
  let workflowStatus = $state('unknown');
  let loading = $state(true);
  let signalSending = $state(false);
  let errorMessage = $state('');
  let stateHistory = $state<Array<{ state: string; timestamp: string }>>([]);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  let action = $derived(STATE_ACTIONS[currentState] ?? null);
  let stateLabel = $derived(STATE_LABELS[currentState] ?? currentState);
  let isTerminal = $derived(
    currentState === 'collected' ||
    currentState === 'cancelled' ||
    workflowStatus === 'COMPLETED'
  );

  async function fetchState() {
    if (!orderId) return;

    try {
      const response = await fetch(`/api/orders/${orderId}`);

      if (!response.ok) {
        const data = await response.json();
        errorMessage = data.message || `Error: ${response.status}`;
        return;
      }

      const data = await response.json();
      const previousState = currentState;
      currentState = data.state;
      workflowStatus = data.workflowStatus;

      if (
        currentState !== previousState &&
        currentState !== 'unknown' &&
        !stateHistory.some((h) => h.state === currentState)
      ) {
        stateHistory = [...stateHistory, { state: currentState, timestamp: new Date().toLocaleTimeString() }];
      }

      // Stop polling when workflow is terminal.
      if (isTerminal && pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to fetch state';
    } finally {
      loading = false;
    }
  }

  async function sendSignal(signalName: string) {
    signalSending = true;
    errorMessage = '';

    try {
      const response = await fetch(`/api/orders/${orderId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal: signalName }),
      });

      if (!response.ok) {
        const data = await response.json();
        errorMessage = data.message || `Error: ${response.status}`;
        return;
      }

      const data = await response.json();
      currentState = data.state;
      workflowStatus = data.workflowStatus;

      if (!stateHistory.some((h) => h.state === currentState)) {
        stateHistory = [...stateHistory, { state: currentState, timestamp: new Date().toLocaleTimeString() }];
      }

      // If terminal, do one final fetch to catch the COMPLETED workflow status.
      if (isTerminal) {
        await new Promise((r) => setTimeout(r, 500));
        await fetchState();
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to send signal';
    } finally {
      signalSending = false;
    }
  }

  onMount(() => {
    fetchState();
    pollInterval = setInterval(fetchState, 2000);

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  });
</script>

<h1>Order Status</h1>
<p><a href="/">&larr; Back to order form</a> &nbsp;|&nbsp; <a href="/orders">All orders</a></p>

<hr />

{#if loading}
  <p>Loading order state…</p>
{:else}
  <table>
    <tbody>
      <tr>
        <td><strong>Order ID</strong></td>
        <td><code>{orderId}</code></td>
      </tr>
      <tr>
        <td><strong>Current State</strong></td>
        <td>
          <strong style="font-size: 1.2em;">{stateLabel}</strong>
        </td>
      </tr>
      <tr>
        <td><strong>Workflow Status</strong></td>
        <td>{workflowStatus}</td>
      </tr>
    </tbody>
  </table>

  {#if errorMessage}
    <p style="color: red;"><strong>Error:</strong> {errorMessage}</p>
  {/if}

  <div style="margin-top: 1em;">
    {#if action}
      <button
        onclick={() => action && sendSignal(action.signal)}
        disabled={signalSending}
      >
        {signalSending ? 'Sending…' : action.label}
      </button>
    {:else if isTerminal}
      <p><em>Order complete. No further actions available.</em></p>
      <p><a href="/orders/{orderId}/audit"><strong>View Audit Report</strong></a></p>
    {:else}
      <p><em>Waiting for state update…</em></p>
    {/if}
  </div>

  {#if stateHistory.length > 0}
    <h3>State History</h3>
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>State</th>
        </tr>
      </thead>
      <tbody>
        {#each stateHistory as entry}
          <tr>
            <td>{entry.timestamp}</td>
            <td>{STATE_LABELS[entry.state] ?? entry.state}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <hr />
  <p style="font-size: 0.85em; color: #666;">
    Temporal Web UI: <a href="http://localhost:8233/namespaces/default/workflows/{orderId}" target="_blank">
      View workflow execution
    </a>
  </p>
{/if}
