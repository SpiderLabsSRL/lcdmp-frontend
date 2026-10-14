import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { IUploadsApi, defaultUploadsApi } from '@/api/UploadsApi';
import { prepareImage } from '@/utils/image';

interface ReferenceImagesInputProps {
  // URLs a mostrar (las recién subidas llegan firmadas; el backend las guarda como key)
  value: string[];
  onChange: (images: string[]) => void;
  uploadsApi?: IUploadsApi;
  max?: number;
}

// Subida de imágenes de referencia de una torta: cada archivo se reduce, se sube a R2 al
// elegirlo y el pedido guarda el resultado al enviarse el formulario.
export default function ReferenceImagesInput({
  value,
  onChange,
  uploadsApi = defaultUploadsApi,
  max = 5,
}: ReferenceImagesInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const allowed = Array.from(files).slice(0, Math.max(max - value.length, 0));
    if (allowed.length < files.length) {
      toast.info(`Máximo ${max} imágenes por torta`);
    }
    if (allowed.length === 0) return;

    setUploading(allowed.length);
    const uploaded: string[] = [];
    for (const file of allowed) {
      try {
        const { url } = await uploadsApi.uploadOrderImage(await prepareImage(file));
        uploaded.push(url);
      } catch (error: any) {
        toast.error(error.message || 'Error al subir la imagen');
      } finally {
        setUploading(count => count - 1);
      }
    }

    if (uploaded.length > 0) {
      onChange([...value, ...uploaded]);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {value.map((src, index) => (
            <div key={`${index}-${src}`} className="relative">
              <img src={src} alt={`Referencia ${index + 1}`} className="w-20 h-20 object-cover rounded border" />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                aria-label={`Quitar imagen ${index + 1}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label="Seleccionar imágenes de referencia"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading > 0 || value.length >= max}
        onClick={() => inputRef.current?.click()}
      >
        {uploading > 0 ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-2" />}
        {uploading > 0 ? 'Subiendo...' : 'Agregar imagen'}
      </Button>
    </div>
  );
}
