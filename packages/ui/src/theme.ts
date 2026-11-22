import type { Theme } from './tokens';

export const THEME_STORAGE_KEY = 'agent-chat.theme';

/**
 * Inline <head> script: applies the persisted theme (or the OS preference)
 * before first paint so there is no flash. Dark is the fallback.
 * Fully static (no interpolation): it is injected with
 * dangerouslySetInnerHTML. A test asserts the key literal matches
 * THEME_STORAGE_KEY.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k='agent-chat.theme';var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}})();`;

export function getTheme(doc: Document = document): Theme {
  return doc.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(theme: Theme, doc: Document = document) {
  doc.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable (private mode); the class still applies.
  }
}
