import { describe, it, expect, vi, afterEach } from 'vitest';
import { prepareImage } from '../image';

const makeFile = (name: string, type: string, bytes = 100) =>
  new File([new Uint8Array(bytes)], name, { type });

const stubBitmap = (width: number, height: number) => {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close }));
  return close;
};

const stubCanvas = (blob: Blob | null) => {
  const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn().mockReturnValue(context),
    toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(blob)),
  };
  vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLElement);
  return { canvas, context };
};

describe('prepareImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns non-images untouched', async () => {
    const file = makeFile('doc.pdf', 'application/pdf');

    expect(await prepareImage(file)).toBe(file);
  });

  it('returns the file untouched when the browser cannot decode images (no createImageBitmap)', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    const file = makeFile('foto.jpg', 'image/jpeg');

    expect(await prepareImage(file)).toBe(file);
  });

  it('does not recompress a JPEG that is already small enough', async () => {
    const close = stubBitmap(1200, 800);
    const file = makeFile('foto.jpg', 'image/jpeg', 200_000);

    expect(await prepareImage(file)).toBe(file);
    expect(close).toHaveBeenCalled();
  });

  it('scales a big photo down to 1600 px on the long side and re-encodes it as JPEG', async () => {
    stubBitmap(4000, 3000);
    const { canvas, context } = stubCanvas(new Blob(['x'], { type: 'image/jpeg' }));
    const file = makeFile('IMG_0001.HEIC.png', 'image/png', 5_000_000);

    const result = await prepareImage(file);

    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    expect(context.drawImage).toHaveBeenCalled();
    expect(context.fillStyle).toBe('#ffffff'); // transparencia sobre blanco
    expect(result).not.toBe(file);
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('IMG_0001.HEIC.jpg');
  });

  it('converts a small PNG to JPEG too (the server accepts both, but JPEG is lighter)', async () => {
    stubBitmap(800, 600);
    stubCanvas(new Blob(['x'], { type: 'image/jpeg' }));

    const result = await prepareImage(makeFile('logo.png', 'image/png', 50_000));

    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('logo.jpg');
  });

  it('falls back to the original file when decoding fails', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('cannot decode')));
    const file = makeFile('rara.heic', 'image/heic');

    expect(await prepareImage(file)).toBe(file);
  });

  it('falls back to the original file when the canvas produces no blob', async () => {
    stubBitmap(4000, 3000);
    stubCanvas(null);
    const file = makeFile('foto.jpg', 'image/jpeg', 5_000_000);

    expect(await prepareImage(file)).toBe(file);
  });
});
