import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Film, Music, Play, Share2 } from 'lucide-react';
import { inspectMediaUrl } from '../../lib/mediaEmbeds';
import { sanitizeExternalUrl } from '../../lib/utils';
import { EditorialImage } from '../EditorialImage';

interface SmartEmbedPlayerProps {
  url: string;
  title?: string;
  posterUrl?: string;
  kindHint?: 'video' | 'audio' | 'social' | 'document';
  startSeconds?: number;
  subtitlesUrl?: string;
  platformLabelOverride?: string;
  isDataSaverActive?: boolean;
  onVideoElementReady?: (el: HTMLVideoElement | null) => void;
  compact?: boolean;
}

export const SmartEmbedPlayer: React.FC<SmartEmbedPlayerProps> = ({
  url,
  title,
  posterUrl,
  kindHint,
  startSeconds,
  subtitlesUrl,
  platformLabelOverride,
  isDataSaverActive = false,
  onVideoElementReady,
  compact = false,
}) => {
  const inspected = useMemo(
    () => inspectMediaUrl(url, kindHint, startSeconds),
    [url, kindHint, startSeconds]
  );
  const safeExternal = sanitizeExternalUrl(inspected.originalUrl || url);
  const [activated, setActivated] = useState(false);
  const [embedFailed, setEmbedFailed] = useState(false);
  const [useDrivePreviewFallback, setUseDrivePreviewFallback] = useState(false);

  useEffect(() => {
    setActivated(false);
    setEmbedFailed(false);
    setUseDrivePreviewFallback(false);
  }, [url, startSeconds, kindHint]);

  const effectivePreviewImg = posterUrl || inspected.thumbnailUrl || '';
  const platformName = platformLabelOverride?.trim() || inspected.platformLabel;
  const displayTitle = title?.trim() || inspected.titleHint;

  if (!inspected.isValid || !safeExternal) {
    return (
      <div className="rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/20 p-4 text-xs text-red-700 dark:text-red-300 space-y-1">
        <p className="font-display font-bold uppercase tracking-wider">Enlace multimedia no válido</p>
        <p>{inspected.errorReason || 'Verifica que la URL comience con https:// o http://.'}</p>
      </div>
    );
  }

  // Tarjeta de respaldo editorial cuando no se puede incrustar o el marco/video falla
  if (embedFailed || inspected.kind === 'link' || (!inspected.embeddable && !useDrivePreviewFallback)) {
    return (
      <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-12 items-stretch">
          {effectivePreviewImg && (
            <div className="sm:col-span-4 aspect-video sm:aspect-auto bg-neutral-900 min-h-[120px]">
              <EditorialImage
                src={effectivePreviewImg}
                alt={displayTitle}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className={`${effectivePreviewImg ? 'sm:col-span-8' : 'sm:col-span-12'} p-4 sm:p-5 flex flex-col justify-between gap-3`}>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] font-display font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                {kindHint === 'audio' ? (
                  <Music className="w-3.5 h-3.5" aria-hidden="true" />
                ) : kindHint === 'social' ? (
                  <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Film className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>{platformName}</span>
              </div>
              <p className="font-display text-lg font-bold leading-snug">{displayTitle}</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {embedFailed
                  ? 'El reproductor externo no pudo cargarse en esta vista (posible restricción de la plataforma o cookies).'
                  : inspected.warning || 'Este enlace se abre de forma segura en su plataforma original.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={safeExternal}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111111] dark:bg-white text-white dark:text-[#111111] font-display text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
              >
                <span>Abrir enlace</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
              {embedFailed && (
                <button
                  type="button"
                  onClick={() => {
                    setEmbedFailed(false);
                    setActivated(true);
                  }}
                  className="px-3 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase cursor-pointer"
                >
                  Reintentar reproductor
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Audio directo o incrustación de audio (Spotify / SoundCloud / Drive / Dropbox)
  if (inspected.kind === 'audio') {
    return (
      <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-display font-bold uppercase tracking-wider text-[var(--editorial-primary)]">
            <Music className="w-3.5 h-3.5" aria-hidden="true" />
            {platformName}
          </span>
          <a
            href={safeExternal}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase text-neutral-500 hover:text-[var(--editorial-primary)]"
          >
            <span>Abrir enlace</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>
        <audio
          controls
          src={inspected.src}
          preload={isDataSaverActive ? 'none' : 'metadata'}
          onError={() => {
            if (inspected.previewIframeUrl && !useDrivePreviewFallback) {
              setUseDrivePreviewFallback(true);
              setActivated(true);
            } else {
              setEmbedFailed(true);
            }
          }}
          className="w-full"
        />
      </div>
    );
  }

  // Fachada ligera: monta iframe o <video> solo tras interacción del lector
  if (!activated) {
    const isTallEmbed = inspected.provider === 'spotify' || inspected.provider === 'soundcloud';
    return (
      <div
        className={`relative rounded-2xl overflow-hidden border border-neutral-300 dark:border-neutral-800 bg-neutral-950 text-white ${
          isTallEmbed || compact ? 'min-h-[168px]' : 'aspect-video'
        }`}
      >
        {effectivePreviewImg && (
          <img
            src={sanitizeExternalUrl(effectivePreviewImg)}
            alt={displayTitle}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/25 flex flex-col items-center justify-center p-5 text-center gap-3">
          <span className="font-display text-[11px] font-bold uppercase tracking-widest text-neutral-300">
            {platformName}
          </span>
          <p className="font-display text-lg sm:text-xl font-bold max-w-md line-clamp-2">
            {displayTitle}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => setActivated(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase tracking-wider shadow-lg cursor-pointer transition-colors"
            >
              <Play className="w-4 h-4 fill-current" aria-hidden="true" />
              <span>Cargar reproductor</span>
            </button>
            <a
              href={safeExternal}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-white/30 bg-black/40 hover:bg-black/60 text-white font-display text-xs font-bold uppercase tracking-wider"
            >
              <span>Abrir enlace</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </a>
          </div>
          {isDataSaverActive && (
            <p className="text-[11px] text-neutral-300">
              Ahorro de datos activo: el reproductor se cargará bajo tu solicitud.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Video HTML5 directo (con fallback a /preview de Drive si falla CORS/streaming)
  if (inspected.kind === 'video' && !useDrivePreviewFallback) {
    return (
      <div className="space-y-2">
        <div className="aspect-video rounded-2xl overflow-hidden bg-black border border-neutral-300 dark:border-neutral-800">
          <video
            ref={(el) => onVideoElementReady?.(el)}
            controls
            autoPlay
            playsInline
            poster={effectivePreviewImg ? sanitizeExternalUrl(effectivePreviewImg) : undefined}
            src={inspected.src}
            onError={() => {
              if (inspected.previewIframeUrl) {
                setUseDrivePreviewFallback(true);
              } else {
                setEmbedFailed(true);
              }
            }}
            className="w-full h-full"
          >
            {subtitlesUrl && sanitizeExternalUrl(subtitlesUrl) && (
              <track
                kind="subtitles"
                src={sanitizeExternalUrl(subtitlesUrl)}
                srcLang="es"
                label="Español"
                default
              />
            )}
          </video>
        </div>
        <div className="flex justify-end">
          <a
            href={safeExternal}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase text-neutral-500 hover:text-[var(--editorial-primary)]"
          >
            <span>Abrir enlace original</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      </div>
    );
  }

  const iframeSrc = useDrivePreviewFallback && inspected.previewIframeUrl ? inspected.previewIframeUrl : inspected.src;
  const isAudioIframe = inspected.provider === 'spotify' || inspected.provider === 'soundcloud';
  const isVerticalSocial = inspected.provider === 'tiktok' || inspected.provider === 'instagram';

  return (
    <div className="space-y-2">
      <div
        className={`rounded-2xl overflow-hidden bg-black border border-neutral-300 dark:border-neutral-800 ${
          isAudioIframe
            ? 'h-[190px]'
            : isVerticalSocial
            ? 'aspect-[9/14] max-w-md mx-auto bg-white dark:bg-[#141414]'
            : 'aspect-video'
        }`}
      >
        <iframe
          src={iframeSrc}
          title={displayTitle}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setEmbedFailed(true)}
          className="w-full h-full border-0"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500">
        <span>{platformName} · ¿No carga el reproductor?</span>
        <a
          href={safeExternal}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-display font-bold uppercase text-[var(--editorial-primary)] hover:underline"
        >
          <span>Abrir enlace</span>
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
};
