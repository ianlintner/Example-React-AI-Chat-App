import { mediaAttachmentsFixture } from '@agent-chat/contract/fixtures';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MediaAttachmentView } from './media-attachments';

const meta = {
  title: 'Media/Attachment renderers',
  component: MediaAttachmentView,
  globals: { theme: 'dark' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof MediaAttachmentView>;

export default meta;
type Story = StoryObj<typeof meta>;

const byType = (type: string) =>
  mediaAttachmentsFixture.find(a => a.type === type)!;

export const YouTube: Story = { args: { attachment: byType('youtube') } };
export const Gif: Story = { args: { attachment: byType('gif') } };
export const Audio: Story = { args: { attachment: byType('audio') } };
export const Image: Story = { args: { attachment: byType('image') } };
export const Gallery: Story = { args: { attachment: byType('image_gallery') } };
export const Video: Story = { args: { attachment: byType('video') } };
export const Dice: Story = { args: { attachment: byType('dice') } };
export const Card: Story = { args: { attachment: byType('card') } };
