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
    expect(steer.status).toBe(409); // unknown run → recorded as conflict

    const cancel = await http.request('/runs/run_x/cancel', {
      method: 'POST',
      headers: AUTH_HEADERS,
    });
    expect(cancel.status).toBe(409);
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
