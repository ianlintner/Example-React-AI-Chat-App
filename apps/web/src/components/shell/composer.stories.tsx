import type { Meta, StoryObj } from '@storybook/react-vite';
import { Composer } from './composer';

const meta = {
  title: 'Shell/Composer',
  component: Composer,
  args: {
    running: false,
    onSend: () => {},
    onStop: () => {},
    disabledReason: undefined,
  },
} satisfies Meta<typeof Composer>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Idle: Story = {};
export const Running: Story = { args: { running: true } };
export const RateLimited: Story = {
  args: { disabledReason: 'Rate limited — the fast route is still available.' },
};
