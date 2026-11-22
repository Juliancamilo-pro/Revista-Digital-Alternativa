import React, { useEffect, useMemo, useState } from 'react';
import { doc, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  ArrowDown,
  ArrowUp,
  Crosshair,
  Eye,
  FileText,
  Image as ImageIcon,
  ListChecks,
  Plus,
  Save,
  Send,
  ShieldAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { db } from '../lib/firebase';
import {
  encodeMediaUrlWithMeta,
  estimateReadTime,
  generateId,
  parseMediaUrlMeta,
  sanitizeExternalUrl,
  slugify,
  toDate,
  uploadDocumentAsset,
  uploadMediaAsset,
} from '../lib/utils';
import {
  AdminIdentityId,
  ContentBlock,
  ContentBlockType,
  CorrectionEntry,
  EditorialKind,
  GalleryItem,
  Post,
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

export const BlockEditor: React.FC<BlockEditorProps> = ({ initialPost, onSaved, onCancel }) => {
  const { firebaseUser, userAccount, collaboratorProfile, isAdmin } = useAuth();
  const { siteConfig, categories, seriesList, publishedPosts, adminIdentities } = useSite();

  const draftStorageKey = `revista_draft_${initialPost?.id || 'new'}`;

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

  const [coverImage, setCoverImage] = useState(initialPost?.coverImage || '');
  const [coverAlt, setCoverAlt] = useState(initialPost?.coverAlt || '');
  const [coverCredit, setCoverCredit] = useState(initialPost?.coverCredit || '');
  const [mediaUrl, setMediaUrl] = useState(initialPost?.mediaUrl || '');
  const [documentTitle, setDocumentTitle] = useState(initialPost?.documentTitle || '');
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
  const [uploadingInfo, setUploadingInfo] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<string>('');
  const [error, setError] = useState('');

  // Sync categoryId if categories load after mount and current selection is missing
  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.id === categoryId)) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  // Restore unsaved local draft for new posts
  useEffect(() => {
    if (initialPost) return;
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
  }, [initialPost, draftStorageKey]);

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
    target: 'cover' | 'media' | 'gallery' | string
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
      ...(bType === 'list' ? { listStyle: 'unordered' as const, listItems: ['Primer punto'] } : {}),
      ...(bType === 'document' ? { documentUrl: '', documentTitle: '', documentDescription: '' } : {}),
      ...(bType === 'timeline'
        ? { timelineEntries: [{ date: '2026', title: 'Hito', detail: '' }] }
        : {}),
      ...(bType === 'table'
        ? { tableHeaders: ['Columna 1', 'Columna 2'], tableRows: [['Dato 1', 'Dato 2']] }
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

    // Enforce optional review queue for collaborators if configured by admin
    let finalStatus: PostStatus = requestedStatus;
    if (!isAdmin && requestedStatus === 'published' && !siteConfig.autoPublishCollaborators) {
      finalStatus = 'in_review';
    }

    const ser = seriesList.find((s) => s.id === seriesId);
    const id = initialPost?.id || generateId('post');
    const slug = initialPost?.slug || `${slugify(title)}-${id.slice(-4)}`;
    const readTime = estimateReadTime(blocks, subtitle);
    const cleanTags = tags.length > 0 ? tags : [cat.slug];

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
        initialPost?.authorName ||
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
      safeAuthorOutlet = collaboratorProfile?.outletType || initialPost?.authorOutletType || 'independiente';
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

    const payload: Record<string, unknown> = {
      id,
      title: title.trim().slice(0, 220),
      slug: slug.slice(0, 240),
      subtitle: subtitle.trim().slice(0, 500),
      type,
      editorialKind,
      status: finalStatus,
      featured: isAdmin ? featured : initialPost?.featured || false,
      breaking: isAdmin ? breaking : initialPost?.breaking || false,
      isSample: false,
      categoryId: cat.id,
      categoryName: cat.name.slice(0, 80),
      categorySlug: cat.slug.slice(0, 100),
      ...(ser ? { seriesId: ser.id, seriesTitle: ser.title.slice(0, 160) } : {}),
      tags: cleanTags.slice(0, 12),
      authorId: initialPost?.authorId || firebaseUser.uid,
      authorProfileId,
      authorIdentityType,
      authorVerified: true,
      authorName: safeAuthorName,
      ...(safeAuthorAvatar ? { authorAvatar: safeAuthorAvatar } : {}),
      authorOutletType: safeAuthorOutlet,
      ...(coverImage ? { coverImage: coverImage.slice(0, 400000) } : {}),
      ...(coverAlt ? { coverAlt: coverAlt.slice(0, 300) } : {}),
      ...(coverCredit ? { coverCredit: coverCredit.slice(0, 200) } : {}),
      blocks: blocks.slice(0, 80),
      ...(galleryItems.length > 0 ? { galleryItems: galleryItems.slice(0, 30) } : {}),
      ...(corrections.filter((c) => c.note.trim()).length > 0
        ? {
            corrections: corrections
              .filter((c) => c.note.trim())
              .slice(0, 30)
              .map((c) => ({
                date: c.date.trim() || new Date().toLocaleDateString('es-ES'),
                note: c.note.trim(),
                editorName: c.editorName.trim() || userAccount?.displayName || 'Redacción',
              })),
          }
        : {}),
      ...(cleanedKeyPoints.length > 0 ? { keyPoints: cleanedKeyPoints } : {}),
      sensitiveContent: Boolean(sensitiveContent),
      ...(sensitiveContent && sensitiveWarning.trim()
        ? { sensitiveWarning: sensitiveWarning.trim().slice(0, 300) }
        : {}),
      ...(cleanedSources.length > 0 ? { sources: cleanedSources } : {}),
      ...(seoDescription.trim() ? { seoDescription: seoDescription.trim().slice(0, 320) } : {}),
      commentsEnabled,
      ...(mediaUrl ? { mediaUrl: mediaUrl.slice(0, 400000) } : {}),
      ...(type === 'video' || type === 'audio' || type === 'document' ? { mediaSourceType: type } : {}),
      ...(type === 'document' && documentTitle.trim() ? { documentTitle: documentTitle.trim().slice(0, 200) } : {}),
      readTimeMinutes: readTime,
      viewCount: initialPost?.viewCount ?? 0,
      commentCount: initialPost?.commentCount ?? 0,
      ...(finalStatus === 'published' ? { publishedAt: initialPost?.publishedAt || serverTimestamp() } : {}),
      ...(finalStatus === 'scheduled' && scheduledForInput
        ? { scheduledFor: new Date(scheduledForInput) }
        : {}),
      createdAt: initialPost?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    setSaving(true);
    try {
      await setDoc(doc(db, 'posts', id), payload, { merge: false });
      if (!initialPost && collaboratorProfile && !isAdmin) {
        await updateDoc(doc(db, 'collaborators_public', firebaseUser.uid), {
          postCount: increment(1),
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);
      }
      localStorage.removeItem(draftStorageKey);
      onSaved(payload as unknown as Post);
    } catch (err) {
      console.error('Error guardando publicación:', err);
      setError(
        err instanceof Error && !err.message.startsWith('{')
          ? err.message
          : 'No se pudo guardar la publicación. Verifica los campos y tus permisos editoriales.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-300 dark:border-neutral-800 pb-4">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
            {initialPost ? 'Editar publicación' : 'Nueva publicación multimedia'}
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            {autoSavedAt ? `Borrador guardado localmente a las ${autoSavedAt}` : 'Guardado automático de borrador activo'}
            {uploadingInfo ? ` · ${uploadingInfo}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

      {error && (
        <div role="alert" className="rounded-xl p-3 border border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm">
          {error}
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

          {/* Video / Audio / Document Main Media Field */}
          {(type === 'video' || type === 'audio' || type === 'document') && (
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-xs font-bold uppercase tracking-wider">
                  {type === 'video'
                    ? 'Fuente de video (YouTube, Vimeo o archivo)'
                    : type === 'audio'
                    ? 'Archivo o URL de audio / pódcast'
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
                  placeholder="Título del documento descargable (ej. Informe completo de contratación pública 2026)"
                  className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                />
              )}
              <input
                type="text"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder={
                  type === 'video'
                    ? 'https://www.youtube.com/watch?v=...'
                    : type === 'audio'
                    ? 'https://.../episodio.mp3'
                    : 'https://.../documento.pdf'
                }
                className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              />
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
                    {block.type === 'image' && 'Imagen intercalada'}
                    {block.type === 'callout' && 'Recuadro destacado'}
                    {block.type === 'list' && 'Lista'}
                    {block.type === 'document' && 'Documento / PDF adjunto'}
                    {block.type === 'footnote' && `Nota al pie [${block.footnoteNumber || 1}]`}
                    {block.type === 'timeline' && 'Línea de tiempo'}
                    {block.type === 'table' && 'Tabla de datos'}
                    {block.type === 'divider' && 'Separador'}
                    {block.type === 'social_embed' && 'Incrustación social'}
                  </span>
                  <div className="flex items-center gap-1">
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
                          prev.map((b, i) => (i === idx ? { ...b, level: Number(e.target.value) as 2 | 3 } : b))
                        )
                      }
                      className="px-2 py-2 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
                    >
                      <option value={2}>H2</option>
                      <option value={3}>H3</option>
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
                      placeholder="Texto de la cita destacada..."
                      className="w-full p-2.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-sm italic"
                    />
                    <input
                      type="text"
                      value={block.author || ''}
                      onChange={(e) =>
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, author: e.target.value } : b)))
                      }
                      placeholder="Autoría de la cita (opcional)"
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                    />
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
                        placeholder="Pie de foto"
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
                    <input
                      type="text"
                      value={block.text || ''}
                      onChange={(e) =>
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, text: e.target.value } : b)))
                      }
                      placeholder="Título de la tabla"
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
                    />
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
                  ['callout', 'Recuadro'],
                  ['list', 'Lista'],
                  ['image', 'Imagen'],
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
              <div className="flex items-center gap-5 pt-4">
                <label className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase cursor-pointer">
                  <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
                  <span>Nota destacada</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase cursor-pointer">
                  <input type="checkbox" checked={breaking} onChange={(e) => setBreaking(e.target.checked)} />
                  <span>Última hora</span>
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

        {/* Live Split Preview */}
        {showPreview && (
          <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-[#F8F6F1] dark:bg-[#0D0D0D] p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
              Vista previa editorial
            </p>
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
            <h1 className="font-display text-3xl font-extrabold leading-tight">
              {title || 'Titular de la publicación'}
            </h1>
            {subtitle && <p className="text-base text-neutral-600 dark:text-neutral-300">{subtitle}</p>}
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
              {blocks.map((b) => (
                <div key={b.id}>
                  {b.type === 'paragraph' && <p>{b.text}</p>}
                  {b.type === 'heading' && <h2 className="font-display text-2xl font-bold">{b.text}</h2>}
                  {b.type === 'quote' && (
                    <blockquote className="py-3 border-y border-neutral-400 italic text-center">
                      “{b.text}”
                    </blockquote>
                  )}
                  {b.type === 'callout' && (
                    <div className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#141414] p-4 space-y-1">
                      {b.calloutTitle && <p className="font-display text-sm font-bold">{b.calloutTitle}</p>}
                      <p className="text-sm">{b.text}</p>
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
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
