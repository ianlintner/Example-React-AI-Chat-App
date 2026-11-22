import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AI_STATES } from '../apps/web/src/lib/ui-states';

/**
 * Contract-fixture states (RESEARCH-UI.md §3 pattern 14). No network LLM:
 * `?state=` renders canonical fixtures from packages/contract deterministically.
 */
for (const stateName of AI_STATES) {
  test(`AI state: ${stateName}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto(`/?state=${stateName}`);
    await expect(page.getByTestId('state-controls')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible();
    await expect(page).toHaveScreenshot(`${stateName}.png`, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      // CI runners rasterize the self-hosted fonts slightly differently;
      // tolerate sub-2% antialiasing drift while still catching real changes.
      maxDiffPixelRatio: 0.02,
    });
    await expectAxeClean(page);
  });
}

test('reduced-motion path keeps the shell usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?state=streaming');
  const duration = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.transition = 'opacity 200ms';
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).transitionDuration;
    probe.remove();
    return value;
  });
  expect(parseFloat(duration)).toBeLessThan(0.001);
  await expect(page.getByRole('button', { name: /stop/i })).toBeVisible();
});

test('command palette and mobile sheet are keyboard accessible', async ({
  page,
}) => {
  await page.goto('/?state=empty');
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.keyboard.press('Control+k');
  await expect(
    page.getByRole('dialog', { name: 'Command palette' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Command palette' }),
  ).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open threads' }).click();
  await expect(page.getByRole('dialog', { name: 'Threads' })).toBeVisible();
  await expectAxeClean(page);
});

async function expectAxeClean(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.flatMap(v =>
    v.nodes.map(n => `${v.id}: ${n.html} — ${n.failureSummary ?? ''}`),
  );
  expect(summary).toEqual([]);
}
