import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('smoke', () => {
  it('cn merges classes', () => {
    const maybe: string | undefined = undefined;
    expect(cn('a', 'b', maybe)).toBe('a b');
  });
});
