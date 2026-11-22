import { planFixture } from '@agent-chat/contract/fixtures';
import { colorTokenNames, colorTokens } from '@agent-chat/ui';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanPreview } from './plan-preview';
import { RouteDecisionChip } from './RouteDecisionChip';
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

describe('RouteDecisionChip', () => {
  it('labels shadow decisions and exposes the rationale in a tooltip', () => {
    render(
      <RouteDecisionChip
        type='data'
        name='route-decision'
        status={{ type: 'complete' }}
        data={{
          decisionId: 'rd_test',
          skill: 'deep-research',
          tier: 'research',
          needsResearch: true,
          needsPlan: true,
          confidence: 0.86,
          margin: 0.41,
          source: 'typed-router',
          mode: 'shadow',
          rationale: 'Composite question',
        }}
      />,
    );
    const chip = screen.getByTestId('route-decision');
    expect(chip.textContent).toContain('deep-research');
    expect(chip.textContent).toContain('shadow');
    expect(chip.getAttribute('title')).toContain('Composite question');
    expect(chip.getAttribute('data-mode')).toBe('shadow');
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
