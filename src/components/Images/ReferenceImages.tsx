import { useState } from 'react';
import { ImageOff } from 'lucide-react';

function ReferenceImage({ src, index }: { src: string; index: number }) {
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
    <a href={src} target="_blank" rel="noreferrer" title="Abrir en tamaño completo">
      <img
        src={src}
        alt={`Referencia ${index + 1}`}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-20 h-20 object-cover rounded border"
      />
    </a>
  );
}

// Miniaturas de las imágenes de referencia de una torta; al tocar una se abre completa.
export function ReferenceImages({ images }: { images?: string[] }) {
  if (!images || images.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {images.map((src, index) => (
        <ReferenceImage key={`${index}-${src}`} src={src} index={index} />
      ))}
    </div>
  );
}
