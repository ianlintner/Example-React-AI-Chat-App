import { planFixture } from '@agent-chat/contract/fixtures';
import { colorTokenNames, colorTokens } from '@agent-chat/ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanPreview } from './plan-preview';
import { ThemeToggle } from './theme-toggle';
import { TokenSwatches } from './token-swatches';

afterEach(() => {
  cleanup();
  document.documentElement.className = '';
});

describe('TokenSwatches', () => {
  it('renders every token with its theme value', () => {
    render(<TokenSwatches theme='dark' />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(colorTokenNames.length);
    expect(screen.getAllByText(colorTokens.dark.accent).length).toBeGreaterThan(
      0,
    );
  });
});

describe('ThemeToggle', () => {
  it('toggles the dark class and persists the choice', () => {
    document.documentElement.classList.add('dark');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: /light theme/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('agent-chat.theme')).toBe('light');
  });
});

describe('PlanPreview', () => {
  it('renders the plan fixture steps', () => {
    render(<PlanPreview plan={planFixture} />);
    for (const step of planFixture.steps) {
      expect(screen.getByText(step.title)).toBeTruthy();
    }
  });
});
