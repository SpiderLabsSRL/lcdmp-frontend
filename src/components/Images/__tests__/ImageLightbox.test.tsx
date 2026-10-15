import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReferenceImages } from '../ReferenceImages';

// jsdom no trae PointerEvent: sin esto fireEvent.pointer* pierde clientX/clientY y pointerId.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  (window as any).PointerEvent = PointerEventPolyfill;
}

const IMAGES = ['https://signed/a.jpg', 'https://signed/b.jpg', 'https://signed/c.jpg'];

const open = async (user: ReturnType<typeof userEvent.setup>, images = IMAGES, thumb = 1) => {
  render(<ReferenceImages images={images} />);
  await user.click(screen.getByAltText(`Referencia ${thumb}`));
  return screen.getByRole('dialog');
};

const zoomLevel = () => screen.getByTestId('zoom-level').textContent;
const enlarged = () => screen.getByRole('img', { name: /ampliada/ });

describe('ImageLightbox (opened from a reference image)', () => {
  beforeEach(() => {
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('enlarges the tapped image in an overlay instead of navigating or opening another window', async () => {
    const user = userEvent.setup();
    await open(user, IMAGES, 2);

    expect(enlarged()).toHaveAttribute('src', 'https://signed/b.jpg');
    expect(enlarged()).toHaveAttribute('alt', 'Referencia 2 ampliada');
    expect(window.open).not.toHaveBeenCalled();
    expect(document.querySelector('a[target="_blank"]')).toBeNull();
  });

  it('starts at 100% and is closed until a thumbnail is tapped', async () => {
    const user = userEvent.setup();
    render(<ReferenceImages images={IMAGES} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByAltText('Referencia 1'));

    expect(zoomLevel()).toBe('100%');
  });

  describe('zoom', () => {
    it('zooms in and out with the buttons, and cannot zoom out below 100%', async () => {
      const user = userEvent.setup();
      await open(user);

      await user.click(screen.getByRole('button', { name: 'Acercar' }));
      expect(zoomLevel()).toBe('150%');
      await user.click(screen.getByRole('button', { name: 'Acercar' }));
      expect(zoomLevel()).toBe('225%');

      await user.click(screen.getByRole('button', { name: 'Alejar' }));
      await user.click(screen.getByRole('button', { name: 'Alejar' }));
      expect(zoomLevel()).toBe('100%');
      expect(screen.getByRole('button', { name: 'Alejar' })).toBeDisabled();
    });

    it('stops zooming in at 600%', async () => {
      const user = userEvent.setup();
      await open(user);

      for (let i = 0; i < 8; i++) {
        const zoomIn = screen.getByRole('button', { name: 'Acercar' });
        if (!(zoomIn as HTMLButtonElement).disabled) await user.click(zoomIn);
      }

      expect(zoomLevel()).toBe('600%');
      expect(screen.getByRole('button', { name: 'Acercar' })).toBeDisabled();
    });

    it('applies the zoom to the image with a CSS transform', async () => {
      const user = userEvent.setup();
      await open(user);

      await user.click(screen.getByRole('button', { name: 'Acercar' }));

      expect(enlarged().style.transform).toContain('scale(1.5)');
    });

    it('zooms with the mouse wheel (up = in, down = out)', async () => {
      const user = userEvent.setup();
      await open(user);
      const stage = enlarged().parentElement!;

      fireEvent.wheel(stage, { deltaY: -100 });
      expect(zoomLevel()).toBe('115%');
      fireEvent.wheel(stage, { deltaY: 100 });
      expect(zoomLevel()).toBe('100%');
      fireEvent.wheel(stage, { deltaY: 100 }); // ya está al mínimo
      expect(zoomLevel()).toBe('100%');
    });

    it('double tap zooms in to 250% and a second double tap goes back to 100%', async () => {
      const user = userEvent.setup();
      await open(user);
      const stage = enlarged().parentElement!;

      fireEvent.doubleClick(stage);
      expect(zoomLevel()).toBe('250%');
      fireEvent.doubleClick(stage);
      expect(zoomLevel()).toBe('100%');
    });

    it('"Restablecer zoom" goes back to 100% and is disabled when there is nothing to reset', async () => {
      const user = userEvent.setup();
      await open(user);
      expect(screen.getByRole('button', { name: 'Restablecer zoom' })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: 'Acercar' }));
      await user.click(screen.getByRole('button', { name: 'Restablecer zoom' }));

      expect(zoomLevel()).toBe('100%');
      expect(enlarged().style.transform).toContain('scale(1)');
    });

    it('supports the keyboard: + and - zoom, 0 resets', async () => {
      const user = userEvent.setup();
      await open(user);

      await user.keyboard('+');
      expect(zoomLevel()).toBe('150%');
      await user.keyboard('-');
      expect(zoomLevel()).toBe('100%');
      await user.keyboard('+++');
      await user.keyboard('0');
      expect(zoomLevel()).toBe('100%');
    });
  });

  describe('touch gestures', () => {
    const pointer = (el: Element, type: 'pointerDown' | 'pointerMove' | 'pointerUp', id: number, x: number, y: number) =>
      fireEvent[type](el, { pointerId: id, clientX: x, clientY: y });

    it('pinching two fingers apart zooms in proportionally to the distance', async () => {
      const user = userEvent.setup();
      await open(user);
      const stage = enlarged().parentElement!;

      pointer(stage, 'pointerDown', 1, 100, 100);
      pointer(stage, 'pointerDown', 2, 200, 100); // distancia inicial: 100
      pointer(stage, 'pointerMove', 2, 300, 100); // ahora 200 => x2

      expect(zoomLevel()).toBe('200%');

      pointer(stage, 'pointerMove', 2, 150, 100); // 50 => x0.5 (mínimo 100%)
      expect(zoomLevel()).toBe('100%');
    });

    it('dragging with one finger moves the image only while zoomed in', async () => {
      const user = userEvent.setup();
      await open(user);
      const stage = enlarged().parentElement!;

      // sin zoom no hay nada que mover
      pointer(stage, 'pointerDown', 1, 100, 100);
      pointer(stage, 'pointerMove', 1, 160, 130);
      pointer(stage, 'pointerUp', 1, 160, 130);
      expect(enlarged().style.transform).toContain('translate(0px, 0px)');

      await user.click(screen.getByRole('button', { name: 'Acercar' }));
      pointer(stage, 'pointerDown', 1, 100, 100);
      pointer(stage, 'pointerMove', 1, 160, 130);
      pointer(stage, 'pointerUp', 1, 160, 130);

      expect(enlarged().style.transform).toContain('translate(60px, 30px)');
    });

    it('resetting the zoom also puts the image back in place', async () => {
      const user = userEvent.setup();
      await open(user);
      const stage = enlarged().parentElement!;
      await user.click(screen.getByRole('button', { name: 'Acercar' }));
      pointer(stage, 'pointerDown', 1, 100, 100);
      pointer(stage, 'pointerMove', 1, 150, 150);
      pointer(stage, 'pointerUp', 1, 150, 150);

      await user.click(screen.getByRole('button', { name: 'Restablecer zoom' }));

      expect(enlarged().style.transform).toContain('translate(0px, 0px)');
    });
  });

  describe('several images', () => {
    it('shows a counter and goes to the next / previous image, wrapping around', async () => {
      const user = userEvent.setup();
      await open(user, IMAGES, 1);
      expect(screen.getByText('1 / 3')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Imagen siguiente' }));
      expect(enlarged()).toHaveAttribute('src', 'https://signed/b.jpg');
      expect(screen.getByText('2 / 3')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Imagen anterior' }));
      await user.click(screen.getByRole('button', { name: 'Imagen anterior' }));
      expect(enlarged()).toHaveAttribute('src', 'https://signed/c.jpg'); // de la primera, hacia atrás
    });

    it('navigates with the arrow keys', async () => {
      const user = userEvent.setup();
      await open(user, IMAGES, 1);

      await user.keyboard('{ArrowRight}');
      expect(enlarged()).toHaveAttribute('src', 'https://signed/b.jpg');
      await user.keyboard('{ArrowLeft}');
      expect(enlarged()).toHaveAttribute('src', 'https://signed/a.jpg');
    });

    it('every image starts without zoom', async () => {
      const user = userEvent.setup();
      await open(user, IMAGES, 1);
      await user.click(screen.getByRole('button', { name: 'Acercar' }));
      expect(zoomLevel()).toBe('150%');

      await user.click(screen.getByRole('button', { name: 'Imagen siguiente' }));

      expect(zoomLevel()).toBe('100%');
    });

    it('a single image has no counter and no arrows', async () => {
      const user = userEvent.setup();
      await open(user, ['https://signed/a.jpg'], 1);

      expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Imagen siguiente' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Imagen anterior' })).not.toBeInTheDocument();
    });
  });

  describe('closing', () => {
    it('closes with the X button', async () => {
      const user = userEvent.setup();
      await open(user);

      await user.click(screen.getByRole('button', { name: 'Cerrar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes with Escape', async () => {
      const user = userEvent.setup();
      await open(user);

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes when tapping the dark background, but not when tapping the image', async () => {
      const user = userEvent.setup();
      await open(user);

      await user.click(enlarged());
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await user.click(enlarged().parentElement!); // fondo del visor
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    describe('the click retargeted to the stage by pointer capture (real browsers)', () => {
      // En un navegador real el click llega al contenedor aunque se haya tocado la imagen:
      // se decide por las coordenadas respecto del rectángulo de la imagen.
      const withImageRect = () => {
        const img = enlarged();
        vi.spyOn(img, 'getBoundingClientRect').mockReturnValue({
          left: 100, right: 500, top: 100, bottom: 400, width: 400, height: 300, x: 100, y: 100, toJSON: () => ({}),
        } as DOMRect);
        return img.parentElement!;
      };

      it('a tap inside the image does not close the viewer', async () => {
        const user = userEvent.setup();
        await open(user);
        const stage = withImageRect();

        fireEvent.click(stage, { clientX: 250, clientY: 250 });

        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      it('a tap outside the image (dark background) closes it', async () => {
        const user = userEvent.setup();
        await open(user);
        const stage = withImageRect();

        fireEvent.click(stage, { clientX: 20, clientY: 20 });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      it('finishing a drag over the background does not close it', async () => {
        const user = userEvent.setup();
        await open(user);
        await user.click(screen.getByRole('button', { name: 'Acercar' }));
        const stage = withImageRect();

        fireEvent.pointerDown(stage, { pointerId: 1, clientX: 300, clientY: 300 });
        fireEvent.pointerMove(stage, { pointerId: 1, clientX: 20, clientY: 20 });
        fireEvent.pointerUp(stage, { pointerId: 1, clientX: 20, clientY: 20 });
        fireEvent.click(stage, { clientX: 20, clientY: 20 }); // el click que sigue a soltar

        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      it('a plain tap right after a previous drag works again (the drag flag resets)', async () => {
        const user = userEvent.setup();
        await open(user);
        await user.click(screen.getByRole('button', { name: 'Acercar' }));
        const stage = withImageRect();
        fireEvent.pointerDown(stage, { pointerId: 1, clientX: 300, clientY: 300 });
        fireEvent.pointerMove(stage, { pointerId: 1, clientX: 200, clientY: 200 });
        fireEvent.pointerUp(stage, { pointerId: 1, clientX: 200, clientY: 200 });

        fireEvent.pointerDown(stage, { pointerId: 2, clientX: 20, clientY: 20 });
        fireEvent.pointerUp(stage, { pointerId: 2, clientX: 20, clientY: 20 });
        fireEvent.click(stage, { clientX: 20, clientY: 20 });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('opens again without the previous zoom', async () => {
      const user = userEvent.setup();
      render(<ReferenceImages images={IMAGES} />);
      await user.click(screen.getByAltText('Referencia 1'));
      await user.click(screen.getByRole('button', { name: 'Acercar' }));
      await user.click(screen.getByRole('button', { name: 'Cerrar' }));

      await user.click(screen.getByAltText('Referencia 1'));

      expect(zoomLevel()).toBe('100%');
    });
  });

  it('keeps the thumbnails reachable by their alt text once the viewer is closed', async () => {
    const user = userEvent.setup();
    const dialog = await open(user);
    expect(within(dialog).getByRole('img', { name: /ampliada/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(screen.getByAltText('Referencia 1')).toBeInTheDocument();
  });
});
