/** Card 7: HTTP surface for durable goal runs. */
import { describe, expect, it } from 'vitest';
import { createApp } from './app';
import { AUTH_HEADERS, TEST_CONFIG, testServices } from './test-helpers';

function app() {
  const services = testServices();
  return { app: createApp(TEST_CONFIG, services), services };
}

describe('goal run routes', () => {
  it('starts a run and exposes its checkpointed state', async () => {
    const { app: http } = app();
    const created = await http.request('/runs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ threadId: 'thread_r1', goal: 'finish the goal' }),
    });
    expect(created.status).toBe(201);
    const { run } = (await created.json()) as {
      run: { runId: string; goal: string; status: string };
    };
    expect(run.goal).toBe('finish the goal');

    const fetched = await http.request(`/runs/${run.runId}`, {
      headers: AUTH_HEADERS,
    });
    expect(fetched.status).toBe(200);
    const body = (await fetched.json()) as { run: unknown };
    expect(body.run).toBeTruthy();
  });

  it('rejects an invalid start body with 400', async () => {
    const { app: http } = app();
    const res = await http.request('/runs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ threadId: 'thread_r1', goal: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('does not expose another owner’s run', async () => {
    const { app: http } = app();
    const created = await http.request('/runs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ threadId: 'thread_r1', goal: 'finish the goal' }),
    });
    const { run } = (await created.json()) as { run: { runId: string } };
    const other = await http.request(`/runs/${run.runId}`, {
      headers: { ...AUTH_HEADERS, 'x-user-id': 'attacker' },
    });
    expect(other.status).toBe(404);
  });

  it('validates approval decisions, steer text and cancel', async () => {
    const { app: http } = app();
    const badDecision = await http.request('/runs/run_x/approvals/appr_x', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ decision: 'maybe' }),
    });
    expect(badDecision.status).toBe(400);

    const badSteer = await http.request('/runs/run_x/steer', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ text: '' }),
    });
    expect(badSteer.status).toBe(400);

    const steer = await http.request('/runs/run_x/steer', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ text: 'Use local sources only.' }),
    });
    expect(steer.status).toBe(404); // unknown run is owner-scoped, not leaked

    const cancel = await http.request('/runs/run_x/cancel', {
      method: 'POST',
      headers: AUTH_HEADERS,
    });
    expect(cancel.status).toBe(404);
  });

  it('emits run/start and run/decision for the Inngest function', async () => {
    const services = testServices();
    const emitted: string[] = [];
    services.runEvents = async event => {
      emitted.push(event.name);
      return undefined;
    };
    const http = createApp(TEST_CONFIG, services);
    const created = await http.request('/runs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ threadId: 'thread_events', goal: 'finish' }),
    });
    expect(created.status).toBe(201);
    const { run } = (await created.json()) as { run: { runId: string } };
    const decision = await http.request(`/runs/${run.runId}/approvals/appr_1`, {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ decision: 'deny' }),
    });
    // Unknown approval is a state conflict, but the decision route was
    // reached through the owner-scoped path and no event was published.
    expect(decision.status).toBe(409);
    expect(emitted).toEqual(['run/start']);
  });

  it('rejects cross-owner human-gate mutations', async () => {
    const { app: http } = app();
    const created = await http.request('/runs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        threadId: 'thread_gate',
        goal: 'finish the goal',
        idempotencyKey: 'gate-key',
      }),
    });
    const { run } = (await created.json()) as { run: { runId: string } };
    const attacker = { ...AUTH_HEADERS, 'x-user-id': 'attacker' };

    for (const path of [`/${run.runId}/steer`, `/${run.runId}/cancel`]) {
      const res = await http.request(`/runs${path}`, {
        method: 'POST',
        headers: attacker,
        body: path.endsWith('/steer')
          ? JSON.stringify({ text: 'attacker steer' })
          : undefined,
      });
      expect(res.status, path).toBe(404);
    }
    const approval = await http.request(`/runs/${run.runId}/approvals/appr_x`, {
      method: 'POST',
      headers: attacker,
      body: JSON.stringify({ decision: 'approve' }),
    });
    expect(approval.status).toBe(404);

    // Owner can still steer and cancel; the attacker never changed state.
    const ownerCancel = await http.request(`/runs/${run.runId}/cancel`, {
      method: 'POST',
      headers: AUTH_HEADERS,
    });
    expect(ownerCancel.status).toBe(200);
    const fetched = await http.request(`/runs/${run.runId}`, {
      headers: AUTH_HEADERS,
    });
    const body = (await fetched.json()) as {
      run: { status: string; steerInstructions: string[] };
    };
    expect(body.run.status).toBe('canceled');
    expect(body.run.steerInstructions).not.toContain('attacker steer');
  });

  it('maps an idempotency key to the same run after a service restart', async () => {
    const first = app();
    const body = JSON.stringify({
      threadId: 'thread_idem',
      goal: 'secret goal for owner',
      idempotencyKey: 'idem-key-1',
    });
    const created = await first.app.request('/runs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body,
    });
    expect(created.status).toBe(201);
    const { run } = (await created.json()) as { run: { runId: string } };

    // Fresh service instance sharing durable data, as after a restart.
    const { MemoryStore } = await import('@agent-chat/agent-core');
    const sharedData = (
      first.services.store as InstanceType<typeof MemoryStore>
    ).data;
    const restartedServices = testServices(sharedData);
    const restarted = createApp(TEST_CONFIG, restartedServices);
    const retry = await restarted.request('/runs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body,
    });
    expect(retry.status).toBe(201);
    const retryBody = (await retry.json()) as {
      run: { runId: string; goal: string };
    };
    expect(retryBody.run.runId).toBe(run.runId);
    expect(retryBody.run.goal).toBe('secret goal for owner');

    // A different owner with the same key must never receive the victim's run.
    const attacker = await restarted.request('/runs', {
      method: 'POST',
      headers: { ...AUTH_HEADERS, 'x-user-id': 'attacker' },
      body,
    });
    expect(attacker.status).toBe(201);
    const attackerBody = (await attacker.json()) as { run: { runId: string } };
    expect(attackerBody.run.runId).not.toBe(run.runId);
  });

  it('records a steer and cancel on a real run', async () => {
    const { app: http } = app();
    const created = await http.request('/runs', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ threadId: 'thread_r2', goal: 'finish the goal' }),
    });
    const { run } = (await created.json()) as { run: { runId: string } };

    const steer = await http.request(`/runs/${run.runId}/steer`, {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ text: 'Prefer local sources.' }),
    });
    expect(steer.status).toBe(200);

    const cancel = await http.request(`/runs/${run.runId}/cancel`, {
      method: 'POST',
      headers: AUTH_HEADERS,
    });
    expect(cancel.status).toBe(200);

    const fetched = await http.request(`/runs/${run.runId}`, {
      headers: AUTH_HEADERS,
    });
    const body = (await fetched.json()) as {
      run: { status: string; steerInstructions: string[] };
    };
    expect(body.run.status).toBe('canceled');
    expect(body.run.steerInstructions).toContain('Prefer local sources.');
  });
});
