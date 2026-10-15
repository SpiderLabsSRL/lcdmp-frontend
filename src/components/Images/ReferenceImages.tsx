import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { ImageLightbox } from './ImageLightbox';

function ReferenceImage({ src, index, onOpen }: { src: string; index: number; onOpen: (index: number) => void }) {
  const [failed, setFailed] = useState(false);

  // Las imágenes de pedidos son URLs firmadas que vencen al día: si una página lleva abierta
  // más tiempo, el navegador ya no puede cargarla y se avisa en vez de dejar un hueco roto.
  if (failed) {
    return (
      <div
        className="w-20 h-20 rounded border flex flex-col items-center justify-center text-center p-1 text-muted-foreground"
        title="La imagen venció o no está disponible. Recarga la página."
      >
        <ImageOff className="h-5 w-5" />
        <span className="text-[10px] leading-tight mt-1">No disponible</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      title="Ampliar imagen"
      className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <img
        src={src}
        alt={`Referencia ${index + 1}`}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-20 h-20 object-cover rounded border"
      />
    </button>
  );
}

// Miniaturas de las imágenes de referencia; al tocar una se amplía en un visor con zoom
// (sin salir de la pantalla ni abrir otra pestaña).
export function ReferenceImages({ images }: { images?: string[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {images.map((src, index) => (
          <ReferenceImage key={`${index}-${src}`} src={src} index={index} onOpen={setOpenIndex} />
        ))}
      </div>
      <ImageLightbox
        images={images}
        index={openIndex}
        onIndexChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </>
  );
}
