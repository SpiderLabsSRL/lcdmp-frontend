import type { OrderItem } from '@/types';

// Una línea de catálogo es "personalizada" si tiene descripción de lo que se personaliza.
export const isCustomizedItem = (item: Pick<OrderItem, 'customizationNotes'>): boolean =>
  typeof item.customizationNotes === 'string' && item.customizationNotes.trim() !== '';

// Recargo por unidad (0 si la línea no es personalizada)
export const customizationExtra = (item: Pick<OrderItem, 'customizationNotes' | 'customizationPrice'>): number =>
  isCustomizedItem(item) ? Number(item.customizationPrice) || 0 : 0;

// Total de la línea: (precio de catálogo + recargo por unidad) x cantidad
export const itemLineTotal = (item: Pick<OrderItem, 'price' | 'quantity' | 'customizationNotes' | 'customizationPrice'>): number =>
  ((Number(item.price) || 0) + customizationExtra(item)) * (Number(item.quantity) || 0);
