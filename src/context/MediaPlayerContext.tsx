import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useDataSaver } from './DataSaverContext';

export interface AudioTrackItem {
  postId: string;
  title: string;
  slug: string;
  authorName: string;
  mediaUrl: string;
  coverImage?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

interface MediaPlayerContextValue {
  currentTrack: AudioTrackItem | null;
  queue: AudioTrackItem[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  playTrack: (track: AudioTrackItem, nextQueue?: AudioTrackItem[]) => void;
  togglePlayPause: () => void;
  seekTo: (seconds: number) => void;
  skipBy: (deltaSeconds: number) => void;
  setPlaybackRate: (rate: number) => void;
  playNextInQueue: () => void;
  closePlayer: () => void;
}

const MediaPlayerContext = createContext<MediaPlayerContextValue | null>(null);

export const MediaPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDataSaverActive } = useDataSaver();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrack, setCurrentTrack] = useState<AudioTrackItem | null>(null);
  const [queue, setQueue] = useState<AudioTrackItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);

  const playNextInQueue = useCallback(() => {
    if (!currentTrack || queue.length === 0) {
      setIsPlaying(false);
      return;
    }
    const idx = queue.findIndex((q) => q.postId === currentTrack.postId);
    const next = idx >= 0 && idx + 1 < queue.length ? queue[idx + 1] : null;
    if (next) {
      setCurrentTrack(next);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [currentTrack, queue]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !currentTrack) return;
    el.playbackRate = playbackRate;
    if (isPlaying) {
      el.play().catch(() => setIsPlaying(false));
    } else {
      el.pause();
    }
  }, [currentTrack, isPlaying, playbackRate]);

  const playTrack = useCallback((track: AudioTrackItem, nextQueue?: AudioTrackItem[]) => {
    if (nextQueue) {
      setQueue(nextQueue);
    }
    if (currentTrack?.postId === track.postId && currentTrack?.mediaUrl === track.mediaUrl) {
      setIsPlaying((prev) => !prev);
      return;
    }
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
  }, [currentTrack]);

  const togglePlayPause = useCallback(() => {
    if (!currentTrack) return;
    setIsPlaying((prev) => !prev);
  }, [currentTrack]);

  const seekTo = useCallback((seconds: number) => {
    const el = audioRef.current;
    const clamped = Math.max(0, seconds);
    if (el && Number.isFinite(el.duration || duration)) {
      el.currentTime = Math.min(clamped, el.duration || clamped);
    }
    setCurrentTime(clamped);
  }, [duration]);

  const skipBy = useCallback(
    (deltaSeconds: number) => {
      const el = audioRef.current;
      const base = el ? el.currentTime : currentTime;
      seekTo(base + deltaSeconds);
    },
    [currentTime, seekTo]
  );

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  }, []);

  const closePlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setCurrentTrack(null);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  return (
    <MediaPlayerContext.Provider
      value={{
        currentTrack,
        queue,
        isPlaying,
        currentTime,
        duration,
        playbackRate,
        playTrack,
        togglePlayPause,
        seekTo,
        skipBy,
        setPlaybackRate,
        playNextInQueue,
        closePlayer,
      }}
    >
      {children}
      {/* Reproductor HTML5 persistente; con ahorro de datos solo carga bajo acción del lector */}
      <audio
        ref={audioRef}
        src={currentTrack?.mediaUrl || undefined}
        preload={isDataSaverActive ? 'none' : 'metadata'}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime || 0);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onEnded={playNextInQueue}
        className="hidden"
      />
    </MediaPlayerContext.Provider>
  );
};

export function useMediaPlayer() {
  const ctx = useContext(MediaPlayerContext);
  if (!ctx) throw new Error('useMediaPlayer debe usarse dentro de MediaPlayerProvider');
  return ctx;
}
