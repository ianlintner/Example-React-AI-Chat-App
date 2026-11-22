import { mediaArtifactFixture } from '@agent-chat/contract/fixtures';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MediaArtifactPanel } from './media-artifact-panel';

const meta = {
  title: 'Media/Artifact panel',
  component: MediaArtifactPanel,
  globals: { theme: 'dark' },
  args: { part: mediaArtifactFixture },
} satisfies Meta<typeof MediaArtifactPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Malformed: Story = {
  args: { part: { kind: 'media', attachments: [{ type: 'script' }] } },
};
