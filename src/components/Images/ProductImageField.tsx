import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ProductImageChange {
  // Imagen nueva elegida (se sube después de guardar el producto, cuando ya existe su id)
  file: File | null;
  // Quitar la imagen que tiene hoy
  remove: boolean;
}

interface ProductImageFieldProps {
  currentImage?: string | null;
  value: ProductImageChange;
  onChange: (change: ProductImageChange) => void;
}

// Imagen pública del producto: muestra la actual (o la recién elegida) y permite cambiarla o quitarla.
export default function ProductImageField({ currentImage, value, onChange }: ProductImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value.file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file]);

  const shown = preview ?? (value.remove ? null : currentImage ?? null);

  return (
    <div className="space-y-1.5 sm:space-y-2">
      <span className="text-sm font-medium">Imagen</span>
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 rounded-lg bg-muted border flex items-center justify-center overflow-hidden shrink-0">
          {shown ? (
            <img src={shown} alt="Imagen del producto" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Seleccionar imagen del producto"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (file) onChange({ file, remove: false });
              e.target.value = '';
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            {shown ? 'Cambiar imagen' : 'Elegir imagen'}
          </Button>
          {shown && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => onChange({ file: null, remove: !!currentImage })}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Quitar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
