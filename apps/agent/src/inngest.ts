/**
 * Durable execution (Inngest). Phase 1 registers the client and serve
 * endpoint only; durable goal/research runs are added in cards 7–8 by
 * appending to `functions` (one file per function under src/runs/).
 */
import { Inngest, type InngestFunction } from 'inngest';
import { serve } from 'inngest/hono';

export function createInngest(opts: { dev: boolean }) {
  const client = new Inngest({ id: 'agent-chat', isDev: opts.dev });
  const functions: InngestFunction.Any[] = [];
  return { client, functions, handler: serve({ client, functions }) };
}
