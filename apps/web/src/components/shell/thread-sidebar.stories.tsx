import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThreadSidebar } from './thread-sidebar';

const meta = {
  title: 'Shell/ThreadSidebar',
  component: ThreadSidebar,
  args: {
    activeId: 'thr_1',
    threads: [
      {
        id: 'thr_1',
        title: 'Vector database comparison',
        updated: 'now',
        status: 'running',
      },
      {
        id: 'thr_2',
        title: 'Weekly digest',
        updated: '2h',
        status: 'attention',
      },
      {
        id: 'thr_3',
        title: 'Failed report',
        updated: '2d',
        status: 'error',
        branchOf: 'thr_1',
      },
    ],
    onSelect: () => {},
    onNew: () => {},
    onOpenPalette: () => {},
  },
} satisfies Meta<typeof ThreadSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
