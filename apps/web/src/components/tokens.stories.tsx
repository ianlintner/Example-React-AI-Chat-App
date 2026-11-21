import { planFixture } from '@agent-chat/contract/fixtures';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlanPreview } from './plan-preview';
import { TokenSwatches } from './token-swatches';

const meta: Meta = { title: 'Foundations/Instrument Panel' };
export default meta;

export const DarkTokens: StoryObj = {
  globals: { theme: 'dark' },
  render: () => <TokenSwatches theme='dark' />,
};

export const LightTokens: StoryObj = {
  globals: { theme: 'light' },
  render: () => <TokenSwatches theme='light' />,
};

export const PlanFromContractFixture: StoryObj = {
  render: () => <PlanPreview plan={planFixture} />,
};
