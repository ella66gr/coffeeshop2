/**
 * Temporal Worker - Phase A
 *
 * The worker hosts workflow and activity code and polls the Temporal
 * server for tasks. Workflows run in a sandboxed V8 isolate (hence
 * workflowsPath rather than a direct import), while activities run
 * in the normal Node.js environment.
 *
 * Task queue name 'coffeeshop' is shared between worker and client
 * so Temporal routes work to the correct worker(s).
 */
export {};
//# sourceMappingURL=worker.d.ts.map