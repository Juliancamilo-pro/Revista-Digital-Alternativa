import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from './firebase';
import { ContentBlock, Post, SiteConfig } from '../types/editorial';

export function generateId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'nota';
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
    return new Date(((value as { seconds: number }).seconds) * 1000);
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

export function estimateReadTime(blocks: ContentBlock[], subtitle = ''): number {
  const words = [
    subtitle,
    ...blocks.map((b) => {
      if (b.text) return b.text;
      if (b.timelineEntries) return b.timelineEntries.map((t) => `${t.title} ${t.detail}`).join(' ');
      if (b.tableRows) return b.tableRows.flat().join(' ');
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
  originalBytes: number;
  optimizedBytes: number;
  width: number;
  height: number;
}

export async function optimizeImageFile(file: File, maxDimension = 1440, quality = 0.82): Promise<OptimizedImageResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Archivo de imagen inválido.'));
      img.onload = () => {
        let { width, height } = img;
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
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas no disponible.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
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

/**
 * Uploads optimized media to Firebase Storage when permitted,
 * gracefully falling back to compact optimized data URLs for images under 350KB
 * if Storage bucket security rules have not yet been opened in Firebase Console.
 */
export async function uploadMediaAsset(
  file: File,
  folder: string,
  onProgress?: (pct: number) => void
): Promise<{ url: string; info: string }> {
  const isImage = file.type.startsWith('image/');
  let payloadBlob: Blob = file;
  let fallbackDataUrl = '';
  let optimizationNote = '';

  if (isImage) {
    const optimized = await optimizeImageFile(file, 1280, 0.8);
    payloadBlob = optimized.blob;
    fallbackDataUrl = optimized.dataUrl;
    const savedPct = Math.max(0, Math.round((1 - optimized.optimizedBytes / Math.max(1, optimized.originalBytes)) * 100));
    optimizationNote = `Optimizada (${Math.round(optimized.optimizedBytes / 1024)} KB, -${savedPct}%)`;
  }

  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const storageRef = ref(storage, `${folder}/${safeName}`);

  try {
    const url = await new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, payloadBlob, {
        contentType: isImage ? 'image/webp' : file.type || 'application/octet-stream',
      });
      const timer = setTimeout(() => {
        task.cancel();
        reject(new Error('storage-timeout'));
      }, 8000);
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
    return { url, info: optimizationNote || 'Subido a Firebase Storage' };
  } catch {
    if (isImage && fallbackDataUrl && fallbackDataUrl.length < 380000) {
      return {
        url: fallbackDataUrl,
        info: `${optimizationNote} · Guardada en formato comprimido`,
      };
    }
    if (isImage) {
      // Re-compress more aggressively to fit Firestore document cap
      const tighter = await optimizeImageFile(file, 900, 0.65);
      if (tighter.dataUrl.length < 380000) {
        return {
          url: tighter.dataUrl,
          info: `Comprimida (${Math.round(tighter.optimizedBytes / 1024)} KB) · Modo compacto`,
        };
      }
    }
    throw new Error(
      'No se pudo subir a Firebase Storage. Verifica las reglas de Storage o usa una URL externa directa.'
    );
  }
}

export function getEmbedUrl(url: string): { kind: 'iframe' | 'video' | 'link'; src: string } {
  const trimmed = (url || '').trim();
  if (!trimmed) return { kind: 'link', src: '' };
  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { kind: 'link', src: '' };
    }
    // YouTube
    if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
      let vid = '';
      if (parsed.hostname.includes('youtu.be')) {
        vid = parsed.pathname.slice(1).split('/')[0];
      } else if (parsed.pathname.includes('/live/')) {
        vid = parsed.pathname.split('/live/')[1]?.split('/')[0] || '';
      } else if (parsed.pathname.includes('/embed/')) {
        vid = parsed.pathname.split('/embed/')[1]?.split('/')[0] || '';
      } else if (parsed.pathname.includes('/shorts/')) {
        vid = parsed.pathname.split('/shorts/')[1]?.split('/')[0] || '';
      } else {
        vid = parsed.searchParams.get('v') || '';
      }
      if (vid) {
        return { kind: 'iframe', src: `https://www.youtube.com/embed/${vid}?rel=0` };
      }
    }
    // Vimeo
    if (parsed.hostname.includes('vimeo.com')) {
      const vid = parsed.pathname.split('/').filter(Boolean).pop() || '';
      if (vid && /^\d+$/.test(vid)) {
        return { kind: 'iframe', src: `https://player.vimeo.com/video/${vid}` };
      }
    }
    // Twitch
    if (parsed.hostname.includes('twitch.tv')) {
      const channel = parsed.pathname.split('/').filter(Boolean)[0] || '';
      const parent = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      if (channel) {
        return { kind: 'iframe', src: `https://player.twitch.tv/?channel=${channel}&parent=${parent}` };
      }
    }
    // Facebook Live / Video
    if (parsed.hostname.includes('facebook.com')) {
      return {
        kind: 'iframe',
        src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}&show_text=false`,
      };
    }
    // Direct video file
    if (/\.(mp4|webm|ogg|m3u8)(\?.*)?$/i.test(parsed.pathname)) {
      return { kind: 'video', src: trimmed };
    }
    return { kind: 'link', src: trimmed };
  } catch {
    return { kind: 'link', src: '' };
  }
}

export function sanitizeExternalUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/')) {
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
    case 'articulo':
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

export function updateDynamicAppIcons(logoUrl?: string, siteName = 'Revista Digital Alternativa', primaryColor = '#B91C1C'): void {
  if (typeof document === 'undefined') return;
  const clean = sanitizeExternalUrl(logoUrl || '');
  const faviconEl = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  const appleIconEl = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;

  if (!clean) {
    if (faviconEl) {
      faviconEl.type = 'image/svg+xml';
      faviconEl.href = '/icon.svg';
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
      <description>${escapeXml(post.subtitle || post.title)}</description>
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
    '/en-vivo',
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
