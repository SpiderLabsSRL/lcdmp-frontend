import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '../use-mobile';

function setInnerWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
}

function mockMatchMedia() {
  let changeListener: (() => void) | undefined;
  const mql = {
    matches: false,
    media: '',
    addEventListener: (event: string, cb: () => void) => {
      if (event === 'change') changeListener = cb;
    },
    removeEventListener: (event: string, cb: () => void) => {
      if (event === 'change' && changeListener === cb) changeListener = undefined;
    },
  };

  window.matchMedia = ((query: string) => {
    mql.media = query;
    return mql as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  return {
    triggerChange: () => changeListener?.(),
  };
}

describe('useIsMobile', () => {
  const originalMatchMedia = window.matchMedia;
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    setInnerWidth(originalInnerWidth);
  });

  it('returns true when innerWidth is below the mobile breakpoint (767)', () => {
    mockMatchMedia();
    setInnerWidth(767);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('returns false when innerWidth is at the desktop breakpoint (768)', () => {
    mockMatchMedia();
    setInnerWidth(768);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('returns false for a clearly desktop width', () => {
    mockMatchMedia();
    setInnerWidth(1440);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('returns true for a clearly mobile width', () => {
    mockMatchMedia();
    setInnerWidth(320);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('updates when the media query change event fires after a resize', () => {
    const { triggerChange } = mockMatchMedia();
    setInnerWidth(1024);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    setInnerWidth(400);
    act(() => {
      triggerChange();
    });

    expect(result.current).toBe(true);
  });

  it('updates back to false when the width grows past the breakpoint again', () => {
    const { triggerChange } = mockMatchMedia();
    setInnerWidth(320);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    setInnerWidth(1280);
    act(() => {
      triggerChange();
    });

    expect(result.current).toBe(false);
  });
});
