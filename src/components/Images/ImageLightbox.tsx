import { useCallback, useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { useBackButtonClose } from '@/hooks/useBackButtonClose';

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const WHEEL_STEP = 1.15;
const BUTTON_STEP = 1.5;
const DOUBLE_TAP_SCALE = 2.5;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface ImageLightboxProps {
  images: string[];
  // Índice de la imagen abierta; null = cerrado
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

interface Point { x: number; y: number }

// Visor a pantalla completa de una imagen con zoom: pellizcar (tablet/celular), rueda del mouse,
// botones +/-, doble toque; y arrastrar para mover la imagen cuando está ampliada. Con varias
// imágenes se navega con las flechas. Esc o la X lo cierran.
export function ImageLightbox({ images, index, onIndexChange, onClose }: ImageLightboxProps) {
  const open = index !== null;
  // "Atrás" cierra el visor (y no la pantalla de detrás)
  useBackButtonClose(open, onClose);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  // Hubo arrastre en este toque: el click que lo cierra no debe cerrar el visor
  const movedRef = useRef(false);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef({ startDistance: 0, startScale: 1, startOffset: { x: 0, y: 0 } as Point, startPoint: { x: 0, y: 0 } as Point });

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Cada imagen empieza sin zoom
  useEffect(() => {
    reset();
    pointers.current.clear();
  }, [index, reset]);

  // Al ampliar no se puede arrastrar la imagen más allá de sus bordes
  const clampOffset = useCallback((next: Point, nextScale: number): Point => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return next;
    const maxX = (rect.width * (nextScale - 1)) / 2;
    const maxY = (rect.height * (nextScale - 1)) / 2;
    return { x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  }, []);

  const zoomTo = useCallback((nextScale: number) => {
    const clamped = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    setScale(clamped);
    setOffset(prev => (clamped === MIN_SCALE ? { x: 0, y: 0 } : clampOffset(prev, clamped)));
  }, [clampOffset]);

  const go = (delta: number) => {
    if (index === null || images.length < 2) return;
    onIndexChange((index + delta + images.length) % images.length);
  };

  const handleWheel = (e: React.WheelEvent) => {
    zoomTo(scale * (e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP));
  };

  const handleDoubleClick = () => {
    if (scale > MIN_SCALE) reset();
    else zoomTo(DOUBLE_TAP_SCALE);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.startDistance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      gesture.current.startScale = scale;
    }
    gesture.current.startPoint = { x: e.clientX, y: e.clientY };
    gesture.current.startOffset = offset;
    if (pointers.current.size === 1) movedRef.current = false;
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (Math.hypot(e.clientX - gesture.current.startPoint.x, e.clientY - gesture.current.startPoint.y) > 5) {
      movedRef.current = true;
    }

    if (pointers.current.size === 2) {
      // Pellizco: el zoom sigue la distancia entre los dos dedos
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      zoomTo(gesture.current.startScale * (distance / gesture.current.startDistance));
    } else if (scale > MIN_SCALE) {
      // Un dedo con zoom: mover la imagen
      setOffset(clampOffset({
        x: gesture.current.startOffset.x + (e.clientX - gesture.current.startPoint.x),
        y: gesture.current.startOffset.y + (e.clientY - gesture.current.startPoint.y),
      }, scale));
    }
  };

  const handlePointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    // Si quedó un dedo, el movimiento continúa desde donde está ahora
    const remaining = [...pointers.current.values()][0];
    if (remaining) {
      gesture.current.startPoint = remaining;
      gesture.current.startOffset = offset;
      gesture.current.startScale = scale;
    } else {
      setDragging(false);
    }
  };

  // Tocar el fondo oscuro (fuera de la imagen) cierra el visor. Se decide por coordenadas y no por
  // e.target: el contenedor captura el puntero para los gestos, y con la captura el navegador
  // entrega el click al contenedor aunque se haya tocado la imagen o terminado un arrastre.
  const handleStageClick = (e: React.MouseEvent) => {
    if (movedRef.current) return;
    const rect = imageRef.current?.getBoundingClientRect();
    const outside = rect && rect.width > 0
      ? e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom
      : e.target !== imageRef.current;
    if (outside) onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === '+' || e.key === '=') zoomTo(scale * BUTTON_STEP);
    else if (e.key === '-') zoomTo(scale / BUTTON_STEP);
    else if (e.key === '0') reset();
    else if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  };

  const src = index !== null ? images[index] : undefined;
  const canZoomOut = scale > MIN_SCALE;
  const canZoomIn = scale < MAX_SCALE;

  const toolButton = 'h-10 w-10 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/90" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-[60] flex flex-col outline-none"
          onKeyDown={handleKeyDown}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <DialogPrimitive.Title className="sr-only">Imagen de referencia ampliada</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Pellizca, usa la rueda del mouse o los botones para acercar; arrastra para mover la imagen.
          </DialogPrimitive.Description>

          <div className="flex items-center justify-between gap-2 p-3 text-white">
            <span className="text-sm min-w-16" aria-live="polite">
              {images.length > 1 && index !== null ? `${index + 1} / ${images.length}` : ''}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" className={toolButton} aria-label="Alejar" disabled={!canZoomOut} onClick={() => zoomTo(scale / BUTTON_STEP)}>
                <Minus className="h-5 w-5" />
              </button>
              <span className="text-sm w-12 text-center tabular-nums" data-testid="zoom-level">{Math.round(scale * 100)}%</span>
              <button type="button" className={toolButton} aria-label="Acercar" disabled={!canZoomIn} onClick={() => zoomTo(scale * BUTTON_STEP)}>
                <Plus className="h-5 w-5" />
              </button>
              <button type="button" className={toolButton} aria-label="Restablecer zoom" disabled={scale === MIN_SCALE && offset.x === 0 && offset.y === 0} onClick={reset}>
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>
            <DialogPrimitive.Close className={toolButton} aria-label="Cerrar">
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          <div className="relative flex-1 min-h-0">
            <div
              ref={stageRef}
              className="absolute inset-0 flex items-center justify-center overflow-hidden select-none"
              style={{ touchAction: 'none', cursor: scale > MIN_SCALE ? (dragging ? 'grabbing' : 'grab') : 'zoom-in' }}
              onWheel={handleWheel}
              onDoubleClick={handleDoubleClick}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onClick={handleStageClick}
            >
              {src && (
                <img
                  ref={imageRef}
                  src={src}
                  alt={`Referencia ${(index ?? 0) + 1} ampliada`}
                  draggable={false}
                  className="max-h-full max-w-full object-contain"
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transition: dragging ? 'none' : 'transform 120ms ease-out',
                  }}
                />
              )}
            </div>

            {images.length > 1 && (
              <>
                <button type="button" className={`${toolButton} absolute left-3 top-1/2 -translate-y-1/2`} aria-label="Imagen anterior" onClick={() => go(-1)}>
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button type="button" className={`${toolButton} absolute right-3 top-1/2 -translate-y-1/2`} aria-label="Imagen siguiente" onClick={() => go(1)}>
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
