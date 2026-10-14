import { describe, it, expect } from 'vitest';
import { cakeShapes, getCakeShapeLabel } from '../consts';

describe('cake shapes', () => {
  it('includes the long cake shape, stored as the long-cake slug', () => {
    expect(cakeShapes).toContainEqual({ value: 'long-cake', label: 'Long cake' });
  });

  it('has unique values', () => {
    const values = cakeShapes.map(s => s.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('getCakeShapeLabel turns a stored slug into its label', () => {
    expect(getCakeShapeLabel('long-cake')).toBe('Long cake');
    expect(getCakeShapeLabel('dos-pisos')).toBe('Dos pisos');
    expect(getCakeShapeLabel('corazon')).toBe('Corazón');
  });

  it('getCakeShapeLabel leaves unknown or legacy values as they are, and handles empty ones', () => {
    expect(getCakeShapeLabel('Redonda')).toBe('Redonda');
    expect(getCakeShapeLabel('octogonal')).toBe('octogonal');
    expect(getCakeShapeLabel(undefined)).toBe('');
    expect(getCakeShapeLabel(null)).toBe('');
  });
});
