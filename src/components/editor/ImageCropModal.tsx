import React, { useEffect, useRef, useState } from 'react';
import { Check, Crop, RotateCcw, X } from 'lucide-react';

type AspectPreset = 'free' | '16:9' | '4:3' | '1:1' | '3:2';

interface ImageCropModalProps {
  open: boolean;
  imageSrc: string;
  fileName?: string;
  initialAspect?: AspectPreset;
  onConfirm: (croppedFile: File) => void;
  onClose: () => void;
}

const ASPECT_RATIO_MAP: Record<AspectPreset, number | null> = {
  free: null,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '3:2': 3 / 2,
};

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  open,
  imageSrc,
  fileName = 'recorte.webp',
  initialAspect = '16:9',
  onConfirm,
  onClose,
}) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [aspect, setAspect] = useState<AspectPreset>(initialAspect);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  // Normalized crop rectangle (0..100%)
  const [crop, setCrop] = useState({ x: 5, y: 5, w: 90, h: 90 });
  const [processing, setProcessing] = useState(false);
  const dragState = useRef<{
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    orig: { x: number; y: number; w: number; h: number };
  } | null>(null);

  const applyAspectFit = (preset: AspectPreset, imgW: number, imgH: number) => {
    const ratio = ASPECT_RATIO_MAP[preset];
    if (!ratio || !imgW || !imgH) {
      setCrop({ x: 5, y: 5, w: 90, h: 90 });
      return;
    }
    const imgRatio = imgW / imgH;
    let wPct = 90;
    let hPct = 90;
    if (imgRatio > ratio) {
      hPct = 90;
      wPct = Math.min(96, (90 * ratio) / imgRatio);
    } else {
      wPct = 90;
      hPct = Math.min(96, (90 * imgRatio) / ratio);
    }
    setCrop({
      x: Math.max(0, (100 - wPct) / 2),
      y: Math.max(0, (100 - hPct) / 2),
      w: wPct,
      h: hPct,
    });
  };

  useEffect(() => {
    if (!open) return;
    setAspect(initialAspect);
  }, [open, initialAspect]);

  if (!open || !imageSrc) return null;

  const handleConfirmCrop = async () => {
    const img = imgRef.current;
    if (!img || !naturalSize.w || !naturalSize.h) return;
    setProcessing(true);
    try {
      const sx = Math.round((crop.x / 100) * naturalSize.w);
      const sy = Math.round((crop.y / 100) * naturalSize.h);
      const sw = Math.max(16, Math.round((crop.w / 100) * naturalSize.w));
      const sh = Math.max(16, Math.round((crop.h / 100) * naturalSize.h));

      const maxOut = 1600;
      let outW = sw;
      let outH = sh;
      if (outW > maxOut || outH > maxOut) {
        if (outW >= outH) {
          outH = Math.round((outH * maxOut) / outW);
          outW = maxOut;
        } else {
          outW = Math.round((outW * maxOut) / outH);
          outH = maxOut;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/webp', 0.85)
      );
      if (blob) {
        const cleanBase = fileName.replace(/\.[^.]+$/, '');
        const croppedFile = new File([blob], `${cleanBase}_recorte.webp`, { type: 'image/webp' });
        onConfirm(croppedFile);
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recortar imagen"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-3xl rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] overflow-hidden shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-[var(--editorial-primary)]" />
            <h3 className="font-display text-sm font-bold uppercase tracking-wider">
              Recortar imagen (salida WebP optimizada)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar recortador"
            className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Aspect controls */}
        <div className="px-5 py-2.5 bg-[#F8F6F1] dark:bg-[#181818] border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['free', 'Libre'],
                ['16:9', '16:9'],
                ['4:3', '4:3'],
                ['3:2', '3:2'],
                ['1:1', '1:1'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setAspect(key);
                  applyAspectFit(key, naturalSize.w, naturalSize.h);
                }}
                className={`px-3 py-1 rounded-full text-xs font-display font-bold uppercase cursor-pointer border ${
                  aspect === key
                    ? 'bg-[#111111] text-white border-[#111111] dark:bg-white dark:text-black dark:border-white'
                    : 'border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => applyAspectFit(aspect, naturalSize.w, naturalSize.h)}
            className="inline-flex items-center gap-1 text-xs font-display font-bold uppercase text-neutral-500 hover:text-black dark:hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer</span>
          </button>
        </div>

        {/* Interactive Crop Stage */}
        <div className="p-5 bg-neutral-950 flex items-center justify-center max-h-[60vh] overflow-hidden">
          <div
            ref={stageRef}
            className="relative inline-block max-w-full max-h-[52vh] select-none touch-none"
            onPointerMove={(e) => {
              if (!dragState.current || !stageRef.current) return;
              const rect = stageRef.current.getBoundingClientRect();
              if (!rect.width || !rect.height) return;
              const dxPct = ((e.clientX - dragState.current.startX) / rect.width) * 100;
              const dyPct = ((e.clientY - dragState.current.startY) / rect.height) * 100;
              const { orig, mode } = dragState.current;

              if (mode === 'move') {
                const nextX = Math.max(0, Math.min(100 - orig.w, orig.x + dxPct));
                const nextY = Math.max(0, Math.min(100 - orig.h, orig.y + dyPct));
                setCrop({ ...orig, x: nextX, y: nextY });
              } else {
                const ratio = ASPECT_RATIO_MAP[aspect];
                let nextW = Math.max(15, Math.min(100 - orig.x, orig.w + dxPct));
                let nextH = Math.max(15, Math.min(100 - orig.y, orig.h + dyPct));
                if (ratio && naturalSize.w && naturalSize.h) {
                  const imgRatio = naturalSize.w / naturalSize.h;
                  nextH = (nextW * imgRatio) / ratio;
                  if (orig.y + nextH > 100) {
                    nextH = 100 - orig.y;
                    nextW = (nextH * ratio) / imgRatio;
                  }
                }
                setCrop({ ...orig, w: nextW, h: nextH });
              }
            }}
            onPointerUp={() => {
              dragState.current = null;
            }}
            onPointerCancel={() => {
              dragState.current = null;
            }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              crossOrigin="anonymous"
              alt="Previsualización de recorte"
              onLoad={(e) => {
                const el = e.currentTarget;
                const nw = el.naturalWidth || el.width;
                const nh = el.naturalHeight || el.height;
                setNaturalSize({ w: nw, h: nh });
                applyAspectFit(aspect, nw, nh);
              }}
              className="max-h-[52vh] max-w-full block opacity-45 pointer-events-none"
            />

            {/* Active Crop Window */}
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                dragState.current = {
                  mode: 'move',
                  startX: e.clientX,
                  startY: e.clientY,
                  orig: crop,
                };
              }}
              style={{
                left: `${crop.x}%`,
                top: `${crop.y}%`,
                width: `${crop.w}%`,
                height: `${crop.h}%`,
              }}
              className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] cursor-move"
            >
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <span key={idx} className="border border-white/25" />
                ))}
              </div>
              <button
                type="button"
                aria-label="Redimensionar área de recorte"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  dragState.current = {
                    mode: 'resize',
                    startX: e.clientX,
                    startY: e.clientY,
                    orig: crop,
                  };
                }}
                className="absolute -right-2 -bottom-2 w-5 h-5 rounded-full bg-[var(--editorial-primary)] border-2 border-white cursor-nwse-resize"
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-neutral-500">
            Arrastra el recuadro para encuadrar o usa el punto rojo inferior derecho para ajustar el tamaño.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={processing || !naturalSize.w}
              onClick={handleConfirmCrop}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white text-xs font-display font-bold uppercase cursor-pointer disabled:opacity-60"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{processing ? 'Aplicando...' : 'Aplicar recorte'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
