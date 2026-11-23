import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from './firebase';
import { inspectMediaUrl, type MediaProvider } from './mediaEmbeds';
import { stripUndefinedDeep } from './postValidation';
import { ContentBlock, Post, SiteConfig } from '../types/editorial';

export { stripUndefinedDeep };

export type MediaSlot =
  | 'cover'
  | 'inline'
  | 'gallery'
  | 'avatar'
  | 'logo'
  | 'party_logo'
  | 'banner'
  | 'infographic'
  | 'document';

export interface MediaSlotPreset {
  maxDimension: number;
  quality: number;
  squareCrop?: boolean;
  label: string;
}

export const MEDIA_SLOT_PRESETS: Record<MediaSlot, MediaSlotPreset> = {
  cover: { maxDimension: 1600, quality: 0.82, label: 'Portada (1600px WebP)' },
  inline: { maxDimension: 1200, quality: 0.82, label: 'Imagen en artículo (1200px WebP)' },
  gallery: { maxDimension: 1400, quality: 0.82, label: 'Galería documental (1400px WebP)' },
  avatar: { maxDimension: 512, quality: 0.84, squareCrop: true, label: 'Foto de perfil 1:1 (512px)' },
  logo: { maxDimension: 640, quality: 0.88, label: 'Logotipo (640px)' },
  party_logo: { maxDimension: 256, quality: 0.86, label: 'Logo político (256px WebP)' },
  banner: { maxDimension: 1600, quality: 0.82, label: 'Encabezado (1600px)' },
  infographic: { maxDimension: 1920, quality: 0.88, label: 'Infografía alta nitidez (1920px)' },
  document: { maxDimension: 1200, quality: 0.8, label: 'Documento / Anexo' },
};

export interface FocalPoint {
  x: number;
  y: number;
}

export interface ParsedMediaUrl {
  cleanUrl: string;
  fpX: number;
  fpY: number;
  blurDataUrl?: string;
}

export function encodeMediaUrlWithMeta(
  rawUrl: string,
  meta?: { fpX?: number; fpY?: number; blur?: string }
): string {
  const { cleanUrl, fpX, fpY, blurDataUrl } = parseMediaUrlMeta(rawUrl);
  if (!cleanUrl) return '';

  const nextFpX = Math.max(5, Math.min(95, Math.round(meta?.fpX ?? fpX)));
  const nextFpY = Math.max(5, Math.min(95, Math.round(meta?.fpY ?? fpY)));
  const nextBlur = meta?.blur !== undefined ? meta.blur : blurDataUrl;

  const params: string[] = [];
  if (nextFpX !== 50 || nextFpY !== 50 || nextBlur) {
    params.push(`fp=${nextFpX},${nextFpY}`);
  }
  if (nextBlur && nextBlur.startsWith('data:image/')) {
    const candidate = `${cleanUrl}#${[...params, `blur=${encodeURIComponent(nextBlur)}`].join('&')}`;
    if (candidate.length < 395000) {
      return candidate;
    }
  }
  if (params.length > 0) {
    const candidate = `${cleanUrl}#${params.join('&')}`;
    if (candidate.length < 395000) return candidate;
  }
  return cleanUrl;
}

export function parseMediaUrlMeta(rawUrl?: string): ParsedMediaUrl {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { cleanUrl: '', fpX: 50, fpY: 50 };
  }
  const trimmed = rawUrl.trim();
  const hashIndex = trimmed.indexOf('#');
  if (hashIndex === -1) {
    return { cleanUrl: trimmed, fpX: 50, fpY: 50 };
  }

  const base = trimmed.slice(0, hashIndex);
  const fragment = trimmed.slice(hashIndex + 1);
  if (!fragment.includes('fp=') && !fragment.includes('blur=')) {
    return { cleanUrl: trimmed, fpX: 50, fpY: 50 };
  }

  let fpX = 50;
  let fpY = 50;
  let blurDataUrl: string | undefined;

  for (const part of fragment.split('&')) {
    if (part.startsWith('fp=')) {
      const coords = part.slice(3).split(',');
      const x = Number(coords[0]);
      const y = Number(coords[1]);
      if (Number.isFinite(x)) fpX = Math.max(5, Math.min(95, x));
      if (Number.isFinite(y)) fpY = Math.max(5, Math.min(95, y));
    } else if (part.startsWith('blur=')) {
      try {
        const decoded = decodeURIComponent(part.slice(5));
        if (decoded.startsWith('data:image/')) {
          blurDataUrl = decoded;
        }
      } catch {
        // Ignore malformed blur fragment
      }
    }
  }

  return { cleanUrl: base, fpX, fpY, blurDataUrl };
}

export function generateId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'nota'
  );
}

export async function hashInviteCode(code: string): Promise<string> {
  const normalized = code.trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateRandomInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let raw = '';
  for (let i = 0; i < bytes.length; i++) {
    raw += chars[bytes[i] % chars.length];
  }
  return `ALT-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function formatDateEs(value: unknown, includeTime = false): string {
  const date = toDate(value);
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function formatDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatSecondsToTimestamp(totalSec: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSec) ? totalSec : 0));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function calculateAdultAgeFromBirthYear(birthYear?: number | string | null): number | null {
  if (birthYear === undefined || birthYear === null || birthYear === '') return null;
  const parsed = typeof birthYear === 'string' ? Number(birthYear.trim()) : Number(birthYear);
  if (!Number.isInteger(parsed)) return null;
  const currentYear = new Date().getFullYear();
  if (parsed < 1900 || parsed > currentYear) return null;
  const age = currentYear - parsed;
  if (age < 18 || age > 120) return null;
  return age;
}

export function estimateReadTime(blocks: ContentBlock[], subtitle = ''): number {
  const words = [
    subtitle,
    ...blocks.map((b) => {
      if (b.text) return b.text;
      if (b.calloutTitle) return `${b.calloutTitle} ${b.text || ''}`;
      if (b.listItems) return b.listItems.join(' ');
      if (b.timelineEntries) return b.timelineEntries.map((t) => `${t.title} ${t.detail}`).join(' ');
      if (b.tableRows) return b.tableRows.flat().join(' ');
      if (b.columns) return b.columns.map((c) => `${c.title || ''} ${c.body}`).join(' ');
      if (b.metricItems) return b.metricItems.map((m) => `${m.value} ${m.label} ${m.detail || ''}`).join(' ');
      return '';
    }),
  ]
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export interface OptimizedImageResult {
  blob: Blob;
  dataUrl: string;
  blurDataUrl: string;
  focalPoint: FocalPoint;
  originalBytes: number;
  optimizedBytes: number;
  width: number;
  height: number;
}

function computeSmartFocalPoint(img: HTMLImageElement): FocalPoint {
  try {
    const sampleSize = 48;
    const canvas = document.createElement('canvas');
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { x: 50, y: 45 };
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
    const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);

    const lum = (px: number, py: number) => {
      const idx = (py * sampleSize + px) * 4;
      return data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
    };

    let weightedX = 0;
    let weightedY = 0;
    let totalWeight = 0;

    for (let y = 1; y < sampleSize - 1; y++) {
      for (let x = 1; x < sampleSize - 1; x++) {
        const dx = Math.abs(lum(x + 1, y) - lum(x - 1, y));
        const dy = Math.abs(lum(x, y + 1) - lum(x, y - 1));
        const edge = dx + dy;
        // Slight portrait upper-center bias to protect faces/subjects
        const portraitBias = y < sampleSize * 0.55 ? 1.15 : 0.9;
        const w = edge * portraitBias;
        if (w > 18) {
          weightedX += (x / (sampleSize - 1)) * 100 * w;
          weightedY += (y / (sampleSize - 1)) * 100 * w;
          totalWeight += w;
        }
      }
    }

    if (totalWeight <= 0) return { x: 50, y: 45 };
    return {
      x: Math.round(Math.max(15, Math.min(85, weightedX / totalWeight))),
      y: Math.round(Math.max(15, Math.min(85, weightedY / totalWeight))),
    };
  } catch {
    return { x: 50, y: 45 };
  }
}

function createTinyBlurPlaceholder(source: CanvasImageSource, width: number, height: number): string {
  try {
    const targetW = 24;
    const targetH = Math.max(14, Math.round((height / Math.max(1, width)) * targetW));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(source, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/webp', 0.45);
  } catch {
    return '';
  }
}

export async function optimizeImageFile(
  file: File,
  maxDimensionOrOptions:
    | number
    | { slot?: MediaSlot; maxDimension?: number; quality?: number; squareCrop?: boolean } = 1440,
  legacyQuality = 0.82
): Promise<OptimizedImageResult> {
  const opts =
    typeof maxDimensionOrOptions === 'number'
      ? { maxDimension: maxDimensionOrOptions, quality: legacyQuality }
      : maxDimensionOrOptions;

  const preset = opts.slot ? MEDIA_SLOT_PRESETS[opts.slot] : undefined;
  const maxDimension = opts.maxDimension ?? preset?.maxDimension ?? 1440;
  const quality = opts.quality ?? preset?.quality ?? 0.82;
  const squareCrop = opts.squareCrop ?? preset?.squareCrop ?? false;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Archivo de imagen inválido.'));
      img.onload = () => {
        const focalPoint = computeSmartFocalPoint(img);
        let sx = 0;
        let sy = 0;
        let sw = img.naturalWidth || img.width;
        let sh = img.naturalHeight || img.height;

        if (squareCrop) {
          const minSide = Math.min(sw, sh);
          const maxShiftX = sw - minSide;
          const maxShiftY = sh - minSide;
          sx = Math.round(maxShiftX * (focalPoint.x / 100));
          sy = Math.round(maxShiftY * (focalPoint.y / 100));
          sw = minSide;
          sh = minSide;
        }

        let width = sw;
        let height = sh;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas no disponible.'));
          return;
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
        const blurDataUrl = createTinyBlurPlaceholder(canvas, width, height);
        const mime = 'image/webp';
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Error al comprimir la imagen.'));
              return;
            }
            const r2 = new FileReader();
            r2.onload = () => {
              resolve({
                blob,
                dataUrl: String(r2.result || ''),
                blurDataUrl,
                focalPoint: squareCrop ? { x: 50, y: 50 } : focalPoint,
                originalBytes: file.size,
                optimizedBytes: blob.size,
                width,
                height,
              });
            };
            r2.readAsDataURL(blob);
          },
          mime,
          quality
        );
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_MEDIA_UPLOAD_BYTES = 50 * 1024 * 1024;

function runSingleStorageUpload(
  storagePath: string,
  payloadBlob: Blob,
  contentType: string,
  timeoutMs: number,
  onProgress?: (pct: number) => void
): Promise<string> {
  const storageRef = ref(storage, storagePath);
  return new Promise<string>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, payloadBlob, { contentType });
    const timer = setTimeout(() => {
      task.cancel();
      reject(new Error('storage-timeout'));
    }, timeoutMs);
    task.on(
      'state_changed',
      (snap) => {
        if (onProgress && snap.totalBytes > 0) {
          const pct = Math.round(22 + (snap.bytesTransferred / snap.totalBytes) * 78);
          onProgress(Math.min(99, pct));
        }
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
      async () => {
        clearTimeout(timer);
        try {
          const dl = await getDownloadURL(task.snapshot.ref);
          if (onProgress) onProgress(100);
          resolve(dl);
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

/**
 * Sube activos optimizados a Firebase Storage con validación previa, hasta 3 reintentos,
 * progreso en tiempo real (0..100%) y detección automática de punto focal + miniatura WebP.
 * Para imágenes menores a 350 KB, incluye respaldo compacto si Storage aún no tiene reglas habilitadas.
 */
export async function uploadMediaAsset(
  file: File,
  folder: string,
  onProgress?: (pct: number) => void,
  slot: MediaSlot = 'inline'
): Promise<{ url: string; cleanUrl: string; blurDataUrl?: string; focalPoint: FocalPoint; info: string }> {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const isAudio = file.type.startsWith('audio/');

  if (!isImage && !isVideo && !isAudio) {
    throw new Error('Tipo de archivo no compatible. Sube una imagen, audio o video válido.');
  }
  if (isImage && file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error('La imagen supera el límite de 25 MB antes de compresión.');
  }
  if (!isImage && file.size > MAX_MEDIA_UPLOAD_BYTES) {
    throw new Error('El archivo multimedia supera el límite máximo permitido de 50 MB.');
  }

  let payloadBlob: Blob = file;
  let fallbackDataUrl = '';
  let blurDataUrl = '';
  let focalPoint: FocalPoint = { x: 50, y: 50 };
  let optimizationNote = '';

  if (onProgress) onProgress(5);

  if (isImage) {
    const optimized = await optimizeImageFile(file, { slot });
    payloadBlob = optimized.blob;
    fallbackDataUrl = optimized.dataUrl;
    blurDataUrl = optimized.blurDataUrl;
    focalPoint = optimized.focalPoint;
    const savedPct = Math.max(0, Math.round((1 - optimized.optimizedBytes / Math.max(1, optimized.originalBytes)) * 100));
    optimizationNote = `${MEDIA_SLOT_PRESETS[slot].label}: ${Math.round(optimized.optimizedBytes / 1024)} KB (-${savedPct}%)`;
    if (onProgress) onProgress(22);
  }

  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = isImage ? 'webp' : file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
  const safeName = `${Date.now()}_${baseName}.${ext}`;
  const storagePath = `${folder}/${safeName}`;
  const contentType = isImage ? 'image/webp' : file.type || 'application/octet-stream';
  const timeoutMs = isImage ? 18000 : 45000;

  let lastError: unknown = null;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const cleanUrl = await runSingleStorageUpload(storagePath, payloadBlob, contentType, timeoutMs, onProgress);
      const url = isImage
        ? encodeMediaUrlWithMeta(cleanUrl, { fpX: focalPoint.x, fpY: focalPoint.y, blur: blurDataUrl })
        : cleanUrl;
      return { url, cleanUrl, blurDataUrl, focalPoint, info: optimizationNote || 'Subido a Firebase Storage' };
    } catch (err) {
      lastError = err;
      const errCode = (err as { code?: string })?.code || '';
      if (errCode === 'storage/unauthorized' || errCode === 'storage/canceled') {
        break;
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, attempt * 450));
      }
    }
  }

  if (isImage && fallbackDataUrl) {
    let compact = fallbackDataUrl;
    let compactBlur = blurDataUrl;
    if (compact.length >= 340000) {
      const tighter = await optimizeImageFile(file, {
        slot,
        maxDimension: Math.min(960, MEDIA_SLOT_PRESETS[slot].maxDimension),
        quality: 0.65,
      });
      compact = tighter.dataUrl;
      compactBlur = tighter.blurDataUrl;
    }
    const urlWithMeta = encodeMediaUrlWithMeta(compact, {
      fpX: focalPoint.x,
      fpY: focalPoint.y,
      blur: compactBlur,
    });
    if (urlWithMeta.length < 395000) {
      if (onProgress) onProgress(100);
      return {
        url: urlWithMeta,
        cleanUrl: compact,
        blurDataUrl: compactBlur,
        focalPoint,
        info: `${optimizationNote || 'Imagen comprimida'} · Guardada en formato compacto`,
      };
    }
  }

  const msg = (lastError as Error)?.message;
  throw new Error(
    msg && msg !== 'storage-timeout'
      ? `No se pudo subir a Firebase Storage (${msg}). Revisa las reglas de Storage o intenta de nuevo.`
      : 'No se pudo subir a Firebase Storage tras varios intentos. Revisa tu conexión o las reglas de Storage.'
  );
}

export async function uploadDocumentAsset(
  file: File,
  folder: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; fileName: string; sizeLabel: string }> {
  const maxBytes = 50 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('El documento supera el límite de 50 MB.');
  }
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storageRef = ref(storage, `${folder}/${safeName}`);
  const url = await new Promise<string>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/pdf',
    });
    const timer = setTimeout(() => {
      task.cancel();
      reject(new Error('Tiempo de espera agotado al subir el documento.'));
    }, 45000);
    task.on(
      'state_changed',
      (snap) => {
        if (onProgress && snap.totalBytes > 0) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
      async () => {
        clearTimeout(timer);
        try {
          const dl = await getDownloadURL(task.snapshot.ref);
          resolve(dl);
        } catch (e) {
          reject(e);
        }
      }
    );
  });

  const kb = file.size / 1024;
  const sizeLabel = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
  return { url, fileName: file.name, sizeLabel };
}

export async function uploadSubtitleAsset(
  file: File,
  folder: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; fileName: string }> {
  if (!/\.vtt$/i.test(file.name) && file.type !== 'text/vtt') {
    throw new Error('Los subtítulos deben cargarse en formato WebVTT (.vtt).');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('El archivo de subtítulos supera el límite de 5 MB.');
  }
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storageRef = ref(storage, `${folder}/${safeName}`);
  const url = await new Promise<string>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: 'text/vtt',
    });
    const timer = setTimeout(() => {
      task.cancel();
      reject(new Error('Tiempo de espera agotado al subir subtítulos.'));
    }, 30000);
    task.on(
      'state_changed',
      (snap) => {
        if (onProgress && snap.totalBytes > 0) {
          onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
      async () => {
        clearTimeout(timer);
        try {
          const dl = await getDownloadURL(task.snapshot.ref);
          resolve(dl);
        } catch (e) {
          reject(e);
        }
      }
    );
  });
  return { url, fileName: file.name };
}

export function getEmbedUrl(
  url: string,
  startSeconds?: number,
  kindHint?: 'video' | 'audio' | 'document' | 'social'
): {
  kind: 'iframe' | 'video' | 'audio' | 'link';
  src: string;
  provider?: MediaProvider;
  platformLabel?: string;
  thumbnailUrl?: string;
  previewIframeUrl?: string;
  warning?: string;
  errorReason?: string;
} {
  const inspected = inspectMediaUrl(url, kindHint, startSeconds);
  return {
    kind: inspected.kind,
    src: inspected.src,
    provider: inspected.provider,
    platformLabel: inspected.platformLabel,
    thumbnailUrl: inspected.thumbnailUrl,
    previewIframeUrl: inspected.previewIframeUrl,
    warning: inspected.warning,
    errorReason: inspected.errorReason,
  };
}

export function sanitizeExternalUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return u.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export function getEditorialKindLabel(kind?: string): string {
  switch (kind) {
    case 'investigacion':
      return 'Investigación';
    case 'opinion':
      return 'Opinión';
    case 'cronica':
      return 'Crónica';
    case 'analisis':
      return 'Análisis';
    case 'reportaje':
      return 'Reportaje';
    case 'multimedia':
      return 'Multimedia';
    case 'entrevista':
      return 'Entrevista';
    case 'editorial':
      return 'Editorial';
    case 'explicativo':
      return 'Explicativo';
    case 'datos':
      return 'Periodismo de datos';
    case 'carta':
      return 'Carta de lectores';
    case 'articulo':
    default:
      return 'Artículo';
  }
}

export function getPostTypeLabel(type?: string): string {
  switch (type) {
    case 'gallery':
      return 'Fotografía';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Audio';
    case 'infographic':
      return 'Infografía';
    case 'document':
      return 'Documento / PDF';
    case 'livestream':
      return 'Archivo';
    case 'article':
    default:
      return 'Artículo';
  }
}

let dynamicManifestObjectUrl: string | null = null;

function renderLogoSquarePng(img: HTMLImageElement, size: number): Promise<string> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('');
        return;
      }
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, size, size);
      const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight) * 0.86;
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL('image/png'));
    } catch {
      resolve('');
    }
  });
}

export function updateDynamicAppIcons(
  logoUrl?: string,
  siteName = 'Revista Digital Alternativa',
  primaryColor = '#B91C1C'
): void {
  if (typeof document === 'undefined') return;
  const cleanRaw = sanitizeExternalUrl(logoUrl || '');
  const clean = parseMediaUrlMeta(cleanRaw).cleanUrl;
  const faviconEl = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  const appleIconEl = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;

  if (!clean) {
    if (faviconEl) {
      faviconEl.type = 'image/png';
      faviconEl.href = '/favicon.png';
    }
    if (appleIconEl) {
      appleIconEl.href = '/apple-touch-icon.png';
    }
    return;
  }

  if (faviconEl) {
    faviconEl.removeAttribute('type');
    faviconEl.href = clean;
  }
  if (appleIconEl) {
    appleIconEl.href = clean;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = async () => {
    const icon192 = await renderLogoSquarePng(img, 192);
    const icon512 = await renderLogoSquarePng(img, 512);
    if (!icon192 || !icon512) return;

    if (appleIconEl) {
      appleIconEl.href = icon192;
    }

    const manifestPayload = {
      name: siteName,
      short_name: siteName.slice(0, 24),
      start_url: '/',
      display: 'standalone',
      background_color: '#111111',
      theme_color: primaryColor || '#B91C1C',
      icons: [
        { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    };

    try {
      if (dynamicManifestObjectUrl) {
        URL.revokeObjectURL(dynamicManifestObjectUrl);
      }
      const blob = new Blob([JSON.stringify(manifestPayload)], { type: 'application/manifest+json' });
      dynamicManifestObjectUrl = URL.createObjectURL(blob);
      let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      if (!manifestLink) {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        document.head.appendChild(manifestLink);
      }
      manifestLink.href = dynamicManifestObjectUrl;
    } catch {
      // Ignore if manifest replacement is blocked
    }
  };
  img.src = clean;
}

export function buildShareLinks(title: string, url: string) {
  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);
  return {
    whatsapp: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
  };
}

export function generateRssXml(posts: Post[], config: SiteConfig, origin: string): string {
  const escapeXml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const items = posts
    .filter((p) => p.status === 'published')
    .slice(0, 30)
    .map((post) => {
      const pubDate = toDate(post.publishedAt || post.createdAt).toUTCString();
      const link = `${origin}/articulo/${post.slug}`;
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(post.categoryName)}</category>
      <author>${escapeXml(post.authorName)}</author>
      <description>${escapeXml(post.seoDescription || post.subtitle || post.title)}</description>
    </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(config.siteName)}</title>
    <link>${escapeXml(origin)}</link>
    <description>${escapeXml(config.tagline)}</description>
    <language>es</language>
${items}
  </channel>
</rss>`;
}

export function generateSitemapXml(posts: Post[], origin: string): string {
  const staticPaths = [
    '/',
    '/buscar',
    '/tolima',
    '/colaboradores',
    '/unete',
    '/quienes-somos',
    '/como-trabajamos',
    '/contacto',
    '/terminos',
    '/privacidad',
  ];
  const urls = [
    ...staticPaths.map(
      (p) => `  <url><loc>${origin}${p}</loc><changefreq>daily</changefreq><priority>${p === '/' ? '1.0' : '0.7'}</priority></url>`
    ),
    ...posts
      .filter((p) => p.status === 'published')
      .map(
        (p) =>
          `  <url><loc>${origin}/articulo/${p.slug}</loc><lastmod>${toDate(p.updatedAt || p.createdAt).toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`
      ),
  ].join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildCleanDuplicatePostPayload(
  source: Post,
  newId: string,
  timestamps: { createdAt: unknown; updatedAt: unknown },
  overrides?: {
    authorId?: string;
    authorProfileId?: string;
    authorIdentityType?: 'owner' | 'magazine' | 'collaborator';
    authorVerified?: boolean;
  }
): Record<string, unknown> {
  const baseTitle = (source.title || 'Publicación').trim();
  const copyTitle = `Copia de ${baseTitle}`.slice(0, 220);
  const copySlug = slugify(`${copyTitle}-${newId.slice(-4)}`).slice(0, 240);
  const safeAuthorName = (source.authorName || 'Redacción').trim().slice(0, 120);
  const safeTags = Array.isArray(source.tags)
    ? source.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, 12)
    : [];

  const payload: Record<string, unknown> = {
    id: newId,
    title: copyTitle.length >= 3 ? copyTitle : 'Copia de nota',
    slug: copySlug.length >= 2 ? copySlug : `copia-${newId.slice(-6)}`,
    subtitle: (source.subtitle || '').slice(0, 500),
    type: source.type && source.type !== 'livestream' ? source.type : 'article',
    ...(source.editorialKind ? { editorialKind: source.editorialKind } : {}),
    status: 'draft',
    featured: false,
    breaking: false,
    pinnedInFeed: false,
    isSample: false,
    categoryId: source.categoryId || 'cat_politica',
    categoryName: (source.categoryName || 'Política').slice(0, 80),
    categorySlug: (source.categorySlug || 'politica').slice(0, 100),
    ...(source.seriesId ? { seriesId: source.seriesId.slice(0, 128) } : {}),
    ...(source.seriesTitle ? { seriesTitle: source.seriesTitle.slice(0, 160) } : {}),
    tags: safeTags,
    authorId: overrides?.authorId || source.authorId,
    ...(overrides?.authorProfileId || source.authorProfileId
      ? { authorProfileId: (overrides?.authorProfileId || source.authorProfileId || '').slice(0, 128) }
      : {}),
    ...(overrides?.authorIdentityType || source.authorIdentityType
      ? { authorIdentityType: overrides?.authorIdentityType || source.authorIdentityType }
      : {}),
    authorVerified: overrides?.authorVerified ?? source.authorVerified ?? true,
    authorName: safeAuthorName.length >= 2 ? safeAuthorName : 'Redacción',
    ...(source.authorAvatar ? { authorAvatar: source.authorAvatar.slice(0, 400000) } : {}),
    ...(source.authorOutletType ? { authorOutletType: source.authorOutletType } : {}),
    ...(source.coverImage ? { coverImage: source.coverImage.slice(0, 400000) } : {}),
    ...(source.coverAlt ? { coverAlt: source.coverAlt.slice(0, 300) } : {}),
    ...(source.coverCredit ? { coverCredit: source.coverCredit.slice(0, 200) } : {}),
    ...(source.coverLayout ? { coverLayout: source.coverLayout } : {}),
    ...(source.headerStyle ? { headerStyle: source.headerStyle } : {}),
    ...(source.accentColor && /^#[0-9a-fA-F]{3,8}$/.test(source.accentColor)
      ? { accentColor: source.accentColor.slice(0, 20) }
      : {}),
    paragraphIndent: Boolean(source.paragraphIndent),
    showTableOfContents: Boolean(source.showTableOfContents),
    blocks: Array.isArray(source.blocks) ? stripUndefinedDeep(source.blocks.slice(0, 80)) : [],
    ...(Array.isArray(source.galleryItems) && source.galleryItems.length > 0
      ? { galleryItems: stripUndefinedDeep(source.galleryItems.slice(0, 30)) }
      : {}),
    ...(Array.isArray(source.corrections) && source.corrections.length > 0
      ? { corrections: stripUndefinedDeep(source.corrections.slice(0, 30)) }
      : {}),
    ...(Array.isArray(source.keyPoints) && source.keyPoints.length > 0
      ? { keyPoints: source.keyPoints.slice(0, 10) }
      : {}),
    sensitiveContent: Boolean(source.sensitiveContent),
    ...(source.sensitiveWarning ? { sensitiveWarning: source.sensitiveWarning.slice(0, 300) } : {}),
    ...(Array.isArray(source.sources) && source.sources.length > 0
      ? { sources: stripUndefinedDeep(source.sources.slice(0, 30)) }
      : {}),
    ...(source.seoDescription ? { seoDescription: source.seoDescription.slice(0, 320) } : {}),
    commentsEnabled: source.commentsEnabled ?? true,
    ...(source.mediaUrl ? { mediaUrl: source.mediaUrl.slice(0, 400000) } : {}),
    ...(source.mediaSourceType ? { mediaSourceType: source.mediaSourceType.slice(0, 40) } : {}),
    ...(Array.isArray(source.mediaChapters) && source.mediaChapters.length > 0
      ? { mediaChapters: stripUndefinedDeep(source.mediaChapters.slice(0, 50)) }
      : {}),
    ...(source.mediaTranscript ? { mediaTranscript: source.mediaTranscript.slice(0, 40000) } : {}),
    ...(source.mediaSubtitlesUrl ? { mediaSubtitlesUrl: source.mediaSubtitlesUrl.slice(0, 1000) } : {}),
    ...(source.mediaDurationLabel ? { mediaDurationLabel: source.mediaDurationLabel.slice(0, 40) } : {}),
    ...(Array.isArray(source.mediaRelatedLinks) && source.mediaRelatedLinks.length > 0
      ? { mediaRelatedLinks: stripUndefinedDeep(source.mediaRelatedLinks.slice(0, 20)) }
      : {}),
    ...(source.episodeNotes ? { episodeNotes: source.episodeNotes.slice(0, 10000) } : {}),
    ...(typeof source.seasonNumber === 'number' && source.seasonNumber >= 1 && source.seasonNumber <= 999
      ? { seasonNumber: source.seasonNumber }
      : {}),
    ...(typeof source.episodeNumber === 'number' && source.episodeNumber >= 1 && source.episodeNumber <= 9999
      ? { episodeNumber: source.episodeNumber }
      : {}),
    ...(source.documentTitle ? { documentTitle: source.documentTitle.slice(0, 200) } : {}),
    ...(typeof source.audioDurationSec === 'number' && source.audioDurationSec >= 0 && source.audioDurationSec <= 86400
      ? { audioDurationSec: source.audioDurationSec }
      : {}),
    readTimeMinutes: Math.max(1, Math.min(180, Number(source.readTimeMinutes) || 1)),
    viewCount: 0,
    commentCount: 0,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  };

  return payload;
}

