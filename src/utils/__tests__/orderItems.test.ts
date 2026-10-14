import { describe, it, expect } from 'vitest';
import { isCustomizedItem, customizationExtra, itemLineTotal } from '../orderItems';

describe('orderItems', () => {
  describe('isCustomizedItem', () => {
    it('is true only with a non-blank description', () => {
      expect(isCustomizedItem({ customizationNotes: 'Papel comestible' })).toBe(true);
      expect(isCustomizedItem({ customizationNotes: '' })).toBe(false);
      expect(isCustomizedItem({ customizationNotes: '   ' })).toBe(false);
      expect(isCustomizedItem({ customizationNotes: null })).toBe(false);
      expect(isCustomizedItem({})).toBe(false);
    });
  });

  describe('customizationExtra', () => {
    it('returns the per-unit surcharge only for customized lines', () => {
      expect(customizationExtra({ customizationNotes: 'Topper', customizationPrice: 30 })).toBe(30);
      expect(customizationExtra({ customizationNotes: '', customizationPrice: 30 })).toBe(0);
      expect(customizationExtra({ customizationPrice: 30 })).toBe(0);
    });

    it('copes with a missing or non-numeric surcharge', () => {
      expect(customizationExtra({ customizationNotes: 'Topper' })).toBe(0);
      expect(customizationExtra({ customizationNotes: 'Topper', customizationPrice: Number.NaN })).toBe(0);
    });
  });

  describe('itemLineTotal', () => {
    it('is (price + surcharge) x quantity', () => {
      expect(itemLineTotal({ price: 80, quantity: 2, customizationNotes: 'Foto', customizationPrice: 30 })).toBe(220);
    });

    it('ignores a leftover surcharge on a line that is not customized', () => {
      expect(itemLineTotal({ price: 80, quantity: 2, customizationNotes: null, customizationPrice: 30 })).toBe(160);
    });

    it('a plain line is price x quantity', () => {
      expect(itemLineTotal({ price: 15, quantity: 3 })).toBe(45);
    });
  });
});
