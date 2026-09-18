import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn', () => {
  it('joins simple class name strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('ignores falsy values', () => {
    expect(cn('a', false, null, undefined, 0, '', 'b')).toBe('a b');
  });

  it('supports conditional object syntax', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('merges conflicting tailwind spacing classes, keeping the last one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('merges conflicting tailwind color utilities, keeping the last one', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('combines arrays of class names', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });

  it('keeps non-conflicting classes while deduping conflicting ones', () => {
    expect(cn('px-2 py-1', 'bg-red-500', { 'bg-blue-500': true }, 'px-4')).toContain('py-1');
  });

  it('returns an empty string when given no meaningful input', () => {
    expect(cn()).toBe('');
    expect(cn(false, undefined, null)).toBe('');
  });
});
