import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReferenceImages } from '../ReferenceImages';
import ReferenceImagesInput from '../ReferenceImagesInput';
import ProductImageField from '../ProductImageField';
import type { IUploadsApi } from '@/api/UploadsApi';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/utils/image', () => ({ prepareImage: vi.fn(async (file: File) => file) }));
import { toast } from 'sonner';

const photo = (name = 'foto.jpg') => new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type: 'image/jpeg' });

describe('ReferenceImages', () => {
  it('renders nothing without images', () => {
    const { container } = render(<ReferenceImages images={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a thumbnail per image, each opening the full image in a new tab', () => {
    render(<ReferenceImages images={['https://signed/a.jpg', 'https://signed/b.jpg']} />);

    expect(screen.getByAltText('Referencia 1')).toHaveAttribute('src', 'https://signed/a.jpg');
    expect(screen.getByAltText('Referencia 2')).toBeInTheDocument();
    const link = screen.getByAltText('Referencia 1').closest('a')!;
    expect(link).toHaveAttribute('href', 'https://signed/a.jpg');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows a "No disponible" placeholder when a (probably expired) URL fails to load', () => {
    render(<ReferenceImages images={['https://signed/expired.jpg']} />);

    fireEvent.error(screen.getByAltText('Referencia 1'));

    expect(screen.getByText('No disponible')).toBeInTheDocument();
    expect(screen.queryByAltText('Referencia 1')).not.toBeInTheDocument();
  });
});

describe('ReferenceImagesInput', () => {
  const makeApi = (overrides: Partial<IUploadsApi> = {}): IUploadsApi => ({
    uploadOrderImage: vi.fn().mockResolvedValue({ key: 'Pedidos/a.jpg', url: 'https://signed/a.jpg' }),
    uploadProductImage: vi.fn(),
    removeProductImage: vi.fn(),
    ...overrides,
  });

  beforeEach(() => vi.clearAllMocks());

  it('uploads each chosen file and adds the returned signed URLs after the existing ones', async () => {
    const uploadsApi = makeApi();
    const onChange = vi.fn();
    render(<ReferenceImagesInput value={['https://signed/old.jpg']} onChange={onChange} uploadsApi={uploadsApi} />);

    fireEvent.change(screen.getByLabelText('Seleccionar imágenes de referencia'), { target: { files: [photo()] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['https://signed/old.jpg', 'https://signed/a.jpg']));
    expect(uploadsApi.uploadOrderImage).toHaveBeenCalledTimes(1);
  });

  it('keeps going when one upload fails and reports it', async () => {
    const uploadsApi = makeApi({
      uploadOrderImage: vi.fn()
        .mockRejectedValueOnce(new Error('La imagen supera los 10 MB'))
        .mockResolvedValueOnce({ key: 'Pedidos/b.jpg', url: 'https://signed/b.jpg' }),
    });
    const onChange = vi.fn();
    render(<ReferenceImagesInput value={[]} onChange={onChange} uploadsApi={uploadsApi} />);

    fireEvent.change(screen.getByLabelText('Seleccionar imágenes de referencia'), { target: { files: [photo('1.jpg'), photo('2.jpg')] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['https://signed/b.jpg']));
    expect(toast.error).toHaveBeenCalledWith('La imagen supera los 10 MB');
  });

  it('does not exceed the maximum per cake', async () => {
    const uploadsApi = makeApi();
    const onChange = vi.fn();
    render(
      <ReferenceImagesInput value={['a', 'b', 'c']} onChange={onChange} uploadsApi={uploadsApi} max={4} />
    );

    fireEvent.change(screen.getByLabelText('Seleccionar imágenes de referencia'), { target: { files: [photo('1.jpg'), photo('2.jpg')] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(uploadsApi.uploadOrderImage).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith('Máximo 4 imágenes por torta');
  });

  it('disables the add button once the maximum is reached', () => {
    render(<ReferenceImagesInput value={['a', 'b']} onChange={vi.fn()} uploadsApi={makeApi()} max={2} />);

    expect(screen.getByRole('button', { name: /Agregar imagen/ })).toBeDisabled();
  });

  it('removes an image from the list', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ReferenceImagesInput value={['https://signed/a.jpg', 'https://signed/b.jpg']} onChange={onChange} uploadsApi={makeApi()} />);

    await user.click(screen.getByRole('button', { name: 'Quitar imagen 1' }));

    expect(onChange).toHaveBeenCalledWith(['https://signed/b.jpg']);
  });
});

describe('ProductImageField', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    }));
  });

  it('shows the current image and offers to change or remove it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProductImageField currentImage="https://img.example.com/Productos/p/a.jpg" value={{ file: null, remove: false }} onChange={onChange} />);

    expect(screen.getByAltText('Imagen del producto')).toHaveAttribute('src', 'https://img.example.com/Productos/p/a.jpg');
    expect(screen.getByRole('button', { name: 'Cambiar imagen' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Quitar/ }));

    expect(onChange).toHaveBeenCalledWith({ file: null, remove: true });
  });

  it('offers "Elegir imagen" and no remove button when the product has none', () => {
    render(<ProductImageField currentImage={null} value={{ file: null, remove: false }} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Elegir imagen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Quitar/ })).not.toBeInTheDocument();
  });

  it('reports the chosen file and previews it instead of the current image', () => {
    const onChange = vi.fn();
    const file = photo();
    const { rerender } = render(
      <ProductImageField currentImage="https://img.example.com/old.jpg" value={{ file: null, remove: false }} onChange={onChange} />
    );

    fireEvent.change(screen.getByLabelText('Seleccionar imagen del producto'), { target: { files: [file] } });
    expect(onChange).toHaveBeenCalledWith({ file, remove: false });

    rerender(<ProductImageField currentImage="https://img.example.com/old.jpg" value={{ file, remove: false }} onChange={onChange} />);
    expect(screen.getByAltText('Imagen del producto')).toHaveAttribute('src', 'blob:preview');
  });

  it('hides the current image once it is marked for removal', () => {
    render(<ProductImageField currentImage="https://img.example.com/old.jpg" value={{ file: null, remove: true }} onChange={vi.fn()} />);

    expect(screen.queryByAltText('Imagen del producto')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elegir imagen' })).toBeInTheDocument();
  });
});
