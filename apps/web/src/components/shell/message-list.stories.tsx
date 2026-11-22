import type { Meta, StoryObj } from '@storybook/react-vite';
import { MessageList } from './message-list';

const meta = {
  title: 'Shell/MessageList',
  component: MessageList,
  args: { messages: [] },
} satisfies Meta<typeof MessageList>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const Conversation: Story = {
  args: {
    messages: [
      { id: '1', role: 'user', text: 'Compare three local vector databases.' },
      { id: '2', role: 'assistant', text: 'Reading the primary sources now.' },
    ],
  },
};
