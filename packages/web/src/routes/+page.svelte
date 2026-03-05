<script lang="ts">
  import { goto } from '$app/navigation';

  let customerName = $state('');
  let drinkType = $state('flat white');
  let size = $state('medium');
  let submitting = $state(false);
  let errorMessage = $state('');

  async function placeOrder() {
    submitting = true;
    errorMessage = '';

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, drinkType, size }),
      });

      if (!response.ok) {
        const data = await response.json();
        errorMessage = data.message || `Error: ${response.status}`;
        return;
      }

      const data = await response.json();
      await goto(`/orders/${data.orderId}`);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to place order';
    } finally {
      submitting = false;
    }
  }
</script>

<h1>Coffee Shop Demonstrator</h1>
<p>SysML v2 Model-Driven Execution — Phase D: Governance Outputs</p>

<hr />

<h2>Place an Order</h2>

{#if errorMessage}
  <p style="color: red;"><strong>Error:</strong> {errorMessage}</p>
{/if}

<div>
  <label>
    Customer Name:
    <input type="text" bind:value={customerName} placeholder="Enter name" />
  </label>
</div>

<div>
  <label>
    Drink Type:
    <select bind:value={drinkType}>
      <option value="flat white">Flat White</option>
      <option value="latte">Latte</option>
      <option value="americano">Americano</option>
      <option value="cappuccino">Cappuccino</option>
      <option value="espresso">Espresso</option>
      <option value="iced latte">Iced Latte</option>
      <option value="cold brew">Cold Brew</option>
    </select>
  </label>
</div>

<div>
  <label>
    Size:
    <select bind:value={size}>
      <option value="small">Small</option>
      <option value="medium">Medium</option>
      <option value="large">Large</option>
    </select>
  </label>
</div>

<div style="margin-top: 1em;">
  <button onclick={placeOrder} disabled={submitting || !customerName}>
    {submitting ? 'Placing order…' : 'Place Order'}
  </button>
</div>
