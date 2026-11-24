import React, { useEffect, useMemo, useState } from 'react';
import {
  deleteField,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Check,
  Copy,
  CopyPlus,
  Eye,
  FileText,
  History,
  Layers,
  ListChecks,
  Plus,
  RotateCcw,
  Save,
  Send,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { db, OperationType } from '../lib/firebase';
import { inspectMediaUrl } from '../lib/mediaEmbeds';
import {
  diagnosePostSaveFailure,
  estimateUtf8JsonBytes,
  isValidFirestoreId,
  mergeExistingAndPatch,
  POST_ALLOWED_KEYS_SET,
  PostSaveDiagnosis,
  validatePostDocumentAgainstRules,
} from '../lib/postValidation';
import {
  estimateReadTime,
  generateId,
  sanitizeExternalUrl,
  slugify,
  stripUndefinedDeep,
  toDate,
  uploadDocumentAsset,
  uploadMediaAsset,
  uploadSubtitleAsset,
} from '../lib/utils';
import {
  AdminIdentityId,
  ContentBlock,
  ContentBlockType,
  CorrectionEntry,
  CoverLayoutStyle,
  EditorialKind,
  GalleryItem,
  HeaderStyleVariant,
  MediaChapter,
  Post,
  PostRevision,
  PostStatus,
  PostType,
  SourceReference,
} from '../types/editorial';
import { EditorialImage } from './EditorialImage';
import { VerifiedBadge } from './VerifiedBadge';
import { BlockItemEditor } from './editor/BlockItemEditor';
import { CoverFramingSection } from './editor/CoverFramingSection';
import { EditorPreview } from './editor/EditorPreview';
import { ImageCropModal } from './editor/ImageCropModal';
import { MediaSectionEditor } from './editor/MediaSectionEditor';
import { MediaUploader } from './editor/MediaUploader';

interface BlockEditorProps {
  initialPost?: Post | null;
  onSaved: (post: Post) => void;
  onCancel: () => void;
}

type GenreTemplateKey = 'entrevista' | 'explicativo' | 'cronica' | 'datos' | 'opinion';

function buildGenreTemplate(templateKey: GenreTemplateKey): {
  editorialKind: EditorialKind;
  blocks: ContentBlock[];
} {
  switch (templateKey) {
    case 'entrevista':
      return {
        editorialKind: 'entrevista',
        blocks: [
          { id: generateId('blk'), type: 'paragraph', text: 'Presentación de la persona entrevistada y contexto editorial de la conversación.' },
          { id: generateId('blk'), type: 'heading', level: 2, text: 'Primera pregunta o eje temático' },
          { id: generateId('blk'), type: 'paragraph', text: 'Transcripción de la respuesta...' },
          { id: generateId('blk'), type: 'speaker_quote', text: 'Frase central de la entrevista...', author: 'Nombre de la persona entrevistada', speakerRole: 'Cargo o actividad' },
          { id: generateId('blk'), type: 'heading', level: 2, text: 'Segunda pregunta o cierre' },
          { id: generateId('blk'), type: 'paragraph', text: 'Desarrollo y respuesta final...' },
        ],
      };
    case 'explicativo':
      return {
        editorialKind: 'explicativo',
        blocks: [
          { id: generateId('blk'), type: 'context_box', calloutTitle: 'Qué está pasando y por qué importa', text: 'Síntesis rápida del hecho o normativa analizada.' },
          { id: generateId('blk'), type: 'heading', level: 2, text: '1. Qué pasó y cuáles son los antecedentes' },
          { id: generateId('blk'), type: 'paragraph', text: 'Desarrollo cronológico claro para lectores que llegan por primera vez al tema.' },
          { id: generateId('blk'), type: 'metrics', text: 'Cifras clave', metricItems: [{ value: '0%', label: 'Indicador principal', detail: 'Fuente verificable' }] },
          { id: generateId('blk'), type: 'heading', level: 2, text: '2. Qué ocurre a partir de ahora' },
          { id: generateId('blk'), type: 'list', listStyle: 'ordered', listItems: ['Primer escenario o paso institucional', 'Segundo escenario'] },
        ],
      };
    case 'cronica':
      return {
        editorialKind: 'cronica',
        blocks: [
          { id: generateId('blk'), type: 'paragraph', text: 'Escena de apertura que sitúa lugar, tiempo y protagonistas reales de la crónica.' },
          { id: generateId('blk'), type: 'quote', text: 'Testimonio recogido en terreno.', author: 'Testimonio' },
          { id: generateId('blk'), type: 'heading', level: 2, text: 'Desarrollo en terreno' },
          { id: generateId('blk'), type: 'paragraph', text: 'Relato narrativo con observaciones directas y contexto social.' },
          { id: generateId('blk'), type: 'divider', dividerVariant: 'asterisks' },
          { id: generateId('blk'), type: 'heading', level: 2, text: 'Cierre y perspectivas' },
          { id: generateId('blk'), type: 'paragraph', text: 'Conclusión narrativa de la cobertura.' },
        ],
      };
    case 'datos':
      return {
        editorialKind: 'datos',
        blocks: [
          { id: generateId('blk'), type: 'context_box', calloutTitle: 'Metodología y fuentes de datos', text: 'Explicación transparente del conjunto de datos, periodo cubierto y limitaciones.' },
          { id: generateId('blk'), type: 'metrics', text: 'Hallazgos cuantitativos', metricItems: [{ value: '0', label: 'Registros analizados', detail: 'Periodo de estudio' }, { value: '0%', label: 'Variación detectada', detail: 'Comparativo oficial' }] },
          { id: generateId('blk'), type: 'heading', level: 2, text: 'Análisis de la base de datos' },
          { id: generateId('blk'), type: 'table', text: 'Tabla comparativa', tableCaption: 'Resumen de datos verificados.', tableHeaders: ['Variable', 'Valor', 'Fuente'], tableRows: [['Registro 1', 'Dato', 'Entidad']] },
          { id: generateId('blk'), type: 'paragraph', text: 'Interpretación periodística de los datos y contraste con fuentes consultadas.' },
        ],
      };
    case 'opinion':
    default:
      return {
        editorialKind: 'opinion',
        blocks: [
          { id: generateId('blk'), type: 'paragraph', text: 'Planteamiento de la tesis central de la columna y su relevancia pública.' },
          { id: generateId('blk'), type: 'paragraph', text: 'Primer argumento sustentado en hechos verificables y contexto histórico.' },
          { id: generateId('blk'), type: 'quote', text: 'Idea fuerza o cita de contraste.' },
          { id: generateId('blk'), type: 'paragraph', text: 'Conclusión crítica y llamado a la reflexión colectiva.' },
        ],
      };
  }
}

export const BlockEditor: React.FC<BlockEditorProps> = ({ initialPost, onSaved, onCancel }) => {
  const {
    firebaseUser,
    userAccount,
    collaboratorProfile,
    isAdmin,
    isActiveCollaborator,
    adminDiagnostics,
  } = useAuth();
  const { siteConfig, categories, seriesList, publishedPosts, adminIdentities } = useSite();

  const [detachedAsCopy, setDetachedAsCopy] = useState(false);
  const effectiveInitialPost = detachedAsCopy ? null : initialPost;
  const draftStorageKey = `revista_draft_${effectiveInitialPost?.id || 'new'}`;
  const revisionsStorageKey = `revista_revisions_${effectiveInitialPost?.id || 'new'}`;

  const [title, setTitle] = useState(initialPost?.title || '');
  const [subtitle, setSubtitle] = useState(initialPost?.subtitle || '');
  const [type, setType] = useState<PostType>(
    initialPost?.type && initialPost.type !== 'livestream' ? initialPost.type : 'article'
  );
  const [editorialKind, setEditorialKind] = useState<EditorialKind>(initialPost?.editorialKind || 'articulo');
  const [categoryId, setCategoryId] = useState(initialPost?.categoryId || categories[0]?.id || 'cat_politica');
  const [seriesId, setSeriesId] = useState(initialPost?.seriesId || '');
  const [tags, setTags] = useState<string[]>(initialPost?.tags || []);
  const [tagInput, setTagInput] = useState('');

  // Admin dual-identity publishing selector
  const [publishAs, setPublishAs] = useState<AdminIdentityId>(() => {
    if (initialPost?.authorIdentityType === 'magazine' || initialPost?.authorProfileId === 'magazine') {
      return 'magazine';
    }
    return 'owner';
  });

  // Presentation & layout controls
  const [coverLayout, setCoverLayout] = useState<CoverLayoutStyle>(initialPost?.coverLayout || 'full');
  const [headerStyle, setHeaderStyle] = useState<HeaderStyleVariant>(initialPost?.headerStyle || 'classic');
  const [useCustomAccent, setUseCustomAccent] = useState(Boolean(initialPost?.accentColor));
  const [accentColor, setAccentColor] = useState(initialPost?.accentColor || siteConfig.primaryColor || '#B91C1C');
  const [paragraphIndent, setParagraphIndent] = useState(Boolean(initialPost?.paragraphIndent));
  const [pinnedInFeed, setPinnedInFeed] = useState(Boolean(initialPost?.pinnedInFeed));

  // Table of Contents
  const [showTableOfContents, setShowTableOfContents] = useState(Boolean(initialPost?.showTableOfContents));

  const [coverImage, setCoverImage] = useState(initialPost?.coverImage || '');
  const [coverAlt, setCoverAlt] = useState(initialPost?.coverAlt || '');
  const [coverCredit, setCoverCredit] = useState(initialPost?.coverCredit || '');
  const [mediaUrl, setMediaUrl] = useState(initialPost?.mediaUrl || '');
  const [documentTitle, setDocumentTitle] = useState(initialPost?.documentTitle || '');

  // Enhanced audio/video fields
  const [mediaDurationLabel, setMediaDurationLabel] = useState(initialPost?.mediaDurationLabel || '');
  const [mediaSubtitlesUrl, setMediaSubtitlesUrl] = useState(initialPost?.mediaSubtitlesUrl || '');
  const [mediaTranscript, setMediaTranscript] = useState(initialPost?.mediaTranscript || '');
  const [episodeNotes, setEpisodeNotes] = useState(initialPost?.episodeNotes || '');
  const [seasonNumber, setSeasonNumber] = useState<string>(
    initialPost?.seasonNumber ? String(initialPost.seasonNumber) : ''
  );
  const [episodeNumber, setEpisodeNumber] = useState<string>(
    initialPost?.episodeNumber ? String(initialPost.episodeNumber) : ''
  );
  const [mediaChapters, setMediaChapters] = useState<MediaChapter[]>(initialPost?.mediaChapters || []);
  const [mediaRelatedLinks, setMediaRelatedLinks] = useState<SourceReference[]>(
    initialPost?.mediaRelatedLinks || []
  );

  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(initialPost?.galleryItems || []);
  const [corrections, setCorrections] = useState<CorrectionEntry[]>(initialPost?.corrections || []);
  const [keyPoints, setKeyPoints] = useState<string[]>(initialPost?.keyPoints || []);
  const [sources, setSources] = useState<SourceReference[]>(initialPost?.sources || []);
  const [seoDescription, setSeoDescription] = useState(initialPost?.seoDescription || '');
  const [sensitiveContent, setSensitiveContent] = useState(Boolean(initialPost?.sensitiveContent));
  const [sensitiveWarning, setSensitiveWarning] = useState(initialPost?.sensitiveWarning || '');
  const [commentsEnabled, setCommentsEnabled] = useState(initialPost?.commentsEnabled ?? true);

  const [blocks, setBlocks] = useState<ContentBlock[]>(
    initialPost?.blocks && initialPost.blocks.length > 0
      ? initialPost.blocks
      : [{ id: generateId('blk'), type: 'paragraph', text: '' }]
  );
  const [featured, setFeatured] = useState(initialPost?.featured || false);
  const [breaking, setBreaking] = useState(initialPost?.breaking || false);
  const [scheduledForInput, setScheduledForInput] = useState(() => {
    if (!initialPost?.scheduledFor) return '';
    const d = toDate(initialPost.scheduledFor);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const [showPreview, setShowPreview] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [selectedTemplate, setSelectedTemplate] = useState<'' | GenreTemplateKey>('');
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [revisions, setRevisions] = useState<PostRevision[]>(() => {
    try {
      const raw = localStorage.getItem(`revista_revisions_${initialPost?.id || 'new'}`);
      return raw ? (JSON.parse(raw) as PostRevision[]) : [];
    } catch {
      return [];
    }
  });

  const [uploadingInfo, setUploadingInfo] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<string>('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [missingAltError, setMissingAltError] = useState(false);
  const [cropTarget, setCropTarget] = useState<{
    kind: 'cover' | 'block';
    blockId?: string;
    srcUrl: string;
  } | null>(null);
  const [diagnostic, setDiagnostic] = useState<PostSaveDiagnosis | null>(null);
  const [copiedDiag, setCopiedDiag] = useState(false);

  // Sync categoryId if categories load after mount and current selection is missing
  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.id === categoryId)) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  // Restore unsaved local draft for new posts
  useEffect(() => {
    if (effectiveInitialPost) return;
    try {
      const saved = localStorage.getItem(draftStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.subtitle) setSubtitle(parsed.subtitle);
        if (parsed.type && parsed.type !== 'livestream') setType(parsed.type);
        if (parsed.editorialKind) setEditorialKind(parsed.editorialKind);
        if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) setBlocks(parsed.blocks);
        if (Array.isArray(parsed.tags)) setTags(parsed.tags);
        if (Array.isArray(parsed.keyPoints)) setKeyPoints(parsed.keyPoints);
        if (Array.isArray(parsed.sources)) setSources(parsed.sources);
        if (typeof parsed.seoDescription === 'string') setSeoDescription(parsed.seoDescription);
        if (typeof parsed.sensitiveContent === 'boolean') setSensitiveContent(parsed.sensitiveContent);
        if (typeof parsed.sensitiveWarning === 'string') setSensitiveWarning(parsed.sensitiveWarning);
        if (typeof parsed.coverImage === 'string') setCoverImage(parsed.coverImage);
        if (typeof parsed.mediaUrl === 'string') setMediaUrl(parsed.mediaUrl);
        if (typeof parsed.documentTitle === 'string') setDocumentTitle(parsed.documentTitle);
      }
    } catch {
      // ignore
    }
  }, [effectiveInitialPost, draftStorageKey]);

  // Automatic local draft saving
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!title.trim() && blocks.every((b) => !b.text?.trim())) return;
      try {
        localStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            title,
            subtitle,
            type,
            editorialKind,
            blocks,
            tags,
            keyPoints,
            sources,
            seoDescription,
            sensitiveContent,
            sensitiveWarning,
            coverImage,
            mediaUrl,
            documentTitle,
          })
        );
        setAutoSavedAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
      } catch {
        // ignore quota errors
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [
    title,
    subtitle,
    type,
    editorialKind,
    blocks,
    tags,
    keyPoints,
    sources,
    seoDescription,
    sensitiveContent,
    sensitiveWarning,
    coverImage,
    mediaUrl,
    documentTitle,
    draftStorageKey,
  ]);

  const saveRevisionSnapshot = (label: string) => {
    if (!title.trim() && blocks.every((b) => !b.text?.trim())) return;
    const rev: PostRevision = {
      id: generateId('rev'),
      savedAt: new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }),
      label,
      title: title || 'Sin título',
      subtitle,
      blocks,
    };
    setRevisions((prev) => {
      const next = [rev, ...prev].slice(0, 15);
      try {
        localStorage.setItem(revisionsStorageKey, JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const saveRevisionRef = React.useRef(saveRevisionSnapshot);
  saveRevisionRef.current = saveRevisionSnapshot;

  // Automatic version snapshot every 3 minutes while actively editing
  useEffect(() => {
    const interval = setInterval(() => {
      saveRevisionRef.current('Respaldo automático');
    }, 180000);
    return () => clearInterval(interval);
  }, []);

  const handleDuplicateInEditor = () => {
    saveRevisionSnapshot('Antes de duplicar');
    setDetachedAsCopy(true);
    setFeatured(false);
    setBreaking(false);
    setPinnedInFeed(false);
    setScheduledForInput('');
    setTitle((prev) => (prev.endsWith('(Copia)') ? prev : `${prev || 'Borrador'} (Copia)`));
    setNotice('Se creó una copia independiente en el editor. Al guardar se creará una nueva publicación.');
  };

  const handleApplyTemplate = (tpl: GenreTemplateKey) => {
    const built = buildGenreTemplate(tpl);
    saveRevisionSnapshot('Antes de aplicar plantilla');
    setEditorialKind(built.editorialKind);
    setBlocks(built.blocks);
    setSelectedTemplate('');
    setNotice('Plantilla estructural cargada. Reemplaza las indicaciones por tu contenido periodístico.');
  };

  const allKnownTags = useMemo(() => {
    const s = new Set<string>();
    for (const p of publishedPosts) {
      for (const t of p.tags || []) s.add(t);
    }
    return Array.from(s);
  }, [publishedPosts]);

  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    if (!q) return [];
    return allKnownTags.filter((t) => t.toLowerCase().includes(q) && !tags.includes(t)).slice(0, 6);
  }, [tagInput, allKnownTags, tags]);

  const addTag = (raw: string) => {
    const clean = raw.trim().toLowerCase().slice(0, 40);
    if (!clean || tags.includes(clean) || tags.length >= 12) return;
    setTags((prev) => [...prev, clean]);
    setTagInput('');
  };

  const handleUploadAsset = async (
    file: File,
    target:
      | 'cover'
      | 'media'
      | 'gallery'
      | { blockId: string; field: 'imageUrl' | 'beforeImageUrl' | 'afterImageUrl' }
      | { blockId: string; carouselAdd?: boolean }
      | string
  ) => {
    setError('');
    setUploadProgress(5);
    setUploadingInfo('Optimizando y subiendo archivo...');
    try {
      const folder = `posts/${firebaseUser?.uid || 'anon'}`;
      const slot =
        target === 'cover'
          ? type === 'infographic'
            ? 'infographic'
            : 'cover'
          : target === 'gallery'
          ? 'gallery'
          : 'inline';
      const res = await uploadMediaAsset(file, folder, (pct) => setUploadProgress(pct), slot);
      if (target === 'cover') {
        setCoverImage(res.url);
      } else if (target === 'media') {
        setMediaUrl(res.url);
      } else if (target === 'gallery') {
        setGalleryItems((prev) => [
          ...prev,
          { id: generateId('gal'), url: res.url, alt: file.name, caption: '', credit: '' },
        ]);
      } else if (typeof target === 'object') {
        if ('carouselAdd' in target && target.carouselAdd) {
          setBlocks((prev) =>
            prev.map((b) =>
              b.id === target.blockId
                ? {
                    ...b,
                    carouselItems: [
                      ...(b.carouselItems || []),
                      { id: generateId('car'), url: res.url, alt: file.name, caption: '', credit: '' },
                    ],
                  }
                : b
            )
          );
        } else if ('field' in target) {
          setBlocks((prev) =>
            prev.map((b) => (b.id === target.blockId ? { ...b, [target.field]: res.url } : b))
          );
        }
      } else {
        setBlocks((prev) => prev.map((b) => (b.id === target ? { ...b, imageUrl: res.url } : b)));
      }
      setUploadingInfo(res.info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir archivo.');
      setUploadingInfo('');
    } finally {
      setTimeout(() => setUploadProgress(null), 800);
    }
  };

  const handleUploadSubtitleFile = async (file: File) => {
    if (!firebaseUser) return;
    setError('');
    setUploadProgress(10);
    setUploadingInfo('Subiendo archivo de subtítulos (.vtt)...');
    try {
      const res = await uploadSubtitleAsset(file, `subtitles/${firebaseUser.uid}`, (pct) =>
        setUploadProgress(pct)
      );
      setMediaSubtitlesUrl(res.url);
      setUploadingInfo(`Subtítulos cargados: ${res.fileName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron subir los subtítulos.');
      setUploadingInfo('');
    } finally {
      setTimeout(() => setUploadProgress(null), 800);
    }
  };

  const handleUploadDocument = async (file: File, target: 'post' | string) => {
    setError('');
    setUploadProgress(5);
    setUploadingInfo(`Subiendo documento ${file.name}...`);
    try {
      const folder = `posts/${firebaseUser?.uid || 'anon'}`;
      const res = await uploadDocumentAsset(file, folder, (pct) => setUploadProgress(pct));
      if (target === 'post') {
        setMediaUrl(res.url);
        if (!documentTitle.trim()) setDocumentTitle(`${res.fileName} (${res.sizeLabel})`);
      } else {
        setBlocks((prev) =>
          prev.map((b) =>
            b.id === target
              ? {
                  ...b,
                  documentUrl: res.url,
                  documentTitle: b.documentTitle || `${res.fileName} (${res.sizeLabel})`,
                }
              : b
          )
        );
      }
      setUploadingInfo(`Documento cargado (${res.sizeLabel})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el documento.');
      setUploadingInfo('');
    } finally {
      setTimeout(() => setUploadProgress(null), 800);
    }
  };

  const addBlock = (bType: ContentBlockType) => {
    const nextNum = blocks.filter((b) => b.type === 'footnote').length + 1;
    const base: ContentBlock = {
      id: generateId('blk'),
      type: bType,
      text: '',
      ...(bType === 'heading' ? { level: 2 as const } : {}),
      ...(bType === 'footnote' ? { footnoteNumber: nextNum } : {}),
      ...(bType === 'callout' ? { calloutTone: 'info' as const, calloutTitle: '' } : {}),
      ...(bType === 'context_box' ? { calloutTitle: 'Contexto clave', text: '' } : {}),
      ...(bType === 'list' ? { listStyle: 'unordered' as const, listItems: ['Primer punto'] } : {}),
      ...(bType === 'document' ? { documentUrl: '', documentTitle: '', documentDescription: '' } : {}),
      ...(bType === 'divider' ? { dividerVariant: 'line' as const } : {}),
      ...(bType === 'columns'
        ? {
            columns: [
              { title: 'Columna 1', body: '' },
              { title: 'Columna 2', body: '' },
            ],
          }
        : {}),
      ...(bType === 'before_after'
        ? { beforeImageUrl: '', afterImageUrl: '', beforeLabel: 'Antes', afterLabel: 'Después' }
        : {}),
      ...(bType === 'metrics'
        ? { metricItems: [{ value: '', label: 'Indicador', detail: '' }] }
        : {}),
      ...(bType === 'speaker_quote' ? { text: '', author: '', speakerRole: '', imageUrl: '' } : {}),
      ...(bType === 'carousel' ? { carouselItems: [] } : {}),
      ...(bType === 'timeline'
        ? { timelineEntries: [{ date: '2026', title: 'Hito', detail: '' }] }
        : {}),
      ...(bType === 'table'
        ? { tableHeaders: ['Columna 1', 'Columna 2'], tableRows: [['Dato 1', 'Dato 2']], tableCaption: '' }
        : {}),
    };
    setBlocks((prev) => [...prev, base]);
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[target]] = [next[target], next[idx]];
    setBlocks(next);
  };

  const collectMissingAlts = (): string[] => {
    const missing: string[] = [];
    if (coverImage.trim() && !coverAlt.trim()) {
      missing.push('Imagen de portada');
    }
    galleryItems.forEach((g, idx) => {
      if (g.url.trim() && !g.alt.trim()) {
        missing.push(`Galería foto #${idx + 1}`);
      }
    });
    blocks.forEach((b, idx) => {
      if (b.type === 'image' && b.imageUrl?.trim() && !b.imageAlt?.trim()) {
        missing.push(`Bloque #${idx + 1} (Imagen)`);
      }
      if (b.type === 'carousel') {
        (b.carouselItems || []).forEach((ci, cIdx) => {
          if (ci.url.trim() && !ci.alt.trim()) {
            missing.push(`Bloque #${idx + 1} carrusel foto #${cIdx + 1}`);
          }
        });
      }
    });
    return missing;
  };

  const handleAutoFillMissingAlts = () => {
    const fallbackBase = title.trim() || 'Fotografía editorial de Revista Digital Alternativa';
    if (coverImage.trim() && !coverAlt.trim()) {
      setCoverAlt(fallbackBase.slice(0, 280));
    }
    setGalleryItems((prev) =>
      prev.map((g, idx) =>
        g.url.trim() && !g.alt.trim()
          ? { ...g, alt: (g.caption.trim() || `${fallbackBase} – imagen ${idx + 1}`).slice(0, 280) }
          : g
      )
    );
    setBlocks((prev) =>
      prev.map((b, idx) => {
        if (b.type === 'image' && b.imageUrl?.trim() && !b.imageAlt?.trim()) {
          return {
            ...b,
            imageAlt: (b.imageCaption?.trim() || `${fallbackBase} – figura ${idx + 1}`).slice(0, 280),
          };
        }
        if (b.type === 'carousel' && Array.isArray(b.carouselItems)) {
          return {
            ...b,
            carouselItems: b.carouselItems.map((ci, cIdx) =>
              ci.url.trim() && !ci.alt.trim()
                ? { ...ci, alt: (ci.caption.trim() || `${fallbackBase} – foto ${cIdx + 1}`).slice(0, 280) }
                : ci
            ),
          };
        }
        return b;
      })
    );
    setMissingAltError(false);
    setError('');
    setNotice('Se completaron automáticamente los textos alternativos faltantes. Puedes editarlos si deseas más detalle.');
  };

  const handleSave = async (requestedStatus: PostStatus) => {
    setError('');
    setNotice('');
    setMissingAltError(false);
    setDiagnostic(null);
    setCopiedDiag(false);
    if (!firebaseUser) {
      setError('Debes iniciar sesión para guardar.');
      return;
    }
    if (title.trim().length < 3) {
      setError('El titular debe tener al menos 3 caracteres.');
      return;
    }

    const cat = categories.find((c) => c.id === categoryId) || categories[0];
    if (!cat) {
      setError('Selecciona una categoría válida.');
      return;
    }
    if (requestedStatus === 'scheduled') {
      const targetTime = scheduledForInput ? new Date(scheduledForInput).getTime() : NaN;
      if (!scheduledForInput || Number.isNaN(targetTime)) {
        setError('Selecciona una fecha y hora válida para programar la publicación.');
        return;
      }
    }

    if ((type === 'video' || type === 'audio' || type === 'document') && mediaUrl.trim()) {
      const checkMedia = inspectMediaUrl(mediaUrl.trim(), type);
      if (!checkMedia.isValid) {
        setError(`Enlace multimedia principal inválido: ${checkMedia.errorReason || 'Verifica la URL.'}`);
        return;
      }
    }

    for (let i = 0; i < blocks.length; i++) {
      const blk = blocks[i];
      if (blk.type === 'social_embed' && blk.embedUrl?.trim()) {
        const checkEmbed = inspectMediaUrl(blk.embedUrl.trim(), 'social');
        if (!checkEmbed.isValid) {
          setError(`Bloque #${i + 1} (incrustación social) con URL inválida: ${checkEmbed.errorReason || 'Verifica la URL.'}`);
          return;
        }
      }
    }

    if (requestedStatus === 'published' || requestedStatus === 'scheduled') {
      const missingAlts = collectMissingAlts();
      if (missingAlts.length > 0) {
        setMissingAltError(true);
        setError(
          `Para publicar es obligatorio describir el texto alternativo (alt) para lectores con discapacidad visual. Faltan: ${missingAlts.join(', ')}.`
        );
        return;
      }
    }

    let finalStatus: PostStatus = requestedStatus;
    if (!isAdmin && requestedStatus === 'published' && !siteConfig.autoPublishCollaborators) {
      finalStatus = 'in_review';
    }

    const ser = seriesList.find((s) => s.id === seriesId);
    const id = effectiveInitialPost?.id || generateId('post');
    const rawSlug = (effectiveInitialPost?.slug || `${slugify(title)}-${id.slice(-4)}`).trim().slice(0, 240);
    const slug = rawSlug.length >= 2 ? rawSlug : `nota-${id.slice(-6)}`;
    const readTime = Math.max(1, Math.min(180, estimateReadTime(blocks, subtitle)));
    const sanitizedTags = tags
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .map((t) => t.trim().slice(0, 40))
      .slice(0, 12);
    const cleanTags = sanitizedTags.length > 0 ? sanitizedTags : [cat.slug.slice(0, 40) || 'actualidad'];

    // Resolve public author identity safely
    let authorProfileId = firebaseUser.uid;
    let authorIdentityType: 'owner' | 'magazine' | 'collaborator' = 'collaborator';
    let safeAuthorName = 'Redacción';
    let safeAuthorAvatar = '';
    let safeAuthorOutlet: 'medio' | 'independiente' = 'independiente';

    if (isAdmin) {
      const chosenIdentity = adminIdentities[publishAs];
      authorProfileId = publishAs;
      authorIdentityType = publishAs;
      const candidate = (chosenIdentity?.name || siteConfig.siteName || 'Dirección Editorial').trim().slice(0, 120);
      safeAuthorName = candidate.length >= 2 ? candidate : 'Redacción';
      safeAuthorAvatar = (chosenIdentity?.avatarUrl || '').slice(0, 400000);
      safeAuthorOutlet = chosenIdentity?.outletType || (publishAs === 'magazine' ? 'medio' : 'independiente');
    } else {
      authorProfileId = firebaseUser.uid;
      authorIdentityType = 'collaborator';
      const candidate = (
        collaboratorProfile?.name ||
        effectiveInitialPost?.authorName ||
        userAccount?.displayName ||
        firebaseUser.displayName ||
        'Colaborador'
      )
        .trim()
        .slice(0, 120);
      safeAuthorName = candidate.length >= 2 ? candidate : 'Colaborador';
      safeAuthorAvatar =
        collaboratorProfile?.showAvatar === true && collaboratorProfile.avatarUrl
          ? collaboratorProfile.avatarUrl.slice(0, 400000)
          : '';
      safeAuthorOutlet =
        collaboratorProfile?.outletType || effectiveInitialPost?.authorOutletType || 'independiente';
    }

    const cleanedKeyPoints = keyPoints.map((k) => k.trim().slice(0, 260)).filter(Boolean).slice(0, 10);
    const cleanedSources = sources
      .filter((s) => s.label.trim().length > 0)
      .slice(0, 30)
      .map((s) => {
        const cleanUrl = sanitizeExternalUrl(s.url || '');
        return {
          label: s.label.trim().slice(0, 220),
          ...(cleanUrl ? { url: cleanUrl.slice(0, 500) } : {}),
        };
      });
    const cleanedMediaRelatedLinks = mediaRelatedLinks
      .filter((s) => s.label.trim().length > 0)
      .slice(0, 20)
      .map((s) => {
        const cleanUrl = sanitizeExternalUrl(s.url || '');
        return {
          label: s.label.trim().slice(0, 220),
          ...(cleanUrl ? { url: cleanUrl.slice(0, 500) } : {}),
        };
      });
    const cleanedChapters = mediaChapters
      .filter((c) => c.label.trim().length > 0)
      .slice(0, 50)
      .map((c) => ({
        id: c.id,
        timeSec: Math.max(0, Math.floor(Number(c.timeSec) || 0)),
        label: c.label.trim().slice(0, 140),
        ...(c.description?.trim() ? { description: c.description.trim().slice(0, 300) } : {}),
      }))
      .sort((a, b) => a.timeSec - b.timeSec);

    const parsedSeason = Number(seasonNumber);
    const parsedEpisode = Number(episodeNumber);
    const cleanSubtitleUrl = sanitizeExternalUrl(mediaSubtitlesUrl || '');

    const cleanBlocks = stripUndefinedDeep(blocks.slice(0, 80));
    const cleanGalleryItems = stripUndefinedDeep(galleryItems.slice(0, 30));
    const cleanCorrections = corrections
      .filter((c) => c.note.trim())
      .slice(0, 30)
      .map((c) => ({
        date: c.date.trim() || new Date().toLocaleDateString('es-ES'),
        note: c.note.trim(),
        editorName: c.editorName.trim() || userAccount?.displayName || 'Redacción',
      }));
    const validAccentColor =
      useCustomAccent && /^#[0-9a-fA-F]{3,8}$/.test(accentColor.trim())
        ? accentColor.trim().slice(0, 20)
        : '';
    const validMediaSourceType =
      type === 'video' || type === 'audio' || type === 'document' ? type : '';
    const validSeason =
      Number.isInteger(parsedSeason) && parsedSeason >= 1 && parsedSeason <= 999 ? parsedSeason : undefined;
    const validEpisode =
      Number.isInteger(parsedEpisode) && parsedEpisode >= 1 && parsedEpisode <= 9999 ? parsedEpisode : undefined;
    const validDocumentTitle =
      type === 'document' && documentTitle.trim() ? documentTitle.trim().slice(0, 200) : '';
    const validSensitiveWarning =
      sensitiveContent && sensitiveWarning.trim() ? sensitiveWarning.trim().slice(0, 300) : '';

    const sharedEditableFields: Record<string, unknown> = {
      title: title.trim().slice(0, 220),
      slug: slug.slice(0, 240),
      subtitle: subtitle.trim().slice(0, 500),
      type,
      editorialKind,
      status: finalStatus,
      categoryId: cat.id,
      categoryName: cat.name.slice(0, 80),
      categorySlug: cat.slug.slice(0, 100),
      tags: cleanTags.slice(0, 12),
      authorProfileId,
      authorIdentityType,
      authorVerified: true,
      authorName: safeAuthorName,
      authorOutletType: safeAuthorOutlet,
      coverLayout,
      headerStyle,
      paragraphIndent: Boolean(paragraphIndent),
      showTableOfContents: Boolean(showTableOfContents),
      blocks: cleanBlocks,
      sensitiveContent: Boolean(sensitiveContent),
      commentsEnabled,
      readTimeMinutes: Math.min(180, readTime),
      updatedAt: serverTimestamp(),
    };

    const setOrClearOptional = (
      target: Record<string, unknown>,
      key: string,
      value: unknown,
      isEdit: boolean
    ) => {
      const hasValue =
        value !== undefined &&
        value !== null &&
        value !== '' &&
        (!Array.isArray(value) || value.length > 0);
      if (hasValue) {
        target[key] = value;
      } else if (isEdit) {
        target[key] = deleteField();
      }
    };

    const applyOptionals = (
      target: Record<string, unknown>,
      isEdit: boolean,
      existingRaw?: Record<string, unknown> | null
    ) => {
      setOrClearOptional(target, 'seriesId', ser ? ser.id : '', isEdit);
      setOrClearOptional(target, 'seriesTitle', ser ? ser.title.slice(0, 160) : '', isEdit);
      setOrClearOptional(target, 'authorAvatar', safeAuthorAvatar, isEdit);
      setOrClearOptional(target, 'coverImage', coverImage ? coverImage.slice(0, 400000) : '', isEdit);
      setOrClearOptional(target, 'coverAlt', coverAlt ? coverAlt.slice(0, 300) : '', isEdit);
      setOrClearOptional(target, 'coverCredit', coverCredit ? coverCredit.slice(0, 200) : '', isEdit);
      setOrClearOptional(target, 'accentColor', validAccentColor, isEdit);
      setOrClearOptional(target, 'galleryItems', cleanGalleryItems, isEdit);
      setOrClearOptional(target, 'corrections', cleanCorrections, isEdit);
      setOrClearOptional(target, 'keyPoints', cleanedKeyPoints, isEdit);
      setOrClearOptional(target, 'sensitiveWarning', validSensitiveWarning, isEdit);
      setOrClearOptional(target, 'sources', cleanedSources.length > 0 ? stripUndefinedDeep(cleanedSources) : [], isEdit);
      setOrClearOptional(target, 'seoDescription', seoDescription.trim() ? seoDescription.trim().slice(0, 320) : '', isEdit);
      setOrClearOptional(target, 'mediaUrl', mediaUrl ? mediaUrl.slice(0, 400000) : '', isEdit);
      setOrClearOptional(target, 'mediaSourceType', validMediaSourceType, isEdit);
      setOrClearOptional(target, 'mediaChapters', cleanedChapters.length > 0 ? stripUndefinedDeep(cleanedChapters) : [], isEdit);
      setOrClearOptional(target, 'mediaTranscript', mediaTranscript.trim() ? mediaTranscript.trim().slice(0, 40000) : '', isEdit);
      setOrClearOptional(target, 'mediaSubtitlesUrl', cleanSubtitleUrl ? cleanSubtitleUrl.slice(0, 1000) : '', isEdit);
      setOrClearOptional(target, 'mediaDurationLabel', mediaDurationLabel.trim() ? mediaDurationLabel.trim().slice(0, 40) : '', isEdit);
      setOrClearOptional(
        target,
        'mediaRelatedLinks',
        cleanedMediaRelatedLinks.length > 0 ? stripUndefinedDeep(cleanedMediaRelatedLinks) : [],
        isEdit
      );
      setOrClearOptional(target, 'episodeNotes', episodeNotes.trim() ? episodeNotes.trim().slice(0, 10000) : '', isEdit);
      setOrClearOptional(target, 'seasonNumber', validSeason, isEdit);
      setOrClearOptional(target, 'episodeNumber', validEpisode, isEdit);
      setOrClearOptional(target, 'documentTitle', validDocumentTitle, isEdit);

      if (finalStatus === 'published') {
        const existingPub = existingRaw?.publishedAt ?? effectiveInitialPost?.publishedAt;
        if (existingPub instanceof Timestamp) {
          target.publishedAt = existingPub;
        } else if (existingPub) {
          target.publishedAt = Timestamp.fromDate(toDate(existingPub));
        } else {
          target.publishedAt = serverTimestamp();
        }
      } else if (isEdit && existingRaw && 'publishedAt' in existingRaw && !(existingRaw.publishedAt instanceof Timestamp)) {
        // Limpiar publishedAt antiguo no-Timestamp si quedó guardado como borrador
        target.publishedAt = deleteField();
      }

      if (finalStatus === 'scheduled' && scheduledForInput) {
        target.scheduledFor = Timestamp.fromDate(new Date(scheduledForInput));
      } else if (isEdit) {
        target.scheduledFor = deleteField();
      }
    };

    const localSavedPost: Post = {
      id,
      title: sharedEditableFields.title as string,
      slug: sharedEditableFields.slug as string,
      subtitle: sharedEditableFields.subtitle as string,
      type,
      editorialKind,
      status: finalStatus,
      featured: isAdmin ? featured : effectiveInitialPost?.featured || false,
      breaking: isAdmin ? breaking : effectiveInitialPost?.breaking || false,
      pinnedInFeed: isAdmin ? Boolean(pinnedInFeed) : effectiveInitialPost?.pinnedInFeed || false,
      isSample: false,
      categoryId: cat.id,
      categoryName: sharedEditableFields.categoryName as string,
      categorySlug: sharedEditableFields.categorySlug as string,
      ...(ser ? { seriesId: ser.id, seriesTitle: ser.title.slice(0, 160) } : {}),
      tags: cleanTags.slice(0, 12),
      authorId: effectiveInitialPost?.authorId || firebaseUser.uid,
      authorProfileId,
      authorIdentityType,
      authorVerified: true,
      authorName: safeAuthorName,
      ...(safeAuthorAvatar ? { authorAvatar: safeAuthorAvatar } : {}),
      authorOutletType: safeAuthorOutlet,
      ...(coverImage ? { coverImage: coverImage.slice(0, 400000) } : {}),
      ...(coverAlt ? { coverAlt: coverAlt.slice(0, 300) } : {}),
      ...(coverCredit ? { coverCredit: coverCredit.slice(0, 200) } : {}),
      coverLayout,
      headerStyle,
      ...(validAccentColor ? { accentColor: validAccentColor } : {}),
      paragraphIndent: Boolean(paragraphIndent),
      showTableOfContents: Boolean(showTableOfContents),
      blocks: cleanBlocks,
      ...(cleanGalleryItems.length > 0 ? { galleryItems: cleanGalleryItems } : {}),
      ...(cleanCorrections.length > 0 ? { corrections: cleanCorrections } : {}),
      ...(cleanedKeyPoints.length > 0 ? { keyPoints: cleanedKeyPoints } : {}),
      sensitiveContent: Boolean(sensitiveContent),
      ...(validSensitiveWarning ? { sensitiveWarning: validSensitiveWarning } : {}),
      ...(cleanedSources.length > 0 ? { sources: cleanedSources } : {}),
      ...(seoDescription.trim() ? { seoDescription: seoDescription.trim().slice(0, 320) } : {}),
      commentsEnabled,
      ...(mediaUrl ? { mediaUrl: mediaUrl.slice(0, 400000) } : {}),
      ...(validMediaSourceType ? { mediaSourceType: validMediaSourceType } : {}),
      ...(cleanedChapters.length > 0 ? { mediaChapters: cleanedChapters } : {}),
      ...(mediaTranscript.trim() ? { mediaTranscript: mediaTranscript.trim().slice(0, 40000) } : {}),
      ...(cleanSubtitleUrl ? { mediaSubtitlesUrl: cleanSubtitleUrl.slice(0, 1000) } : {}),
      ...(mediaDurationLabel.trim() ? { mediaDurationLabel: mediaDurationLabel.trim().slice(0, 40) } : {}),
      ...(cleanedMediaRelatedLinks.length > 0 ? { mediaRelatedLinks: cleanedMediaRelatedLinks } : {}),
      ...(episodeNotes.trim() ? { episodeNotes: episodeNotes.trim().slice(0, 10000) } : {}),
      ...(validSeason !== undefined ? { seasonNumber: validSeason } : {}),
      ...(validEpisode !== undefined ? { episodeNumber: validEpisode } : {}),
      ...(validDocumentTitle ? { documentTitle: validDocumentTitle } : {}),
      readTimeMinutes: Math.min(180, readTime),
      viewCount: effectiveInitialPost?.viewCount ?? 0,
      commentCount: effectiveInitialPost?.commentCount ?? 0,
      ...(finalStatus === 'published'
        ? { publishedAt: effectiveInitialPost?.publishedAt || new Date() }
        : {}),
      ...(finalStatus === 'scheduled' && scheduledForInput
        ? { scheduledFor: new Date(scheduledForInput) }
        : {}),
      createdAt: effectiveInitialPost?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    setSaving(true);
    let preflightInvalidFields: string[] = [];
    let preflightBytes = 0;
    let existingAuthorId: string | null = effectiveInitialPost?.authorId || null;

    try {
      saveRevisionSnapshot(`Guardado (${finalStatus})`);
      if (effectiveInitialPost) {
        const existingSnap = await getDoc(doc(db, 'posts', id)).catch(() => null);
        const existingRaw: Record<string, unknown> =
          existingSnap && existingSnap.exists()
            ? (existingSnap.data() as Record<string, unknown>)
            : (effectiveInitialPost as unknown as Record<string, unknown>);
        existingAuthorId = typeof existingRaw.authorId === 'string' ? existingRaw.authorId : existingAuthorId;

        const updatePayload: Record<string, unknown> = {
          ...sharedEditableFields,
          ...(isAdmin
            ? {
                featured,
                breaking,
                pinnedInFeed: Boolean(pinnedInFeed),
              }
            : {}),
        };
        applyOptionals(updatePayload, true, existingRaw);

        // Normalización segura en update: eliminar claves heredadas fuera de hasOnly (incluidos apaMode/apaReferences) y completar faltantes
        for (const key of Object.keys(existingRaw)) {
          if (!POST_ALLOWED_KEYS_SET.has(key)) {
            updatePayload[key] = deleteField();
          }
        }
        if ('apaMode' in existingRaw) updatePayload.apaMode = deleteField();
        if ('apaReferences' in existingRaw) updatePayload.apaReferences = deleteField();
        if (
          'audioDurationSec' in existingRaw &&
          (typeof existingRaw.audioDurationSec !== 'number' ||
            existingRaw.audioDurationSec < 0 ||
            existingRaw.audioDurationSec > 86400)
        ) {
          updatePayload.audioDurationSec = deleteField();
        }

        if (isAdmin) {
          if (typeof existingRaw.id !== 'string' || existingRaw.id !== id) updatePayload.id = id;
          if (!isValidFirestoreId(existingRaw.authorId)) updatePayload.authorId = firebaseUser.uid;
          if (typeof existingRaw.isSample !== 'boolean') updatePayload.isSample = false;
          if (typeof existingRaw.viewCount !== 'number' || existingRaw.viewCount < 0) updatePayload.viewCount = 0;
          if (typeof existingRaw.commentCount !== 'number' || existingRaw.commentCount < 0) updatePayload.commentCount = 0;
          if (!(existingRaw.createdAt instanceof Timestamp)) {
            updatePayload.createdAt = existingRaw.createdAt
              ? Timestamp.fromDate(toDate(existingRaw.createdAt))
              : serverTimestamp();
          }
        }

        const simulatedDoc = mergeExistingAndPatch(existingRaw, updatePayload);
        preflightBytes = estimateUtf8JsonBytes(simulatedDoc);
        preflightInvalidFields = validatePostDocumentAgainstRules(simulatedDoc, {
          isCreate: false,
          isAdmin,
          isActiveCollaborator,
          uid: firebaseUser.uid,
          autoPublishCollaborators: siteConfig.autoPublishCollaborators,
          existingDoc: existingRaw,
        });

        if (preflightBytes > 980000) {
          throw new Error('exceeds the maximum allowed size');
        }

        await updateDoc(doc(db, 'posts', id), updatePayload);
      } else {
        const createPayload: Record<string, unknown> = {
          ...sharedEditableFields,
          id,
          featured: isAdmin ? featured : false,
          breaking: isAdmin ? breaking : false,
          pinnedInFeed: isAdmin ? Boolean(pinnedInFeed) : false,
          isSample: false,
          authorId: firebaseUser.uid,
          viewCount: 0,
          commentCount: 0,
          createdAt: serverTimestamp(),
        };
        applyOptionals(createPayload, false, null);

        preflightBytes = estimateUtf8JsonBytes(createPayload);
        preflightInvalidFields = validatePostDocumentAgainstRules(createPayload, {
          isCreate: true,
          isAdmin,
          isActiveCollaborator,
          uid: firebaseUser.uid,
          autoPublishCollaborators: siteConfig.autoPublishCollaborators,
        });

        if (preflightBytes > 980000) {
          throw new Error('exceeds the maximum allowed size');
        }

        await setDoc(doc(db, 'posts', id), createPayload);
        if (collaboratorProfile && !isAdmin) {
          await updateDoc(doc(db, 'collaborators_public', firebaseUser.uid), {
            postCount: increment(1),
            updatedAt: serverTimestamp(),
          }).catch(() => undefined);
        }
      }
      localStorage.removeItem(draftStorageKey);
      onSaved(localSavedPost);
    } catch (err) {
      const diag = diagnosePostSaveFailure({
        error: err,
        operation: effectiveInitialPost ? 'update' : 'create',
        postId: id,
        uid: firebaseUser.uid,
        role: userAccount?.role || null,
        status: userAccount?.status || null,
        isAdmin,
        isActiveCollaborator,
        emailVerified: Boolean(firebaseUser.emailVerified),
        hasAdminDoc: adminDiagnostics.hasAdminDoc,
        bootstrapClaimed: adminDiagnostics.bootstrapClaimed,
        bootstrapAdminUid: adminDiagnostics.bootstrapAdminUid,
        autoPublishCollaborators: siteConfig.autoPublishCollaborators,
        estimatedBytes: preflightBytes,
        invalidFields: preflightInvalidFields,
        existingAuthorId,
      });

      console.error(
        'Firestore Error:',
        JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
          operationType: effectiveInitialPost ? OperationType.UPDATE : OperationType.CREATE,
          path: `posts/${id}`,
          authInfo: {
            userId: firebaseUser.uid,
            emailVerified: firebaseUser.emailVerified,
            role: userAccount?.role || null,
            status: userAccount?.status || null,
          },
        })
      );

      setDiagnostic(diag);
      setError(`${diag.headline}. ${diag.detail}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 sm:p-8 space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-300 dark:border-neutral-800 pb-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
            {effectiveInitialPost ? 'Editar publicación' : 'Nueva publicación multimedia'}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            {autoSavedAt ? `Borrador guardado localmente a las ${autoSavedAt}` : 'Guardado automático de borrador activo'}
            {uploadingInfo ? ` · ${uploadingInfo}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDuplicateInEditor}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 font-display text-xs font-bold uppercase tracking-wider cursor-pointer hover:border-[var(--editorial-primary)]"
          >
            <CopyPlus className="w-3.5 h-3.5" />
            <span>Duplicar</span>
          </button>
          <button
            type="button"
            onClick={() => setRevisionsOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 font-display text-xs font-bold uppercase tracking-wider cursor-pointer hover:border-[var(--editorial-primary)]"
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial ({revisions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPreview((p) => !p)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-400 dark:border-neutral-700 font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{showPreview ? 'Solo editor' : 'Vista previa en vivo'}</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-xs font-display font-bold uppercase tracking-wider text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Revisions Drawer */}
      {revisionsOpen && (
        <div className="rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-[#F8F6F1] dark:bg-[#191919] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
              Historial local de versiones
            </span>
            <button
              type="button"
              onClick={() => saveRevisionSnapshot('Versión manual')}
              className="px-3 py-1 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black font-display text-[11px] font-bold uppercase cursor-pointer"
            >
              + Guardar instantánea ahora
            </button>
          </div>
          {revisions.length === 0 ? (
            <p className="text-xs text-neutral-500">Aún no hay instantáneas guardadas en este navegador.</p>
          ) : (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 max-h-48 overflow-y-auto">
              {revisions.map((rev) => (
                <li key={rev.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{rev.title}</p>
                    <p className="text-neutral-500">
                      {rev.savedAt} · {rev.label} · {rev.blocks.length} bloques
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTitle(rev.title);
                      setSubtitle(rev.subtitle);
                      setBlocks(rev.blocks);
                      setRevisionsOpen(false);
                      setNotice(`Versión restaurada (${rev.savedAt}).`);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-neutral-400 dark:border-neutral-600 font-display font-bold uppercase cursor-pointer shrink-0 hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-black"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restaurar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {uploadProgress !== null && (
        <div className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[#F8F6F1] dark:bg-[#1A1A1A] p-3 space-y-1.5">
          <div className="flex justify-between text-xs font-display font-bold uppercase">
            <span>{uploadingInfo || 'Procesando archivo...'}</span>
            <span className="font-tabular">{uploadProgress}%</span>
          </div>
          <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
            <div
              className="h-2 bg-[var(--editorial-primary)] transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {notice && (
        <div role="status" className="rounded-xl p-3 border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 text-xs">
          {notice}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl p-4 border border-red-500 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 text-sm space-y-2.5">
          <p className="font-semibold">{error}</p>
          {missingAltError && (
            <button
              type="button"
              onClick={handleAutoFillMissingAlts}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#111111] dark:bg-white text-white dark:text-[#111111] font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Completar textos alt faltantes automáticamente
            </button>
          )}
          {diagnostic && (
            <div className="rounded-lg border border-red-300 dark:border-red-800/70 bg-white/80 dark:bg-[#141414] p-3 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display font-bold uppercase tracking-wider text-[11px] text-red-700 dark:text-red-300">
                  Diagnóstico técnico (sin datos sensibles)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(diagnostic.diagnosticText).then(() => {
                      setCopiedDiag(true);
                      setTimeout(() => setCopiedDiag(false), 2500);
                    }).catch(() => undefined);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-red-400 dark:border-red-700 font-display text-[11px] font-bold uppercase cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40"
                >
                  {copiedDiag ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedDiag ? 'Copiado' : 'Copiar diagnóstico'}</span>
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-[11px] text-neutral-700 dark:text-neutral-300 leading-relaxed">
                {diagnostic.diagnosticText}
              </pre>
            </div>
          )}
        </div>
      )}

      <div className={`grid gap-8 ${showPreview ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Editor Column */}
        <div className="space-y-5">
          {/* Admin-only Publishing Identity Selector */}
          {isAdmin && (
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-[#F8F6F1]/70 dark:bg-[#1A1A1A] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)]">
                  Publicar como (identidad pública del administrador)
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
                  <VerifiedBadge size="xs" /> Firma verificada
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(['owner', 'magazine'] as const).map((idKey) => {
                  const ident = adminIdentities[idKey];
                  const selected = publishAs === idKey;
                  return (
                    <button
                      key={idKey}
                      type="button"
                      onClick={() => setPublishAs(idKey)}
                      className={`text-left p-3 rounded-xl border transition-colors cursor-pointer flex items-center gap-3 ${
                        selected
                          ? 'border-[var(--editorial-primary)] bg-white dark:bg-[#141414] ring-1 ring-[var(--editorial-primary)]'
                          : 'border-neutral-300 dark:border-neutral-700 bg-white/60 dark:bg-[#161616] opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0">
                        <EditorialImage
                          src={ident.avatarUrl || siteConfig.logoUrl}
                          alt={ident.name}
                          fallbackTitle={ident.name}
                          allowInDataSaver
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-sm font-bold truncate flex items-center gap-1">
                          <span className="truncate">{ident.name}</span>
                          <VerifiedBadge size="xs" />
                        </p>
                        <p className="text-[11px] text-neutral-500 truncate">
                          {ident.roleTitle || (idKey === 'owner' ? 'Perfil personal' : 'Revista / Redacción')}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Genre Structural Template Loader */}
          <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-[#F8F6F1]/50 dark:bg-[#181818] p-3.5 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-[var(--editorial-primary)]" />
              Plantilla por género editorial
            </span>
            <div className="flex items-center gap-2">
              <select
                aria-label="Seleccionar plantilla por género"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value as '' | GenreTemplateKey)}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#141414] border border-neutral-300 dark:border-neutral-700 text-xs"
              >
                <option value="">Elegir estructura...</option>
                <option value="entrevista">Entrevista (P&R)</option>
                <option value="explicativo">Artículo explicativo</option>
                <option value="cronica">Crónica narrativa</option>
                <option value="datos">Periodismo de datos</option>
                <option value="opinion">Columna de opinión</option>
              </select>
              {selectedTemplate && (
                <button
                  type="button"
                  onClick={() => handleApplyTemplate(selectedTemplate)}
                  className="px-3 py-1.5 rounded-full bg-[var(--editorial-primary)] text-white font-display text-xs font-bold uppercase cursor-pointer"
                >
                  Cargar estructura
                </button>
              )}
            </div>
          </div>

          {/* Format, Classification & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Formato</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PostType)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              >
                <option value="article">Texto / Artículo</option>
                <option value="gallery">Galería fotográfica</option>
                <option value="video">Video</option>
                <option value="audio">Audio / Pódcast</option>
                <option value="infographic">Infografía</option>
                <option value="document">Documento / PDF descargable</option>
              </select>
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Género editorial</label>
              <select
                value={editorialKind}
                onChange={(e) => setEditorialKind(e.target.value as EditorialKind)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              >
                <option value="articulo">Artículo</option>
                <option value="investigacion">Investigación</option>
                <option value="opinion">Opinión</option>
                <option value="cronica">Crónica</option>
                <option value="analisis">Análisis</option>
                <option value="reportaje">Reportaje</option>
                <option value="multimedia">Multimedia</option>
                <option value="entrevista">Entrevista</option>
                <option value="editorial">Editorial</option>
                <option value="explicativo">Explicativo</option>
                <option value="datos">Periodismo de datos</option>
                <option value="carta">Carta de lectores</option>
              </select>
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Categoría</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parentId ? `↳ ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Serie o especial</label>
              <select
                value={seriesId}
                onChange={(e) => setSeriesId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              >
                <option value="">Sin serie asignada</option>
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Headline & Subtitle */}
          <div>
            <label className="block font-display text-xs font-bold uppercase mb-1">Titular</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={220}
              placeholder="Escribe un titular claro, contundente y verificable..."
              className="w-full px-3 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 font-display text-xl font-bold"
            />
          </div>

          <div>
            <label className="block font-display text-xs font-bold uppercase mb-1">Bajada / Sumario</label>
            <textarea
              rows={2}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              maxLength={500}
              placeholder="Resumen editorial que acompaña al titular y aparece al compartir en redes..."
              className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
            />
          </div>

          {/* Presentation & Academic Design Options */}
          <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 p-4 space-y-3 bg-[#F8F6F1]/40 dark:bg-[#171717]">
            <p className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-[var(--editorial-primary)]" />
              Presentación editorial y modo académico
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-display font-bold uppercase text-neutral-500 mb-1">
                  Diseño de portada
                </label>
                <select
                  value={coverLayout}
                  onChange={(e) => setCoverLayout(e.target.value as CoverLayoutStyle)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                >
                  <option value="full">Completa (panorámica)</option>
                  <option value="compact">Compacta lateral</option>
                  <option value="overlay">Titular sobre imagen</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-display font-bold uppercase text-neutral-500 mb-1">
                  Estilo de encabezado
                </label>
                <select
                  value={headerStyle}
                  onChange={(e) => setHeaderStyle(e.target.value as HeaderStyleVariant)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                >
                  <option value="classic">Clásico de prensa</option>
                  <option value="editorial">Editorial destacado</option>
                  <option value="minimal">Minimalista centrado</option>
                </select>
              </div>
              <div>
                <label className="inline-flex items-center gap-1.5 text-[11px] font-display font-bold uppercase text-neutral-500 mb-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomAccent}
                    onChange={(e) => setUseCustomAccent(e.target.checked)}
                  />
                  <span>Color de acento propio</span>
                </label>
                {useCustomAccent && (
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-9 h-8 rounded border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                    />
                    <span className="font-tabular text-xs">{accentColor}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-5 pt-1 text-xs">
              <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={showTableOfContents}
                  onChange={(e) => setShowTableOfContents(e.target.checked)}
                />
                <span>Tabla de contenidos automática</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
                <input
                  type="checkbox"
                  checked={paragraphIndent}
                  onChange={(e) => setParagraphIndent(e.target.checked)}
                />
                <span>Sangría en párrafos</span>
              </label>
            </div>
          </div>

          <CoverFramingSection
            type={type}
            folder={`posts/${firebaseUser?.uid || 'anon'}`}
            coverImage={coverImage}
            setCoverImage={setCoverImage}
            coverAlt={coverAlt}
            setCoverAlt={setCoverAlt}
            coverCredit={coverCredit}
            setCoverCredit={setCoverCredit}
            sensitiveContent={sensitiveContent}
            setSensitiveContent={setSensitiveContent}
            sensitiveWarning={sensitiveWarning}
            setSensitiveWarning={setSensitiveWarning}
            onRequestCrop={(srcUrl) => setCropTarget({ kind: 'cover', srcUrl })}
            onUploadNote={(info) => setUploadingInfo(info)}
          />

          <MediaSectionEditor
            type={type}
            title={title}
            coverImage={coverImage}
            mediaUrl={mediaUrl}
            setMediaUrl={setMediaUrl}
            documentTitle={documentTitle}
            setDocumentTitle={setDocumentTitle}
            mediaDurationLabel={mediaDurationLabel}
            setMediaDurationLabel={setMediaDurationLabel}
            seasonNumber={seasonNumber}
            setSeasonNumber={setSeasonNumber}
            episodeNumber={episodeNumber}
            setEpisodeNumber={setEpisodeNumber}
            mediaSubtitlesUrl={mediaSubtitlesUrl}
            setMediaSubtitlesUrl={setMediaSubtitlesUrl}
            mediaChapters={mediaChapters}
            setMediaChapters={setMediaChapters}
            episodeNotes={episodeNotes}
            setEpisodeNotes={setEpisodeNotes}
            mediaTranscript={mediaTranscript}
            setMediaTranscript={setMediaTranscript}
            mediaRelatedLinks={mediaRelatedLinks}
            setMediaRelatedLinks={setMediaRelatedLinks}
            onUploadMedia={(file) => void handleUploadAsset(file, 'media')}
            onUploadDocument={(file) => void handleUploadDocument(file, 'post')}
            onUploadSubtitle={(file) => void handleUploadSubtitleFile(file)}
          />

          {/* Gallery Builder with Multi-upload & Drag-and-Drop */}
          {type === 'gallery' && (
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-xs font-bold uppercase tracking-wider">
                  Fotografías de la galería ({galleryItems.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setGalleryItems((prev) => [
                      ...prev,
                      { id: generateId('gal'), url: '', alt: '', caption: '', credit: '' },
                    ])
                  }
                  className="px-3 py-1.5 rounded-full border border-neutral-400 text-xs font-display font-bold uppercase cursor-pointer"
                >
                  + Por URL
                </button>
              </div>
              <MediaUploader
                folder={`posts/${firebaseUser?.uid || 'anon'}`}
                slot="gallery"
                accept="image/*"
                multiple
                label="Arrastra aquí o selecciona varias fotografías"
                helperText="Cada foto se comprime a WebP con detección automática de punto focal."
                onUploaded={(results) => {
                  setGalleryItems((prev) => [
                    ...prev,
                    ...results.map((r) => ({
                      id: generateId('gal'),
                      url: r.url,
                      alt: r.file.name.replace(/\.[^.]+$/, ''),
                      caption: '',
                      credit: '',
                    })),
                  ]);
                }}
              />
              {galleryItems.map((g, idx) => (
                <div key={g.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 border-t border-neutral-200 dark:border-neutral-800 pt-2 items-center">
                  <input
                    type="text"
                    value={g.url}
                    onChange={(e) =>
                      setGalleryItems((prev) => prev.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x)))
                    }
                    placeholder="URL de imagen"
                    className="sm:col-span-3 px-2 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                  <input
                    type="text"
                    value={g.alt}
                    onChange={(e) =>
                      setGalleryItems((prev) => prev.map((x, i) => (i === idx ? { ...x, alt: e.target.value } : x)))
                    }
                    placeholder="Texto alt (obligatorio)"
                    className={`sm:col-span-3 px-2 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border text-xs ${
                      g.url.trim() && !g.alt.trim()
                        ? 'border-amber-500'
                        : 'border-neutral-300 dark:border-neutral-700'
                    }`}
                  />
                  <input
                    type="text"
                    value={g.caption}
                    onChange={(e) =>
                      setGalleryItems((prev) => prev.map((x, i) => (i === idx ? { ...x, caption: e.target.value } : x)))
                    }
                    placeholder="Pie de foto"
                    className="sm:col-span-3 px-2 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                  <input
                    type="text"
                    value={g.credit}
                    onChange={(e) =>
                      setGalleryItems((prev) => prev.map((x, i) => (i === idx ? { ...x, credit: e.target.value } : x)))
                    }
                    placeholder="Crédito"
                    className="sm:col-span-2 px-2 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setGalleryItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="sm:col-span-1 text-xs text-red-600 font-display uppercase font-bold cursor-pointer"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Key Points (Puntos clave) */}
          <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider">
                <ListChecks className="w-3.5 h-3.5 text-[var(--editorial-primary)]" />
                Puntos clave / En síntesis (opcional, máx. 10)
              </span>
              <button
                type="button"
                disabled={keyPoints.length >= 10}
                onClick={() => setKeyPoints((prev) => [...prev, ''])}
                className="px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase cursor-pointer disabled:opacity-50"
              >
                + Añadir punto
              </button>
            </div>
            {keyPoints.map((kp, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  maxLength={260}
                  value={kp}
                  onChange={(e) =>
                    setKeyPoints((prev) => prev.map((x, i) => (i === idx ? e.target.value : x)))
                  }
                  placeholder={`Punto clave ${idx + 1}...`}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setKeyPoints((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-xs text-red-600 font-display font-bold uppercase cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>

          {/* Block Editor Canvas */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-xs font-bold uppercase tracking-wider">
                Bloques del cuerpo ({blocks.length}) — Usa **negritas**, *cursivas*, [texto](https://enlace) y [1] para notas al pie
              </span>
            </div>

            {blocks.map((block, idx) => (
              <BlockItemEditor
                key={block.id}
                block={block}
                index={idx}
                setBlocks={setBlocks}
                onMoveBlock={moveBlock}
                onUploadAsset={handleUploadAsset}
                onUploadDocument={handleUploadDocument}
                onRequestCropBlockImage={(blockId, srcUrl) =>
                  setCropTarget({ kind: 'block', blockId, srcUrl })
                }
              />
            ))}

            {/* Add Block Toolbar */}
            <div className="flex flex-wrap gap-2 pt-2">
              {(
                [
                  ['paragraph', 'Párrafo'],
                  ['heading', 'Subtítulo'],
                  ['quote', 'Cita destacada'],
                  ['speaker_quote', 'Cita entrevista'],
                  ['callout', 'Recuadro'],
                  ['context_box', 'Contexto'],
                  ['list', 'Lista'],
                  ['columns', 'Columnas'],
                  ['before_after', 'Antes / Después'],
                  ['metrics', 'Métricas'],
                  ['image', 'Imagen'],
                  ['carousel', 'Carrusel'],
                  ['document', 'PDF / Anexo'],
                  ['footnote', 'Nota al pie'],
                  ['timeline', 'Línea de tiempo'],
                  ['table', 'Tabla'],
                  ['social_embed', 'Red social'],
                  ['divider', 'Separador'],
                ] as const
              ).map(([bType, label]) => (
                <button
                  key={bType}
                  type="button"
                  onClick={() => addBlock(bType)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-[var(--editorial-primary)]" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sources Consulted */}
          <div className="space-y-2.5 border-t border-neutral-300 dark:border-neutral-800 pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-xs font-bold uppercase tracking-wider">
                Fuentes consultadas (opcional)
              </span>
              <button
                type="button"
                onClick={() => setSources((prev) => [...prev, { label: '', url: '' }])}
                className="px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase cursor-pointer"
              >
                + Añadir fuente
              </button>
            </div>
            {sources.map((src, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  maxLength={220}
                  value={src.label}
                  onChange={(e) =>
                    setSources((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                  }
                  placeholder="Nombre del documento, entidad o testimonio"
                  className="sm:col-span-6 px-2.5 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
                <input
                  type="url"
                  maxLength={500}
                  value={src.url || ''}
                  onChange={(e) =>
                    setSources((prev) => prev.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x)))
                  }
                  placeholder="Enlace de respaldo (opcional)"
                  className="sm:col-span-5 px-2.5 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setSources((prev) => prev.filter((_, i) => i !== idx))}
                  className="sm:col-span-1 text-xs text-red-600 font-display font-bold uppercase cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>

          {/* Tags with Autocomplete */}
          <div className="space-y-2 border-t border-neutral-300 dark:border-neutral-800 pt-4">
            <label className="block font-display text-xs font-bold uppercase">
              Etiquetas (máx. 12)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                placeholder="Escribe una etiqueta y pulsa Enter"
                className="flex-1 px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              />
              <button
                type="button"
                onClick={() => addTag(tagInput)}
                className="px-4 py-2 rounded-full border border-neutral-400 font-display text-xs font-bold uppercase cursor-pointer"
              >
                Agregar
              </button>
            </div>
            {tagSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-neutral-500">Sugerencias:</span>
                {tagSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addTag(s)}
                    className="underline hover:text-[var(--editorial-primary)] cursor-pointer"
                  >
                    #{s}
                  </button>
                ))}
              </div>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-3 text-xs font-display uppercase tracking-wider pt-1">
                {tags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                    className="hover:text-red-600 cursor-pointer"
                  >
                    #{t} ×
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SEO Description & Comments Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 border-t border-neutral-200 dark:border-neutral-800 pt-4 items-start">
            <div className="sm:col-span-8">
              <div className="flex justify-between items-center mb-1">
                <label className="font-display text-xs font-bold uppercase">
                  Descripción SEO / Resumen para buscadores (opcional)
                </label>
                <span className="text-[11px] font-tabular text-neutral-500">{seoDescription.length}/320</span>
              </div>
              <textarea
                rows={2}
                maxLength={320}
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                placeholder="Si se deja vacío, se usará automáticamente la bajada de la nota."
                className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
            </div>
            <div className="sm:col-span-4 pt-5">
              <label className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase cursor-pointer">
                <input
                  type="checkbox"
                  checked={commentsEnabled}
                  onChange={(e) => setCommentsEnabled(e.target.checked)}
                />
                <span>Permitir comentarios</span>
              </label>
            </div>
          </div>

          {/* Corrections / Errata Section */}
          <div className="space-y-3 border-t border-neutral-200 dark:border-neutral-800 pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-xs font-bold uppercase tracking-wider">
                Fe de erratas y correcciones públicas (opcional)
              </span>
              <button
                type="button"
                onClick={() =>
                  setCorrections((prev) => [
                    ...prev,
                    {
                      date: new Date().toLocaleDateString('es-ES'),
                      note: '',
                      editorName: userAccount?.displayName || firebaseUser?.displayName || 'Redacción',
                    },
                  ])
                }
                className="px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase cursor-pointer"
              >
                + Añadir nota de corrección
              </button>
            </div>
            {corrections.map((c, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  value={c.date}
                  onChange={(e) =>
                    setCorrections((prev) => prev.map((x, i) => (i === idx ? { ...x, date: e.target.value } : x)))
                  }
                  placeholder="Fecha"
                  className="sm:col-span-3 px-2.5 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
                <input
                  type="text"
                  value={c.note}
                  onChange={(e) =>
                    setCorrections((prev) => prev.map((x, i) => (i === idx ? { ...x, note: e.target.value } : x)))
                  }
                  placeholder="Detalle de la corrección o actualización"
                  className="sm:col-span-6 px-2.5 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
                <input
                  type="text"
                  value={c.editorName}
                  onChange={(e) =>
                    setCorrections((prev) => prev.map((x, i) => (i === idx ? { ...x, editorName: e.target.value } : x)))
                  }
                  placeholder="Editor"
                  className="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setCorrections((prev) => prev.filter((_, i) => i !== idx))}
                  className="sm:col-span-1 text-xs text-red-600 font-display font-bold uppercase cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>

          {/* Admin Flags & Scheduling */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-neutral-300 dark:border-neutral-800 pt-4">
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">
                Programar fecha de publicación (opcional)
              </label>
              <input
                type="datetime-local"
                value={scheduledForInput}
                onChange={(e) => setScheduledForInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              />
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-4 pt-4">
                <label className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase cursor-pointer">
                  <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
                  <span>Nota destacada</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase cursor-pointer">
                  <input type="checkbox" checked={breaking} onChange={(e) => setBreaking(e.target.checked)} />
                  <span>Última hora</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase cursor-pointer">
                  <input type="checkbox" checked={pinnedInFeed} onChange={(e) => setPinnedInFeed(e.target.checked)} />
                  <span>Fijar en el feed</span>
                </label>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-neutral-300 dark:border-neutral-800">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('published')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display font-bold uppercase tracking-wider text-xs cursor-pointer disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {!isAdmin && !siteConfig.autoPublishCollaborators ? 'Enviar a revisión' : 'Publicar ahora'}
              </span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('draft')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-neutral-400 dark:border-neutral-700 font-display font-bold uppercase tracking-wider text-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Guardar borrador</span>
            </button>

            {scheduledForInput && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave('scheduled')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-neutral-400 dark:border-neutral-700 font-display font-bold uppercase tracking-wider text-xs cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Programar</span>
              </button>
            )}
          </div>
        </div>

        {showPreview && (
          <EditorPreview
            previewViewport={previewViewport}
            setPreviewViewport={setPreviewViewport}
            headerStyle={headerStyle}
            coverLayout={coverLayout}
            useCustomAccent={useCustomAccent}
            accentColor={accentColor}
            type={type}
            coverImage={coverImage}
            coverAlt={coverAlt}
            title={title}
            subtitle={subtitle}
            mediaUrl={mediaUrl}
            mediaSubtitlesUrl={mediaSubtitlesUrl}
            sensitiveContent={sensitiveContent}
            sensitiveWarning={sensitiveWarning}
            keyPoints={keyPoints}
            blocks={blocks}
            paragraphIndent={paragraphIndent}
          />
        )}
      </div>

      <ImageCropModal
        open={Boolean(cropTarget)}
        imageSrc={cropTarget?.srcUrl || ''}
        initialAspect={cropTarget?.kind === 'cover' ? '16:9' : 'free'}
        fileName={cropTarget?.kind === 'cover' ? 'portada.webp' : 'imagen-articulo.webp'}
        onClose={() => setCropTarget(null)}
        onConfirm={(croppedFile) => {
          const current = cropTarget;
          setCropTarget(null);
          if (!current) return;
          if (current.kind === 'cover') {
            void handleUploadAsset(croppedFile, 'cover');
          } else if (current.blockId) {
            void handleUploadAsset(croppedFile, current.blockId);
          }
        }}
      />
    </div>
  );
};
