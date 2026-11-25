import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Info,
  Quote,
} from 'lucide-react';
import { parseMediaUrlMeta, sanitizeExternalUrl } from '../../lib/utils';
import { ContentBlock } from '../../types/editorial';
import { EditorialImage } from '../EditorialImage';
import type { LightboxSlide } from '../media/GalleryLightbox';
import { SmartEmbedPlayer } from '../media/SmartEmbedPlayer';

/** Safe inline formatter for **bold**, *italic*, [label](https://...), and [n] */
export function renderInlineText(raw: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^)]+\)|\[\d+\])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      parts.push(raw.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={keyIdx++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={keyIdx++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('[') && token.includes('](')) {
      const m = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      if (m) {
        parts.push(
          <a
            key={keyIdx++}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-[var(--editorial-primary)] underline-offset-4 hover:text-[var(--editorial-primary)] transition-colors"
          >
            {m[1]}
          </a>
        );
      } else {
        parts.push(token);
      }
    } else if (/^\[\d+\]$/.test(token)) {
      const num = token.slice(1, -1);
      parts.push(
        <sup key={keyIdx++} className="font-tabular text-xs font-bold text-[var(--editorial-primary)] ml-0.5">
          <a href={`#nota-${num}`} className="hover:underline">
            [{num}]
          </a>
        </sup>
      );
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < raw.length) {
    parts.push(raw.slice(lastIndex));
  }
  return parts.length > 0 ? parts : raw;
}

const BeforeAfterSliderBlock: React.FC<{ block: ContentBlock }> = ({ block }) => {
  const [pos, setPos] = useState(50);
  const beforeUrl = sanitizeExternalUrl(parseMediaUrlMeta(block.beforeImageUrl || '').cleanUrl);
  const afterUrl = sanitizeExternalUrl(parseMediaUrlMeta(block.afterImageUrl || '').cleanUrl);
  if (!beforeUrl || !afterUrl) return null;

  return (
    <figure className="my-8 space-y-2">
      <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-neutral-900 select-none border border-[var(--editorial-border)]">
        <img
          src={afterUrl}
          alt={block.afterLabel || 'Después'}
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          <img
            src={beforeUrl}
            alt={block.beforeLabel || 'Antes'}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md pointer-events-none"
          style={{ left: `${pos}%` }}
        />
        {block.beforeLabel && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/75 text-white font-display text-[11px] font-bold uppercase tracking-wider">
            {block.beforeLabel}
          </span>
        )}
        {block.afterLabel && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/75 text-white font-display text-[11px] font-bold uppercase tracking-wider">
            {block.afterLabel}
          </span>
        )}
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Comparar antes y después"
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
        />
      </div>
      {block.text && (
        <figcaption className="text-xs text-[var(--editorial-muted)] italic">
          {block.text}
        </figcaption>
      )}
    </figure>
  );
};

const CarouselBlock: React.FC<{ block: ContentBlock }> = ({ block }) => {
  const items = (block.carouselItems || []).filter((i) => sanitizeExternalUrl(i.url));
  const [idx, setIdx] = useState(0);
  if (items.length === 0) return null;
  const active = items[idx % items.length];

  return (
    <figure className="my-8 space-y-2.5">
      <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-neutral-900 border border-[var(--editorial-border)]">
        <EditorialImage
          src={active.url}
          alt={active.alt || active.caption || 'Imagen de carrusel'}
          fallbackTitle={active.caption}
          fallbackCategory="Galería"
          width={1200}
          height={750}
          className="w-full h-full object-cover"
        />
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)}
              aria-label="Diapositiva anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/75 text-white hover:bg-black cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setIdx((i) => (i + 1) % items.length)}
              aria-label="Diapositiva siguiente"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/75 text-white hover:bg-black cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-black/75 text-white font-tabular text-[11px]">
              {idx + 1} / {items.length}
            </span>
          </>
        )}
      </div>
      {(active.caption || active.credit || items.length > 1) && (
        <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--editorial-muted)]">
          <span className="italic">{active.caption}</span>
          {active.credit && <span className="font-display uppercase">{active.credit}</span>}
          {items.length > 1 && (
            <div className="flex items-center gap-1.5">
              {items.map((it, i) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setIdx(i)}
                  aria-label={`Ir a imagen ${i + 1}`}
                  className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-colors ${
                    i === idx ? 'bg-[var(--editorial-primary)]' : 'bg-[var(--editorial-muted)]/40'
                  }`}
                />
              ))}
            </div>
          )}
        </figcaption>
      )}
    </figure>
  );
};

interface ArticleBodyBlocksProps {
  blocks: ContentBlock[];
  paragraphIndent?: boolean;
  resolvedAuthorName: string;
  isDataSaverActive: boolean;
  onQuoteShare: (payload: { text: string; author?: string }) => void;
  onImageClick?: (slide: LightboxSlide) => void;
}

export const ArticleBodyBlocks: React.FC<ArticleBodyBlocksProps> = ({
  blocks,
  paragraphIndent,
  resolvedAuthorName,
  isDataSaverActive,
  onQuoteShare,
  onImageClick,
}) => {
  let paragraphIdx = 0;

  return (
    <>
      {blocks.map((block: ContentBlock) => {
        switch (block.type) {
          case 'paragraph': {
            const isFirst = paragraphIdx === 0;
            paragraphIdx++;
            const rawTrimmed = (block.text || '').trim();
            const startsWithLetter = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(rawTrimmed);
            const classNames = isFirst
              ? startsWithLetter
                ? 'editorial-lead editorial-dropcap'
                : 'editorial-lead'
              : paragraphIndent
              ? 'editorial-paragraph-indent'
              : '';
            return (
              <p key={block.id} className={classNames}>
                {renderInlineText(block.text || '')}
              </p>
            );
          }
          case 'heading': {
            const anchorId = `sec-${block.id}`;
            if (block.level === 4) {
              return (
                <h4 id={anchorId} key={block.id} className="font-display text-xl font-bold tracking-tight pt-2 scroll-mt-20 text-[var(--editorial-ink)]">
                  {block.text}
                </h4>
              );
            }
            if (block.level === 3) {
              return (
                <h3 id={anchorId} key={block.id} className="font-display text-2xl font-bold tracking-tight pt-3 scroll-mt-20 text-[var(--editorial-ink)]">
                  {block.text}
                </h3>
              );
            }
            return (
              <h2 id={anchorId} key={block.id} className="font-display text-3xl font-extrabold tracking-tight pt-5 scroll-mt-20 text-[var(--editorial-ink)]">
                {block.text}
              </h2>
            );
          }
          case 'quote':
            return (
              <blockquote
                key={block.id}
                className="my-9 py-7 border-y border-[var(--editorial-border)] text-center px-4 space-y-3"
              >
                <p className="font-editorial italic text-2xl sm:text-3xl leading-snug text-[var(--editorial-ink)]">
                  “{block.text}”
                </p>
                {block.author && (
                  <footer className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                    — {block.author}
                  </footer>
                )}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      onQuoteShare({
                        text: block.text || '',
                        author: block.author || resolvedAuthorName,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[var(--editorial-border)] text-xs font-display font-bold uppercase tracking-wider text-[var(--editorial-muted)] hover:border-[var(--editorial-primary)] hover:text-[var(--editorial-primary)] cursor-pointer transition-colors"
                  >
                    <Quote className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Compartir cita</span>
                  </button>
                </div>
              </blockquote>
            );
          case 'speaker_quote':
            return (
              <blockquote
                key={block.id}
                className="my-8 rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-6 space-y-4 shadow-xs"
              >
                <p className="font-editorial italic text-xl sm:text-2xl leading-relaxed text-[var(--editorial-ink)]">
                  “{block.text}”
                </p>
                <footer className="flex items-center gap-3 pt-3 border-t border-[var(--editorial-border)]">
                  {block.imageUrl && (
                    <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 bg-[var(--editorial-surface-subtle)]">
                      <EditorialImage
                        src={block.imageUrl}
                        alt={block.author || ''}
                        fallbackTitle={block.author}
                        width={88}
                        height={88}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div>
                    {block.author && (
                      <p className="font-display text-sm font-bold uppercase tracking-wider text-[var(--editorial-primary)]">
                        {block.author}
                      </p>
                    )}
                    {block.speakerRole && (
                      <p className="text-xs text-[var(--editorial-muted)]">{block.speakerRole}</p>
                    )}
                  </div>
                </footer>
              </blockquote>
            );
          case 'callout':
          case 'context_box': {
            const tone = block.type === 'context_box' ? 'info' : block.calloutTone || 'info';
            const cardClass =
              tone === 'warning'
                ? 'border-amber-500/40 bg-amber-500/10'
                : tone === 'key_fact'
                ? 'border-[var(--editorial-primary)]/40 bg-[var(--editorial-primary)]/[0.05]'
                : block.type === 'context_box'
                ? 'border-[var(--editorial-border)] bg-[var(--editorial-surface-subtle)]'
                : 'border-[var(--editorial-border)] bg-[var(--editorial-surface)]';
            const badgeText =
              block.type === 'context_box'
                ? 'Caja de contexto'
                : tone === 'warning'
                ? 'Advertencia'
                : tone === 'key_fact'
                ? 'Dato clave'
                : 'Contexto';
            return (
              <aside key={block.id} className={`my-7 rounded-2xl border p-5 space-y-2 ${cardClass}`}>
                <div className="flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-widest text-[var(--editorial-primary)]">
                  {tone === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{block.calloutTitle || badgeText}</span>
                </div>
                {block.text && (
                  <p className="text-base leading-relaxed text-[var(--editorial-ink)] whitespace-pre-line">
                    {renderInlineText(block.text)}
                  </p>
                )}
              </aside>
            );
          }
          case 'columns': {
            const cols = block.columns || [];
            if (cols.length === 0) return null;
            return (
              <div
                key={block.id}
                className={`my-7 grid grid-cols-1 ${
                  cols.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
                } gap-4`}
              >
                {cols.map((col, ci) => (
                  <div
                    key={ci}
                    className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 space-y-1.5"
                  >
                    {col.title && (
                      <h4 className="font-display text-base font-bold uppercase tracking-wide text-[var(--editorial-primary)]">
                        {col.title}
                      </h4>
                    )}
                    <p className="text-sm sm:text-base leading-relaxed text-[var(--editorial-ink)]">
                      {renderInlineText(col.body)}
                    </p>
                  </div>
                ))}
              </div>
            );
          }
          case 'metrics': {
            const items = (block.metricItems || []).filter((m) => m.value || m.label);
            if (items.length === 0) return null;
            return (
              <section key={block.id} className="my-8 space-y-3">
                {block.text && (
                  <p className="font-display text-xs font-extrabold uppercase tracking-widest text-[var(--editorial-primary)]">
                    {block.text}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {items.map((m, mi) => (
                    <div
                      key={mi}
                      className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 space-y-1"
                    >
                      <p className="font-display text-3xl sm:text-4xl font-extrabold text-[var(--editorial-primary)] font-tabular">
                        {m.value}
                      </p>
                      <p className="font-display text-sm font-bold uppercase tracking-wide text-[var(--editorial-ink)]">
                        {m.label}
                      </p>
                      {m.detail && <p className="text-xs text-[var(--editorial-muted)]">{m.detail}</p>}
                    </div>
                  ))}
                </div>
              </section>
            );
          }
          case 'before_after':
            return <BeforeAfterSliderBlock key={block.id} block={block} />;
          case 'carousel':
            return <CarouselBlock key={block.id} block={block} />;
          case 'list': {
            const items = (block.listItems || []).filter((item) => item.trim().length > 0);
            if (items.length === 0) return null;
            return block.listStyle === 'ordered' ? (
              <ol key={block.id} className="list-decimal pl-6 space-y-2 marker:text-[var(--editorial-primary)] marker:font-semibold">
                {items.map((item, idx) => (
                  <li key={idx}>{renderInlineText(item)}</li>
                ))}
              </ol>
            ) : (
              <ul key={block.id} className="list-disc pl-6 space-y-2 marker:text-[var(--editorial-primary)]">
                {items.map((item, idx) => (
                  <li key={idx}>{renderInlineText(item)}</li>
                ))}
              </ul>
            );
          }
          case 'document': {
            const safeDocUrl = sanitizeExternalUrl(block.documentUrl || '');
            if (!safeDocUrl) return null;
            return (
              <div
                key={block.id}
                className="my-7 rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-[var(--editorial-primary)] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-display text-base font-bold text-[var(--editorial-ink)]">
                      {block.documentTitle || 'Documento adjunto'}
                    </p>
                    {block.documentDescription && (
                      <p className="text-xs text-[var(--editorial-muted)] mt-0.5">
                        {block.documentDescription}
                      </p>
                    )}
                  </div>
                </div>
                <a
                  href={safeDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--editorial-border)] font-display text-xs font-bold uppercase tracking-wider shrink-0 hover:bg-[var(--editorial-ink)] hover:text-[var(--editorial-paper)] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Descargar PDF</span>
                </a>
              </div>
            );
          }
          case 'image': {
            const imgUrl = block.imageUrl || '';
            const imgAlt = block.imageAlt || block.imageCaption || 'Imagen editorial';
            return (
              <figure key={block.id} className="my-8">
                <div
                  className={`aspect-[16/10] rounded-2xl overflow-hidden bg-neutral-900 border border-[var(--editorial-border)] ${
                    onImageClick && imgUrl ? 'cursor-zoom-in' : ''
                  }`}
                  onClick={() => {
                    if (onImageClick && imgUrl) {
                      onImageClick({
                        id: block.id,
                        url: imgUrl,
                        alt: imgAlt,
                        caption: block.imageCaption,
                        credit: block.imageCredit,
                      });
                    }
                  }}
                >
                  <EditorialImage
                    src={imgUrl}
                    alt={imgAlt}
                    fallbackTitle={block.imageCaption}
                    fallbackCategory="Fotografía"
                    width={1200}
                    height={750}
                    className="w-full h-full object-cover"
                  />
                </div>
                {(block.imageCaption || block.imageCredit) && (
                  <figcaption className="mt-2 text-xs text-[var(--editorial-muted)] italic flex flex-wrap justify-between gap-2">
                    <span>{block.imageCaption}</span>
                    {block.imageCredit && <span className="not-italic font-display uppercase">{block.imageCredit}</span>}
                  </figcaption>
                )}
              </figure>
            );
          }
          case 'timeline':
            return (
              <div key={block.id} className="my-8 rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-6">
                {block.text && (
                  <h3 className="font-display text-lg font-extrabold uppercase tracking-wider text-[var(--editorial-primary)] mb-4">
                    {block.text}
                  </h3>
                )}
                <ol className="space-y-4">
                  {(block.timelineEntries || []).map((entry, idx) => (
                    <li key={idx} className="pb-4 border-b border-[var(--editorial-border)] last:border-b-0 last:pb-0">
                      <span className="font-tabular text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                        {entry.date}
                      </span>
                      <h4 className="font-display text-xl font-bold mt-0.5 text-[var(--editorial-ink)]">{entry.title}</h4>
                      <p className="text-sm text-[var(--editorial-muted)] mt-1 leading-relaxed">
                        {entry.detail}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            );
          case 'table':
            return (
              <figure key={block.id} className="my-8 space-y-2">
                <div className="rounded-2xl overflow-x-auto border border-[var(--editorial-border)] bg-[var(--editorial-surface)]">
                  {block.text && (
                    <p className="px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider border-b border-[var(--editorial-border)] text-[var(--editorial-ink)]">
                      {block.text}
                    </p>
                  )}
                  <table className="w-full text-left text-sm">
                    {block.tableHeaders && block.tableHeaders.length > 0 && (
                      <thead className="border-b border-[var(--editorial-border)] bg-[var(--editorial-surface-subtle)] font-display uppercase text-xs tracking-wider">
                        <tr>
                          {block.tableHeaders.map((h, i) => (
                            <th key={i} className="px-4 py-2.5 font-bold text-[var(--editorial-ink)]">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody className="divide-y divide-[var(--editorial-border)]">
                      {(block.tableRows || []).map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-4 py-2.5 font-tabular text-[var(--editorial-ink)]">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {block.tableCaption && (
                  <figcaption className="text-xs text-[var(--editorial-muted)] italic">
                    Nota. {block.tableCaption}
                  </figcaption>
                )}
              </figure>
            );
          case 'divider':
            if (block.dividerVariant === 'asterisks') {
              return (
                <div key={block.id} aria-hidden="true" className="my-8 text-center font-display text-xl tracking-[0.6em] text-[var(--editorial-muted)]">
                  * * *
                </div>
              );
            }
            if (block.dividerVariant === 'red_rule') {
              return (
                <hr key={block.id} className="my-8 border-t-2 border-[var(--editorial-primary)] w-16 mx-auto" />
              );
            }
            return <hr key={block.id} className="my-8 border-[var(--editorial-border)] w-1/3 mx-auto" />;
          case 'social_embed': {
            if (!block.embedUrl?.trim()) return null;
            return (
              <div key={block.id} className="my-7">
                <SmartEmbedPlayer
                  url={block.embedUrl}
                  platformLabelOverride={block.embedPlatform}
                  kindHint="social"
                  isDataSaverActive={isDataSaverActive}
                  compact
                />
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </>
  );
};
