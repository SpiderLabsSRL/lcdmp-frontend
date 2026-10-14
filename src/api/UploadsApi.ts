import api from '@/api/api';

export interface UploadedOrderImage {
  key: string;
  url: string;
}

export interface IUploadsApi {
  uploadOrderImage(file: File): Promise<UploadedOrderImage>;
  uploadProductImage(productId: string, file: File): Promise<string>;
  removeProductImage(productId: string): Promise<void>;
}

const toFormData = (file: File) => {
  const form = new FormData();
  form.append('image', file);
  return form;
};

const fail = (label: string, error: any): never => {
  console.error(`Error en ${label}:`, error);
  throw new Error(error.response?.data?.message || error.message || 'Error de conexión');
};

export class UploadsApi implements IUploadsApi {
  async uploadOrderImage(file: File): Promise<UploadedOrderImage> {
    try {
      const response = await api.post('/uploads/order-image', toFormData(file), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al subir la imagen');
      }
      return response.data.data as UploadedOrderImage;
    } catch (error: any) {
      return fail('uploadOrderImage', error);
    }
  }

  // Devuelve la URL pública de la imagen del producto
  async uploadProductImage(productId: string, file: File): Promise<string> {
    try {
      const response = await api.post(`/products/${productId}/image`, toFormData(file), {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al subir la imagen del producto');
      }
      return response.data.data.image as string;
    } catch (error: any) {
      return fail('uploadProductImage', error);
    }
  }

  async removeProductImage(productId: string): Promise<void> {
    try {
      const response = await api.delete(`/products/${productId}/image`);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Error al eliminar la imagen del producto');
      }
    } catch (error: any) {
      fail('removeProductImage', error);
    }
  }
}

export const defaultUploadsApi = new UploadsApi();
