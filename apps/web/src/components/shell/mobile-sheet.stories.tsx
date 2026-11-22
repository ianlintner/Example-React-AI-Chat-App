import type { Meta, StoryObj } from '@storybook/react-vite';
import { MobileSheet } from './mobile-sheet';

const meta = {
  title: 'Shell/MobileSheet',
  component: MobileSheet,
  args: { open: true, onClose: () => {}, title: 'Run status' },
  decorators: [
    Story => (
      <div className='h-dvh w-full md:hidden'>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MobileSheet>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Open: Story = {
  args: {
    children: <p className='text-sm'>Research route resets at 09:00.</p>,
  },
};
