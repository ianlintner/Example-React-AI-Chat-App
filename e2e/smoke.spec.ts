import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** WCAG 2.2 AA, per PLAN.md §4 quality gate. */
async function expectAxeClean(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map(v => `${v.id}: ${v.help}`)).toEqual([]);
}

async function cssVar(page: Page, name: string) {
  return page.evaluate(
    n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name,
  );
}

test.describe('smoke', () => {
  test('dark theme renders Instrument Panel tokens and is axe clean', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/tokens');
    await expect(
      page.getByRole('heading', { level: 1, name: /Instrument Panel/ }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark/);
    expect(await cssVar(page, '--bg')).toBe('#0b0d0f');
    expect(await cssVar(page, '--accent')).toBe('#f5a524');
    const bodyBg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(bodyBg).toBe('rgb(11, 13, 15)');
    await expect(page.locator('[data-token]')).toHaveCount(15);
    await expectAxeClean(page);
  });

  test('theme toggle switches to light, persists, and stays axe clean', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/tokens');
    await page.getByRole('button', { name: /light theme/i }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    expect(await cssVar(page, '--bg')).toBe('#fafaf9');
    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expectAxeClean(page);
  });

  test('uses self-hosted Inter and JetBrains Mono', async ({ page }) => {
    await page.goto('/tokens');
    const fonts = await page.evaluate(() => ({
      sans: getComputedStyle(document.body).fontFamily,
      mono: getComputedStyle(
        document.querySelector('[data-token] .font-mono') as Element,
      ).fontFamily,
    }));
    expect(fonts.sans).toContain('Inter Variable');
    expect(fonts.mono).toContain('JetBrains Mono');
  });

  test('reduced motion collapses transitions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/tokens');
    // The app currently declares no transitions of its own, so probe the
    // global reduced-motion override with an element that has one.
    const duration = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.transition = 'opacity 200ms';
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).transitionDuration;
      probe.remove();
      return value;
    });
    expect(parseFloat(duration)).toBeLessThan(0.001);
  });
});
