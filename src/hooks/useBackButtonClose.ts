import { useCallback, useEffect, useRef, useState } from 'react';
import { registerBackLayer, unregisterBackLayer } from '@/lib/backNavigation';

export function useBackButtonClose(isOpen: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!isOpen) return;
    const layer = registerBackLayer(() => closeRef.current());
    return () => unregisterBackLayer(layer);
  }, [isOpen]);
}

interface DialogStateProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function useBackAwareDialog({ open, defaultOpen, onOpenChange }: DialogStateProps) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen ?? false);
  const controlled = open !== undefined;
  const isOpen = controlled ? open : innerOpen;

  const handleOpenChange = useCallback((next: boolean) => {
    if (!controlled) setInnerOpen(next);
    onOpenChange?.(next);
  }, [controlled, onOpenChange]);

  useBackButtonClose(isOpen, () => handleOpenChange(false));

  return { open: isOpen, onOpenChange: handleOpenChange };
}
