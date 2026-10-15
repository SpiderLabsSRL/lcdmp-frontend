import { describe, it, expect } from 'vitest';
import { mixedSplit, buildPayments, describePayments, round2 } from '../payments';

describe('payments', () => {
  describe('round2', () => {
    it('rounds to cents', () => {
      expect(round2(10.005)).toBeCloseTo(10.01, 2);
      expect(round2(0.1 + 0.2)).toBe(0.3);
    });
  });

  describe('mixedSplit', () => {
    it('the QR part is the rest of the total after the cash received', () => {
      expect(mixedSplit(100, 60)).toEqual({ cash: 60, qr: 40, valid: true });
    });

    it('handles cents without floating point noise', () => {
      expect(mixedSplit(0.3, 0.1)).toEqual({ cash: 0.1, qr: 0.2, valid: true });
      expect(mixedSplit(99.99, 50.5)).toEqual({ cash: 50.5, qr: 49.49, valid: true });
    });

    it.each([
      ['no cash entered', 0],
      ['negative cash', -5],
      ['cash equal to the total (nothing left for QR)', 100],
      ['cash above the total', 150],
      ['NaN', Number.NaN],
    ])('is not a valid mixed payment with %s', (_name, cash) => {
      expect(mixedSplit(100, cash).valid).toBe(false);
    });
  });

  describe('buildPayments', () => {
    it('a single method pays the whole total', () => {
      expect(buildPayments('cash', 100, 0)).toEqual([{ method: 'cash', amount: 100 }]);
      expect(buildPayments('qr', 100, 40)).toEqual([{ method: 'qr', amount: 100 }]); // ignora el efectivo escrito
    });

    it('mixed splits into cash + qr and adds up exactly to the total', () => {
      const payments = buildPayments('mixed', 100, 60);

      expect(payments).toEqual([{ method: 'cash', amount: 60 }, { method: 'qr', amount: 40 }]);
      expect(payments.reduce((s, p) => s + p.amount, 0)).toBe(100);
    });

    it('mixed with cents still adds up exactly', () => {
      const payments = buildPayments('mixed', 33.33, 10.1);

      expect(round2(payments.reduce((s, p) => s + p.amount, 0))).toBe(33.33);
    });
  });

  describe('describePayments', () => {
    it('names a single method without amounts', () => {
      expect(describePayments([{ method: 'qr', amount: 100 }])).toBe('QR');
    });

    it('lists the amount of each part of a mixed payment', () => {
      expect(describePayments([{ method: 'cash', amount: 60 }, { method: 'qr', amount: 40 }]))
        .toBe('Efectivo Bs. 60 + QR Bs. 40');
    });
  });
});
