import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '@/api/api';
import { UploadsApi } from '../UploadsApi';

const mockedApi = api as unknown as {
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const photo = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'foto.jpg', { type: 'image/jpeg' });

describe('UploadsApi', () => {
  let uploadsApi: UploadsApi;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    uploadsApi = new UploadsApi();
  });

  it('uploadOrderImage posts the file as multipart field "image" and returns key + signed url', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: true, data: { key: 'Pedidos/a.jpg', url: 'https://signed/a.jpg' } } });
    const file = photo();

    const result = await uploadsApi.uploadOrderImage(file);

    expect(result).toEqual({ key: 'Pedidos/a.jpg', url: 'https://signed/a.jpg' });
    const [url, body, config] = mockedApi.post.mock.calls[0];
    expect(url).toBe('/uploads/order-image');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('image')).toBe(file);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
  });

  it('uploadOrderImage surfaces the backend message', async () => {
    mockedApi.post.mockRejectedValue({ response: { data: { message: 'La imagen supera los 10 MB' } } });

    await expect(uploadsApi.uploadOrderImage(photo())).rejects.toThrow('La imagen supera los 10 MB');
  });

  it('uploadProductImage posts to the product endpoint and returns the public url', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: true, data: { image: 'https://img.example.com/Productos/p1/a.jpg' } } });

    const url = await uploadsApi.uploadProductImage('p1', photo());

    expect(url).toBe('https://img.example.com/Productos/p1/a.jpg');
    expect(mockedApi.post.mock.calls[0][0]).toBe('/products/p1/image');
    expect((mockedApi.post.mock.calls[0][1] as FormData).get('image')).toBeInstanceOf(File);
  });

  it('uploadProductImage throws the backend message when success is false', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: false, message: 'Producto no encontrado' } });

    await expect(uploadsApi.uploadProductImage('zz', photo())).rejects.toThrow('Producto no encontrado');
  });

  it('removeProductImage deletes the product image', async () => {
    mockedApi.delete.mockResolvedValue({ data: { success: true } });

    await expect(uploadsApi.removeProductImage('p1')).resolves.toBeUndefined();
    expect(mockedApi.delete).toHaveBeenCalledWith('/products/p1/image');
  });

  it('removeProductImage reports a connection error', async () => {
    mockedApi.delete.mockRejectedValue(new Error('Network Error'));

    await expect(uploadsApi.removeProductImage('p1')).rejects.toThrow('Network Error');
  });
});
