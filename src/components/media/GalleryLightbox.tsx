import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { parseMediaUrlMeta, sanitizeExternalUrl } from '../../lib/utils';

export interface LightboxSlide {
  id?: string;
  url: string;
  alt: string;
  caption?: string;
  credit?: string;
}

interface GalleryLightboxProps {
  items: LightboxSlide[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

const ZOOM_STEPS = [1, 1.5, 2.5];

export const GalleryLightbox: React.FC<GalleryLightboxProps> = ({
  items,
  initialIndex = 0,
  isOpen,
  onClose,
}) => {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIndex(Math.max(0, Math.min(items.length - 1, initialIndex)));
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex, items.length]);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const goPrev = useCallback(() => {
    if (items.length <= 1) return;
    resetZoom();
    setIndex((i) => (i - 1 + items.length) % items.length);
  }, [items.length, resetZoom]);

  const goNext = useCallback(() => {
    if (items.length <= 1) return;
    resetZoom();
    setIndex((i) => (i + 1) % items.length);
  }, [items.length, resetZoom]);

  const adjustZoom = useCallback((nextZoom: number) => {
    const clamped = Math.max(1, Math.min(3.5, Number(nextZoom.toFixed(2))));
    setZoom(clamped);
    if (clamped === 1) {
      setPan({ x: 0, y: 0 });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === '+' || e.key === '=') {
        adjustZoom(zoom + 0.5);
      } else if (e.key === '-') {
        adjustZoom(zoom - 0.5);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, goPrev, goNext, adjustZoom, zoom]);

  if (!isOpen || items.length === 0) return null;

  const current = items[index] || items[0];
  const parsed = parseMediaUrlMeta(sanitizeExternalUrl(current.url));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visor de imagen ampliada"
      className="fixed inset-0 z-50 bg-black/95 text-white flex flex-col justify-between p-4 sm:p-6 select-none"
      onTouchStart={(e) => {
        if (e.touches.length === 1) {
          touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
      }}
      onTouchEnd={(e) => {
        if (!touchStartRef.current || e.changedTouches.length !== 1 || zoom > 1.05) {
          touchStartRef.current = null;
          return;
        }
        const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
        const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
        touchStartRef.current = null;
        if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          if (dx > 0) goPrev();
          else goNext();
        }
      }}
    >
      {/* Top toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 z-10">
        <span className="font-tabular text-xs font-display font-bold uppercase tracking-widest text-neutral-300">
          {items.length > 1 ? `Imagen ${index + 1} de ${items.length}` : 'Vista ampliada'}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => adjustZoom(zoom - 0.5)}
            disabled={zoom <= 1}
            aria-label="Alejar"
            className="p-2 rounded-full border border-neutral-700 hover:border-white disabled:opacity-40 cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          {ZOOM_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => adjustZoom(step)}
              className={`px-2.5 py-1 rounded-full text-xs font-tabular font-bold border cursor-pointer ${
                Math.abs(zoom - step) < 0.1
                  ? 'bg-white text-black border-white'
                  : 'border-neutral-700 text-neutral-200 hover:border-white'
              }`}
            >
              {step}x
            </button>
          ))}
          <button
            type="button"
            onClick={() => adjustZoom(zoom + 0.5)}
            disabled={zoom >= 3.5}
            aria-label="Acercar"
            className="p-2 rounded-full border border-neutral-700 hover:border-white disabled:opacity-40 cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          {zoom > 1 && (
            <button
              type="button"
              onClick={resetZoom}
              aria-label="Restablecer zoom"
              className="p-2 rounded-full border border-neutral-700 hover:border-white cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar visor"
            className="ml-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white text-black text-xs font-display font-bold uppercase cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Cerrar</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        className="relative flex-1 flex items-center justify-center overflow-hidden my-3"
        onWheel={(e) => {
          if (e.deltaY < 0) adjustZoom(zoom + 0.25);
          else if (e.deltaY > 0) adjustZoom(zoom - 0.25);
        }}
        onPointerDown={(e) => {
          if (zoom <= 1) return;
          dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        }}
        onPointerMove={(e) => {
          if (!dragStartRef.current || zoom <= 1) return;
          setPan({
            x: dragStartRef.current.panX + (e.clientX - dragStartRef.current.x),
            y: dragStartRef.current.panY + (e.clientY - dragStartRef.current.y),
          });
        }}
        onPointerUp={() => {
          dragStartRef.current = null;
        }}
        onPointerCancel={() => {
          dragStartRef.current = null;
        }}
      >
        {items.length > 1 && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Imagen anterior"
            className="absolute left-1 sm:left-3 z-10 p-2.5 rounded-full bg-black/70 border border-neutral-700 hover:border-white cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        <img
          src={parsed.cleanUrl}
          alt={current.alt}
          draggable={false}
          onDoubleClick={() => adjustZoom(zoom > 1 ? 1 : 2)}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
          className={`max-h-[75vh] max-w-full object-contain transition-transform duration-150 ${
            zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
          }`}
        />

        {items.length > 1 && (
          <button
            type="button"
            onClick={goNext}
            aria-label="Siguiente imagen"
            className="absolute right-1 sm:right-3 z-10 p-2.5 rounded-full bg-black/70 border border-neutral-700 hover:border-white cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Caption & Credit */}
      <div className="max-w-3xl mx-auto text-center space-y-1 z-10">
        {current.caption && <p className="text-sm text-neutral-200">{current.caption}</p>}
        {current.credit && <p className="text-xs text-neutral-400">Crédito: {current.credit}</p>}
      </div>
    </div>
  );
};
