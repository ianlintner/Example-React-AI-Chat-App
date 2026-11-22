import { expect, test } from '@playwright/test';

test.describe('agent chat', () => {
  test('sends a message and sees a streamed mock reply', async ({ page }) => {
    await page.goto('/');
    const threadId = await page.getByTestId('thread-id').textContent();
    expect(threadId).toContain('thr_web_');

    const input = page.getByRole('textbox', { name: 'Message' });
    const send = page.getByRole('button', { name: 'Send message' });
    // Wait for React hydration before typing: a fill() against the raw SSR
    // markup is not observed by assistant-ui and leaves Send disabled.
    await expect(send).toBeDisabled();
    await input.fill('Hello agent');
    // A disabled Send after fill means hydration lost the input event; retry
    // deterministically rather than racing the 30s test timeout.
    for (let attempt = 0; attempt < 10 && (await send.isDisabled()); attempt++) {
      await input.fill('');
      await input.fill('Hello agent');
      await page.waitForTimeout(50);
    }
    await expect(send).toBeEnabled();
    await send.click();

    await expect(page.getByText('Hello agent')).toBeVisible();
    await expect(page.getByText('Mock reply from the agent.')).toBeVisible({ timeout: 10_000 });
  });
});
