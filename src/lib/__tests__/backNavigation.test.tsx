import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { registerBackLayer, unregisterBackLayer, __resetBackNavigation } from '../backNavigation';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';

const layerOf = () => window.history.state?.__dialogLayer;
const settle = () => act(async () => { await new Promise(r => setTimeout(r, 30)); });
const pressBack = async () => { window.history.back(); await settle(); };

// Entrada "página" estable debajo de los diálogos, para poder ver cuándo se navega de verdad
let pageEntryState: unknown;

beforeEach(() => {
  __resetBackNavigation();
  window.history.replaceState({ idx: 1, key: 'page' }, '', '/');
  pageEntryState = window.history.state;
});

afterEach(() => {
  __resetBackNavigation();
});

describe('backNavigation (layers)', () => {
  it('opening a layer adds one history entry with the same URL, keeping the router state', () => {
    const before = window.history.length;

    const layer = registerBackLayer(() => {});

    expect(window.history.length).toBe(before + 1);
    expect(window.location.pathname).toBe('/');
    expect(window.history.state).toMatchObject({ idx: 1, key: 'page', __dialogLayer: layer.id });
    unregisterBackLayer(layer);
  });

  it('the back button closes the layer instead of leaving the page, and leaves the page entry current', async () => {
    const close = vi.fn();
    registerBackLayer(close);

    await pressBack();

    expect(close).toHaveBeenCalledTimes(1);
    expect(window.history.state).toEqual(pageEntryState);
    expect(layerOf()).toBeUndefined();
  });

  it('closing the layer by other means removes its history entry, so the next back is a real back', async () => {
    const layer = registerBackLayer(() => {});

    unregisterBackLayer(layer);
    await settle();

    expect(layerOf()).toBeUndefined();
    expect(window.history.state).toEqual(pageEntryState);
  });

  it('the cleanup after a back-button close does not remove another entry', async () => {
    const closeFn = vi.fn();
    const layer = registerBackLayer(closeFn);
    await pressBack();
    expect(closeFn).toHaveBeenCalledTimes(1);

    // el diálogo se desmonta luego por el estado de React: no debe volver a retroceder
    unregisterBackLayer(layer);
    await settle();

    expect(window.history.state).toEqual(pageEntryState);
  });

  it('with stacked layers, back closes the last one opened first', async () => {
    const first = vi.fn();
    const second = vi.fn();
    registerBackLayer(first);
    registerBackLayer(second);

    await pressBack();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();

    await pressBack();
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('with no layer open, back is NOT intercepted (a normal navigation)', async () => {
    const close = vi.fn();
    const layer = registerBackLayer(close);
    unregisterBackLayer(layer);
    await settle();

    await pressBack();

    expect(close).not.toHaveBeenCalled();
  });

  it('does not remove the history entry when the page changed in between (menu that navigates and closes)', async () => {
    const layer = registerBackLayer(() => {});
    window.history.pushState({ idx: 2, key: 'otra-pagina' }, '', '/orders'); // se navegó
    const backSpy = vi.spyOn(window.history, 'back');

    unregisterBackLayer(layer);

    expect(backSpy).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/orders');
    backSpy.mockRestore();
    window.history.replaceState({ idx: 1, key: 'page' }, '', '/');
  });

  it('closing a lower layer while a higher one stays does not touch the history (that entry is not on top)', () => {
    const lower = registerBackLayer(() => {});
    const higher = registerBackLayer(() => {});
    const backSpy = vi.spyOn(window.history, 'back');

    unregisterBackLayer(lower);

    expect(backSpy).not.toHaveBeenCalled();
    backSpy.mockRestore();
    unregisterBackLayer(higher);
  });
});

describe('Dialog / AlertDialog / Sheet close with the back button', () => {
  it('a controlled Dialog calls onOpenChange(false) on back, and the page is not left', async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Detalles</DialogTitle>
          <DialogDescription>x</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(layerOf()).toBeDefined();

    await pressBack();

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(window.location.pathname).toBe('/');
    expect(window.history.state).toEqual(pageEntryState);
  });

  const Uncontrolled = () => (
    <Dialog>
      <DialogTrigger>Abrir</DialogTrigger>
      <DialogContent>
        <DialogTitle>Detalles</DialogTitle>
        <DialogDescription>x</DialogDescription>
      </DialogContent>
    </Dialog>
  );

  it('an uncontrolled Dialog (opened by its trigger) closes with back', async () => {
    const user = userEvent.setup();
    render(<Uncontrolled />);
    await user.click(screen.getByText('Abrir'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await pressBack();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closing with Escape leaves no extra history entry behind', async () => {
    const user = userEvent.setup();
    render(<Uncontrolled />);
    await user.click(screen.getByText('Abrir'));
    expect(layerOf()).toBeDefined();

    await user.keyboard('{Escape}');
    await settle();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(layerOf()).toBeUndefined();
    expect(window.history.state).toEqual(pageEntryState);
  });

  it('can be reopened after closing with back, and back works again', async () => {
    const user = userEvent.setup();
    render(<Uncontrolled />);

    await user.click(screen.getByText('Abrir'));
    await pressBack();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByText('Abrir'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await pressBack();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.history.state).toEqual(pageEntryState);
  });

  it('a Dialog that stays closed adds nothing to the history', () => {
    const before = window.history.length;
    render(
      <Dialog open={false} onOpenChange={() => {}}>
        <DialogContent>
          <DialogTitle>x</DialogTitle>
          <DialogDescription>x</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    expect(window.history.length).toBe(before);
    expect(layerOf()).toBeUndefined();
  });

  it('an AlertDialog closes with back', async () => {
    const Harness = () => {
      const [open, setOpen] = useState(true);
      return (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogTitle>¿Seguro?</AlertDialogTitle>
            <AlertDialogDescription>x</AlertDialogDescription>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
          </AlertDialogContent>
        </AlertDialog>
      );
    };
    render(<Harness />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await pressBack();

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('a Sheet (the mobile menu) closes with back', async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger>Menú</SheetTrigger>
        <SheetContent side="left">
          <SheetTitle>Navegación</SheetTitle>
          <SheetDescription>x</SheetDescription>
        </SheetContent>
      </Sheet>
    );
    await user.click(screen.getByText('Menú'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await pressBack();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a Dialog opened over another: back closes only the top one, a second back closes the other', async () => {
    const user = userEvent.setup();
    const Stacked = () => {
      const [inner, setInner] = useState(false);
      const [outer, setOuter] = useState(true);
      return (
        <Dialog open={outer} onOpenChange={setOuter}>
          <DialogContent>
            <DialogTitle>Detalles</DialogTitle>
            <DialogDescription>x</DialogDescription>
            <button type="button" onClick={() => setInner(true)}>Abrir segundo</button>
            <Dialog open={inner} onOpenChange={setInner}>
              <DialogContent>
                <DialogTitle>Segundo</DialogTitle>
                <DialogDescription>y</DialogDescription>
              </DialogContent>
            </Dialog>
          </DialogContent>
        </Dialog>
      );
    };
    render(<Stacked />);
    await user.click(screen.getByText('Abrir segundo'));
    expect(screen.getByText('Segundo')).toBeInTheDocument();

    await pressBack();

    expect(screen.queryByText('Segundo')).not.toBeInTheDocument();
    expect(screen.getByText('Detalles')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');

    await pressBack();
    expect(screen.queryByText('Detalles')).not.toBeInTheDocument();
  });

  it('unmounting an open Dialog (leaving the screen) removes its entry', async () => {
    const { unmount } = render(
      <Dialog open onOpenChange={() => {}}>
        <DialogContent>
          <DialogTitle>x</DialogTitle>
          <DialogDescription>x</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(layerOf()).toBeDefined();

    unmount();
    await waitFor(() => expect(layerOf()).toBeUndefined());
  });
});
