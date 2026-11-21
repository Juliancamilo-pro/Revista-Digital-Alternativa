import React, { useEffect, useMemo, useState } from 'react';
import { doc, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  ArrowDown,
  ArrowUp,
  Eye,
  FileText,
  Image as ImageIcon,
  Plus,
  Save,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { db } from '../lib/firebase';
import { estimateReadTime, generateId, slugify, toDate, uploadMediaAsset } from '../lib/utils';
import {
  ContentBlock,
  ContentBlockType,
  CorrectionEntry,
  EditorialKind,
  GalleryItem,
  Post,
  PostStatus,
  PostType,
} from '../types/editorial';
import { EditorialImage } from './EditorialImage';

interface BlockEditorProps {
  initialPost?: Post | null;
  onSaved: (post: Post) => void;
  onCancel: () => void;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({ initialPost, onSaved, onCancel }) => {
  const { firebaseUser, userAccount, collaboratorProfile, isAdmin } = useAuth();
  const { siteConfig, categories, seriesList, publishedPosts } = useSite();

  const draftStorageKey = `revista_draft_${initialPost?.id || 'new'}`;

  const [title, setTitle] = useState(initialPost?.title || '');
  const [subtitle, setSubtitle] = useState(initialPost?.subtitle || '');
  const [type, setType] = useState<PostType>(initialPost?.type || 'article');
  const [editorialKind, setEditorialKind] = useState<EditorialKind>(initialPost?.editorialKind || 'articulo');
  const [categoryId, setCategoryId] = useState(initialPost?.categoryId || categories[0]?.id || 'cat_politica');
  const [seriesId, setSeriesId] = useState(initialPost?.seriesId || '');
  const [tags, setTags] = useState<string[]>(initialPost?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [coverImage, setCoverImage] = useState(initialPost?.coverImage || '');
  const [coverAlt, setCoverAlt] = useState(initialPost?.coverAlt || '');
  const [coverCredit, setCoverCredit] = useState(initialPost?.coverCredit || '');
  const [mediaUrl, setMediaUrl] = useState(initialPost?.mediaUrl || '');
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(initialPost?.galleryItems || []);
  const [corrections, setCorrections] = useState<CorrectionEntry[]>(initialPost?.corrections || []);
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
        if (Array.isArray(parsed.blocks) && parsed.blocks.length > 0) setBlocks(parsed.blocks);
        if (Array.isArray(parsed.tags)) setTags(parsed.tags);
        if (typeof parsed.coverImage === 'string') setCoverImage(parsed.coverImage);
        if (typeof parsed.mediaUrl === 'string') setMediaUrl(parsed.mediaUrl);
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
          JSON.stringify({ title, subtitle, blocks, tags, coverImage, mediaUrl })
        );
        setAutoSavedAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
      } catch {
        // ignore quota errors
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [title, subtitle, blocks, tags, coverImage, mediaUrl, draftStorageKey]);

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

  const handleUploadAsset = async (file: File, target: 'cover' | 'media' | 'gallery' | string) => {
    setError('');
    setUploadingInfo('Optimizando y subiendo archivo...');
    try {
      const res = await uploadMediaAsset(file, `posts/${firebaseUser?.uid || 'anon'}`);
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

    const rawAuthorName = (
      initialPost?.authorName ||
      collaboratorProfile?.name ||
      userAccount?.displayName ||
      firebaseUser.displayName ||
      'Redacción'
    )
      .trim()
      .slice(0, 120);
    const safeAuthorName = rawAuthorName.length >= 2 ? rawAuthorName : 'Redacción';

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
      authorName: safeAuthorName,
      ...(collaboratorProfile?.avatarUrl || initialPost?.authorAvatar
        ? { authorAvatar: (collaboratorProfile?.avatarUrl || initialPost?.authorAvatar || '').slice(0, 400000) }
        : {}),
      authorOutletType:
        initialPost?.authorOutletType || collaboratorProfile?.outletType || 'independiente',
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
      ...(mediaUrl ? { mediaUrl: mediaUrl.slice(0, 400000) } : {}),
      ...(type === 'video' || type === 'audio' ? { mediaSourceType: type } : {}),
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
      if (!initialPost && collaboratorProfile) {
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
    <div className="border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 sm:p-8 space-y-6">
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
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-neutral-400 dark:border-neutral-700 font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
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

      {error && (
        <div role="alert" className="p-3 border border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className={`grid gap-8 ${showPreview ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Editor Column */}
        <div className="space-y-5">
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
                {initialPost?.type === 'livestream' && (
                  <option value="livestream">Archivo en vivo (VOD)</option>
                )}
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
              className="w-full px-3 py-2.5 bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 font-display text-xl font-bold"
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
              className="w-full px-3 py-2 bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
            />
          </div>

          {/* Cover Image with optimization */}
          <div className="border border-neutral-300 dark:border-neutral-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-xs font-bold uppercase tracking-wider">Imagen de portada</span>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#111111] dark:bg-white text-white dark:text-black text-xs font-display font-bold uppercase cursor-pointer">
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
                className="px-3 py-2 bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <input
                type="text"
                value={coverAlt}
                onChange={(e) => setCoverAlt(e.target.value)}
                placeholder="Texto alternativo (accesibilidad)"
                className="px-3 py-2 bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <input
                type="text"
                value={coverCredit}
                onChange={(e) => setCoverCredit(e.target.value)}
                placeholder="Crédito fotográfico"
                className="px-3 py-2 bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
            </div>
          </div>

          {/* Video / Audio Media Field */}
          {(type === 'video' || type === 'audio') && (
            <div className="border border-neutral-300 dark:border-neutral-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-xs font-bold uppercase tracking-wider">
                  {type === 'video' ? 'Fuente de video (YouTube, Vimeo o archivo)' : 'Archivo o URL de audio / pódcast'}
                </span>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-400 text-xs font-display font-bold uppercase cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir archivo</span>
                  <input
                    type="file"
                    accept={type === 'video' ? 'video/*' : 'audio/*'}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadAsset(f, 'media');
                    }}
                  />
                </label>
              </div>
              <input
                type="text"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder={type === 'video' ? 'https://www.youtube.com/watch?v=...' : 'https://.../episodio.mp3'}
                className="w-full px-3 py-2 bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              />
            </div>
          )}

          {/* Gallery Builder */}
          {type === 'gallery' && (
            <div className="border border-neutral-300 dark:border-neutral-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-xs font-bold uppercase tracking-wider">
                  Fotografías de la galería ({galleryItems.length})
                </span>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#111111] dark:bg-white text-white dark:text-black text-xs font-display font-bold uppercase cursor-pointer">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Agregar foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadAsset(f, 'gallery');
                      }}
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
                    className="px-3 py-1.5 border border-neutral-400 text-xs font-display font-bold uppercase cursor-pointer"
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
                    className="px-2 py-1.5 bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                  <input
                    type="text"
                    value={g.caption}
                    onChange={(e) =>
                      setGalleryItems((prev) => prev.map((x, i) => (i === idx ? { ...x, caption: e.target.value } : x)))
                    }
                    placeholder="Pie de foto"
                    className="px-2 py-1.5 bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                  <input
                    type="text"
                    value={g.credit}
                    onChange={(e) =>
                      setGalleryItems((prev) => prev.map((x, i) => (i === idx ? { ...x, credit: e.target.value } : x)))
                    }
                    placeholder="Crédito"
                    className="px-2 py-1.5 bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
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

          {/* Block Editor Canvas */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-xs font-bold uppercase tracking-wider">
                Bloques del cuerpo ({blocks.length}) — Usa **negritas**, *cursivas*, [texto](https://enlace) y [1] para notas al pie
              </span>
            </div>

            {blocks.map((block, idx) => (
              <div key={block.id} className="border border-neutral-300 dark:border-neutral-800 p-3.5 space-y-2.5 bg-[#F8F6F1]/50 dark:bg-[#181818]">
                <div className="flex items-center justify-between gap-2 text-xs font-display uppercase tracking-wider">
                  <span className="font-bold text-[var(--editorial-primary)]">
                    {idx + 1}. {block.type === 'paragraph' && 'Párrafo'}
                    {block.type === 'heading' && 'Subtítulo'}
                    {block.type === 'quote' && 'Cita destacada'}
                    {block.type === 'image' && 'Imagen intercalada'}
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
                    className="w-full p-2.5 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-sm"
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
                      className="px-2 py-2 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
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
                      className="flex-1 px-3 py-2 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 font-display text-lg font-bold"
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
                      className="w-full p-2.5 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-sm italic"
                    />
                    <input
                      type="text"
                      value={block.author || ''}
                      onChange={(e) =>
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, author: e.target.value } : b)))
                      }
                      placeholder="Autoría de la cita (opcional)"
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                    />
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
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                      />
                      <label className="px-3 py-1.5 bg-[#111111] text-white text-xs font-display font-bold uppercase cursor-pointer">
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
                        className="px-3 py-1.5 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                      />
                      <input
                        type="text"
                        value={block.imageCredit || ''}
                        onChange={(e) =>
                          setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, imageCredit: e.target.value } : b)))
                        }
                        placeholder="Crédito y texto alternativo"
                        className="px-3 py-1.5 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
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
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
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
                          className="px-2 py-1 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
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
                          className="px-2 py-1 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
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
                          className="px-2 py-1 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
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
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-bold"
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
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
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
                      className="w-full p-2 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs font-tabular"
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
                      className="px-3 py-1.5 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
                    />
                    <input
                      type="url"
                      value={block.embedUrl || ''}
                      onChange={(e) =>
                        setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, embedUrl: e.target.value } : b)))
                      }
                      placeholder="https://..."
                      className="sm:col-span-2 px-3 py-1.5 bg-white dark:bg-[#111111] border border-neutral-300 dark:border-neutral-700 text-xs"
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
                  ['image', 'Imagen'],
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
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-[var(--editorial-primary)]" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
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
                className="flex-1 px-3 py-2 bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              />
              <button
                type="button"
                onClick={() => addTag(tagInput)}
                className="px-4 py-2 border border-neutral-400 font-display text-xs font-bold uppercase cursor-pointer"
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
          <div className="border border-neutral-300 dark:border-neutral-800 bg-[#F8F6F1] dark:bg-[#0D0D0D] p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
              Vista previa editorial
            </p>
            {coverImage && (
              <div className="aspect-[16/9] overflow-hidden bg-neutral-900">
                <EditorialImage src={coverImage} alt={coverAlt || title} fallbackTitle={title} />
              </div>
            )}
            <h1 className="font-display text-3xl font-extrabold leading-tight">
              {title || 'Titular de la publicación'}
            </h1>
            {subtitle && <p className="text-base text-neutral-600 dark:text-neutral-300">{subtitle}</p>}
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
