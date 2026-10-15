import { describe, it, expect } from 'vitest';
import { sanitizePhone, PHONE_MAX_DIGITS } from '../phone';

describe('sanitizePhone', () => {
  it('leaves a clean number untouched', () => {
    expect(sanitizePhone('71234567')).toBe('71234567');
  });

  it('removes separators, symbols and letters', () => {
    expect(sanitizePhone('+591 (7) 123-4567')).toBe('59171234567');
    expect(sanitizePhone('Tel: 712.345.67')).toBe('71234567');
  });

  it.each([
    ['zero-width space', '\u200B'],
    ['zero-width joiner', '\u200D'],
    ['byte order mark', '\uFEFF'],
    ['non-breaking space', '\u00A0'],
    ['left-to-right mark', '\u200E'],
    ['right-to-left mark', '\u200F'],
    ['soft hyphen', '\u00AD'],
    ['line separator', '\u2028'],
    ['tab and line breaks', '\t\r\n'],
  ])('removes the invisible %s that hides inside pasted numbers', (_name, invisible) => {
    expect(sanitizePhone(`712${invisible}34${invisible}567`)).toBe('71234567');
  });

  it('removes digits that are not 0-9 (fullwidth, Arabic-Indic): the rule is strict', () => {
    expect(sanitizePhone('１２３٤٥٦7')).toBe('7');
  });

  it('returns an empty string when there is no digit at all', () => {
    expect(sanitizePhone('---  ()')).toBe('');
    expect(sanitizePhone('')).toBe('');
  });

  it('exposes the same 20-digit limit as the database column', () => {
    expect(PHONE_MAX_DIGITS).toBe(20);
  });
});
