import type { Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import '../src/styles.css';

/** Toolbar theme switch applying the same `.dark` class as the app. */
const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Instrument Panel theme',
      toolbar: { icon: 'mirror', items: ['dark', 'light'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'dark' },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === 'light' ? 'light' : 'dark';
      useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
      }, [theme]);
      return (
        <div className='bg-bg p-4 font-sans text-fg'>
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    a11y: { test: 'error' },
    controls: { expanded: true },
  },
};

export default preview;
