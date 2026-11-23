import React from 'react';
import { Crop, Crosshair, ShieldAlert } from 'lucide-react';
import { encodeMediaUrlWithMeta, parseMediaUrlMeta, sanitizeExternalUrl } from '../../lib/utils';
import { PostType } from '../../types/editorial';
import { MediaUploader } from './MediaUploader';

interface CoverFramingSectionProps {
  type: PostType;
  folder: string;
  coverImage: string;
  setCoverImage: (url: string) => void;
  coverAlt: string;
  setCoverAlt: (alt: string) => void;
  coverCredit: string;
  setCoverCredit: (credit: string) => void;
  sensitiveContent: boolean;
  setSensitiveContent: (val: boolean) => void;
  sensitiveWarning: string;
  setSensitiveWarning: (val: string) => void;
  onRequestCrop: (srcUrl: string) => void;
  onUploadNote?: (info: string) => void;
}

export const CoverFramingSection: React.FC<CoverFramingSectionProps> = ({
  type,
  folder,
  coverImage,
  setCoverImage,
  coverAlt,
  setCoverAlt,
  coverCredit,
  setCoverCredit,
  sensitiveContent,
  setSensitiveContent,
  sensitiveWarning,
  setSensitiveWarning,
  onRequestCrop,
  onUploadNote,
}) => {
  const coverMeta = parseMediaUrlMeta(coverImage);

  const handleCoverFocalClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!coverImage.trim()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const fpX = Math.max(5, Math.min(95, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const fpY = Math.max(5, Math.min(95, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
    setCoverImage(encodeMediaUrlWithMeta(coverImage, { fpX, fpY }));
  };

  return (
    <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-xs font-bold uppercase tracking-wider">
          {type === 'infographic' ? 'Imagen principal de la infografía (alta nitidez)' : 'Imagen de portada'}
        </span>
        {coverMeta.cleanUrl && (
          <button
            type="button"
            onClick={() => onRequestCrop(coverMeta.cleanUrl)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-neutral-400 dark:border-neutral-600 text-xs font-display font-bold uppercase cursor-pointer hover:border-[var(--editorial-primary)]"
          >
            <Crop className="w-3.5 h-3.5" />
            <span>Recortar portada</span>
          </button>
        )}
      </div>

      <MediaUploader
        folder={folder}
        slot={type === 'infographic' ? 'infographic' : 'cover'}
        accept="image/*"
        label="Arrastra o selecciona la portada"
        helperText={
          type === 'infographic'
            ? 'Infografía optimizada a 1920px WebP.'
            : 'Se optimiza automáticamente a máximo 1600px en WebP.'
        }
        onUploaded={(items) => {
          if (items[0]) {
            setCoverImage(items[0].url);
            onUploadNote?.(items[0].info);
          }
        }}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          type="text"
          value={coverImage}
          onChange={(e) => setCoverImage(e.target.value)}
          placeholder="URL de imagen de portada"
          className="px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
        />
        <input
          type="text"
          value={coverAlt}
          onChange={(e) => setCoverAlt(e.target.value)}
          placeholder="Texto alternativo (obligatorio al publicar)"
          className={`px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border text-xs ${
            coverImage.trim() && !coverAlt.trim()
              ? 'border-amber-500 dark:border-amber-500'
              : 'border-neutral-300 dark:border-neutral-700'
          }`}
        />
        <input
          type="text"
          value={coverCredit}
          onChange={(e) => setCoverCredit(e.target.value)}
          placeholder="Crédito fotográfico"
          className="px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
        />
      </div>

      {coverMeta.cleanUrl && (
        <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)]">
              <Crosshair className="w-3.5 h-3.5" />
              Encuadre de la portada (haz clic en el punto focal: {coverMeta.fpX}%, {coverMeta.fpY}%)
            </span>
            <button
              type="button"
              onClick={() => setCoverImage(encodeMediaUrlWithMeta(coverImage, { fpX: 50, fpY: 50 }))}
              className="text-xs font-display font-bold uppercase text-neutral-500 hover:text-black dark:hover:text-white cursor-pointer"
            >
              Centrar (50%, 50%)
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
            <div
              onClick={handleCoverFocalClick}
              title="Haz clic sobre el sujeto principal para fijar el encuadre"
              className="md:col-span-6 relative aspect-[16/9] rounded-xl overflow-hidden bg-neutral-900 cursor-crosshair border border-neutral-300 dark:border-neutral-700"
            >
              <img
                src={sanitizeExternalUrl(coverMeta.cleanUrl)}
                alt={coverAlt || 'Selector de punto focal'}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
                style={{ objectPosition: `${coverMeta.fpX}% ${coverMeta.fpY}%` }}
              />
              <span
                aria-hidden="true"
                className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-white bg-[var(--editorial-primary)]/80 shadow-md pointer-events-none"
                style={{ left: `${coverMeta.fpX}%`, top: `${coverMeta.fpY}%` }}
              />
            </div>
            <div className="md:col-span-6 grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <div className="aspect-[16/9] rounded-lg overflow-hidden bg-neutral-900 border border-neutral-300 dark:border-neutral-700">
                  <img
                    src={sanitizeExternalUrl(coverMeta.cleanUrl)}
                    alt=""
                    className="w-full h-full object-cover"
                    style={{ objectPosition: `${coverMeta.fpX}% ${coverMeta.fpY}%` }}
                  />
                </div>
                <p className="text-[10px] font-display uppercase text-center text-neutral-500">16:9 Portada</p>
              </div>
              <div className="space-y-1">
                <div className="aspect-[4/3] rounded-lg overflow-hidden bg-neutral-900 border border-neutral-300 dark:border-neutral-700">
                  <img
                    src={sanitizeExternalUrl(coverMeta.cleanUrl)}
                    alt=""
                    className="w-full h-full object-cover"
                    style={{ objectPosition: `${coverMeta.fpX}% ${coverMeta.fpY}%` }}
                  />
                </div>
                <p className="text-[10px] font-display uppercase text-center text-neutral-500">4:3 Tarjeta</p>
              </div>
              <div className="space-y-1">
                <div className="aspect-square rounded-lg overflow-hidden bg-neutral-900 border border-neutral-300 dark:border-neutral-700">
                  <img
                    src={sanitizeExternalUrl(coverMeta.cleanUrl)}
                    alt=""
                    className="w-full h-full object-cover"
                    style={{ objectPosition: `${coverMeta.fpX}% ${coverMeta.fpY}%` }}
                  />
                </div>
                <p className="text-[10px] font-display uppercase text-center text-neutral-500">1:1 Cuadrado</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
        <label className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase cursor-pointer">
          <input
            type="checkbox"
            checked={sensitiveContent}
            onChange={(e) => setSensitiveContent(e.target.checked)}
          />
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
          <span>Ocultar portada tras advertencia de contenido sensible</span>
        </label>
        {sensitiveContent && (
          <input
            type="text"
            maxLength={300}
            value={sensitiveWarning}
            onChange={(e) => setSensitiveWarning(e.target.value)}
            placeholder="Mensaje de advertencia para lectores (ej. Imágenes fuertes de protesta o conflicto)..."
            className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
          />
        )}
      </div>
    </div>
  );
};
