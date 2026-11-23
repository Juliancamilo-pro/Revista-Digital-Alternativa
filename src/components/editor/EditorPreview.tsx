import React from 'react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { ContentBlock, CoverLayoutStyle, HeaderStyleVariant, PostType } from '../../types/editorial';
import { EditorialImage } from '../EditorialImage';
import { SmartEmbedPlayer } from '../media/SmartEmbedPlayer';

interface EditorPreviewProps {
  previewViewport: 'desktop' | 'tablet' | 'mobile';
  setPreviewViewport: (v: 'desktop' | 'tablet' | 'mobile') => void;
  headerStyle: HeaderStyleVariant;
  coverLayout: CoverLayoutStyle;
  useCustomAccent: boolean;
  accentColor: string;
  type: PostType;
  coverImage: string;
  coverAlt: string;
  title: string;
  subtitle: string;
  mediaUrl: string;
  mediaSubtitlesUrl: string;
  sensitiveContent: boolean;
  sensitiveWarning: string;
  keyPoints: string[];
  blocks: ContentBlock[];
  paragraphIndent: boolean;
}

export const EditorPreview: React.FC<EditorPreviewProps> = ({
  previewViewport,
  setPreviewViewport,
  headerStyle,
  coverLayout,
  useCustomAccent,
  accentColor,
  type,
  coverImage,
  coverAlt,
  title,
  subtitle,
  mediaUrl,
  mediaSubtitlesUrl,
  sensitiveContent,
  sensitiveWarning,
  keyPoints,
  blocks,
  paragraphIndent,
}) => {
  return (
    <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-[#F8F6F1] dark:bg-[#0D0D0D] p-5 space-y-4 max-h-[85vh] overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
          Vista previa editorial ({headerStyle} · {coverLayout})
        </p>
        <div className="inline-flex items-center rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#161616] p-0.5">
          <button
            type="button"
            onClick={() => setPreviewViewport('desktop')}
            aria-label="Vista escritorio"
            className={`p-1.5 rounded-full cursor-pointer ${
              previewViewport === 'desktop' ? 'bg-[#111111] text-white dark:bg-white dark:text-black' : 'text-neutral-500'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setPreviewViewport('tablet')}
            aria-label="Vista tableta"
            className={`p-1.5 rounded-full cursor-pointer ${
              previewViewport === 'tablet' ? 'bg-[#111111] text-white dark:bg-white dark:text-black' : 'text-neutral-500'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setPreviewViewport('mobile')}
            aria-label="Vista móvil"
            className={`p-1.5 rounded-full cursor-pointer ${
              previewViewport === 'mobile' ? 'bg-[#111111] text-white dark:bg-white dark:text-black' : 'text-neutral-500'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        className={`mx-auto transition-all space-y-5 ${
          previewViewport === 'mobile'
            ? 'max-w-[360px] rounded-2xl border border-neutral-300 dark:border-neutral-800 p-4 bg-[#F8F6F1] dark:bg-[#0D0D0D]'
            : previewViewport === 'tablet'
            ? 'max-w-[680px]'
            : 'w-full'
        }`}
        style={
          useCustomAccent
            ? ({ '--editorial-primary': accentColor } as React.CSSProperties)
            : undefined
        }
      >
        {coverImage && (
          <div
            className={
              type === 'infographic'
                ? 'overflow-hidden rounded-xl bg-neutral-900'
                : 'aspect-[16/9] rounded-xl overflow-hidden bg-neutral-900'
            }
          >
            <EditorialImage
              src={coverImage}
              alt={coverAlt || title}
              fallbackTitle={title}
              sensitive={sensitiveContent}
              sensitiveWarning={sensitiveWarning}
              className={type === 'infographic' ? 'w-full h-auto object-contain' : 'w-full h-full object-cover'}
            />
          </div>
        )}
        <h1 className={`font-display text-3xl font-extrabold leading-tight ${headerStyle === 'minimal' ? 'text-center' : ''}`}>
          {title || 'Titular de la publicación'}
        </h1>
        {subtitle && (
          <p className={`text-base text-neutral-600 dark:text-neutral-300 ${headerStyle === 'minimal' ? 'text-center' : ''}`}>
            {subtitle}
          </p>
        )}

        {(type === 'video' || type === 'audio') && mediaUrl.trim() && (
          <SmartEmbedPlayer
            url={mediaUrl}
            title={title}
            posterUrl={coverImage}
            kindHint={type}
            subtitlesUrl={mediaSubtitlesUrl}
            compact
          />
        )}

        {keyPoints.filter((k) => k.trim()).length > 0 && (
          <div className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#141414] p-4 space-y-2">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
              Puntos clave
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              {keyPoints.filter((k) => k.trim()).map((kp, i) => (
                <li key={i}>{kp}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4 font-editorial text-base leading-relaxed">
          {blocks.map((b, bIdx) => (
            <div key={b.id}>
              {b.type === 'paragraph' && (
                <p className={bIdx === 0 ? 'editorial-lead' : paragraphIndent ? 'editorial-paragraph-indent' : ''}>
                  {b.text}
                </p>
              )}
              {b.type === 'heading' && <h2 className="font-display text-2xl font-bold">{b.text}</h2>}
              {b.type === 'quote' && (
                <blockquote className="py-3 border-y border-neutral-300 dark:border-neutral-700 italic text-center">
                  “{b.text}”
                </blockquote>
              )}
              {b.type === 'speaker_quote' && (
                <div className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#141414] p-4 space-y-1">
                  <p className="italic">“{b.text}”</p>
                  <p className="text-xs font-display font-bold uppercase text-[var(--editorial-primary)]">
                    {b.author} {b.speakerRole ? `· ${b.speakerRole}` : ''}
                  </p>
                </div>
              )}
              {(b.type === 'callout' || b.type === 'context_box') && (
                <div className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#141414] p-4 space-y-1">
                  {b.calloutTitle && <p className="font-display text-sm font-bold">{b.calloutTitle}</p>}
                  <p className="text-sm">{b.text}</p>
                </div>
              )}
              {b.type === 'metrics' && (
                <div className="grid grid-cols-2 gap-2">
                  {(b.metricItems || []).map((m, mi) => (
                    <div key={mi} className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#141414] p-3">
                      <p className="font-display text-2xl font-extrabold text-[var(--editorial-primary)]">{m.value}</p>
                      <p className="text-xs font-bold">{m.label}</p>
                    </div>
                  ))}
                </div>
              )}
              {b.type === 'columns' && (
                <div className="grid grid-cols-2 gap-3">
                  {(b.columns || []).map((c, ci) => (
                    <div key={ci} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 text-sm">
                      {c.title && <p className="font-display font-bold">{c.title}</p>}
                      <p>{c.body}</p>
                    </div>
                  ))}
                </div>
              )}
              {b.type === 'list' &&
                (b.listStyle === 'ordered' ? (
                  <ol className="list-decimal pl-5 space-y-1">
                    {(b.listItems || []).filter(Boolean).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ol>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    {(b.listItems || []).filter(Boolean).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                ))}
              {b.type === 'document' && b.documentUrl && (
                <div className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#141414] p-3 flex items-center justify-between text-xs">
                  <span className="font-bold">{b.documentTitle || 'Documento adjunto'}</span>
                  <span className="uppercase text-[var(--editorial-primary)]">PDF</span>
                </div>
              )}
              {b.type === 'image' && b.imageUrl && (
                <EditorialImage src={b.imageUrl} alt={b.imageAlt || ''} className="w-full aspect-video object-cover" />
              )}
              {b.type === 'social_embed' && b.embedUrl && (
                <SmartEmbedPlayer
                  url={b.embedUrl}
                  platformLabelOverride={b.embedPlatform}
                  kindHint="social"
                  compact
                />
              )}
              {b.type === 'divider' && <hr className="my-4 border-neutral-300 dark:border-neutral-700 w-1/3 mx-auto" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
