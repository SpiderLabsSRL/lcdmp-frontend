export type PaymentMode = 'cash' | 'qr' | 'mixed';

export interface SalePayment {
  method: 'cash' | 'qr';
  amount: number;
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;

// Pago mixto: el cajero escribe cuánto recibió en efectivo y el resto va por QR.
// Es válido solo si ambas partes son mayores a 0 (si no, es un pago de un solo método).
export const mixedSplit = (total: number, cashAmount: number) => {
  const cash = round2(Number.isFinite(cashAmount) ? cashAmount : 0);
  const qr = round2(total - cash);
  return { cash, qr, valid: cash > 0 && qr > 0 };
};

// Pagos a enviar al backend. Un método simple paga el total completo; el mixto reparte
// efectivo + QR y debe sumar exactamente el total.
export const buildPayments = (mode: PaymentMode, total: number, cashAmount: number): SalePayment[] => {
  if (mode !== 'mixed') {
    return [{ method: mode, amount: round2(total) }];
  }
  const { cash, qr } = mixedSplit(total, cashAmount);
  return [
    { method: 'cash', amount: cash },
    { method: 'qr', amount: qr },
  ];
};

export const describePayments = (payments: SalePayment[]): string =>
  payments
    .map(p => `${p.method === 'cash' ? 'Efectivo' : 'QR'}${payments.length > 1 ? ` Bs. ${p.amount}` : ''}`)
    .join(' + ');
