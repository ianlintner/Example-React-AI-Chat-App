import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommandPalette } from './command-palette';

const meta = {
  title: 'Shell/CommandPalette',
  component: CommandPalette,
  args: {
    open: true,
    onClose: () => {},
    commands: [
      { id: 'new', label: 'New thread', hint: '⌘N', run: () => {} },
      { id: 'canvas', label: 'Toggle artifacts canvas', run: () => {} },
      { id: 'jump', label: 'Jump to run', hint: 'run_001', run: () => {} },
    ],
  },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Open: Story = {};
