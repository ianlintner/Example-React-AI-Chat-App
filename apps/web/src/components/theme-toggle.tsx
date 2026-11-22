import { getTheme, setTheme, type Theme } from '@agent-chat/ui';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/** Light/dark switch. The initial class is set pre-paint by THEME_INIT_SCRIPT. */
export function ThemeToggle() {
  const [theme, setLocal] = useState<Theme>('dark');
  useEffect(() => setLocal(getTheme()), []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <Button
      variant='outline'
      size='sm'
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        setTheme(next);
        setLocal(next);
      }}
    >
      {theme === 'dark' ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
      {next === 'light' ? 'Light' : 'Dark'}
    </Button>
  );
}
