export type MediaProvider =
  | 'youtube'
  | 'vimeo'
  | 'spotify'
  | 'soundcloud'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'gdrive'
  | 'dropbox'
  | 'direct'
  | 'other';

export interface MediaInspectionResult {
  isValid: boolean;
  errorReason?: string;
  warning?: string;
  kind: 'iframe' | 'video' | 'audio' | 'link';
  src: string;
  previewIframeUrl?: string;
  provider: MediaProvider;
  platformLabel: string;
  thumbnailUrl?: string;
  titleHint: string;
  originalUrl: string;
  embeddable: boolean;
}

function parseYouTubeStartSeconds(parsed: URL, explicitStart?: number): number | undefined {
  if (typeof explicitStart === 'number' && explicitStart > 0) {
    return Math.floor(explicitStart);
  }
  const rawT = parsed.searchParams.get('t') || parsed.searchParams.get('start') || '';
  if (!rawT) return undefined;
  if (/^\d+$/.test(rawT)) return Number(rawT);
  const match = rawT.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
  if (!match) return undefined;
  const h = Number(match[1] || 0);
  const m = Number(match[2] || 0);
  const s = Number(match[3] || 0);
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : undefined;
}

function extractDriveId(parsed: URL): string {
  const pathMatch = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (pathMatch?.[1]) return pathMatch[1];
  const openId = parsed.searchParams.get('id');
  if (openId && /^[a-zA-Z0-9_-]{10,}$/.test(openId)) return openId;
  return '';
}

function isDirectAudioPath(pathname: string): boolean {
  return /\.(mp3|wav|m4a|aac|ogg|oga|flac|opus|weba)(\?.*)?$/i.test(pathname);
}

function isDirectVideoPath(pathname: string): boolean {
  return /\.(mp4|webm|m3u8|mov|m4v|ogv)(\?.*)?$/i.test(pathname);
}

function isImagePath(pathname: string): boolean {
  return /\.(webp|jpe?g|png|gif|avif|svg)(\?.*)?$/i.test(pathname);
}

/**
 * Analiza, valida y convierte enlaces de YouTube, Vimeo, Spotify, SoundCloud,
 * Facebook, Instagram, TikTok, Google Drive, Dropbox y medios directos.
 */
export function inspectMediaUrl(
  url: string,
  kindHint?: 'video' | 'audio' | 'document' | 'social',
  startSeconds?: number
): MediaInspectionResult {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      errorReason: 'Ingresa un enlace válido que comience con https://',
      kind: 'link',
      src: '',
      provider: 'other',
      platformLabel: 'Enlace',
      titleHint: 'Enlace externo',
      originalUrl: '',
      embeddable: false,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      errorReason: 'El enlace no tiene un formato de URL válido (debe empezar por https:// o http://).',
      kind: 'link',
      src: '',
      provider: 'other',
      platformLabel: 'Enlace inválido',
      titleHint: 'Enlace inválido',
      originalUrl: trimmed,
      embeddable: false,
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      errorReason: 'Por seguridad solo se permiten enlaces con protocolo http:// o https://.',
      kind: 'link',
      src: '',
      provider: 'other',
      platformLabel: 'Protocolo bloqueado',
      titleHint: 'Protocolo no permitido',
      originalUrl: trimmed,
      embeddable: false,
    };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  const cleanOriginal = parsed.toString();

  // 1. YouTube (watch, youtu.be, shorts, live, embed)
  if (host === 'youtube.com' || host === 'youtu.be' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    let vid = '';
    if (host === 'youtu.be') {
      vid = parsed.pathname.slice(1).split('/')[0] || '';
    } else if (parsed.pathname.includes('/live/')) {
      vid = parsed.pathname.split('/live/')[1]?.split('/')[0] || '';
    } else if (parsed.pathname.includes('/embed/')) {
      vid = parsed.pathname.split('/embed/')[1]?.split('/')[0] || '';
    } else if (parsed.pathname.includes('/shorts/')) {
      vid = parsed.pathname.split('/shorts/')[1]?.split('/')[0] || '';
    } else {
      vid = parsed.searchParams.get('v') || '';
    }
    vid = vid.replace(/[^a-zA-Z0-9_-]/g, '');

    if (!vid) {
      return {
        isValid: false,
        errorReason: 'Enlace de YouTube incompleto: falta el identificador del video (v=, /shorts/, /live/ o youtu.be/).',
        kind: 'link',
        src: cleanOriginal,
        provider: 'youtube',
        platformLabel: 'YouTube',
        titleHint: 'Video de YouTube',
        originalUrl: cleanOriginal,
        embeddable: false,
      };
    }

    const start = parseYouTubeStartSeconds(parsed, startSeconds);
    const startParam = start ? `&start=${start}` : '';
    return {
      isValid: true,
      kind: 'iframe',
      src: `https://www.youtube.com/embed/${vid}?rel=0${startParam}`,
      provider: 'youtube',
      platformLabel: parsed.pathname.includes('/shorts/') ? 'YouTube Shorts' : parsed.pathname.includes('/live/') ? 'YouTube Live' : 'YouTube',
      thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
      titleHint: 'Reproductor de YouTube',
      originalUrl: cleanOriginal,
      embeddable: true,
    };
  }

  // 2. Vimeo
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const segments = parsed.pathname.split('/').filter(Boolean);
    const vid = [...segments].reverse().find((seg) => /^\d+$/.test(seg)) || '';
    if (!vid) {
      return {
        isValid: false,
        errorReason: 'Enlace de Vimeo inválido: no se encontró el ID numérico del video.',
        kind: 'link',
        src: cleanOriginal,
        provider: 'vimeo',
        platformLabel: 'Vimeo',
        titleHint: 'Video de Vimeo',
        originalUrl: cleanOriginal,
        embeddable: false,
      };
    }
    const hashTime = typeof startSeconds === 'number' && startSeconds > 0 ? `#t=${Math.floor(startSeconds)}s` : '';
    return {
      isValid: true,
      kind: 'iframe',
      src: `https://player.vimeo.com/video/${vid}${hashTime}`,
      provider: 'vimeo',
      platformLabel: 'Vimeo',
      titleHint: 'Reproductor de Vimeo',
      originalUrl: cleanOriginal,
      embeddable: true,
    };
  }

  // 3. Spotify (canción, álbum, playlist, episodio, programa/podcast)
  if (host === 'open.spotify.com' || host === 'play.spotify.com') {
    const parts = parsed.pathname.split('/').filter(Boolean).filter((seg) => !/^intl-[a-z-]+$/i.test(seg));
    const kindSeg = parts[0];
    const itemId = parts[1];
    if (kindSeg && itemId && ['track', 'album', 'playlist', 'episode', 'show'].includes(kindSeg)) {
      const labelMap: Record<string, string> = {
        track: 'Spotify · Canción',
        album: 'Spotify · Álbum',
        playlist: 'Spotify · Lista',
        episode: 'Spotify · Episodio',
        show: 'Spotify · Pódcast',
      };
      return {
        isValid: true,
        kind: 'iframe',
        src: `https://open.spotify.com/embed/${kindSeg}/${itemId}`,
        provider: 'spotify',
        platformLabel: labelMap[kindSeg] || 'Spotify',
        titleHint: 'Reproductor de Spotify',
        originalUrl: cleanOriginal,
        embeddable: true,
      };
    }
    return {
      isValid: false,
      errorReason: 'Enlace de Spotify no reconocido. Usa un enlace de canción, álbum, episodio o programa.',
      kind: 'link',
      src: cleanOriginal,
      provider: 'spotify',
      platformLabel: 'Spotify',
      titleHint: 'Enlace de Spotify',
      originalUrl: cleanOriginal,
      embeddable: false,
    };
  }

  // 4. SoundCloud
  if (host === 'soundcloud.com' || host === 'on.soundcloud.com') {
    if (host === 'on.soundcloud.com') {
      return {
        isValid: true,
        warning: 'Los enlaces cortos on.soundcloud.com pueden requerir abrirse directo; si no carga, usa la URL completa de soundcloud.com.',
        kind: 'link',
        src: cleanOriginal,
        provider: 'soundcloud',
        platformLabel: 'SoundCloud',
        titleHint: 'Audio en SoundCloud',
        originalUrl: cleanOriginal,
        embeddable: false,
      };
    }
    return {
      isValid: true,
      kind: 'iframe',
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(cleanOriginal)}&color=%23B91C1C&auto_play=false&show_teaser=true`,
      provider: 'soundcloud',
      platformLabel: 'SoundCloud',
      titleHint: 'Audio de SoundCloud',
      originalUrl: cleanOriginal,
      embeddable: true,
    };
  }

  // 5. Facebook (videos, reels, watch y publicaciones)
  if (host === 'facebook.com' || host === 'fb.watch' || host === 'web.facebook.com') {
    const isVideoLike =
      host === 'fb.watch' ||
      /\/(videos?|watch|reel|reels|share\/v|share\/r)/i.test(parsed.pathname) ||
      parsed.searchParams.has('v');
    const pluginPath = isVideoLike || kindHint === 'video' ? 'video.php' : 'post.php';
    return {
      isValid: true,
      warning: 'Si el navegador bloquea cookies de terceros de Facebook, se mostrará la tarjeta con botón Abrir enlace.',
      kind: 'iframe',
      src: `https://www.facebook.com/plugins/${pluginPath}?href=${encodeURIComponent(cleanOriginal)}&show_text=false`,
      provider: 'facebook',
      platformLabel: isVideoLike ? 'Video de Facebook' : 'Publicación de Facebook',
      titleHint: isVideoLike ? 'Video incrustado de Facebook' : 'Publicación de Facebook',
      originalUrl: cleanOriginal,
      embeddable: true,
    };
  }

  // 6. Instagram (/p/, /reel/, /tv/)
  if (host === 'instagram.com' || host === 'instagr.am') {
    const igMatch = parsed.pathname.match(/^\/(p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/);
    if (igMatch) {
      const kindSeg = igMatch[1] === 'reels' ? 'reel' : igMatch[1];
      const code = igMatch[2];
      return {
        isValid: true,
        warning: 'Instagram a veces limita la vista previa dentro de marcos; si falla, se ofrecerá la tarjeta Abrir enlace.',
        kind: 'iframe',
        src: `https://www.instagram.com/${kindSeg}/${code}/embed`,
        provider: 'instagram',
        platformLabel: kindSeg === 'reel' ? 'Instagram Reel' : 'Instagram',
        titleHint: 'Publicación de Instagram',
        originalUrl: cleanOriginal,
        embeddable: true,
      };
    }
    return {
      isValid: true,
      warning: 'Solo las publicaciones (/p/, /reel/ o /tv/) de Instagram permiten reproductor incrustado; este enlace abrirá en tarjeta.',
      kind: 'link',
      src: cleanOriginal,
      provider: 'instagram',
      platformLabel: 'Instagram',
      titleHint: 'Perfil o enlace de Instagram',
      originalUrl: cleanOriginal,
      embeddable: false,
    };
  }

  // 7. TikTok
  if (host === 'tiktok.com' || host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
    const ttMatch = parsed.pathname.match(/\/video\/(\d+)/);
    if (ttMatch?.[1]) {
      return {
        isValid: true,
        kind: 'iframe',
        src: `https://www.tiktok.com/embed/v2/${ttMatch[1]}`,
        provider: 'tiktok',
        platformLabel: 'TikTok',
        titleHint: 'Video de TikTok',
        originalUrl: cleanOriginal,
        embeddable: true,
      };
    }
    return {
      isValid: true,
      warning: 'Los enlaces cortos de TikTok (vm.tiktok.com) no permiten marco directo: pega la URL larga con /video/ID o usa la tarjeta de respaldo.',
      kind: 'link',
      src: cleanOriginal,
      provider: 'tiktok',
      platformLabel: 'TikTok',
      titleHint: 'Video en TikTok',
      originalUrl: cleanOriginal,
      embeddable: false,
    };
  }

  // 8. Google Drive (enlace directo + respaldo preview)
  if (host === 'drive.google.com' || host === 'docs.google.com') {
    const driveId = extractDriveId(parsed);
    if (!driveId) {
      return {
        isValid: false,
        errorReason: 'Enlace de Google Drive sin ID de archivo (/file/d/ID/view o ?id=ID).',
        kind: 'link',
        src: cleanOriginal,
        provider: 'gdrive',
        platformLabel: 'Google Drive',
        titleHint: 'Archivo de Google Drive',
        originalUrl: cleanOriginal,
        embeddable: false,
      };
    }
    const directStream = `https://drive.google.com/uc?export=download&id=${driveId}`;
    const previewUrl = `https://drive.google.com/file/d/${driveId}/preview`;
    if (kindHint === 'audio') {
      return {
        isValid: true,
        warning: 'Asegúrate de que el archivo de Google Drive esté compartido como "Cualquier persona con el enlace".',
        kind: 'audio',
        src: directStream,
        previewIframeUrl: previewUrl,
        provider: 'gdrive',
        platformLabel: 'Google Drive Audio',
        titleHint: 'Audio alojado en Google Drive',
        originalUrl: cleanOriginal,
        embeddable: true,
      };
    }
    if (kindHint === 'video') {
      return {
        isValid: true,
        warning: 'Asegúrate de que el video en Google Drive sea público ("Cualquier persona con el enlace").',
        kind: 'video',
        src: directStream,
        previewIframeUrl: previewUrl,
        provider: 'gdrive',
        platformLabel: 'Google Drive Video',
        titleHint: 'Video alojado en Google Drive',
        originalUrl: cleanOriginal,
        embeddable: true,
      };
    }
    return {
      isValid: true,
      kind: 'iframe',
      src: previewUrl,
      previewIframeUrl: previewUrl,
      provider: 'gdrive',
      platformLabel: 'Google Drive',
      titleHint: 'Documento o medio de Google Drive',
      originalUrl: cleanOriginal,
      embeddable: true,
    };
  }

  // 9. Dropbox (?raw=1 directo para audio/video)
  if (host === 'dropbox.com' || host === 'dl.dropboxusercontent.com') {
    const rawUrl = new URL(cleanOriginal);
    if (host === 'dropbox.com') {
      rawUrl.searchParams.delete('dl');
      rawUrl.searchParams.set('raw', '1');
    }
    const directSrc = rawUrl.toString();
    const inferredKind: 'audio' | 'video' | 'link' =
      kindHint === 'audio' || isDirectAudioPath(parsed.pathname)
        ? 'audio'
        : kindHint === 'video' || isDirectVideoPath(parsed.pathname)
        ? 'video'
        : 'link';
    return {
      isValid: true,
      kind: inferredKind,
      src: directSrc,
      provider: 'dropbox',
      platformLabel: 'Dropbox',
      titleHint: inferredKind === 'audio' ? 'Audio en Dropbox' : inferredKind === 'video' ? 'Video en Dropbox' : 'Archivo en Dropbox',
      originalUrl: cleanOriginal,
      embeddable: inferredKind !== 'link',
    };
  }

  // 10. Firebase Storage / archivos multimedia directos
  if (isDirectAudioPath(parsed.pathname)) {
    return {
      isValid: true,
      kind: 'audio',
      src: cleanOriginal,
      provider: 'direct',
      platformLabel: 'Audio directo',
      titleHint: 'Archivo de audio directo',
      originalUrl: cleanOriginal,
      embeddable: true,
    };
  }
  if (isDirectVideoPath(parsed.pathname)) {
    return {
      isValid: true,
      kind: 'video',
      src: cleanOriginal,
      provider: 'direct',
      platformLabel: 'Video directo',
      titleHint: 'Archivo de video directo',
      originalUrl: cleanOriginal,
      embeddable: true,
    };
  }
  if (parsed.hostname.includes('firebasestorage.googleapis.com')) {
    const decodedPath = decodeURIComponent(parsed.pathname);
    if (isDirectAudioPath(decodedPath) || kindHint === 'audio') {
      return {
        isValid: true,
        kind: 'audio',
        src: cleanOriginal,
        provider: 'direct',
        platformLabel: 'Audio alojado',
        titleHint: 'Archivo de audio',
        originalUrl: cleanOriginal,
        embeddable: true,
      };
    }
    if (isDirectVideoPath(decodedPath) || kindHint === 'video') {
      return {
        isValid: true,
        kind: 'video',
        src: cleanOriginal,
        provider: 'direct',
        platformLabel: 'Video alojado',
        titleHint: 'Archivo de video',
        originalUrl: cleanOriginal,
        embeddable: true,
      };
    }
  }

  if (isImagePath(parsed.pathname) && (kindHint === 'video' || kindHint === 'audio')) {
    return {
      isValid: false,
      errorReason: 'Este enlace apunta a una imagen y no a un archivo de audio o video reproducible.',
      kind: 'link',
      src: cleanOriginal,
      provider: 'other',
      platformLabel: host,
      titleHint: 'Imagen externa',
      originalUrl: cleanOriginal,
      embeddable: false,
    };
  }

  // 11. Genérico externo válido -> tarjeta de enlace segura
  return {
    isValid: true,
    warning:
      kindHint === 'video' || kindHint === 'audio'
        ? 'Este dominio no tiene reproductor incrustado automático; se mostrará una tarjeta con botón "Abrir enlace".'
        : undefined,
    kind: 'link',
    src: cleanOriginal,
    provider: 'other',
    platformLabel: host,
    titleHint: `Enlace en ${host}`,
    originalUrl: cleanOriginal,
    embeddable: false,
  };
}
