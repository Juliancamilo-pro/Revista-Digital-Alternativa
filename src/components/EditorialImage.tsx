import React, { useEffect, useRef, useState } from 'react';
import { Eye, Image as ImageIcon, Newspaper } from 'lucide-react';
import { useDataSaver } from '../context/DataSaverContext';
import { parseMediaUrlMeta, sanitizeExternalUrl } from '../lib/utils';

interface EditorialImageProps {
  src?: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  fallbackTitle?: string;
  fallbackCategory?: string;
  aspectClass?: string;
  priority?: boolean;
  allowInDataSaver?: boolean;
  sensitive?: boolean;
  sensitiveWarning?: string;
  focalPointOverride?: { x: number; y: number };
  width?: number;
  height?: number;
  sizes?: string;
  srcSet?: string;
}

export const EditorialImage: React.FC<EditorialImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  wrapperClassName = '',
  fallbackTitle,
  fallbackCategory,
  aspectClass = '',
  priority = false,
  allowInDataSaver = false,
  sensitive = false,
  sensitiveWarning,
  focalPointOverride,
  width = 1200,
  height = 800,
  sizes,
  srcSet,
}) => {
  const { isDataSaverActive } = useDataSaver();
  const safeRaw = sanitizeExternalUrl(src || '');
  const parsed = parseMediaUrlMeta(safeRaw);
  const safeSrc = parsed.cleanUrl;
  const fpX = focalPointOverride?.x ?? parsed.fpX;
  const fpY = focalPointOverride?.y ?? parsed.fpY;
  const blurPreview = parsed.blurDataUrl;

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [manualRevealDataSaver, setManualRevealDataSaver] = useState(false);
  const [manualRevealSensitive, setManualRevealSensitive] = useState(false);

  const deferredByDataSaver = isDataSaverActive && !allowInDataSaver && !manualRevealDataSaver;
  const gatedSensitive = sensitive && !manualRevealSensitive;
  const shouldFetchFull = !deferredByDataSaver;

  useEffect(() => {
    setFailed(false);
    setManualRevealDataSaver(false);
    setManualRevealSensitive(false);
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [safeSrc]);

  useEffect(() => {
    if (shouldFetchFull && imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [shouldFetchFull]);

  const hasExplicitPosition = /\b(absolute|fixed|sticky)\b/.test(wrapperClassName);
  const wrapperPosition = hasExplicitPosition ? '' : 'relative';

  if (!safeSrc || failed) {
    const initial = (fallbackCategory || fallbackTitle || 'R').trim().slice(0, 1).toUpperCase();
    return (
      <div
        className={`${wrapperPosition} overflow-hidden flex flex-col justify-between bg-gradient-to-br from-[#181414] via-[#221616] to-[#3B0D0D] text-[#F4F1EA] p-4 sm:p-5 ${aspectClass} ${className} ${wrapperClassName}`}
        role="img"
        aria-label={alt}
      >
        {/* Sutil patrón geométrico editorial */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-20 tolima-weave-bg pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute -right-6 -bottom-8 font-display text-[7rem] font-extrabold leading-none text-white/[0.05] select-none pointer-events-none"
        >
          {initial}
        </div>
        <div className="relative z-10 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-[#FCA5A5]">
            <Newspaper className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{fallbackCategory || 'Edición editorial'}</span>
          </span>
          <span className="w-6 h-0.5 bg-[var(--editorial-primary)] rounded-full" aria-hidden="true" />
        </div>
        {fallbackTitle && (
          <p className="relative z-10 font-display text-sm sm:text-base font-extrabold uppercase tracking-tight leading-snug line-clamp-3 text-[#F8F6F1] headline-balance">
            {fallbackTitle}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`${wrapperPosition} w-full h-full overflow-hidden bg-neutral-200 dark:bg-neutral-900 ${aspectClass} ${wrapperClassName}`}>
      {!loaded && (
        blurPreview ? (
          <img
            src={blurPreview}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 w-full h-full object-cover scale-110 blur-md transition-opacity duration-300 ${
              loaded ? 'opacity-0' : 'opacity-100'
            }`}
            style={{ objectPosition: `${fpX}% ${fpY}%` }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 w-full h-full bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 animate-pulse"
          />
        )
      )}

      {shouldFetchFull && (
        <img
          ref={imgRef}
          src={safeSrc}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          width={width}
          height={height}
          referrerPolicy="no-referrer"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{ objectPosition: `${fpX}% ${fpY}%` }}
          className={`${className} transition-opacity duration-500 ${
            loaded ? 'opacity-100' : 'opacity-0'
          } ${gatedSensitive ? 'blur-xl scale-105' : ''}`}
        />
      )}

      {deferredByDataSaver && (
        <div className="relative z-10 w-full h-full min-h-[120px] flex flex-col items-center justify-center p-4 text-center bg-neutral-900/60 text-white">
          <ImageIcon className="w-5 h-5 mb-1.5 opacity-90" aria-hidden="true" />
          <p className="text-[11px] font-display uppercase tracking-wider opacity-90 mb-2">
            Ahorro de datos activo
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setManualRevealDataSaver(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[#111111] text-[11px] font-display font-bold uppercase tracking-wider shadow cursor-pointer hover:bg-neutral-100"
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Ver imagen</span>
          </button>
        </div>
      )}

      {!deferredByDataSaver && gatedSensitive && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center bg-neutral-950/75 text-white">
          <p className="text-xs font-display font-bold uppercase tracking-wider text-amber-300 mb-1">
            Contenido sensible
          </p>
          {sensitiveWarning && (
            <p className="text-[11px] text-neutral-200 max-w-xs mb-2.5 line-clamp-2">
              {sensitiveWarning}
            </p>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setManualRevealSensitive(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-[#111111] text-[11px] font-display font-bold uppercase tracking-wider cursor-pointer hover:bg-neutral-200"
          >
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Mostrar imagen</span>
          </button>
        </div>
      )}
    </div>
  );
};
