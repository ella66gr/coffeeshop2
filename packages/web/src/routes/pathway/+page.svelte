<h1>Drink Fulfilment Pathway</h1>
<p><a href="/">&larr; Home</a></p>

<hr />

<p>
  This diagram is generated from the SysML v2 domain action flow
  (<code>FulfilDrink</code>) by <code>gen_mermaid_pathway.py</code>.
  It shows the process steps a non-technical reviewer would inspect to
  understand the defined pathway.
</p>

<p style="font-size: 0.85em; color: #666;">
  Source: <code>coffeeshop-exercise/model/domain/drink-fulfilment.sysml</code>
  &rarr; <code>generated/fulfil-drink-pathway.mmd</code>
  &rarr; <code>generated/fulfil-drink-pathway.svg</code>
</p>

<div style="margin-top: 1.5em; border: 1px solid #ccc; padding: 1em; background: #fafafa;">
  <img
    src="/fulfil-drink-pathway.svg"
    alt="Drink fulfilment pathway diagram generated from SysML v2 model"
    style="max-width: 100%; height: auto;"
  />
</div>

<hr />

<h2>Orchestration Workflow Steps</h2>
<p>
  The orchestration-level workflow (<code>FulfilDrinkWorkflow</code>) defines
  the system's process management — activity boundaries, signal waits, and
  timeout points. Each step maps to the domain pathway above.
</p>

<table>
  <thead>
    <tr>
      <th>Step</th>
      <th>Type</th>
      <th>Expected Max Duration</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Validate Order</td>
      <td>Activity</td>
      <td>1 min</td>
      <td>Validate order details before processing</td>
    </tr>
    <tr>
      <td>Wait for Barista</td>
      <td>Signal wait</td>
      <td>30 min</td>
      <td>Suspend until a barista signals they have started</td>
    </tr>
    <tr>
      <td>Prepare Drink</td>
      <td>Activity</td>
      <td>1 min</td>
      <td>Record that drink preparation has occurred</td>
    </tr>
    <tr>
      <td>Wait for Drink Ready</td>
      <td>Signal wait</td>
      <td>15 min</td>
      <td>Suspend until barista marks drink as ready</td>
    </tr>
    <tr>
      <td>Wait for Collection</td>
      <td>Signal wait</td>
      <td>60 min</td>
      <td>Suspend until customer collects their drink</td>
    </tr>
    <tr>
      <td>Complete Order</td>
      <td>Activity</td>
      <td>1 min</td>
      <td>Finalise the order after collection</td>
    </tr>
  </tbody>
</table>
