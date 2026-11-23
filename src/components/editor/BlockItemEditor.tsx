import React from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Crop, Trash2 } from 'lucide-react';
import { inspectMediaUrl } from '../../lib/mediaEmbeds';
import { generateId, parseMediaUrlMeta } from '../../lib/utils';
import { ContentBlock } from '../../types/editorial';
import { SmartEmbedPlayer } from '../media/SmartEmbedPlayer';

interface BlockItemEditorProps {
  block: ContentBlock;
  index: number;
  setBlocks: React.Dispatch<React.SetStateAction<ContentBlock[]>>;
  onMoveBlock: (idx: number, dir: -1 | 1) => void;
  onUploadAsset: (
    file: File,
    target:
      | { blockId: string; field: 'imageUrl' | 'beforeImageUrl' | 'afterImageUrl' }
      | { blockId: string; carouselAdd?: boolean }
      | string
  ) => void;
  onUploadDocument: (file: File, target: string) => void;
  onRequestCropBlockImage: (blockId: string, srcUrl: string) => void;
}

export const BlockItemEditor: React.FC<BlockItemEditorProps> = ({
  block,
  index,
  setBlocks,
  onMoveBlock,
  onUploadAsset,
  onUploadDocument,
  onRequestCropBlockImage,
}) => {
  const socialInspection =
    block.type === 'social_embed' && block.embedUrl?.trim()
      ? inspectMediaUrl(block.embedUrl.trim(), 'social')
      : null;

  return (
    <div className="rounded-xl border border-neutral-300 dark:border-neutral-800 p-3.5 space-y-2.5 bg-[#F8F6F1]/50 dark:bg-[#181818]">
      <div className="flex items-center justify-between gap-2 text-xs font-display uppercase tracking-wider">
        <span className="font-bold text-[var(--editorial-primary)]">
          {index + 1}. {block.type === 'paragraph' && 'Párrafo'}
          {block.type === 'heading' && 'Subtítulo'}
          {block.type === 'quote' && 'Cita destacada'}
          {block.type === 'speaker_quote' && 'Cita de entrevistado'}
          {block.type === 'image' && 'Imagen intercalada'}
          {block.type === 'callout' && 'Recuadro destacado'}
          {block.type === 'context_box' && 'Caja de contexto'}
          {block.type === 'list' && 'Lista'}
          {block.type === 'document' && 'Documento / PDF adjunto'}
          {block.type === 'footnote' && `Nota al pie [${block.footnoteNumber || 1}]`}
          {block.type === 'timeline' && 'Línea de tiempo'}
          {block.type === 'table' && 'Tabla de datos'}
          {block.type === 'columns' && 'Columnas paralelas'}
          {block.type === 'before_after' && 'Comparativa Antes / Después'}
          {block.type === 'metrics' && 'Métricas / Cifras clave'}
          {block.type === 'carousel' && 'Carrusel fotográfico'}
          {block.type === 'divider' && 'Separador'}
          {block.type === 'social_embed' && 'Incrustación social / video'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMoveBlock(index, -1)}
            aria-label="Subir bloque"
            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMoveBlock(index, 1)}
            aria-label="Bajar bloque"
            className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setBlocks((prev) => prev.filter((_, i) => i !== index))}
            aria-label="Eliminar bloque"
            className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-950 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {(block.type === 'paragraph' || block.type === 'footnote') && (
        <textarea
          rows={block.type === 'paragraph' ? 4 : 2}
          value={block.text || ''}
          onChange={(e) =>
            setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, text: e.target.value } : b)))
          }
          placeholder={block.type === 'paragraph' ? 'Escribe el párrafo aquí...' : 'Texto de la fuente o nota al pie...'}
          className="w-full p-2.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-sm"
        />
      )}

      {block.type === 'heading' && (
        <div className="flex gap-2">
          <select
            value={block.level || 2}
            onChange={(e) =>
              setBlocks((prev) =>
                prev.map((b, i) => (i === index ? { ...b, level: Number(e.target.value) as 2 | 3 | 4 } : b))
              )
            }
            className="px-2 py-2 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
          >
            <option value={2}>H2</option>
            <option value={3}>H3</option>
            <option value={4}>H4</option>
          </select>
          <input
            type="text"
            value={block.text || ''}
            onChange={(e) =>
              setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, text: e.target.value } : b)))
            }
            placeholder="Subtítulo de sección"
            className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 font-display text-lg font-bold"
          />
        </div>
      )}

      {block.type === 'quote' && (
        <div className="space-y-2">
          <textarea
            rows={2}
            value={block.text || ''}
            onChange={(e) =>
              setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, text: e.target.value } : b)))
            }
            placeholder="Texto de la cita destacada..."
            className="w-full p-2.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-sm italic"
          />
          <input
            type="text"
            value={block.author || ''}
            onChange={(e) =>
              setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, author: e.target.value } : b)))
            }
            placeholder="Autoría o fuente de la cita (opcional)"
            className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
          />
        </div>
      )}

      {block.type === 'speaker_quote' && (
        <div className="space-y-2">
          <textarea
            rows={2}
            value={block.text || ''}
            onChange={(e) =>
              setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, text: e.target.value } : b)))
            }
            placeholder="Declaración textual de la persona..."
            className="w-full p-2.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-sm"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={block.author || ''}
              onChange={(e) =>
                setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, author: e.target.value } : b)))
              }
              placeholder="Nombre completo"
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
            />
            <input
              type="text"
              value={block.speakerRole || ''}
              onChange={(e) =>
                setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, speakerRole: e.target.value } : b)))
              }
              placeholder="Cargo o rol"
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
            />
            <div className="flex gap-1.5">
              <input
                type="text"
                value={block.imageUrl || ''}
                onChange={(e) =>
                  setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, imageUrl: e.target.value } : b)))
                }
                placeholder="URL retrato"
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <label className="px-2.5 py-1.5 rounded-full bg-[#111111] text-white text-[11px] font-display font-bold uppercase cursor-pointer">
                Foto
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadAsset(f, block.id);
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {block.type === 'callout' && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={block.calloutTone || 'info'}
              onChange={(e) =>
                setBlocks((prev) =>
                  prev.map((b, i) =>
                    i === index ? { ...b, calloutTone: e.target.value as 'info' | 'key_fact' | 'warning' } : b
                  )
                )
              }
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
            >
              <option value="info">Contexto / Nota</option>
              <option value="key_fact">Dato clave</option>
              <option value="warning">Advertencia</option>
            </select>
            <input
              type="text"
              value={block.calloutTitle || ''}
              onChange={(e) =>
                setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, calloutTitle: e.target.value } : b)))
              }
              placeholder="Título del recuadro"
              className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
            />
          </div>
          <textarea
            rows={3}
            value={block.text || ''}
            onChange={(e) =>
              setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, text: e.target.value } : b)))
            }
            placeholder="Contenido del recuadro..."
            className="w-full p-2.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-sm"
          />
        </div>
      )}

      {block.type === 'context_box' && (
        <div className="space-y-2">
          <input
            type="text"
            value={block.calloutTitle || ''}
            onChange={(e) =>
              setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, calloutTitle: e.target.value } : b)))
            }
            placeholder="Título de la caja de contexto"
            className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
          />
          <textarea
            rows={3}
            value={block.text || ''}
            onChange={(e) =>
              setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, text: e.target.value } : b)))
            }
            placeholder="Antecedentes, glosario o metodología..."
            className="w-full p-2.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-sm"
          />
        </div>
      )}

      {block.type === 'columns' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setBlocks((prev) =>
                  prev.map((b, i) =>
                    i === index
                      ? {
                          ...b,
                          columns: [
                            b.columns?.[0] || { title: 'Columna 1', body: '' },
                            b.columns?.[1] || { title: 'Columna 2', body: '' },
                          ],
                        }
                      : b
                  )
                )
              }
              className="px-2.5 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 text-[11px] font-bold uppercase cursor-pointer"
            >
              2 columnas
            </button>
            <button
              type="button"
              onClick={() =>
                setBlocks((prev) =>
                  prev.map((b, i) =>
                    i === index
                      ? {
                          ...b,
                          columns: [
                            b.columns?.[0] || { title: 'Columna 1', body: '' },
                            b.columns?.[1] || { title: 'Columna 2', body: '' },
                            b.columns?.[2] || { title: 'Columna 3', body: '' },
                          ],
                        }
                      : b
                  )
                )
              }
              className="px-2.5 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 text-[11px] font-bold uppercase cursor-pointer"
            >
              3 columnas
            </button>
          </div>
          <div className={`grid grid-cols-1 ${(block.columns?.length || 2) === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2`}>
            {(block.columns || []).map((col, ci) => (
              <div key={ci} className="space-y-1.5">
                <input
                  type="text"
                  value={col.title || ''}
                  onChange={(e) =>
                    setBlocks((prev) =>
                      prev.map((b, i) =>
                        i === index
                          ? {
                              ...b,
                              columns: (b.columns || []).map((c, j) =>
                                j === ci ? { ...c, title: e.target.value } : c
                              ),
                            }
                          : b
                      )
                    )
                  }
                  placeholder={`Título col. ${ci + 1}`}
                  className="w-full px-2.5 py-1 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
                />
                <textarea
                  rows={3}
                  value={col.body}
                  onChange={(e) =>
                    setBlocks((prev) =>
                      prev.map((b, i) =>
                        i === index
                          ? {
                              ...b,
                              columns: (b.columns || []).map((c, j) =>
                                j === ci ? { ...c, body: e.target.value } : c
                              ),
                            }
                          : b
                      )
                    )
                  }
                  placeholder={`Contenido col. ${ci + 1}`}
                  className="w-full p-2 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {block.type === 'before_after' && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={block.beforeImageUrl || ''}
                  onChange={(e) =>
                    setBlocks((prev) =>
                      prev.map((b, i) => (i === index ? { ...b, beforeImageUrl: e.target.value } : b))
                    )
                  }
                  placeholder="URL imagen Antes"
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
                <label className="px-2.5 py-1.5 rounded-full bg-[#111111] text-white text-[11px] font-bold uppercase cursor-pointer">
                  Subir
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadAsset(f, { blockId: block.id, field: 'beforeImageUrl' });
                    }}
                  />
                </label>
              </div>
              <input
                type="text"
                value={block.beforeLabel || ''}
                onChange={(e) =>
                  setBlocks((prev) =>
                    prev.map((b, i) => (i === index ? { ...b, beforeLabel: e.target.value } : b))
                  )
                }
                placeholder="Etiqueta Antes"
                className="w-full px-2.5 py-1 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={block.afterImageUrl || ''}
                  onChange={(e) =>
                    setBlocks((prev) =>
                      prev.map((b, i) => (i === index ? { ...b, afterImageUrl: e.target.value } : b))
                    )
                  }
                  placeholder="URL imagen Después"
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
                <label className="px-2.5 py-1.5 rounded-full bg-[#111111] text-white text-[11px] font-bold uppercase cursor-pointer">
                  Subir
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadAsset(f, { blockId: block.id, field: 'afterImageUrl' });
                    }}
                  />
                </label>
              </div>
              <input
                type="text"
                value={block.afterLabel || ''}
                onChange={(e) =>
                  setBlocks((prev) =>
                    prev.map((b, i) => (i === index ? { ...b, afterLabel: e.target.value } : b))
                  )
                }
                placeholder="Etiqueta Después"
                className="w-full px-2.5 py-1 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
            </div>
          </div>
          <input
            type="text"
            value={block.text || ''}
            onChange={(e) =>
              setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, text: e.target.value } : b)))
            }
            placeholder="Pie comparativo (opcional)"
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
          />
        </div>
      )}

      {block.type === 'metrics' && (
        <div className="space-y-2">
          <input
            type="text"
            value={block.text || ''}
            onChange={(e) =>
              setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, text: e.target.value } : b)))
            }
            placeholder="Título del panel de cifras (opcional)"
            className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
          />
          {(block.metricItems || []).map((m, mi) => (
            <div key={mi} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <input
                type="text"
                value={m.value}
                onChange={(e) =>
                  setBlocks((prev) =>
                    prev.map((b, i) =>
                      i === index
                        ? {
                            ...b,
                            metricItems: (b.metricItems || []).map((x, j) =>
                              j === mi ? { ...x, value: e.target.value } : x
                            ),
                          }
                        : b
                    )
                  )
                }
                placeholder="Cifra (ej. 42%)"
                className="sm:col-span-3 px-2 py-1 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
              />
              <input
                type="text"
                value={m.label}
                onChange={(e) =>
                  setBlocks((prev) =>
                    prev.map((b, i) =>
                      i === index
                        ? {
                            ...b,
                            metricItems: (b.metricItems || []).map((x, j) =>
                              j === mi ? { ...x, label: e.target.value } : x
                            ),
                          }
                        : b
                    )
                  )
                }
                placeholder="Etiqueta"
                className="sm:col-span-4 px-2 py-1 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <input
                type="text"
                value={m.detail || ''}
                onChange={(e) =>
                  setBlocks((prev) =>
                    prev.map((b, i) =>
                      i === index
                        ? {
                            ...b,
                            metricItems: (b.metricItems || []).map((x, j) =>
                              j === mi ? { ...x, detail: e.target.value } : x
                            ),
                          }
                        : b
                    )
                  )
                }
                placeholder="Fuente o aclaración"
                className="sm:col-span-4 px-2 py-1 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <button
                type="button"
                onClick={() =>
                  setBlocks((prev) =>
                    prev.map((b, i) =>
                      i === index
                        ? { ...b, metricItems: (b.metricItems || []).filter((_, j) => j !== mi) }
                        : b
                    )
                  )
                }
                className="sm:col-span-1 text-xs text-red-600 font-bold cursor-pointer"
              >
                Quitar
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setBlocks((prev) =>
                prev.map((b, i) =>
                  i === index
                    ? { ...b, metricItems: [...(b.metricItems || []), { value: '', label: '', detail: '' }] }
                    : b
                )
              )
            }
            className="text-xs font-display font-bold uppercase text-[var(--editorial-primary)] cursor-pointer"
          >
            + Añadir métrica
          </button>
        </div>
      )}

      {block.type === 'carousel' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-neutral-500">Diapositivas: {(block.carouselItems || []).length}</span>
            <div className="flex gap-2">
              <label className="px-3 py-1 rounded-full bg-[#111111] text-white text-[11px] font-display font-bold uppercase cursor-pointer">
                + Subir foto
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadAsset(f, { blockId: block.id, carouselAdd: true });
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setBlocks((prev) =>
                    prev.map((b, i) =>
                      i === index
                        ? {
                            ...b,
                            carouselItems: [
                              ...(b.carouselItems || []),
                              { id: generateId('car'), url: '', alt: '', caption: '', credit: '' },
                            ],
                          }
                        : b
                    )
                  )
                }
                className="px-2.5 py-1 rounded-full border border-neutral-400 text-[11px] font-bold uppercase cursor-pointer"
              >
                + URL
              </button>
            </div>
          </div>
          {(block.carouselItems || []).map((item, ci) => (
            <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              <input
                type="text"
                value={item.url}
                onChange={(e) =>
                  setBlocks((prev) =>
                    prev.map((b, i) =>
                      i === index
                        ? {
                            ...b,
                            carouselItems: (b.carouselItems || []).map((x, j) =>
                              j === ci ? { ...x, url: e.target.value } : x
                            ),
                          }
                        : b
                    )
                  )
                }
                placeholder="URL imagen"
                className="sm:col-span-3 px-2 py-1 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <input
                type="text"
                value={item.alt || ''}
                onChange={(e) =>
                  setBlocks((prev) =>
                    prev.map((b, i) =>
                      i === index
                        ? {
                            ...b,
                            carouselItems: (b.carouselItems || []).map((x, j) =>
                              j === ci ? { ...x, alt: e.target.value } : x
                            ),
                          }
                        : b
                    )
                  )
                }
                placeholder="Texto alt (obligatorio)"
                className={`sm:col-span-3 px-2 py-1 rounded-lg bg-white dark:bg-[#111111] border text-xs ${
                  item.url.trim() && !item.alt.trim()
                    ? 'border-amber-500'
                    : 'border-neutral-300 dark:border-neutral-700'
                }`}
              />
              <input
                type="text"
                value={item.caption}
                onChange={(e) =>
                  setBlocks((prev) =>
                    prev.map((b, i) =>
                      i === index
                        ? {
                            ...b,
                            carouselItems: (b.carouselItems || []).map((x, j) =>
                              j === ci ? { ...x, caption: e.target.value } : x
                            ),
                          }
                        : b
                    )
                  )
                }
                placeholder="Pie de foto"
                className="sm:col-span-3 px-2 py-1 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <input
                type="text"
                value={item.credit}
                onChange={(e) =>
                  setBlocks((prev) =>
                    prev.map((b, i) =>
                      i === index
                        ? {
                            ...b,
                            carouselItems: (b.carouselItems || []).map((x, j) =>
                              j === ci ? { ...x, credit: e.target.value } : x
                            ),
                          }
                        : b
                    )
                  )
                }
                placeholder="Crédito"
                className="sm:col-span-2 px-2 py-1 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <button
                type="button"
                onClick={() =>
                  setBlocks((prev) =>
                    prev.map((b, i) =>
                      i === index
                        ? { ...b, carouselItems: (b.carouselItems || []).filter((_, j) => j !== ci) }
                        : b
                    )
                  )
                }
                className="sm:col-span-1 text-xs text-red-600 font-bold cursor-pointer"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}

      {block.type === 'divider' && (
        <select
          value={block.dividerVariant || 'line'}
          onChange={(e) =>
            setBlocks((prev) =>
              prev.map((b, i) =>
                i === index
                  ? { ...b, dividerVariant: e.target.value as 'line' | 'asterisks' | 'red_rule' }
                  : b
              )
            )
          }
          className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
        >
          <option value="line">Línea sutil centrada</option>
          <option value="asterisks">Asteriscos editoriales (* * *)</option>
          <option value="red_rule">Trazo rojo editorial</option>
        </select>
      )}

      {block.type === 'list' && (
        <div className="space-y-2">
          <select
            value={block.listStyle || 'unordered'}
            onChange={(e) =>
              setBlocks((prev) =>
                prev.map((b, i) =>
                  i === index ? { ...b, listStyle: e.target.value as 'unordered' | 'ordered' } : b
                )
              )
            }
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
          >
            <option value="unordered">Lista con viñetas</option>
            <option value="ordered">Lista numerada</option>
          </select>
          <textarea
            rows={4}
            value={(block.listItems || []).join('\n')}
            onChange={(e) =>
              setBlocks((prev) =>
                prev.map((b, i) => (i === index ? { ...b, listItems: e.target.value.split('\n') } : b))
              )
            }
            placeholder="Escribe un elemento por línea..."
            className="w-full p-2.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-sm"
          />
        </div>
      )}

      {block.type === 'document' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={block.documentUrl || ''}
              onChange={(e) =>
                setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, documentUrl: e.target.value } : b)))
              }
              placeholder="URL del documento PDF o anexo"
              className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
            />
            <label className="px-3 py-1.5 rounded-full bg-[#111111] text-white text-xs font-display font-bold uppercase cursor-pointer">
              Subir PDF
              <input
                type="file"
                accept="application/pdf,.pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadDocument(f, block.id);
                }}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={block.documentTitle || ''}
              onChange={(e) =>
                setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, documentTitle: e.target.value } : b)))
              }
              placeholder="Nombre del documento"
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
            />
            <input
              type="text"
              value={block.documentDescription || ''}
              onChange={(e) =>
                setBlocks((prev) =>
                  prev.map((b, i) => (i === index ? { ...b, documentDescription: e.target.value } : b))
                )
              }
              placeholder="Descripción breve o contexto"
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
            />
          </div>
        </div>
      )}

      {block.type === 'image' && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={block.imageUrl || ''}
              onChange={(e) =>
                setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, imageUrl: e.target.value } : b)))
              }
              placeholder="URL de imagen"
              className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
            />
            {block.imageUrl && parseMediaUrlMeta(block.imageUrl).cleanUrl && (
              <button
                type="button"
                onClick={() => onRequestCropBlockImage(block.id, parseMediaUrlMeta(block.imageUrl).cleanUrl)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-neutral-400 dark:border-neutral-700 text-xs font-display font-bold uppercase cursor-pointer"
              >
                <Crop className="w-3 h-3" />
                <span>Recortar</span>
              </button>
            )}
            <label className="px-3 py-1.5 rounded-full bg-[#111111] text-white text-xs font-display font-bold uppercase cursor-pointer">
              Subir
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadAsset(f, block.id);
                }}
              />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={block.imageAlt || ''}
              onChange={(e) =>
                setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, imageAlt: e.target.value } : b)))
              }
              placeholder="Texto alternativo (obligatorio)"
              className={`px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border text-xs ${
                block.imageUrl?.trim() && !block.imageAlt?.trim()
                  ? 'border-amber-500'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}
            />
            <input
              type="text"
              value={block.imageCaption || ''}
              onChange={(e) =>
                setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, imageCaption: e.target.value } : b)))
              }
              placeholder="Pie de foto o nota de figura"
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
            />
            <input
              type="text"
              value={block.imageCredit || ''}
              onChange={(e) =>
                setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, imageCredit: e.target.value } : b)))
              }
              placeholder="Crédito fotográfico"
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
            />
          </div>
        </div>
      )}

      {block.type === 'timeline' && (
        <div className="space-y-2">
          <input
            type="text"
            value={block.text || ''}
            onChange={(e) =>
              setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, text: e.target.value } : b)))
            }
            placeholder="Título de la línea de tiempo"
            className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
          />
          {(block.timelineEntries || []).map((te, ti) => (
            <div key={ti} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={te.date}
                onChange={(e) =>
                  setBlocks((prev) =>
                    prev.map((b, i) =>
                      i === index
                        ? {
                            ...b,
                            timelineEntries: (b.timelineEntries || []).map((x, j) =>
                              j === ti ? { ...x, date: e.target.value } : x
                            ),
                          }
                        : b
                    )
                  )
                }
                placeholder="Fecha / Hora"
                className="px-2 py-1 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <input
                type="text"
                value={te.title}
                onChange={(e) =>
                  setBlocks((prev) =>
                    prev.map((b, i) =>
                      i === index
                        ? {
                            ...b,
                            timelineEntries: (b.timelineEntries || []).map((x, j) =>
                              j === ti ? { ...x, title: e.target.value } : x
                            ),
                          }
                        : b
                    )
                  )
                }
                placeholder="Evento"
                className="px-2 py-1 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <input
                type="text"
                value={te.detail}
                onChange={(e) =>
                  setBlocks((prev) =>
                    prev.map((b, i) =>
                      i === index
                        ? {
                            ...b,
                            timelineEntries: (b.timelineEntries || []).map((x, j) =>
                              j === ti ? { ...x, detail: e.target.value } : x
                            ),
                          }
                        : b
                    )
                  )
                }
                placeholder="Detalle"
                className="px-2 py-1 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setBlocks((prev) =>
                prev.map((b, i) =>
                  i === index
                    ? {
                        ...b,
                        timelineEntries: [
                          ...(b.timelineEntries || []),
                          { date: '', title: '', detail: '' },
                        ],
                      }
                    : b
                )
              )
            }
            className="text-xs font-display font-bold uppercase text-[var(--editorial-primary)] cursor-pointer"
          >
            + Añadir hito
          </button>
        </div>
      )}

      {block.type === 'table' && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={block.text || ''}
              onChange={(e) =>
                setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, text: e.target.value } : b)))
              }
              placeholder="Título de la tabla"
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
            />
            <input
              type="text"
              value={block.tableCaption || ''}
              onChange={(e) =>
                setBlocks((prev) =>
                  prev.map((b, i) => (i === index ? { ...b, tableCaption: e.target.value } : b))
                )
              }
              placeholder="Nota / pie de tabla (ej. Fuente: DANE)"
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
            />
          </div>
          <input
            type="text"
            value={(block.tableHeaders || []).join(' | ')}
            onChange={(e) =>
              setBlocks((prev) =>
                prev.map((b, i) =>
                  i === index
                    ? { ...b, tableHeaders: e.target.value.split('|').map((s) => s.trim()) }
                    : b
                )
              )
            }
            placeholder="Encabezados separados por |"
            className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
          />
          <textarea
            rows={3}
            value={(block.tableRows || []).map((r) => r.join(' | ')).join('\n')}
            onChange={(e) =>
              setBlocks((prev) =>
                prev.map((b, i) =>
                  i === index
                    ? {
                        ...b,
                        tableRows: e.target.value
                          .split('\n')
                          .filter(Boolean)
                          .map((line) => line.split('|').map((s) => s.trim())),
                      }
                    : b
                )
              )
            }
            placeholder="Una fila por línea, columnas separadas por |"
            className="w-full p-2 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-tabular"
          />
        </div>
      )}

      {block.type === 'social_embed' && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={block.embedPlatform || ''}
              onChange={(e) =>
                setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, embedPlatform: e.target.value } : b)))
              }
              placeholder="Plataforma (YouTube, Spotify, TikTok...)"
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
            />
            <input
              type="url"
              value={block.embedUrl || ''}
              onChange={(e) =>
                setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, embedUrl: e.target.value } : b)))
              }
              placeholder="https://youtube.com/..., instagram.com/p/..., tiktok.com/..."
              className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
            />
          </div>
          {socialInspection && (
            <p
              className={`inline-flex items-center gap-1.5 text-[11px] ${
                !socialInspection.isValid
                  ? 'text-red-600 dark:text-red-400'
                  : socialInspection.warning
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {!socialInspection.isValid || socialInspection.warning ? (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {!socialInspection.isValid
                  ? socialInspection.errorReason
                  : socialInspection.warning || `${socialInspection.platformLabel} detectado`}
              </span>
            </p>
          )}
          {socialInspection?.isValid && (
            <SmartEmbedPlayer
              url={block.embedUrl || ''}
              platformLabelOverride={block.embedPlatform}
              kindHint="social"
              compact
            />
          )}
        </div>
      )}
    </div>
  );
};
