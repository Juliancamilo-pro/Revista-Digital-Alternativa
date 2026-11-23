import React from 'react';
import { ExternalLink, Headphones, Pause, Play, RotateCcw, RotateCw, SkipForward, Volume2, VolumeX, X } from 'lucide-react';
import { useMediaPlayer } from '../context/MediaPlayerContext';
import { useSite } from '../context/SiteContext';
import { formatSecondsToTimestamp, sanitizeExternalUrl } from '../lib/utils';

const SPEED_OPTIONS = [1, 1.5, 2];

export const MiniAudioPlayer: React.FC = () => {
  const {
    currentTrack,
    queue,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    volume,
    isMuted,
    playbackError,
    togglePlayPause,
    seekTo,
    skipBy,
    setPlaybackRate,
    setVolume,
    toggleMute,
    playNextInQueue,
    closePlayer,
  } = useMediaPlayer();
  const { navigate } = useSite();

  if (!currentTrack) return null;

  const pct = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;
  const idxInQueue = queue.findIndex((q) => q.postId === currentTrack.postId);
  const hasNext = idxInQueue >= 0 && idxInQueue + 1 < queue.length;

  const cycleRate = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate);
    const nextRate = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(nextRate);
  };

  return (
    <aside
      aria-label="Reproductor de audio continuo"
      className="fixed bottom-0 inset-x-0 z-50 h-16 bg-[#111111] text-[#F4F1EA] border-t border-neutral-800 shadow-2xl"
    >
      {/* Barra superior interactiva de avance */}
      <div className="relative h-1 w-full bg-neutral-800">
        <div
          className="h-full bg-[var(--editorial-primary)] transition-[width] duration-150"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(duration || 100))}
          value={Math.floor(currentTime)}
          onChange={(e) => seekTo(Number(e.target.value))}
          aria-label="Posición del audio"
          className="absolute inset-0 w-full h-2 -top-0.5 opacity-0 cursor-pointer"
        />
      </div>

      <div className="max-w-7xl mx-auto h-[calc(4rem-4px)] px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => navigate(`/articulo/${currentTrack.slug}`)}
          className="min-w-0 flex items-center gap-2.5 text-left cursor-pointer group"
        >
          <span className="w-8 h-8 rounded-lg bg-[var(--editorial-primary)]/20 text-[var(--editorial-primary)] flex items-center justify-center shrink-0">
            <Headphones className="w-4 h-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-display font-bold truncate group-hover:underline">
              {currentTrack.title}
            </span>
            {playbackError ? (
              <span className="block text-[10px] text-amber-300 truncate">
                No se pudo cargar el audio en línea
              </span>
            ) : (
              <span className="block text-[10px] text-neutral-400 truncate">
                {currentTrack.authorName}
                {currentTrack.episodeNumber ? ` · Ep. ${currentTrack.episodeNumber}` : ''}
              </span>
            )}
          </span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {playbackError && sanitizeExternalUrl(currentTrack.mediaUrl) && (
            <a
              href={sanitizeExternalUrl(currentTrack.mediaUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-500/40 text-[10px] font-display font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-900/30"
            >
              <span>Abrir audio</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          )}

          <span className="hidden md:inline font-tabular text-[11px] text-neutral-400">
            {formatSecondsToTimestamp(currentTime)} / {formatSecondsToTimestamp(duration)}
          </span>

          <button
            type="button"
            onClick={() => skipBy(-10)}
            aria-label="Retroceder 10 segundos"
            title="Retroceder 10 s"
            className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 rounded-full hover:bg-neutral-800 text-neutral-300 text-[10px] font-tabular cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>10s</span>
          </button>

          <button
            type="button"
            onClick={togglePlayPause}
            aria-label={isPlaying ? 'Pausar audio' : 'Reproducir audio'}
            className="w-9 h-9 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => skipBy(10)}
            aria-label="Adelantar 10 segundos"
            title="Adelantar 10 s"
            className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 rounded-full hover:bg-neutral-800 text-neutral-300 text-[10px] font-tabular cursor-pointer"
          >
            <span>10s</span>
            <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          {hasNext && (
            <button
              type="button"
              onClick={playNextInQueue}
              aria-label="Siguiente episodio"
              title="Siguiente episodio"
              className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-300 cursor-pointer"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          )}

          <div className="hidden lg:flex items-center gap-1.5 pl-1 border-l border-neutral-800">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted || volume === 0 ? 'Activar sonido' : 'Silenciar audio'}
              className="p-1 rounded-full hover:bg-neutral-800 text-neutral-300 cursor-pointer"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volumen del reproductor"
              className="w-16 accent-[var(--editorial-primary)] cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={cycleRate}
            aria-label="Cambiar velocidad de reproducción"
            title="Velocidad: 1x, 1.5x, 2x"
            className="px-2 py-0.5 rounded-md border border-neutral-700 font-tabular text-[11px] font-semibold text-neutral-200 hover:border-neutral-500 cursor-pointer"
          >
            {playbackRate}x
          </button>

          <button
            type="button"
            onClick={closePlayer}
            aria-label="Cerrar reproductor"
            className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
