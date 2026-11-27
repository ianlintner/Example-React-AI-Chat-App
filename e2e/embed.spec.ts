import { expect, test } from '@playwright/test';

/**
 * End-to-end for the <agent-chat> demo: open the panel, send a message and
 * assert the streamed mock-model reply lands in the shadow DOM. No network
 * LLM call: apps/agent runs with LLM_PROVIDER=mock.
 */
test('demo sends a message and receives a streamed reply', async ({ page }) => {
  await page.goto('/?api=http://127.0.0.1:8787');

  const widget = page.locator('agent-chat');
  await expect(widget).toBeAttached();
  // Programmatic open (the FAB is also clickable in a real integration).
  await page.evaluate(() => {
    (window as unknown as { __agentChat: { open(): void } }).__agentChat.open();
  });

  const shadow = widget.locator('css=.panel');
  await expect(shadow).toBeVisible();

  const input = widget.locator('css=input[aria-label="Message"]');
  await input.fill('What can you do?');
  await widget.locator('css=button[type="submit"]').click();

  const reply = widget.locator('css=[data-testid="msg-assistant"]').last();
  await expect(reply).toContainText('Mock reply from the agent.', {
    timeout: 15_000,
  });
  const status = widget.locator('css=.status');
  await expect(status).toHaveAttribute('data-state', 'ready');
});

test('renders tokens inside the shadow root and keeps host CSS out', async ({
  page,
}) => {
  await page.goto('/?api=http://127.0.0.1:8787');
  const styles = await page.evaluate(() => {
    const root = document.querySelector('agent-chat')?.shadowRoot;
    if (!root) return '';
    const sheet = Array.from(root.querySelectorAll('style'))
      .map(s => s.textContent ?? '')
      .join('\n');
    return sheet;
  });
  expect(styles).toContain('--accent');
  expect(styles).toContain('--font-mono');
  expect(styles).toContain('prefers-reduced-motion');
});
