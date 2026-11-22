import type { Meta, StoryObj } from '@storybook/react-vite';
import { McpAppFrame } from './mcp-app-frame';

const meta = {
  title: 'Media/McpAppFrame',
  component: McpAppFrame,
  globals: { theme: 'dark' },
  parameters: { layout: 'padded' },
  args: {
    uri: 'ui://tools/dice-roller',
    html: '<p style="font:14px sans-serif;padding:16px">Sandboxed MCP App content</p>',
  },
} satisfies Meta<typeof McpAppFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithOrigins: Story = {
  args: { allowedOrigins: ['https://localhost:8787'] },
};
