import React from 'react';
import { AlertTriangle, Captions, CheckCircle2, Upload } from 'lucide-react';
import { inspectMediaUrl } from '../../lib/mediaEmbeds';
import { formatSecondsToTimestamp, generateId } from '../../lib/utils';
import { MediaChapter, PostType, SourceReference } from '../../types/editorial';
import { SmartEmbedPlayer } from '../media/SmartEmbedPlayer';

function parseTimestampToSec(raw: string): number {
  const clean = raw.trim();
  if (!clean) return 0;
  if (/^\d+$/.test(clean)) return Math.max(0, Number(clean));
  const parts = clean.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

interface MediaSectionEditorProps {
  type: PostType;
  title: string;
  coverImage: string;
  mediaUrl: string;
  setMediaUrl: (url: string) => void;
  documentTitle: string;
  setDocumentTitle: (t: string) => void;
  mediaDurationLabel: string;
  setMediaDurationLabel: (v: string) => void;
  seasonNumber: string;
  setSeasonNumber: (v: string) => void;
  episodeNumber: string;
  setEpisodeNumber: (v: string) => void;
  mediaSubtitlesUrl: string;
  setMediaSubtitlesUrl: (v: string) => void;
  mediaChapters: MediaChapter[];
  setMediaChapters: React.Dispatch<React.SetStateAction<MediaChapter[]>>;
  episodeNotes: string;
  setEpisodeNotes: (v: string) => void;
  mediaTranscript: string;
  setMediaTranscript: (v: string) => void;
  mediaRelatedLinks: SourceReference[];
  setMediaRelatedLinks: React.Dispatch<React.SetStateAction<SourceReference[]>>;
  onUploadMedia: (file: File) => void;
  onUploadDocument: (file: File) => void;
  onUploadSubtitle: (file: File) => void;
}

export const MediaSectionEditor: React.FC<MediaSectionEditorProps> = ({
  type,
  title,
  coverImage,
  mediaUrl,
  setMediaUrl,
  documentTitle,
  setDocumentTitle,
  mediaDurationLabel,
  setMediaDurationLabel,
  seasonNumber,
  setSeasonNumber,
  episodeNumber,
  setEpisodeNumber,
  mediaSubtitlesUrl,
  setMediaSubtitlesUrl,
  mediaChapters,
  setMediaChapters,
  episodeNotes,
  setEpisodeNotes,
  mediaTranscript,
  setMediaTranscript,
  mediaRelatedLinks,
  setMediaRelatedLinks,
  onUploadMedia,
  onUploadDocument,
  onUploadSubtitle,
}) => {
  if (type !== 'video' && type !== 'audio' && type !== 'document') {
    return null;
  }

  const trimmedUrl = mediaUrl.trim();
  const inspection = trimmedUrl
    ? inspectMediaUrl(trimmedUrl, type === 'audio' ? 'audio' : type === 'video' ? 'video' : 'document')
    : null;

  return (
    <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-xs font-bold uppercase tracking-wider">
          {type === 'video'
            ? 'Fuente de video (YouTube, Vimeo, TikTok, Instagram, Facebook, Drive, Dropbox o MP4)'
            : type === 'audio'
            ? 'Audio / pódcast (MP3, Spotify, SoundCloud, Google Drive o Dropbox)'
            : 'Documento / PDF descargable principal'}
        </span>
        <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-neutral-400 text-xs font-display font-bold uppercase cursor-pointer">
          <Upload className="w-3.5 h-3.5" />
          <span>{type === 'document' ? 'Subir PDF / Doc' : 'Subir archivo'}</span>
          <input
            type="file"
            accept={
              type === 'video'
                ? 'video/*'
                : type === 'audio'
                ? 'audio/*'
                : 'application/pdf,.pdf,.doc,.docx'
            }
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (type === 'document') onUploadDocument(f);
              else onUploadMedia(f);
            }}
          />
        </label>
      </div>

      {type === 'document' && (
        <input
          type="text"
          maxLength={200}
          value={documentTitle}
          onChange={(e) => setDocumentTitle(e.target.value)}
          placeholder="Título del documento descargable"
          className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
        />
      )}

      <input
        type="text"
        value={mediaUrl}
        onChange={(e) => setMediaUrl(e.target.value)}
        placeholder={
          type === 'video'
            ? 'https://www.youtube.com/watch?v=..., Vimeo, TikTok, Instagram, Drive o MP4'
            : type === 'audio'
            ? 'https://.../episodio.mp3, Spotify, SoundCloud, Google Drive o Dropbox'
            : 'https://.../documento.pdf'
        }
        className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
      />

      {inspection && (
        <div
          className={`rounded-xl px-3 py-2 text-xs flex items-start gap-2 border ${
            !inspection.isValid
              ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
              : inspection.warning
              ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
              : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200'
          }`}
        >
          {!inspection.isValid || inspection.warning ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-semibold">
              {!inspection.isValid
                ? inspection.errorReason
                : `${inspection.platformLabel}${inspection.embeddable ? ' · Reproductor incrustado listo' : ' · Se mostrará como tarjeta externa segura'}`}
            </p>
            {inspection.warning && <p className="mt-0.5 opacity-90">{inspection.warning}</p>}
          </div>
        </div>
      )}

      {(type === 'video' || type === 'audio') && inspection?.isValid && (
        <SmartEmbedPlayer
          url={mediaUrl}
          title={title}
          posterUrl={coverImage}
          kindHint={type}
          subtitlesUrl={mediaSubtitlesUrl}
          compact
        />
      )}

      {(type === 'video' || type === 'audio') && (
        <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-display font-bold uppercase text-neutral-500 mb-1">
                Duración visible
              </label>
              <input
                type="text"
                maxLength={40}
                value={mediaDurationLabel}
                onChange={(e) => setMediaDurationLabel(e.target.value)}
                placeholder="Ej. 24:15"
                className="w-full px-3 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
            </div>
            {type === 'audio' && (
              <>
                <div>
                  <label className="block text-[11px] font-display font-bold uppercase text-neutral-500 mb-1">
                    Temporada (opcional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={seasonNumber}
                    onChange={(e) => setSeasonNumber(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-display font-bold uppercase text-neutral-500 mb-1">
                    Episodio (opcional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={episodeNumber}
                    onChange={(e) => setEpisodeNumber(e.target.value)}
                    placeholder="1"
                    className="w-full px-3 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                </div>
              </>
            )}
            {type === 'video' && (
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-display font-bold uppercase text-neutral-500 mb-1">
                  Subtítulos WebVTT (.vtt opcional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={mediaSubtitlesUrl}
                    onChange={(e) => setMediaSubtitlesUrl(e.target.value)}
                    placeholder="URL archivo .vtt"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                  <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#111111] text-white text-xs font-display font-bold uppercase cursor-pointer shrink-0">
                    <Captions className="w-3.5 h-3.5" />
                    <span>Subir .vtt</span>
                    <input
                      type="file"
                      accept=".vtt,text/vtt"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onUploadSubtitle(f);
                      }}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-display text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                Capítulos y marcas de tiempo ({mediaChapters.length})
              </span>
              <button
                type="button"
                onClick={() =>
                  setMediaChapters((prev) => [
                    ...prev,
                    { id: generateId('chap'), timeSec: 0, label: '', description: '' },
                  ])
                }
                className="px-2.5 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 text-[11px] font-display font-bold uppercase cursor-pointer"
              >
                + Añadir capítulo
              </button>
            </div>
            {mediaChapters.map((chap, cIdx) => (
              <div key={chap.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  defaultValue={formatSecondsToTimestamp(chap.timeSec)}
                  onBlur={(e) => {
                    const sec = parseTimestampToSec(e.target.value);
                    setMediaChapters((prev) =>
                      prev.map((x, i) => (i === cIdx ? { ...x, timeSec: sec } : x))
                    );
                  }}
                  placeholder="02:30"
                  className="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs font-tabular"
                />
                <input
                  type="text"
                  value={chap.label}
                  onChange={(e) =>
                    setMediaChapters((prev) =>
                      prev.map((x, i) => (i === cIdx ? { ...x, label: e.target.value } : x))
                    )
                  }
                  placeholder="Título del capítulo"
                  className="sm:col-span-4 px-2.5 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
                <input
                  type="text"
                  value={chap.description || ''}
                  onChange={(e) =>
                    setMediaChapters((prev) =>
                      prev.map((x, i) => (i === cIdx ? { ...x, description: e.target.value } : x))
                    )
                  }
                  placeholder="Nota breve (opcional)"
                  className="sm:col-span-5 px-2.5 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setMediaChapters((prev) => prev.filter((_, i) => i !== cIdx))}
                  className="sm:col-span-1 text-xs text-red-600 font-bold cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>

          {type === 'audio' && (
            <div>
              <label className="block text-[11px] font-display font-bold uppercase text-neutral-500 mb-1">
                Notas del episodio (opcional)
              </label>
              <textarea
                rows={2}
                maxLength={10000}
                value={episodeNotes}
                onChange={(e) => setEpisodeNotes(e.target.value)}
                placeholder="Créditos de producción, música, temas abordados..."
                className="w-full px-3 py-2 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
            </div>
          )}

          <div>
            <label className="block text-[11px] font-display font-bold uppercase text-neutral-500 mb-1">
              Transcripción completa (desplegable y accesible, opcional)
            </label>
            <textarea
              rows={3}
              maxLength={40000}
              value={mediaTranscript}
              onChange={(e) => setMediaTranscript(e.target.value)}
              placeholder="Pega aquí la transcripción literal del video o episodio..."
              className="w-full px-3 py-2 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-display text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                Enlaces mencionados en el video / pódcast
              </span>
              <button
                type="button"
                onClick={() => setMediaRelatedLinks((prev) => [...prev, { label: '', url: '' }])}
                className="px-2.5 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 text-[11px] font-display font-bold uppercase cursor-pointer"
              >
                + Añadir enlace
              </button>
            </div>
            {mediaRelatedLinks.map((lnk, lIdx) => (
              <div key={lIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  value={lnk.label}
                  onChange={(e) =>
                    setMediaRelatedLinks((prev) =>
                      prev.map((x, i) => (i === lIdx ? { ...x, label: e.target.value } : x))
                    )
                  }
                  placeholder="Etiqueta del recurso"
                  className="sm:col-span-5 px-2.5 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
                <input
                  type="url"
                  value={lnk.url || ''}
                  onChange={(e) =>
                    setMediaRelatedLinks((prev) =>
                      prev.map((x, i) => (i === lIdx ? { ...x, url: e.target.value } : x))
                    )
                  }
                  placeholder="https://..."
                  className="sm:col-span-6 px-2.5 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setMediaRelatedLinks((prev) => prev.filter((_, i) => i !== lIdx))}
                  className="sm:col-span-1 text-xs text-red-600 font-bold cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
