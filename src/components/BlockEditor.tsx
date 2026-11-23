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
  ArrowDown,
  ArrowUp,
  BookMarked,
  Captions,
  Check,
  Copy,
  CopyPlus,
  Crosshair,
  Eye,
  FileText,
  History,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Monitor,
  Plus,
  RotateCcw,
  Save,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { buildApaReferenceString } from '../lib/apa';
import { db, OperationType } from '../lib/firebase';
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
  encodeMediaUrlWithMeta,
  estimateReadTime,
  formatSecondsToTimestamp,
  generateId,
  parseMediaUrlMeta,
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
  ApaReference,
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

  // Academic APA 7 mode & Table of Contents
  const [apaMode, setApaMode] = useState(Boolean(initialPost?.apaMode));
  const [showTableOfContents, setShowTableOfContents] = useState(Boolean(initialPost?.showTableOfContents));
  const [apaReferences, setApaReferences] = useState<ApaReference[]>(initialPost?.apaReferences || []);

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
        if (Array.isArray(parsed.apaReferences)) setApaReferences(parsed.apaReferences);
        if (typeof parsed.seoDescription === 'string') setSeoDescription(parsed.seoDescription);
        if (typeof parsed.sensitiveContent === 'boolean') setSensitiveContent(parsed.sensitiveContent);
        if (typeof parsed.sensitiveWarning === 'string') setSensitiveWarning(parsed.sensitiveWarning);
        if (typeof parsed.coverImage === 'string') setCoverImage(parsed.coverImage);
        if (typeof parsed.mediaUrl === 'string') setMediaUrl(parsed.mediaUrl);
        if (typeof parsed.documentTitle === 'string') setDocumentTitle(parsed.documentTitle);
        if (typeof parsed.apaMode === 'boolean') setApaMode(parsed.apaMode);
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
            apaReferences,
            apaMode,
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
    apaReferences,
    apaMode,
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

  // Automatic version snapshot every 3 minutes while actively editing
  useEffect(() => {
    const interval = setInterval(() => {
      saveRevisionSnapshot('Respaldo automático');
    }, 180000);
    return () => clearInterval(interval);
  });

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

  const handleUploadMultipleGallery = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    const list = Array.from(files).slice(0, 20);
    const folder = `posts/${firebaseUser?.uid || 'anon'}`;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      setUploadingInfo(`Subiendo foto ${i + 1} de ${list.length}...`);
      setUploadProgress(Math.round(((i + 0.1) / list.length) * 100));
      try {
        const res = await uploadMediaAsset(
          f,
          folder,
          (pct) => {
            const overall = Math.round(((i + pct / 100) / list.length) * 100);
            setUploadProgress(overall);
          },
          'gallery'
        );
        setGalleryItems((prev) => [
          ...prev,
          { id: generateId('gal'), url: res.url, alt: f.name, caption: '', credit: '' },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : `No se pudo subir ${f.name}`);
      }
    }
    setUploadingInfo(`${list.length} imagen(es) procesadas.`);
    setTimeout(() => setUploadProgress(null), 800);
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

  const coverMeta = useMemo(() => parseMediaUrlMeta(coverImage), [coverImage]);

  const handleCoverFocalClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!coverImage.trim()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const fpX = Math.max(5, Math.min(95, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
    const fpY = Math.max(5, Math.min(95, Math.round(((e.clientY - rect.top) / rect.height) * 100)));
    setCoverImage(encodeMediaUrlWithMeta(coverImage, { fpX, fpY }));
  };

  const handleSave = async (requestedStatus: PostStatus) => {
    setError('');
    setNotice('');
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
    const cleanedApaRefs = apaReferences
      .filter((r) => r.author.trim() || r.title.trim())
      .slice(0, 60)
      .map((r) => ({
        id: r.id,
        author: r.author.trim().slice(0, 220),
        year: r.year.trim().slice(0, 20),
        title: r.title.trim().slice(0, 300),
        publisher: r.publisher.trim().slice(0, 200),
        ...(sanitizeExternalUrl(r.url || '') ? { url: sanitizeExternalUrl(r.url || '').slice(0, 500) } : {}),
        ...(r.accessDate?.trim() ? { accessDate: r.accessDate.trim().slice(0, 60) } : {}),
        formatted: buildApaReferenceString(r).slice(0, 900),
      }));
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
      apaMode: Boolean(apaMode),
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
      setOrClearOptional(target, 'apaReferences', cleanedApaRefs.length > 0 ? stripUndefinedDeep(cleanedApaRefs) : [], isEdit);
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
      apaMode: Boolean(apaMode),
      showTableOfContents: Boolean(showTableOfContents),
      ...(cleanedApaRefs.length > 0 ? { apaReferences: cleanedApaRefs } : {}),
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

        // Normalización segura en update: eliminar claves heredadas fuera de hasOnly y completar faltantes de hasAll
        for (const key of Object.keys(existingRaw)) {
          if (!POST_ALLOWED_KEYS_SET.has(key)) {
            updatePayload[key] = deleteField();
          }
        }
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
                <input type="checkbox" checked={apaMode} onChange={(e) => setApaMode(e.target.checked)} />
                <span>Modo académico / citas APA 7 (citas, figuras y bibliografía)</span>
              </label>
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

          {/* Cover Image with optimization & Focal Point Picker */}
          <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-xs font-bold uppercase tracking-wider">
                {type === 'infographic' ? 'Imagen principal de la infografía (alta nitidez)' : 'Imagen de portada'}
              </span>
              <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black text-xs font-display font-bold uppercase cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Subir y optimizar</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadAsset(f, 'cover');
                  }}
                />
              </label>
            </div>
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
                placeholder="Texto alternativo (accesibilidad)"
                className="px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
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

            {/* Sensitive Content Option */}
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

          {/* Video / Audio / Document Main Media Field + Enhanced Audio/Video Options */}
          {(type === 'video' || type === 'audio' || type === 'document') && (
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-xs font-bold uppercase tracking-wider">
                  {type === 'video'
                    ? 'Fuente de video (YouTube, Vimeo o archivo MP4)'
                    : type === 'audio'
                    ? 'Archivo o URL de audio / pódcast (MP3, Spotify, SoundCloud)'
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
                      if (type === 'document') handleUploadDocument(f, 'post');
                      else handleUploadAsset(f, 'media');
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
                    ? 'https://www.youtube.com/watch?v=... o https://vimeo.com/...'
                    : type === 'audio'
                    ? 'https://.../episodio.mp3, Spotify o SoundCloud'
                    : 'https://.../documento.pdf'
                }
                className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              />

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
                                if (f) handleUploadSubtitleFile(f);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Interactive Chapters */}
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

                  {/* Related links inside player */}
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
          )}

          {/* Gallery Builder with Multi-upload */}
          {type === 'gallery' && (
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-xs font-bold uppercase tracking-wider">
                  Fotografías de la galería ({galleryItems.length})
                </span>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black text-xs font-display font-bold uppercase cursor-pointer">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Subir una o varias fotos</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleUploadMultipleGallery(e.target.files)}
                    />
                  </label>
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
              </div>
              {galleryItems.map((g, idx) => (
                <div key={g.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2 border-t border-neutral-200 dark:border-neutral-800 pt-2">
                  <input
                    type="text"
                    value={g.url}
                    onChange={(e) =>
                      setGalleryItems((prev) => prev.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x)))
                    }
                    placeholder="URL de imagen"
                    className="px-2 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                  <input
                    type="text"
                    value={g.caption}
                    onChange={(e) =>
                      setGalleryItems((prev) => prev.map((x, i) => (i === idx ? { ...x, caption: e.target.value } : x)))
                    }
                    placeholder="Pie de foto"
                    className="px-2 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                  <input
                    type="text"
                    value={g.credit}
                    onChange={(e) =>
                      setGalleryItems((prev) => prev.map((x, i) => (i === idx ? { ...x, credit: e.target.value } : x)))
                    }
                    placeholder="Crédito"
                    className="px-2 py-1.5 rounded-lg bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setGalleryItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-xs text-red-600 font-display uppercase font-bold cursor-pointer"
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
              <div key={block.id} className="rounded-xl border border-neutral-300 dark:border-neutral-800 p-3.5 space-y-2.5 bg-[#F8F6F1]/50 dark:bg-[#181818]">
                <div className="flex items-center justify-between gap-2 text-xs font-display uppercase tracking-wider">
                  <span className="font-bold text-[var(--editorial-primary)]">
                    {idx + 1}. {block.type === 'paragraph' && 'Párrafo'}
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
                    {block.type === 'social_embed' && 'Incrustación social'}
                  </span>
                  <div className="flex items-center gap-1">
                    {block.type === 'paragraph' && (
                      <button
                        type="button"
                        onClick={() =>
                          setBlocks((prev) =>
                            prev.map((b, i) =>
                              i === idx ? { ...b, text: `${b.text || ''} (Apellido, Año)`.trimStart() } : b
                            )
                          )
                        }
                        title="Insertar cita APA en el texto"
                        className="px-2 py-0.5 rounded border border-neutral-300 dark:border-neutral-700 text-[10px] font-bold hover:border-[var(--editorial-primary)] cursor-pointer mr-1"
                      >
                        + (Cita APA)
                      </button>
                    )}
                    <button type="button" onClick={() => moveBlock(idx, -1)} aria-label="Subir bloque" className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => moveBlock(idx, 1)} aria-label="Bajar bloque" className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setBlocks((prev) => prev.filter((_, i) => i !== idx))}
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
                      setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, text: e.target.value } : b)))
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
                          prev.map((b, i) => (i === idx ? { ...b, level: Number(e.target.value) as 2 | 3 | 4 } : b))
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
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, text: e.target.value } : b)))
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
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, text: e.target.value } : b)))
                      }
                      placeholder="Texto de la cita destacada (en modo APA, >40 palabras se formatea como cita en bloque)..."
                      className="w-full p-2.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-sm italic"
                    />
                    <input
                      type="text"
                      value={block.author || ''}
                      onChange={(e) =>
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, author: e.target.value } : b)))
                      }
                      placeholder="Autoría o referencia APA (ej. Apellido, 2024, p. 18)"
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
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, text: e.target.value } : b)))
                      }
                      placeholder="Declaración textual de la persona..."
                      className="w-full p-2.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-sm"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={block.author || ''}
                        onChange={(e) =>
                          setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, author: e.target.value } : b)))
                        }
                        placeholder="Nombre completo"
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                      />
                      <input
                        type="text"
                        value={block.speakerRole || ''}
                        onChange={(e) =>
                          setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, speakerRole: e.target.value } : b)))
                        }
                        placeholder="Cargo o rol"
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                      />
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={block.imageUrl || ''}
                          onChange={(e) =>
                            setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, imageUrl: e.target.value } : b)))
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
                              if (f) handleUploadAsset(f, block.id);
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
                              i === idx ? { ...b, calloutTone: e.target.value as 'info' | 'key_fact' | 'warning' } : b
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
                          setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, calloutTitle: e.target.value } : b)))
                        }
                        placeholder="Título del recuadro"
                        className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
                      />
                    </div>
                    <textarea
                      rows={3}
                      value={block.text || ''}
                      onChange={(e) =>
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, text: e.target.value } : b)))
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
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, calloutTitle: e.target.value } : b)))
                      }
                      placeholder="Título de la caja de contexto"
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
                    />
                    <textarea
                      rows={3}
                      value={block.text || ''}
                      onChange={(e) =>
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, text: e.target.value } : b)))
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
                              i === idx
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
                              i === idx
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
                                  i === idx
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
                                  i === idx
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
                                prev.map((b, i) => (i === idx ? { ...b, beforeImageUrl: e.target.value } : b))
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
                                if (f) handleUploadAsset(f, { blockId: block.id, field: 'beforeImageUrl' });
                              }}
                            />
                          </label>
                        </div>
                        <input
                          type="text"
                          value={block.beforeLabel || ''}
                          onChange={(e) =>
                            setBlocks((prev) =>
                              prev.map((b, i) => (i === idx ? { ...b, beforeLabel: e.target.value } : b))
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
                                prev.map((b, i) => (i === idx ? { ...b, afterImageUrl: e.target.value } : b))
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
                                if (f) handleUploadAsset(f, { blockId: block.id, field: 'afterImageUrl' });
                              }}
                            />
                          </label>
                        </div>
                        <input
                          type="text"
                          value={block.afterLabel || ''}
                          onChange={(e) =>
                            setBlocks((prev) =>
                              prev.map((b, i) => (i === idx ? { ...b, afterLabel: e.target.value } : b))
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
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, text: e.target.value } : b)))
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
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, text: e.target.value } : b)))
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
                                i === idx
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
                                i === idx
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
                                i === idx
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
                                i === idx
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
                            i === idx
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
                      <span className="text-xs text-neutral-500">
                        Diapositivas: {(block.carouselItems || []).length}
                      </span>
                      <div className="flex gap-2">
                        <label className="px-3 py-1 rounded-full bg-[#111111] text-white text-[11px] font-display font-bold uppercase cursor-pointer">
                          + Subir foto
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadAsset(f, { blockId: block.id, carouselAdd: true });
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setBlocks((prev) =>
                              prev.map((b, i) =>
                                i === idx
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
                                i === idx
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
                          className="sm:col-span-4 px-2 py-1 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                        />
                        <input
                          type="text"
                          value={item.caption}
                          onChange={(e) =>
                            setBlocks((prev) =>
                              prev.map((b, i) =>
                                i === idx
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
                          className="sm:col-span-4 px-2 py-1 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                        />
                        <input
                          type="text"
                          value={item.credit}
                          onChange={(e) =>
                            setBlocks((prev) =>
                              prev.map((b, i) =>
                                i === idx
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
                          className="sm:col-span-3 px-2 py-1 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setBlocks((prev) =>
                              prev.map((b, i) =>
                                i === idx
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
                          i === idx
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
                            i === idx ? { ...b, listStyle: e.target.value as 'unordered' | 'ordered' } : b
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
                          prev.map((b, i) =>
                            i === idx ? { ...b, listItems: e.target.value.split('\n') } : b
                          )
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
                          setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, documentUrl: e.target.value } : b)))
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
                            if (f) handleUploadDocument(f, block.id);
                          }}
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={block.documentTitle || ''}
                        onChange={(e) =>
                          setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, documentTitle: e.target.value } : b)))
                        }
                        placeholder="Nombre del documento"
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                      />
                      <input
                        type="text"
                        value={block.documentDescription || ''}
                        onChange={(e) =>
                          setBlocks((prev) =>
                            prev.map((b, i) => (i === idx ? { ...b, documentDescription: e.target.value } : b))
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
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={block.imageUrl || ''}
                        onChange={(e) =>
                          setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, imageUrl: e.target.value } : b)))
                        }
                        placeholder="URL de imagen"
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                      />
                      <label className="px-3 py-1.5 rounded-full bg-[#111111] text-white text-xs font-display font-bold uppercase cursor-pointer">
                        Subir
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadAsset(f, block.id);
                          }}
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={block.imageCaption || ''}
                        onChange={(e) =>
                          setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, imageCaption: e.target.value } : b)))
                        }
                        placeholder="Pie de foto o nota de figura"
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                      />
                      <input
                        type="text"
                        value={block.imageCredit || ''}
                        onChange={(e) =>
                          setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, imageCredit: e.target.value } : b)))
                        }
                        placeholder="Crédito y texto alternativo"
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
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, text: e.target.value } : b)))
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
                                i === idx
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
                                i === idx
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
                                i === idx
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
                            i === idx
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
                          setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, text: e.target.value } : b)))
                        }
                        placeholder="Título de la tabla"
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
                      />
                      <input
                        type="text"
                        value={block.tableCaption || ''}
                        onChange={(e) =>
                          setBlocks((prev) =>
                            prev.map((b, i) => (i === idx ? { ...b, tableCaption: e.target.value } : b))
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
                            i === idx
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
                            i === idx
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={block.embedPlatform || ''}
                      onChange={(e) =>
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, embedPlatform: e.target.value } : b)))
                      }
                      placeholder="Plataforma (X, Instagram, YouTube...)"
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                    />
                    <input
                      type="url"
                      value={block.embedUrl || ''}
                      onChange={(e) =>
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, embedUrl: e.target.value } : b)))
                      }
                      placeholder="https://..."
                      className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                    />
                  </div>
                )}
              </div>
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

          {/* APA 7 Bibliographic References Assistant */}
          <div className="space-y-3 border-t border-neutral-300 dark:border-neutral-800 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider">
                <BookMarked className="w-3.5 h-3.5 text-[var(--editorial-primary)]" />
                Referencias bibliográficas APA 7 ({apaReferences.length})
              </span>
              <button
                type="button"
                disabled={apaReferences.length >= 60}
                onClick={() =>
                  setApaReferences((prev) => [
                    ...prev,
                    { id: generateId('apa'), author: '', year: '', title: '', publisher: '', url: '' },
                  ])
                }
                className="px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase cursor-pointer"
              >
                + Añadir referencia APA
              </button>
            </div>
            {apaReferences.map((ref, idx) => (
              <div key={ref.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 space-y-2 bg-[#F8F6F1]/50 dark:bg-[#181818]">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={ref.author}
                    onChange={(e) =>
                      setApaReferences((prev) => prev.map((x, i) => (i === idx ? { ...x, author: e.target.value } : x)))
                    }
                    placeholder="Autor (ej. Fals Borda, O.)"
                    className="sm:col-span-5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                  <input
                    type="text"
                    value={ref.year}
                    onChange={(e) =>
                      setApaReferences((prev) => prev.map((x, i) => (i === idx ? { ...x, year: e.target.value } : x)))
                    }
                    placeholder="Año (ej. 2024)"
                    className="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                  <input
                    type="text"
                    value={ref.publisher}
                    onChange={(e) =>
                      setApaReferences((prev) => prev.map((x, i) => (i === idx ? { ...x, publisher: e.target.value } : x)))
                    }
                    placeholder="Editorial / Revista / Institución"
                    className="sm:col-span-4 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setApaReferences((prev) => prev.filter((_, i) => i !== idx))}
                    className="sm:col-span-1 text-xs text-red-600 font-bold cursor-pointer"
                  >
                    Quitar
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={ref.title}
                    onChange={(e) =>
                      setApaReferences((prev) => prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))
                    }
                    placeholder="Título del libro, artículo o informe"
                    className="sm:col-span-6 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                  <input
                    type="url"
                    value={ref.url || ''}
                    onChange={(e) =>
                      setApaReferences((prev) => prev.map((x, i) => (i === idx ? { ...x, url: e.target.value } : x)))
                    }
                    placeholder="URL o DOI (opcional)"
                    className="sm:col-span-4 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                  <input
                    type="text"
                    value={ref.accessDate || ''}
                    onChange={(e) =>
                      setApaReferences((prev) => prev.map((x, i) => (i === idx ? { ...x, accessDate: e.target.value } : x)))
                    }
                    placeholder="Consulta (opc.)"
                    className="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                </div>
                <p className="text-[11px] text-neutral-500 italic">
                  Vista APA: {buildApaReferenceString(ref)}
                </p>
              </div>
            ))}
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

        {/* Live Split Preview with Viewport Switcher */}
        {showPreview && (
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
                  className={`p-1.5 rounded-full cursor-pointer ${previewViewport === 'desktop' ? 'bg-[#111111] text-white dark:bg-white dark:text-black' : 'text-neutral-500'}`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewport('tablet')}
                  aria-label="Vista tableta"
                  className={`p-1.5 rounded-full cursor-pointer ${previewViewport === 'tablet' ? 'bg-[#111111] text-white dark:bg-white dark:text-black' : 'text-neutral-500'}`}
                >
                  <Tablet className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewport('mobile')}
                  aria-label="Vista móvil"
                  className={`p-1.5 rounded-full cursor-pointer ${previewViewport === 'mobile' ? 'bg-[#111111] text-white dark:bg-white dark:text-black' : 'text-neutral-500'}`}
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
                <div className={type === 'infographic' ? 'overflow-hidden rounded-xl bg-neutral-900' : 'aspect-[16/9] rounded-xl overflow-hidden bg-neutral-900'}>
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
              {subtitle && <p className={`text-base text-neutral-600 dark:text-neutral-300 ${headerStyle === 'minimal' ? 'text-center' : ''}`}>{subtitle}</p>}
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
                    {b.type === 'divider' && <hr className="my-4 border-neutral-300 dark:border-neutral-700 w-1/3 mx-auto" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
