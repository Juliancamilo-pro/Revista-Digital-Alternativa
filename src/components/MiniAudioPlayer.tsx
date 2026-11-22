import React from 'react';
import { Headphones, Pause, Play, RotateCcw, RotateCw, SkipForward, X } from 'lucide-react';
import { useMediaPlayer } from '../context/MediaPlayerContext';
import { useSite } from '../context/SiteContext';
import { formatSecondsToTimestamp } from '../lib/utils';

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

export const MiniAudioPlayer: React.FC = () => {
  const {
    currentTrack,
    queue,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    togglePlayPause,
    seekTo,
    skipBy,
    setPlaybackRate,
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
      {/* Top interactive scrubber bar */}
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
            <span className="block text-[10px] text-neutral-400 truncate">
              {currentTrack.authorName}
              {currentTrack.episodeNumber ? ` · Ep. ${currentTrack.episodeNumber}` : ''}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <span className="hidden md:inline font-tabular text-[11px] text-neutral-400">
            {formatSecondsToTimestamp(currentTime)} / {formatSecondsToTimestamp(duration)}
          </span>

          <button
            type="button"
            onClick={() => skipBy(-15)}
            aria-label="Retroceder 15 segundos"
            className="hidden sm:inline-flex p-1.5 rounded-full hover:bg-neutral-800 text-neutral-300 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
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
            onClick={() => skipBy(15)}
            aria-label="Adelantar 15 segundos"
            className="hidden sm:inline-flex p-1.5 rounded-full hover:bg-neutral-800 text-neutral-300 cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
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

          <button
            type="button"
            onClick={cycleRate}
            aria-label="Cambiar velocidad de reproducción"
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
