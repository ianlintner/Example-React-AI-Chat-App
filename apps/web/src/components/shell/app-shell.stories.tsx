import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppShell } from './app-shell';
import { AI_STATES, previewStates } from '@/lib/ui-states';

const meta = {
  title: 'Shell/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
  args: {
    thread: {
      id: 'thr_1',
      title: 'Vector database comparison',
      updated: 'now',
      status: 'idle',
    },
    state: previewStates.empty,
    threads: [
      {
        id: 'thr_1',
        title: 'Vector database comparison',
        updated: 'now',
        status: 'idle',
      },
    ],
    messages: [],
    onSend: () => {},
    onStop: () => {},
    onSelectThread: () => {},
    onBranch: () => {},
    onEdit: () => {},
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const Streaming: Story = {
  args: {
    state: previewStates.streaming,
    messages: previewStates.streaming.messages,
  },
};
export const RateLimited: Story = {
  args: {
    state: previewStates['rate-limited'],
    messages: previewStates['rate-limited'].messages,
  },
};
export const AllStates: Story = {
  render: args => (
    <div data-testid='states'>
      {AI_STATES.map(name => (
        <p key={name}>{name}</p>
      ))}
      <AppShell {...args} />
    </div>
  ),
};
