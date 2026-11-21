import type { StorybookConfig } from '@storybook/react-vite';

// Storybook builds components in isolation with its own Vite config
// (Tailwind + React, no TanStack Start plugin): stories must not depend on
// the router or server functions.
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  core: {
    disableTelemetry: true,
    builder: {
      name: '@storybook/builder-vite',
      options: { viteConfigPath: '.storybook/vite.config.ts' },
    },
  },
};

export default config;
