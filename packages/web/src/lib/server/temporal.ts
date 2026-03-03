/**
 * Temporal Client — server-side only
 *
 * Provides a singleton Temporal client for use by SvelteKit API routes.
 * The $lib/server/ directory ensures SvelteKit never bundles this into
 * client-side code.
 */

import { Client, Connection } from '@temporalio/client';

let client: Client | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (!client) {
    const connection = await Connection.connect({
      address: 'localhost:7233',
    });
    client = new Client({ connection });
  }
  return client;
}
