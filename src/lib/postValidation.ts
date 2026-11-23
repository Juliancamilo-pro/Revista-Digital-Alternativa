import type {
  CoverLayoutStyle,
  EditorialKind,
  HeaderStyleVariant,
  OutletType,
  PostStatus,
  PostType,
} from '../types/editorial';

export type AuthorIdentityType = 'owner' | 'magazine' | 'collaborator';

export const FIRESTORE_NAMED_DATABASE_ID = 'ai-studio-d59371ff-9be7-4b64-8860-ce29bd962f51';

export const POST_REQUIRED_KEYS = [
  'id',
  'title',
  'slug',
  'type',
  'status',
  'featured',
  'breaking',
  'isSample',
  'categoryId',
  'categoryName',
  'categorySlug',
  'tags',
  'authorId',
  'authorName',
  'blocks',
  'readTimeMinutes',
  'viewCount',
  'commentCount',
  'createdAt',
  'updatedAt',
] as const;

export const POST_ALLOWED_KEYS = [
  'id',
  'title',
  'slug',
  'subtitle',
  'type',
  'editorialKind',
  'status',
  'featured',
  'breaking',
  'pinnedInFeed',
  'isSample',
  'categoryId',
  'categoryName',
  'categorySlug',
  'seriesId',
  'seriesTitle',
  'tags',
  'authorId',
  'authorProfileId',
  'authorIdentityType',
  'authorVerified',
  'authorName',
  'authorAvatar',
  'authorOutletType',
  'coverImage',
  'coverAlt',
  'coverCredit',
  'coverLayout',
  'headerStyle',
  'accentColor',
  'paragraphIndent',
  'showTableOfContents',
  'blocks',
  'galleryItems',
  'corrections',
  'keyPoints',
  'sensitiveContent',
  'sensitiveWarning',
  'sources',
  'seoDescription',
  'commentsEnabled',
  'mediaUrl',
  'mediaSourceType',
  'mediaChapters',
  'mediaTranscript',
  'mediaSubtitlesUrl',
  'mediaDurationLabel',
  'mediaRelatedLinks',
  'episodeNotes',
  'seasonNumber',
  'episodeNumber',
  'documentTitle',
  'audioDurationSec',
  'readTimeMinutes',
  'viewCount',
  'commentCount',
  'publishedAt',
  'scheduledFor',
  'createdAt',
  'updatedAt',
] as const;

export const POST_ALLOWED_KEYS_SET = new Set<string>(POST_ALLOWED_KEYS);

export const VALID_POST_TYPES: PostType[] = [
  'article',
  'gallery',
  'video',
  'audio',
  'infographic',
  'document',
  'livestream',
];

export const VALID_EDITORIAL_KINDS: EditorialKind[] = [
  'articulo',
  'investigacion',
  'opinion',
  'cronica',
  'analisis',
  'reportaje',
  'multimedia',
  'entrevista',
  'editorial',
  'explicativo',
  'datos',
  'carta',
];

export const VALID_POST_STATUSES: PostStatus[] = [
  'draft',
  'in_review',
  'scheduled',
  'published',
  'unpublished',
];

export const VALID_IDENTITY_TYPES: AuthorIdentityType[] = ['owner', 'magazine', 'collaborator'];
export const VALID_OUTLET_TYPES: OutletType[] = ['medio', 'independiente'];
export const VALID_COVER_LAYOUTS: CoverLayoutStyle[] = ['full', 'compact', 'overlay'];
export const VALID_HEADER_STYLES: HeaderStyleVariant[] = ['classic', 'editorial', 'minimal'];

export function isValidFirestoreId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(value)
  );
}

export function isTimestampLike(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  const obj = value as Record<string, unknown>;
  // Firestore Timestamp instance
  if (typeof obj.toDate === 'function' && typeof obj.toMillis === 'function') return true;
  if (typeof obj.seconds === 'number' && typeof obj.nanoseconds === 'number') return true;
  // Firestore FieldValue sentinel (serverTimestamp)
  if ('_methodName' in obj && obj._methodName === 'serverTimestamp') return true;
  return false;
}

export function isServerTimestampSentinel(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return obj._methodName === 'serverTimestamp';
}

export function isDeleteFieldSentinel(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return obj._methodName === 'deleteField';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    if (!isPlainObject(value)) {
      return value;
    }
    const obj = value as Record<string, unknown>;
    if (
      '_methodName' in obj ||
      (typeof obj.toDate === 'function' && typeof obj.toMillis === 'function')
    ) {
      return value;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

export function estimateUtf8JsonBytes(value: unknown): number {
  try {
    const json = JSON.stringify(value, (_k, v) => {
      if (isDeleteFieldSentinel(v)) return undefined;
      if (isServerTimestampSentinel(v)) return '2026-01-01T00:00:00.000Z';
      return v;
    });
    return new TextEncoder().encode(json || '').length;
  } catch {
    return 0;
  }
}

/**
 * Simula el documento final resultante tras aplicar `updateDoc(patch)` sobre `existingDoc`,
 * resolviendo `deleteField()` igual que Firestore antes de evaluar `isValidPost(incoming())`.
 */
export function mergeExistingAndPatch(
  existingDoc: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = existingDoc ? { ...existingDoc } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (isDeleteFieldSentinel(v)) {
      delete merged[k];
    } else if (v !== undefined) {
      merged[k] = v;
    }
  }
  return merged;
}

export interface PostRulesCheckContext {
  isCreate?: boolean;
  isAdmin?: boolean;
  isActiveCollaborator?: boolean;
  uid?: string;
  autoPublishCollaborators?: boolean;
  existingDoc?: Record<string, unknown> | null;
}

export function validatePostDocumentAgainstRules(
  data: Record<string, unknown>,
  ctx?: PostRulesCheckContext
): string[] {
  const errors: string[] = [];

  // 1. Required fields (hasAll)
  for (const key of POST_REQUIRED_KEYS) {
    if (!(key in data) || data[key] === undefined || data[key] === null) {
      errors.push(`Falta campo obligatorio "${key}"`);
    }
  }

  // 2. Allowlisted fields (hasOnly)
  for (const key of Object.keys(data)) {
    if (!POST_ALLOWED_KEYS_SET.has(key)) {
      errors.push(`Campo no permitido por firestore.rules: "${key}"`);
    }
  }

  // 3. Field types, enums & bounds matching isValidPost(data)
  if (!isValidFirestoreId(data.id)) errors.push('id inválido (solo a-zA-Z0-9_- y <= 128 caracteres)');
  if (typeof data.title !== 'string' || data.title.length < 3 || data.title.length > 220) {
    errors.push('title debe ser texto entre 3 y 220 caracteres');
  }
  if (typeof data.slug !== 'string' || data.slug.length < 2 || data.slug.length > 240) {
    errors.push('slug debe ser texto entre 2 y 240 caracteres');
  }
  if ('subtitle' in data && (typeof data.subtitle !== 'string' || data.subtitle.length > 500)) {
    errors.push('subtitle supera 500 caracteres o no es texto');
  }
  if (!VALID_POST_TYPES.includes(data.type as PostType)) {
    errors.push(`type inválido: ${String(data.type)}`);
  }
  if ('editorialKind' in data && !VALID_EDITORIAL_KINDS.includes(data.editorialKind as EditorialKind)) {
    errors.push(`editorialKind inválido: ${String(data.editorialKind)}`);
  }
  if (!VALID_POST_STATUSES.includes(data.status as PostStatus)) {
    errors.push(`status inválido: ${String(data.status)}`);
  }
  if (typeof data.featured !== 'boolean') errors.push('featured debe ser booleano');
  if (typeof data.breaking !== 'boolean') errors.push('breaking debe ser booleano');
  if ('pinnedInFeed' in data && typeof data.pinnedInFeed !== 'boolean') {
    errors.push('pinnedInFeed debe ser booleano');
  }
  if (typeof data.isSample !== 'boolean') errors.push('isSample debe ser booleano');
  if (!isValidFirestoreId(data.categoryId)) errors.push('categoryId inválido');
  if (typeof data.categoryName !== 'string' || data.categoryName.length > 80) {
    errors.push('categoryName inválido (> 80 caracteres)');
  }
  if (typeof data.categorySlug !== 'string' || data.categorySlug.length > 100) {
    errors.push('categorySlug inválido (> 100 caracteres)');
  }
  if ('seriesId' in data && (typeof data.seriesId !== 'string' || data.seriesId.length > 128)) {
    errors.push('seriesId inválido');
  }
  if ('seriesTitle' in data && (typeof data.seriesTitle !== 'string' || data.seriesTitle.length > 160)) {
    errors.push('seriesTitle supera 160 caracteres');
  }
  if (!Array.isArray(data.tags) || data.tags.length > 12 || (data.tags.length > 0 && typeof data.tags[0] !== 'string')) {
    errors.push('tags debe ser lista de strings con máximo 12 elementos');
  }
  if (!isValidFirestoreId(data.authorId)) errors.push('authorId inválido');
  if ('authorProfileId' in data && (typeof data.authorProfileId !== 'string' || data.authorProfileId.length > 128)) {
    errors.push('authorProfileId inválido');
  }
  if ('authorIdentityType' in data && !VALID_IDENTITY_TYPES.includes(data.authorIdentityType as AuthorIdentityType)) {
    errors.push(`authorIdentityType inválido: ${String(data.authorIdentityType)}`);
  }
  if ('authorVerified' in data && typeof data.authorVerified !== 'boolean') {
    errors.push('authorVerified debe ser booleano');
  }
  if (typeof data.authorName !== 'string' || data.authorName.length < 2 || data.authorName.length > 120) {
    errors.push('authorName debe tener entre 2 y 120 caracteres');
  }
  if ('authorAvatar' in data && (typeof data.authorAvatar !== 'string' || data.authorAvatar.length > 400000)) {
    errors.push('authorAvatar supera 400000 caracteres');
  }
  if ('authorOutletType' in data && !VALID_OUTLET_TYPES.includes(data.authorOutletType as OutletType)) {
    errors.push('authorOutletType inválido');
  }
  if ('coverImage' in data && (typeof data.coverImage !== 'string' || data.coverImage.length > 400000)) {
    errors.push('coverImage supera 400000 caracteres');
  }
  if ('coverAlt' in data && (typeof data.coverAlt !== 'string' || data.coverAlt.length > 300)) {
    errors.push('coverAlt supera 300 caracteres');
  }
  if ('coverCredit' in data && (typeof data.coverCredit !== 'string' || data.coverCredit.length > 200)) {
    errors.push('coverCredit supera 200 caracteres');
  }
  if ('coverLayout' in data && !VALID_COVER_LAYOUTS.includes(data.coverLayout as CoverLayoutStyle)) {
    errors.push('coverLayout inválido');
  }
  if ('headerStyle' in data && !VALID_HEADER_STYLES.includes(data.headerStyle as HeaderStyleVariant)) {
    errors.push('headerStyle inválido');
  }
  if ('accentColor' in data && (typeof data.accentColor !== 'string' || data.accentColor.length > 20)) {
    errors.push('accentColor supera 20 caracteres');
  }
  if ('paragraphIndent' in data && typeof data.paragraphIndent !== 'boolean') errors.push('paragraphIndent debe ser bool');
  if ('showTableOfContents' in data && typeof data.showTableOfContents !== 'boolean') {
    errors.push('showTableOfContents debe ser bool');
  }
  if (!Array.isArray(data.blocks) || data.blocks.length > 80) {
    errors.push('blocks debe ser lista con máximo 80 bloques');
  }
  if ('galleryItems' in data && (!Array.isArray(data.galleryItems) || data.galleryItems.length > 30)) {
    errors.push('galleryItems supera 30 elementos');
  }
  if ('corrections' in data && (!Array.isArray(data.corrections) || data.corrections.length > 30)) {
    errors.push('corrections supera 30 elementos');
  }
  if ('keyPoints' in data && (!Array.isArray(data.keyPoints) || data.keyPoints.length > 10)) {
    errors.push('keyPoints supera 10 elementos');
  }
  if ('sensitiveContent' in data && typeof data.sensitiveContent !== 'boolean') errors.push('sensitiveContent debe ser bool');
  if ('sensitiveWarning' in data && (typeof data.sensitiveWarning !== 'string' || data.sensitiveWarning.length > 300)) {
    errors.push('sensitiveWarning supera 300 caracteres');
  }
  if ('sources' in data && (!Array.isArray(data.sources) || data.sources.length > 30)) {
    errors.push('sources supera 30 elementos');
  }
  if ('seoDescription' in data && (typeof data.seoDescription !== 'string' || data.seoDescription.length > 320)) {
    errors.push('seoDescription supera 320 caracteres');
  }
  if ('commentsEnabled' in data && typeof data.commentsEnabled !== 'boolean') errors.push('commentsEnabled debe ser bool');
  if ('mediaUrl' in data && (typeof data.mediaUrl !== 'string' || data.mediaUrl.length > 400000)) {
    errors.push('mediaUrl supera 400000 caracteres');
  }
  if ('mediaSourceType' in data && (typeof data.mediaSourceType !== 'string' || data.mediaSourceType.length > 40)) {
    errors.push('mediaSourceType supera 40 caracteres');
  }
  if ('mediaChapters' in data && (!Array.isArray(data.mediaChapters) || data.mediaChapters.length > 50)) {
    errors.push('mediaChapters supera 50 elementos');
  }
  if ('mediaTranscript' in data && (typeof data.mediaTranscript !== 'string' || data.mediaTranscript.length > 40000)) {
    errors.push('mediaTranscript supera 40000 caracteres');
  }
  if ('mediaSubtitlesUrl' in data && (typeof data.mediaSubtitlesUrl !== 'string' || data.mediaSubtitlesUrl.length > 1000)) {
    errors.push('mediaSubtitlesUrl supera 1000 caracteres');
  }
  if ('mediaDurationLabel' in data && (typeof data.mediaDurationLabel !== 'string' || data.mediaDurationLabel.length > 40)) {
    errors.push('mediaDurationLabel supera 40 caracteres');
  }
  if ('mediaRelatedLinks' in data && (!Array.isArray(data.mediaRelatedLinks) || data.mediaRelatedLinks.length > 20)) {
    errors.push('mediaRelatedLinks supera 20 elementos');
  }
  if ('episodeNotes' in data && (typeof data.episodeNotes !== 'string' || data.episodeNotes.length > 10000)) {
    errors.push('episodeNotes supera 10000 caracteres');
  }
  if ('seasonNumber' in data && (typeof data.seasonNumber !== 'number' || data.seasonNumber < 1 || data.seasonNumber > 999)) {
    errors.push('seasonNumber debe estar entre 1 y 999');
  }
  if ('episodeNumber' in data && (typeof data.episodeNumber !== 'number' || data.episodeNumber < 1 || data.episodeNumber > 9999)) {
    errors.push('episodeNumber debe estar entre 1 y 9999');
  }
  if ('documentTitle' in data && (typeof data.documentTitle !== 'string' || data.documentTitle.length > 200)) {
    errors.push('documentTitle supera 200 caracteres');
  }
  if ('audioDurationSec' in data && (typeof data.audioDurationSec !== 'number' || data.audioDurationSec < 0 || data.audioDurationSec > 86400)) {
    errors.push('audioDurationSec fuera de rango (0-86400)');
  }
  if (typeof data.readTimeMinutes !== 'number' || data.readTimeMinutes < 1 || data.readTimeMinutes > 180) {
    errors.push('readTimeMinutes debe estar entre 1 y 180');
  }
  if (typeof data.viewCount !== 'number' || data.viewCount < 0) {
    errors.push('viewCount debe ser número >= 0');
  }
  if (typeof data.commentCount !== 'number' || data.commentCount < 0) {
    errors.push('commentCount debe ser número >= 0');
  }
  if ('publishedAt' in data && !isTimestampLike(data.publishedAt)) {
    errors.push('publishedAt debe ser Firestore Timestamp válido');
  }
  if ('scheduledFor' in data && !isTimestampLike(data.scheduledFor)) {
    errors.push('scheduledFor debe ser Firestore Timestamp válido');
  }
  if (!isTimestampLike(data.createdAt)) {
    errors.push('createdAt debe ser Firestore Timestamp válido');
  }
  if (!isTimestampLike(data.updatedAt)) {
    errors.push('updatedAt debe ser Firestore Timestamp válido');
  }

  // 4. Role-based constraints
  if (ctx) {
    const { isCreate, isAdmin, isActiveCollaborator, uid, autoPublishCollaborators, existingDoc } = ctx;
    if (!isAdmin) {
      if (!isActiveCollaborator || !uid) {
        errors.push('La cuenta no tiene rol de administrador ni colaborador activo');
      } else {
        if (data.authorId !== uid) errors.push('authorId no coincide con el UID del colaborador');
        if ('authorIdentityType' in data && data.authorIdentityType !== 'collaborator') {
          errors.push('Un colaborador no puede publicar con authorIdentityType distinto de "collaborator"');
        }
        if ('authorProfileId' in data && data.authorProfileId !== uid) {
          errors.push('authorProfileId debe coincidir con el UID del colaborador');
        }
        if (data.status === 'published' && autoPublishCollaborators === false) {
          errors.push('La publicación directa de colaboradores está desactivada (debe enviarse a "in_review")');
        }
        if (isCreate) {
          if (data.featured !== false || data.breaking !== false) {
            errors.push('Un colaborador no puede marcar featured o breaking');
          }
          if ('pinnedInFeed' in data && data.pinnedInFeed !== false) {
            errors.push('Un colaborador no puede fijar notas en portada (pinnedInFeed)');
          }
          if (data.isSample !== false || data.viewCount !== 0 || data.commentCount !== 0) {
            errors.push('Un colaborador debe iniciar isSample=false, viewCount=0 y commentCount=0');
          }
        } else if (existingDoc) {
          if (existingDoc.authorId !== uid) {
            errors.push('El documento pertenece a otro autor y solo un administrador puede editarlo');
          }
          if (data.featured !== existingDoc.featured || data.breaking !== existingDoc.breaking) {
            errors.push('Un colaborador no puede modificar featured o breaking');
          }
          const hadPinned = 'pinnedInFeed' in existingDoc;
          const hasPinned = 'pinnedInFeed' in data;
          if (!hadPinned && hasPinned && data.pinnedInFeed !== false) {
            errors.push('Un colaborador no puede activar pinnedInFeed');
          }
          if (hadPinned && (!hasPinned || data.pinnedInFeed !== existingDoc.pinnedInFeed)) {
            errors.push('Un colaborador no puede alterar pinnedInFeed existente');
          }
          if (data.viewCount !== existingDoc.viewCount || data.commentCount !== existingDoc.commentCount) {
            errors.push('viewCount y commentCount no pueden ser alterados en edición');
          }
        }
      }
    }
  }

  return errors;
}

export function normalizeLegacyPostForRules(
  rawData: Record<string, unknown>,
  docId: string,
  helpers: {
    fallbackCategory: { id: string; name: string; slug: string };
    fallbackAuthorId: string;
    fallbackAuthorName: string;
    toTimestamp: (val: unknown) => unknown;
    nowTimestamp: () => unknown;
    isNativeTimestamp?: (val: unknown) => boolean;
  }
): Record<string, unknown> {
  const isValidTs = helpers.isNativeTimestamp || isTimestampLike;
  const safeId = isValidFirestoreId(docId) ? docId : `post_${Date.now()}`;
  const rawTitle = typeof rawData.title === 'string' ? rawData.title.trim() : '';
  const safeTitle = (rawTitle.length >= 3 ? rawTitle : rawTitle || 'Publicación editorial').padEnd(3, '.').slice(0, 220);

  const rawSlug = typeof rawData.slug === 'string' ? rawData.slug.trim() : '';
  const safeSlug = (rawSlug.length >= 2 ? rawSlug : `nota-${safeId.slice(-6)}`).slice(0, 240);

  const rawType = rawData.type as PostType;
  const safeType: PostType = VALID_POST_TYPES.includes(rawType) ? rawType : 'article';

  const rawStatus = rawData.status as PostStatus;
  const safeStatus: PostStatus = VALID_POST_STATUSES.includes(rawStatus) ? rawStatus : 'draft';

  const catId = isValidFirestoreId(rawData.categoryId) ? rawData.categoryId : helpers.fallbackCategory.id;
  const catName =
    typeof rawData.categoryName === 'string' && rawData.categoryName.trim()
      ? rawData.categoryName.trim().slice(0, 80)
      : helpers.fallbackCategory.name.slice(0, 80);
  const catSlug =
    typeof rawData.categorySlug === 'string' && rawData.categorySlug.trim()
      ? rawData.categorySlug.trim().slice(0, 100)
      : helpers.fallbackCategory.slug.slice(0, 100);

  const rawTags = Array.isArray(rawData.tags)
    ? rawData.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim().slice(0, 40)).slice(0, 12)
    : [];

  const rawAuthorId = isValidFirestoreId(rawData.authorId) ? rawData.authorId : helpers.fallbackAuthorId;
  const rawAuthorName = typeof rawData.authorName === 'string' ? rawData.authorName.trim() : '';
  const safeAuthorName = (rawAuthorName.length >= 2 ? rawAuthorName : helpers.fallbackAuthorName || 'Redacción').slice(0, 120);

  const rawBlocks = Array.isArray(rawData.blocks) ? rawData.blocks.slice(0, 80) : [];
  const rawReadTime = typeof rawData.readTimeMinutes === 'number' && Number.isFinite(rawData.readTimeMinutes)
    ? Math.max(1, Math.min(180, Math.round(rawData.readTimeMinutes)))
    : 1;
  const rawViewCount = typeof rawData.viewCount === 'number' && Number.isFinite(rawData.viewCount) && rawData.viewCount >= 0
    ? Math.floor(rawData.viewCount)
    : 0;
  const rawCommentCount = typeof rawData.commentCount === 'number' && Number.isFinite(rawData.commentCount) && rawData.commentCount >= 0
    ? Math.floor(rawData.commentCount)
    : 0;

  const safeCreatedAt = isValidTs(rawData.createdAt) ? rawData.createdAt : helpers.toTimestamp(rawData.createdAt);

  const cleaned: Record<string, unknown> = {
    id: safeId,
    title: safeTitle,
    slug: safeSlug,
    type: safeType,
    status: safeStatus,
    featured: Boolean(rawData.featured),
    breaking: Boolean(rawData.breaking),
    isSample: Boolean(rawData.isSample),
    categoryId: catId,
    categoryName: catName,
    categorySlug: catSlug,
    tags: rawTags,
    authorId: rawAuthorId,
    authorName: safeAuthorName,
    blocks: rawBlocks,
    readTimeMinutes: rawReadTime,
    viewCount: rawViewCount,
    commentCount: rawCommentCount,
    createdAt: safeCreatedAt,
    updatedAt: helpers.nowTimestamp(),
  };

  if (typeof rawData.subtitle === 'string' && rawData.subtitle.trim()) cleaned.subtitle = rawData.subtitle.trim().slice(0, 500);
  if (VALID_EDITORIAL_KINDS.includes(rawData.editorialKind as EditorialKind)) cleaned.editorialKind = rawData.editorialKind;
  if (typeof rawData.pinnedInFeed === 'boolean') cleaned.pinnedInFeed = rawData.pinnedInFeed;
  if (typeof rawData.seriesId === 'string' && rawData.seriesId.trim()) cleaned.seriesId = rawData.seriesId.trim().slice(0, 128);
  if (typeof rawData.seriesTitle === 'string' && rawData.seriesTitle.trim()) cleaned.seriesTitle = rawData.seriesTitle.trim().slice(0, 160);
  if (typeof rawData.authorProfileId === 'string' && rawData.authorProfileId.trim()) cleaned.authorProfileId = rawData.authorProfileId.trim().slice(0, 128);
  if (VALID_IDENTITY_TYPES.includes(rawData.authorIdentityType as AuthorIdentityType)) cleaned.authorIdentityType = rawData.authorIdentityType;
  if (typeof rawData.authorVerified === 'boolean') cleaned.authorVerified = rawData.authorVerified;
  if (typeof rawData.authorAvatar === 'string' && rawData.authorAvatar.trim()) cleaned.authorAvatar = rawData.authorAvatar.slice(0, 400000);
  if (VALID_OUTLET_TYPES.includes(rawData.authorOutletType as OutletType)) cleaned.authorOutletType = rawData.authorOutletType;
  if (typeof rawData.coverImage === 'string' && rawData.coverImage.trim()) cleaned.coverImage = rawData.coverImage.slice(0, 400000);
  if (typeof rawData.coverAlt === 'string' && rawData.coverAlt.trim()) cleaned.coverAlt = rawData.coverAlt.trim().slice(0, 300);
  if (typeof rawData.coverCredit === 'string' && rawData.coverCredit.trim()) cleaned.coverCredit = rawData.coverCredit.trim().slice(0, 200);
  if (VALID_COVER_LAYOUTS.includes(rawData.coverLayout as CoverLayoutStyle)) cleaned.coverLayout = rawData.coverLayout;
  if (VALID_HEADER_STYLES.includes(rawData.headerStyle as HeaderStyleVariant)) cleaned.headerStyle = rawData.headerStyle;
  if (typeof rawData.accentColor === 'string' && rawData.accentColor.trim()) cleaned.accentColor = rawData.accentColor.trim().slice(0, 20);
  if (typeof rawData.paragraphIndent === 'boolean') cleaned.paragraphIndent = rawData.paragraphIndent;
  if (typeof rawData.showTableOfContents === 'boolean') cleaned.showTableOfContents = rawData.showTableOfContents;
  if (Array.isArray(rawData.galleryItems) && rawData.galleryItems.length > 0) cleaned.galleryItems = rawData.galleryItems.slice(0, 30);
  if (Array.isArray(rawData.corrections) && rawData.corrections.length > 0) cleaned.corrections = rawData.corrections.slice(0, 30);
  if (Array.isArray(rawData.keyPoints) && rawData.keyPoints.length > 0) cleaned.keyPoints = rawData.keyPoints.slice(0, 10);
  if (typeof rawData.sensitiveContent === 'boolean') cleaned.sensitiveContent = rawData.sensitiveContent;
  if (typeof rawData.sensitiveWarning === 'string' && rawData.sensitiveWarning.trim()) cleaned.sensitiveWarning = rawData.sensitiveWarning.trim().slice(0, 300);
  if (Array.isArray(rawData.sources) && rawData.sources.length > 0) cleaned.sources = rawData.sources.slice(0, 30);
  if (typeof rawData.seoDescription === 'string' && rawData.seoDescription.trim()) cleaned.seoDescription = rawData.seoDescription.trim().slice(0, 320);
  if (typeof rawData.commentsEnabled === 'boolean') cleaned.commentsEnabled = rawData.commentsEnabled;
  if (typeof rawData.mediaUrl === 'string' && rawData.mediaUrl.trim()) cleaned.mediaUrl = rawData.mediaUrl.slice(0, 400000);
  if (typeof rawData.mediaSourceType === 'string' && rawData.mediaSourceType.trim()) cleaned.mediaSourceType = rawData.mediaSourceType.trim().slice(0, 40);
  if (Array.isArray(rawData.mediaChapters) && rawData.mediaChapters.length > 0) cleaned.mediaChapters = rawData.mediaChapters.slice(0, 50);
  if (typeof rawData.mediaTranscript === 'string' && rawData.mediaTranscript.trim()) cleaned.mediaTranscript = rawData.mediaTranscript.slice(0, 40000);
  if (typeof rawData.mediaSubtitlesUrl === 'string' && rawData.mediaSubtitlesUrl.trim()) cleaned.mediaSubtitlesUrl = rawData.mediaSubtitlesUrl.slice(0, 1000);
  if (typeof rawData.mediaDurationLabel === 'string' && rawData.mediaDurationLabel.trim()) cleaned.mediaDurationLabel = rawData.mediaDurationLabel.trim().slice(0, 40);
  if (Array.isArray(rawData.mediaRelatedLinks) && rawData.mediaRelatedLinks.length > 0) cleaned.mediaRelatedLinks = rawData.mediaRelatedLinks.slice(0, 20);
  if (typeof rawData.episodeNotes === 'string' && rawData.episodeNotes.trim()) cleaned.episodeNotes = rawData.episodeNotes.slice(0, 10000);
  if (typeof rawData.seasonNumber === 'number' && rawData.seasonNumber >= 1 && rawData.seasonNumber <= 999) cleaned.seasonNumber = Math.floor(rawData.seasonNumber);
  if (typeof rawData.episodeNumber === 'number' && rawData.episodeNumber >= 1 && rawData.episodeNumber <= 9999) cleaned.episodeNumber = Math.floor(rawData.episodeNumber);
  if (typeof rawData.documentTitle === 'string' && rawData.documentTitle.trim()) cleaned.documentTitle = rawData.documentTitle.trim().slice(0, 200);
  if (typeof rawData.audioDurationSec === 'number' && rawData.audioDurationSec >= 0 && rawData.audioDurationSec <= 86400) cleaned.audioDurationSec = rawData.audioDurationSec;

  if (rawData.publishedAt !== undefined && rawData.publishedAt !== null) {
    cleaned.publishedAt = isValidTs(rawData.publishedAt) ? rawData.publishedAt : helpers.toTimestamp(rawData.publishedAt);
  } else if (safeStatus === 'published') {
    cleaned.publishedAt = safeCreatedAt;
  }
  if (rawData.scheduledFor !== undefined && rawData.scheduledFor !== null) {
    cleaned.scheduledFor = isValidTs(rawData.scheduledFor) ? rawData.scheduledFor : helpers.toTimestamp(rawData.scheduledFor);
  }

  return cleaned;
}

export interface PostSaveDiagnosisInput {
  error: unknown;
  operation: 'create' | 'update';
  postId: string;
  uid: string | null;
  role: string | null;
  status: string | null;
  isAdmin: boolean;
  isActiveCollaborator: boolean;
  emailVerified: boolean;
  hasAdminDoc?: boolean;
  bootstrapClaimed?: boolean;
  bootstrapAdminUid?: string | null;
  autoPublishCollaborators?: boolean;
  estimatedBytes?: number;
  invalidFields?: string[];
  existingAuthorId?: string | null;
}

export interface PostSaveDiagnosis {
  headline: string;
  detail: string;
  diagnosticText: string;
}

export function diagnosePostSaveFailure(input: PostSaveDiagnosisInput): PostSaveDiagnosis {
  const errCode = (input.error as { code?: string })?.code || 'unknown';
  const errMsg = input.error instanceof Error ? input.error.message : String(input.error);
  const invalidList = input.invalidFields || [];

  let headline = 'No se pudo guardar la publicación';
  let detail = '';

  if (input.estimatedBytes && input.estimatedBytes > 950000) {
    headline = 'El documento supera el límite de 1 MB de Firestore';
    detail =
      `El tamaño estimado es de ${Math.round(input.estimatedBytes / 1024)} KB. ` +
      'Verifica que las imágenes de portada, galería o bloques se hayan subido a Firebase Storage y no como código base64 incrustado.';
  } else if (errCode === 'permission-denied') {
    if (input.role === 'collaborator' && input.status !== 'active') {
      headline = `Cuenta de colaborador ${input.status === 'suspended' ? 'suspendida' : 'pendiente de aprobación'}`;
      detail =
        'Las reglas de Firestore solo permiten publicar o editar cuando users/{uid}.status == "active". Pide al administrador aprobar o reactivar tu cuenta.';
    } else if (!input.isAdmin && !input.isActiveCollaborator) {
      headline = 'La sesión actual no tiene permisos de administrador ni colaborador activo';
      detail =
        `Rol actual: "${input.role || 'sin documento en users'}", estado: "${input.status || 'sin estado'}". ` +
        (input.hasAdminDoc === false && input.emailVerified === false
          ? 'Tu correo aún no figura verificado y no existe registro en /admins/{uid}. Verifica tu correo o inicia sesión con Google.'
          : 'Asegúrate de que existan /admins/{uid} y /users/{uid} en la base nombrada.');
    } else if (!input.isAdmin && input.existingAuthorId && input.existingAuthorId !== input.uid) {
      headline = 'Propiedad de la publicación: este artículo pertenece a otro autor';
      detail = 'Un colaborador solo puede editar publicaciones cuyo authorId coincida exactamente con su propio UID.';
    } else if (invalidList.length > 0) {
      headline = 'Uno o más campos no cumplen las reglas de validación (isValidPost)';
      detail = `Regla rechazada en: ${invalidList.slice(0, 4).join('; ')}.`;
    } else {
      headline = 'Permiso denegado en la base de datos nombrada de Firestore';
      detail =
        `La aplicación escribe en la base "${FIRESTORE_NAMED_DATABASE_ID}" (NO en "(default)"). ` +
        'Publica firestore.rules específicamente sobre esa base nombrada con `firebase deploy --only firestore:rules,storage` o seleccionándola en el selector superior de Firebase Console.';
    }
  } else if (errCode === 'invalid-argument' || /exceeds the maximum allowed size/i.test(errMsg)) {
    headline = 'Tamaño o formato de documento rechazado por Firestore';
    detail = 'El documento excede 1 MB o contiene un tipo de dato no soportado. Sube las imágenes a Firebase Storage.';
  } else {
    detail = !errMsg.startsWith('{') ? errMsg : 'Error inesperado comunicándose con Firestore.';
  }

  const lines = [
    `Operación: posts.${input.operation} (posts/${input.postId})`,
    `Base de datos: ${FIRESTORE_NAMED_DATABASE_ID}`,
    `Código de error: ${errCode}`,
    `UID: ${input.uid || 'sin-sesion'}`,
    `Rol en users/{uid}: ${input.role || 'sin-doc'}`,
    `Estado en users/{uid}: ${input.status || 'sin-doc'}`,
    `esAdmin (cliente): ${input.isAdmin ? 'sí' : 'no'} | docs /admins/{uid}: ${input.hasAdminDoc ? 'sí' : 'no'}`,
    `emailVerified: ${input.emailVerified ? 'sí' : 'no'}`,
    `bootstrapClaimed: ${input.bootstrapClaimed ? 'sí' : 'no'} | bootstrapUid: ${input.bootstrapAdminUid || 'ninguno'}`,
    `autoPublishCollaborators: ${input.autoPublishCollaborators ? 'true' : 'false'}`,
    `Tamaño estimado doc: ${input.estimatedBytes ? `${Math.round(input.estimatedBytes / 1024)} KB` : 'n/d'}`,
    `Campos inválidos detectados: ${invalidList.length > 0 ? invalidList.join(' | ') : 'ninguno en cliente'}`,
    `Causa probable: ${headline}`,
  ];

  return {
    headline,
    detail,
    diagnosticText: lines.join('\n'),
  };
}
