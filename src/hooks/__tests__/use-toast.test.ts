import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { reducer } from '../use-toast';

describe('toast reducer', () => {
  it('ADD_TOAST prepends the toast and enforces the toast limit of 1', () => {
    const state = { toasts: [{ id: '1', open: true }] } as any;

    const result = reducer(state, { type: 'ADD_TOAST', toast: { id: '2', open: true } } as any);

    expect(result.toasts).toHaveLength(1);
    expect(result.toasts[0].id).toBe('2');
  });

  it('UPDATE_TOAST merges fields into the matching toast', () => {
    const state = { toasts: [{ id: '1', open: true, title: 'old' }] } as any;

    const result = reducer(state, { type: 'UPDATE_TOAST', toast: { id: '1', title: 'new' } } as any);

    expect(result.toasts[0].title).toBe('new');
    expect(result.toasts[0].open).toBe(true);
  });

  it('DISMISS_TOAST sets open to false for the matching toast id only', () => {
    const state = {
      toasts: [
        { id: '1', open: true },
        { id: '2', open: true },
      ],
    } as any;

    const result = reducer(state, { type: 'DISMISS_TOAST', toastId: '1' } as any);

    expect(result.toasts.find((t: any) => t.id === '1')?.open).toBe(false);
    expect(result.toasts.find((t: any) => t.id === '2')?.open).toBe(true);
  });

  it('DISMISS_TOAST without a toastId sets open to false for all toasts', () => {
    const state = {
      toasts: [
        { id: '1', open: true },
        { id: '2', open: true },
      ],
    } as any;

    const result = reducer(state, { type: 'DISMISS_TOAST', toastId: undefined } as any);

    expect(result.toasts.every((t: any) => t.open === false)).toBe(true);
  });

  it('REMOVE_TOAST removes only the matching toast', () => {
    const state = {
      toasts: [
        { id: '1', open: true },
        { id: '2', open: true },
      ],
    } as any;

    const result = reducer(state, { type: 'REMOVE_TOAST', toastId: '1' } as any);

    expect(result.toasts).toHaveLength(1);
    expect(result.toasts[0].id).toBe('2');
  });

  it('REMOVE_TOAST without a toastId clears all toasts', () => {
    const state = { toasts: [{ id: '1', open: true }] } as any;

    const result = reducer(state, { type: 'REMOVE_TOAST', toastId: undefined } as any);

    expect(result.toasts).toHaveLength(0);
  });
});

describe('useToast / toast', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('toast() adds a toast that is exposed through useToast', async () => {
    const { useToast, toast } = await import('../use-toast');
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: 'Hello' });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Hello');
    expect(result.current.toasts[0].open).toBe(true);
  });

  it('enforces the toast limit, keeping only the most recently created toast', async () => {
    const { useToast, toast } = await import('../use-toast');
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: 'First' });
    });
    act(() => {
      toast({ title: 'Second' });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe('Second');
  });

  it('update() modifies the previously created toast', async () => {
    const { useToast, toast } = await import('../use-toast');
    const { result } = renderHook(() => useToast());

    let created: any;
    act(() => {
      created = toast({ title: 'Original' });
    });
    act(() => {
      created.update({ id: created.id, title: 'Updated' });
    });

    expect(result.current.toasts[0].title).toBe('Updated');
  });

  it("the object returned by toast() closes it immediately via dismiss()", async () => {
    const { useToast, toast } = await import('../use-toast');
    const { result } = renderHook(() => useToast());

    let created: any;
    act(() => {
      created = toast({ title: 'To close' });
    });
    act(() => {
      created.dismiss();
    });

    expect(result.current.toasts[0].open).toBe(false);
  });

  it('removes the toast from state only after the remove delay elapses', async () => {
    vi.useFakeTimers();
    const { useToast, toast } = await import('../use-toast');
    const { result } = renderHook(() => useToast());

    act(() => {
      toast({ title: 'Temp' });
    });
    act(() => {
      result.current.dismiss();
    });

    expect(result.current.toasts[0].open).toBe(false);
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(999999);
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("useToast's dismiss(id) closes only the matching toast", async () => {
    const { useToast, toast } = await import('../use-toast');
    const { result } = renderHook(() => useToast());

    let created: any;
    act(() => {
      created = toast({ title: 'Only one' });
    });
    act(() => {
      result.current.dismiss(created.id);
    });

    expect(result.current.toasts[0].open).toBe(false);
  });
});
