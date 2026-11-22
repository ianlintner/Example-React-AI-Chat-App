import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineAgentChat, type AgentChatElement } from '../src/element';

function sse(chunks: unknown[]): ReadableStream<Uint8Array> {
  const text =
    chunks.map(c => `data: ${JSON.stringify(c)}\n\n`).join('') +
    'data: [DONE]\n\n';
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

async function submitValue(el: AgentChatElement, text: string): Promise<void> {
  const input = el.shadowRoot!.querySelector('input')!;
  input.value = text;
  el.shadowRoot!.querySelector('form')!.dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  );
  // Form handler starts an async turn; let its microtasks settle.
  await vi.waitFor(() =>
    expect(
      el.shadowRoot!.querySelector('.status .label')!.textContent,
    ).not.toBe('Streaming…'),
  );
}

describe('<agent-chat> error handling', () => {
  let el: AgentChatElement;

  beforeEach(() => {
    defineAgentChat();
    el = document.createElement('agent-chat') as AgentChatElement;
    el.setAttribute('api-url', 'http://agent.test');
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
    vi.restoreAllMocks();
  });

  it('keeps the error status visible and removes the empty assistant bubble on HTTP failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('fail', { status: 503 }),
    );
    await submitValue(el, 'hello');
    const label = el.shadowRoot!.querySelector('.status .label')!;
    expect(label.textContent).toMatch(/503/);
    expect(
      el.shadowRoot!.querySelector('.status')!.getAttribute('data-state'),
    ).toBe('error');
    const assistantBubbles = el.shadowRoot!.querySelectorAll(
      '[data-testid="msg-assistant"]',
    );
    // Only the welcome message remains; no empty failed-turn bubble.
    expect(assistantBubbles).toHaveLength(1);
    expect(assistantBubbles[0]!.textContent).toContain('Send a message');
    expect(el.shadowRoot!.querySelector('input')!.value).toBe('hello');
  });

  it('shows contract errorText and does not report success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        sse([
          { type: 'start', messageId: 'm1' },
          { type: 'text-delta', id: 't1', delta: 'partial' },
          { type: 'error', errorText: 'Upstream unavailable' },
        ]),
      ),
    );
    await submitValue(el, 'hello');
    expect(el.shadowRoot!.querySelector('.status .label')!.textContent).toBe(
      'Upstream unavailable',
    );
    const bubbles = el.shadowRoot!.querySelectorAll(
      '[data-testid="msg-assistant"]',
    );
    expect(bubbles).toHaveLength(1); // welcome only; failed reply removed
    expect(bubbles[0]!.textContent).not.toContain('partial');
  });

  it('upgrades declaratively when title precedes api-url without throwing', () => {
    const node = document.createElement('agent-chat') as AgentChatElement;
    expect(() => {
      node.setAttribute('title', 'Later URL');
      node.setAttribute('api-url', 'http://agent.test');
      document.body.appendChild(node);
    }).not.toThrow();
    expect(node.shadowRoot!.querySelector('.title')!.textContent).toBe(
      'Later URL',
    );
    node.remove();
  });

  it('does not leak auth listeners across attribute changes', () => {
    const auth = JSON.stringify({
      type: 'oauth2',
      issuer: 'http://localhost:4000',
      clientId: 'embed',
    });
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('no'));
    el.setAttribute('auth', auth);
    const first = el.shadowRoot!.querySelector('.signin button')!;
    el.setAttribute('title', 'Renamed');
    const second = el.shadowRoot!.querySelector('.signin button')!;
    expect(second).not.toBe(first);
    // The old button's listener is gone with the old DOM; only one exists.
    expect(el.shadowRoot!.querySelectorAll('.signin button')).toHaveLength(1);
    spy.mockRestore();
  });
});
