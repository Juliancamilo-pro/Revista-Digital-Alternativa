import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowLeft,
  BookMarked,
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Headphones,
  History,
  Info,
  List,
  ListChecks,
  Maximize2,
  Pause,
  Play,
  Quote,
  RotateCcw,
  RotateCw,
  Share2,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDataSaver } from '../context/DataSaverContext';
import { AudioTrackItem, useMediaPlayer } from '../context/MediaPlayerContext';
import { FontSizeScale, useSite } from '../context/SiteContext';
import { buildArticleCitationApa, sortApaReferencesAlphabetically } from '../lib/apa';
import { checkActionCooldown, generateSpamChallenge, markActionCooldown } from '../lib/appCheck';
import { db } from '../lib/firebase';
import {
  buildShareLinks,
  formatDateEs,
  formatDateKey,
  formatSecondsToTimestamp,
  generateId,
  getEditorialKindLabel,
  getEmbedUrl,
  parseMediaUrlMeta,
  sanitizeExternalUrl,
  toDate,
} from '../lib/utils';
import { CollaboratorPublic, ContentBlock, GalleryItem } from '../types/editorial';
import { ArticleCard } from './ArticleCard';
import { AuthorDossierCard } from './AuthorDossierCard';
import { CommentsSection } from './CommentsSection';
import { EditorialImage } from './EditorialImage';
import { QuoteShareModal } from './QuoteShareModal';
import { VerifiedBadge } from './VerifiedBadge';

/** Safe inline formatter for **bold**, *italic*, [label](https://...), and [n] */
function renderInlineText(raw: string): React.ReactNode {
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
            className="underline decoration-[var(--editorial-primary)] underline-offset-4 hover:text-[var(--editorial-primary)]"
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
      <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-neutral-900 select-none border border-neutral-300 dark:border-neutral-800">
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
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded bg-black/75 text-white font-display text-[11px] font-bold uppercase tracking-wider">
            {block.beforeLabel}
          </span>
        )}
        {block.afterLabel && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded bg-black/75 text-white font-display text-[11px] font-bold uppercase tracking-wider">
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
        <figcaption className="text-xs text-neutral-600 dark:text-neutral-400 italic">
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
      <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-300 dark:border-neutral-800">
        <EditorialImage
          src={active.url}
          alt={active.alt || active.caption || 'Imagen de carrusel'}
          fallbackTitle={active.caption}
          className="w-full h-full object-cover"
        />
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)}
              aria-label="Diapositiva anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/70 text-white hover:bg-black cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setIdx((i) => (i + 1) % items.length)}
              aria-label="Diapositiva siguiente"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/70 text-white hover:bg-black cursor-pointer"
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
        <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400">
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
                  className={`w-2 h-2 rounded-full cursor-pointer transition-colors ${
                    i === idx ? 'bg-[var(--editorial-primary)]' : 'bg-neutral-400/50'
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

export const ArticleView: React.FC<{ slug: string }> = ({ slug }) => {
  const {
    publishedPosts,
    myPosts,
    allPostsForAdmin,
    collaborators,
    adminIdentities,
    isAuthorVerified,
    siteConfig,
    fontSize,
    setFontSize,
    readingMode,
    setReadingMode,
    navigate,
    setAuthModalOpen,
  } = useSite();

  const { isDataSaverActive } = useDataSaver();
  const { firebaseUser, bookmarks, toggleBookmark } = useAuth();
  const {
    currentTrack,
    isPlaying: globalAudioPlaying,
    currentTime: globalAudioTime,
    duration: globalAudioDuration,
    playbackRate: globalAudioRate,
    playTrack,
    togglePlayPause,
    seekTo,
    skipBy,
    setPlaybackRate,
  } = useMediaPlayer();

  const post = useMemo(() => {
    const pool = [...publishedPosts, ...myPosts, ...allPostsForAdmin];
    return pool.find((p) => p.slug === slug || p.id === slug) || null;
  }, [publishedPosts, myPosts, allPostsForAdmin, slug]);

  const isLegacyAdminMatch = Boolean(
    post &&
      !collaborators.some((c) => c.uid === post.authorId) &&
      (post.authorName === siteConfig.siteName ||
        post.authorName === adminIdentities.magazine.name ||
        post.authorName === adminIdentities.owner.name)
  );

  const isAdminIdentity = Boolean(
    post &&
      (post.authorIdentityType === 'owner' ||
        post.authorIdentityType === 'magazine' ||
        post.authorProfileId === 'owner' ||
        post.authorProfileId === 'magazine' ||
        isLegacyAdminMatch)
  );

  const adminIdentityKey: 'owner' | 'magazine' =
    post?.authorProfileId === 'magazine' ||
    post?.authorIdentityType === 'magazine' ||
    (isLegacyAdminMatch &&
      (post?.authorName === siteConfig.siteName ||
        post?.authorName === adminIdentities.magazine.name))
      ? 'magazine'
      : 'owner';

  const adminIdentity = useMemo(() => {
    if (!post || !isAdminIdentity) return null;
    return adminIdentities[adminIdentityKey];
  }, [post, isAdminIdentity, adminIdentityKey, adminIdentities]);

  const [fetchedAuthor, setFetchedAuthor] = useState<CollaboratorPublic | null>(null);
  const collabProfile = useMemo(() => {
    if (!post || isAdminIdentity) return null;
    return collaborators.find((c) => c.uid === post.authorId) || fetchedAuthor;
  }, [collaborators, fetchedAuthor, post, isAdminIdentity]);

  useEffect(() => {
    if (!post || isAdminIdentity || collaborators.some((c) => c.uid === post.authorId)) {
      setFetchedAuthor(null);
      return;
    }
    getDoc(doc(db, 'collaborators_public', post.authorId))
      .then((snap) => {
        if (snap.exists()) {
          setFetchedAuthor(snap.data() as CollaboratorPublic);
        }
      })
      .catch(() => undefined);
  }, [post?.authorId, isAdminIdentity, collaborators]);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedApa, setCopiedApa] = useState(false);
  const [showSharePreview, setShowSharePreview] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [infographicOpen, setInfographicOpen] = useState(false);
  const [mediaLoadedInDataSaver, setMediaLoadedInDataSaver] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [videoStartSec, setVideoStartSec] = useState<number | undefined>(undefined);
  const [quoteShare, setQuoteShare] = useState<{ text: string; author?: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Report modal state + antispam
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Información inexacta o descontextualizada');
  const [reportDetails, setReportDetails] = useState('');
  const [reportName, setReportName] = useState('');
  const [reportEmail, setReportEmail] = useState('');
  const [reportHoneypot, setReportHoneypot] = useState('');
  const [reportChallengeSeed, setReportChallengeSeed] = useState(0);
  const reportChallenge = useMemo(() => generateSpamChallenge(), [reportChallengeSeed]);
  const [reportChallengeAns, setReportChallengeAns] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportErr, setReportErr] = useState('');
  const [reportDone, setReportDone] = useState('');

  // Speech synthesis state
  const [speechStatus, setSpeechStatus] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [speechRate, setSpeechRate] = useState(1);

  const viewLoggedRef = useRef<string | null>(null);
  const enteredAtRef = useRef<number>(Date.now());

  useEffect(() => {
    setMediaLoadedInDataSaver(false);
    setInfographicOpen(false);
    setLightboxIdx(null);
    setTranscriptOpen(false);
    setVideoStartSec(undefined);
  }, [post?.id]);

  // Reading progress bar
  useEffect(() => {
    const onScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        setScrollProgress(0);
        return;
      }
      setScrollProgress(Math.min(100, Math.max(0, Math.round((window.scrollY / docHeight) * 100))));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cleanup speech synthesis on leave
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setReadingMode(false);
    };
  }, [setReadingMode]);

  // Sync browser title & SEO description meta tags while reading article
  useEffect(() => {
    if (!post) return;
    document.title = `${post.title} – ${siteConfig.siteName}`;
    const desc = post.seoDescription || post.subtitle || siteConfig.tagline || siteConfig.siteName;
    const metas = [
      document.querySelector('meta[name="description"]'),
      document.querySelector('meta[property="og:description"]'),
      document.querySelector('meta[name="twitter:description"]'),
    ];
    const prevContents = metas.map((m) => m?.getAttribute('content') || '');
    metas.forEach((m) => m?.setAttribute('content', desc));

    return () => {
      document.title = `${siteConfig.siteName} – Periodismo Independiente y Crítico`;
      metas.forEach((m, idx) => {
        if (m && prevContents[idx]) m.setAttribute('content', prevContents[idx]);
      });
    };
  }, [post?.title, post?.seoDescription, post?.subtitle, siteConfig.siteName, siteConfig.tagline]);

  // Privacy-safe view increment & analytics event
  useEffect(() => {
    if (!post || post.status !== 'published') return;
    enteredAtRef.current = Date.now();
    if (viewLoggedRef.current !== post.id) {
      viewLoggedRef.current = post.id;
      const key = `viewed_${post.id}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        updateDoc(doc(db, 'posts', post.id), {
          viewCount: increment(1),
        }).catch(() => undefined);
      }
    }

    return () => {
      const durationSec = Math.min(7200, Math.max(1, Math.round((Date.now() - enteredAtRef.current) / 1000)));
      const eventId = generateId('evt');
      const refHost = document.referrer
        ? (() => {
            try {
              return new URL(document.referrer).hostname;
            } catch {
              return 'directo';
            }
          })()
        : 'directo';
      setDoc(doc(db, 'analytics_events', eventId), {
        id: eventId,
        postId: post.id,
        categoryId: post.categoryId,
        authorId: post.authorId,
        contentType: post.type,
        readDurationSec: durationSec,
        referrerSource: refHost.slice(0, 80),
        dateKey: formatDateKey(),
        createdAt: serverTimestamp(),
      }).catch(() => undefined);
    };
  }, [post?.id]);

  // Keyboard navigation in lightbox / infographic viewer
  useEffect(() => {
    if (lightboxIdx === null && !infographicOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIdx(null);
        setInfographicOpen(false);
      }
      if (lightboxIdx !== null && post?.galleryItems) {
        const items = post.galleryItems;
        if (e.key === 'ArrowRight') setLightboxIdx((i) => (i === null ? 0 : (i + 1) % items.length));
        if (e.key === 'ArrowLeft') setLightboxIdx((i) => (i === null ? 0 : (i - 1 + items.length) % items.length));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, infographicOpen, post?.galleryItems]);

  const seriesEpisodes = useMemo(() => {
    if (!post?.seriesId) return [];
    return publishedPosts
      .filter((p) => p.seriesId === post.seriesId)
      .sort((a, b) => {
        const epA = (a.seasonNumber || 1) * 10000 + (a.episodeNumber || 999);
        const epB = (b.seasonNumber || 1) * 10000 + (b.episodeNumber || 999);
        if (epA !== epB) return epA - epB;
        return toDate(a.publishedAt || a.createdAt).getTime() - toDate(b.publishedAt || b.createdAt).getTime();
      });
  }, [publishedPosts, post?.seriesId]);

  const seriesAudioQueue: AudioTrackItem[] = useMemo(() => {
    return seriesEpisodes
      .filter((p) => {
        if (p.type !== 'audio' || !p.mediaUrl) return false;
        const info = getEmbedUrl(p.mediaUrl);
        return info.kind === 'audio' || info.kind === 'link';
      })
      .map((p) => ({
        postId: p.id,
        title: p.title,
        slug: p.slug,
        authorName: p.authorName,
        mediaUrl: sanitizeExternalUrl(p.mediaUrl || ''),
        coverImage: p.coverImage,
        seasonNumber: p.seasonNumber,
        episodeNumber: p.episodeNumber,
      }))
      .filter((t) => Boolean(t.mediaUrl));
  }, [seriesEpisodes]);

  const sortedApaRefs = useMemo(
    () => sortApaReferencesAlphabetically(post?.apaReferences || []),
    [post?.apaReferences]
  );

  if (!post) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-display text-4xl font-extrabold uppercase">Publicación no encontrada</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          El artículo que buscas no existe o fue retirado de la edición pública.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-6 py-2.5 rounded-full bg-[var(--editorial-primary)] text-white font-display font-bold uppercase tracking-wider text-sm cursor-pointer"
        >
          Volver a la portada
        </button>
      </main>
    );
  }

  const isSaved = bookmarks.some((b) => b.postId === post.id);
  const articleUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareLinks = buildShareLinks(post.title, articleUrl);

  const pubDateMs = toDate(post.publishedAt || post.createdAt).getTime();
  const updDateMs = post.updatedAt ? toDate(post.updatedAt).getTime() : 0;
  const wasSignificantlyUpdated = updDateMs > pubDateMs + 5 * 60 * 1000;

  const fontSizeClass: Record<FontSizeScale, string> = {
    sm: 'text-[16px] leading-[1.7]',
    md: 'text-[18px] sm:text-[19px] leading-[1.78]',
    lg: 'text-[21px] leading-[1.8]',
    xl: 'text-[23px] leading-[1.85]',
  };

  const handleToggleSpeech = () => {
    if (!('speechSynthesis' in window)) return;
    if (speechStatus === 'playing') {
      window.speechSynthesis.pause();
      setSpeechStatus('paused');
      return;
    }
    if (speechStatus === 'paused') {
      window.speechSynthesis.resume();
      setSpeechStatus('playing');
      return;
    }

    window.speechSynthesis.cancel();
    const fullText = [
      post.title,
      post.subtitle || '',
      ...(post.keyPoints || []),
      ...post.blocks
        .filter(
          (b) =>
            b.type === 'paragraph' ||
            b.type === 'heading' ||
            b.type === 'quote' ||
            b.type === 'speaker_quote' ||
            b.type === 'callout' ||
            b.type === 'context_box' ||
            b.type === 'list'
        )
        .map((b) => {
          if (b.type === 'list') return (b.listItems || []).join('. ');
          if (b.type === 'callout' || b.type === 'context_box') return `${b.calloutTitle || ''}. ${b.text || ''}`;
          return b.text || '';
        }),
    ]
      .filter(Boolean)
      .join('. ')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '');

    const utterance = new SpeechSynthesisUtterance(fullText);
    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find((v) => v.lang.startsWith('es'));
    if (esVoice) utterance.voice = esVoice;
    utterance.lang = esVoice?.lang || 'es-ES';
    utterance.rate = speechRate;
    utterance.onend = () => setSpeechStatus('idle');
    utterance.onerror = () => setSpeechStatus('idle');
    window.speechSynthesis.speak(utterance);
    setSpeechStatus('playing');
  };

  const handleStopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeechStatus('idle');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(articleUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyApaCitation = async () => {
    const citation = buildArticleCitationApa(post, resolvedAuthorName, siteConfig.siteName, articleUrl);
    try {
      await navigator.clipboard.writeText(citation);
      setCopiedApa(true);
      setTimeout(() => setCopiedApa(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportErr('');
    setReportDone('');
    if (reportHoneypot.trim()) {
      setReportDone('Denuncia enviada al equipo de administración para revisión.');
      return;
    }
    const cd = checkActionCooldown(`report_${post.id}`, 30000);
    if (!cd.allowed) {
      setReportErr(`Espera ${cd.remainingSec} segundos antes de enviar otro reporte.`);
      return;
    }
    const cleanName = reportName.trim().slice(0, 120);
    const cleanEmail = reportEmail.trim().slice(0, 200);
    const cleanDetails = reportDetails.trim().slice(0, 3000);
    if (cleanName.length < 2) {
      setReportErr('Ingresa tu nombre (mínimo 2 caracteres).');
      return;
    }
    if (cleanEmail.length < 5 || !cleanEmail.includes('@')) {
      setReportErr('Ingresa un correo electrónico válido.');
      return;
    }
    if (cleanDetails.length < 5) {
      setReportErr('Describe el motivo del reporte con al menos 5 caracteres.');
      return;
    }
    if (!firebaseUser && Number(reportChallengeAns.trim()) !== reportChallenge.expectedAnswer) {
      setReportErr('Verifica la respuesta de control antispam.');
      return;
    }

    setReportSubmitting(true);
    try {
      const id = generateId('rep');
      await setDoc(doc(db, 'reports_and_rectifications', id), {
        id,
        type: 'denuncia',
        postId: post.id,
        postTitle: post.title.slice(0, 220),
        reporterName: cleanName,
        reporterEmail: cleanEmail,
        reason: reportReason.slice(0, 200),
        details: cleanDetails,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      markActionCooldown(`report_${post.id}`);
      setReportDone('Denuncia enviada al equipo de administración para revisión.');
      setReportDetails('');
      setReportChallengeAns('');
      setReportChallengeSeed((n) => n + 1);
      setTimeout(() => {
        setReportOpen(false);
        setReportDone('');
      }, 1500);
    } catch {
      setReportErr('No se pudo enviar el reporte en este momento. Intenta nuevamente.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const relatedPosts = publishedPosts
    .filter((p) => p.id !== post.id && (p.categoryId === post.categoryId || p.tags.some((t) => post.tags.includes(t))))
    .slice(0, 3);

  const footnotes = post.blocks.filter((b) => b.type === 'footnote');
  const bodyBlocks = post.blocks.filter((b) => b.type !== 'footnote');
  const headings = bodyBlocks.filter((b) => b.type === 'heading' && b.text?.trim());
  const shouldShowToc = Boolean(post.showTableOfContents || (post.apaMode && headings.length >= 3)) && headings.length > 0;

  let paragraphIdx = 0;
  let figureCounter = 0;
  let tableCounter = 0;

  const embedInfo = post.mediaUrl ? getEmbedUrl(post.mediaUrl, videoStartSec) : null;
  const authorTargetId = isAdminIdentity ? adminIdentityKey : post.authorId;

  const verified = isAuthorVerified(
    authorTargetId,
    post.authorIdentityType,
    post.authorVerified,
    post.authorName
  );

  const resolvedAuthorName = isAdminIdentity
    ? adminIdentity?.name || post.authorName
    : collabProfile?.name || post.authorName;
  const resolvedAuthorAvatar = isAdminIdentity
    ? adminIdentity?.avatarUrl || post.authorAvatar || siteConfig.logoUrl
    : collabProfile?.showAvatar === true
    ? collabProfile.avatarUrl || post.authorAvatar
    : undefined;

  const showMediaDeferredBanner = isDataSaverActive && !mediaLoadedInDataSaver;
  const coverLayout = post.coverLayout || 'full';
  const headerStyle = post.headerStyle || 'classic';
  const customAccentStyle =
    post.accentColor && /^#[0-9a-fA-F]{3,8}$/.test(post.accentColor)
      ? ({
          '--editorial-primary': post.accentColor,
          '--editorial-accent': post.accentColor,
        } as React.CSSProperties)
      : undefined;

  const isThisAudioPlaying = Boolean(
    currentTrack && currentTrack.postId === post.id && globalAudioPlaying
  );
  const isThisAudioLoaded = Boolean(currentTrack && currentTrack.postId === post.id);
  const currentAudioUrl = sanitizeExternalUrl(post.mediaUrl || '');

  const handlePlayCurrentEpisode = (seekSeconds?: number) => {
    if (!currentAudioUrl) return;
    const track: AudioTrackItem = {
      postId: post.id,
      title: post.title,
      slug: post.slug,
      authorName: resolvedAuthorName,
      mediaUrl: currentAudioUrl,
      coverImage: post.coverImage,
      seasonNumber: post.seasonNumber,
      episodeNumber: post.episodeNumber,
    };
    const nextQueue = seriesAudioQueue.some((t) => t.postId === post.id)
      ? seriesAudioQueue
      : [track];
    if (typeof seekSeconds === 'number') {
      if (!isThisAudioLoaded) {
        playTrack(track, nextQueue);
        setTimeout(() => seekTo(seekSeconds), 200);
      } else {
        seekTo(seekSeconds);
        if (!globalAudioPlaying) togglePlayPause();
      }
      return;
    }
    playTrack(track, nextQueue);
  };

  const handleSeekVideoChapter = (sec: number) => {
    setMediaLoadedInDataSaver(true);
    if (embedInfo?.kind === 'video' && videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.play().catch(() => undefined);
    } else {
      setVideoStartSec(sec);
    }
  };

  return (
    <article className="relative animate-[fade-up-enter_0.35s_ease-out]" style={customAccentStyle}>
      {/* Fixed Reading Progress Bar */}
      <div
        role="progressbar"
        aria-valuenow={scrollProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso de lectura"
        className="fixed top-0 left-0 h-1 bg-[var(--editorial-primary)] z-50 transition-[width] duration-100"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Distraction-free exit bar */}
      {readingMode && (
        <div className="sticky top-0 z-40 border-b border-neutral-300 dark:border-neutral-800 bg-[#F8F6F1]/95 dark:bg-[#0D0D0D]/95 backdrop-blur-md px-4 py-2.5 flex items-center justify-between max-w-4xl mx-auto">
          <span className="font-display text-xs uppercase tracking-widest text-neutral-500">
            Modo lectura sin distracciones · {scrollProgress}%
          </span>
          <button
            type="button"
            onClick={() => setReadingMode(false)}
            className="px-4 py-1.5 rounded-full border border-neutral-400 dark:border-neutral-700 font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Salir del modo lectura
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        {!readingMode && (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 hover:text-[var(--editorial-primary)] mb-6 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Volver a portada</span>
          </button>
        )}

        {/* Header + Cover Variants */}
        {coverLayout === 'overlay' && post.coverImage && post.type !== 'video' ? (
          <header className="relative rounded-3xl overflow-hidden bg-[#111111] text-white min-h-[420px] flex items-end p-6 sm:p-10 shadow-xl">
            <EditorialImage
              src={post.coverImage}
              alt={post.coverAlt || post.title}
              fallbackTitle={post.title}
              priority
              sensitive={post.sensitiveContent}
              sensitiveWarning={post.sensitiveWarning}
              wrapperClassName="absolute inset-0"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/65 to-black/25 pointer-events-none" />
            <div className="relative z-10 max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-display font-bold uppercase tracking-widest">
                <span className="px-2.5 py-0.5 rounded-full bg-[var(--editorial-primary)] text-white">
                  {getEditorialKindLabel(post.editorialKind)}
                </span>
                <a
                  href={`/categoria/${post.categorySlug}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/categoria/${post.categorySlug}`);
                  }}
                  className="hover:underline text-white/95"
                >
                  {post.categoryName}
                </a>
                {post.seriesTitle && <span className="text-neutral-300">· {post.seriesTitle}</span>}
              </div>
              <h1 className="font-display text-3xl sm:text-5xl font-extrabold leading-[1.03] tracking-tight headline-balance">
                {post.title}
              </h1>
              {post.subtitle && (
                <p className="text-base sm:text-xl text-neutral-200 leading-relaxed">{post.subtitle}</p>
              )}
            </div>
          </header>
        ) : (
          <header
            className={
              headerStyle === 'editorial'
                ? 'rounded-3xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 sm:p-9 shadow-sm'
                : headerStyle === 'minimal'
                ? 'text-center max-w-3xl mx-auto'
                : ''
            }
          >
            <div className={coverLayout === 'compact' && post.coverImage && post.type !== 'video' ? 'grid grid-cols-1 md:grid-cols-12 gap-6 items-center' : ''}>
              <div className={coverLayout === 'compact' && post.coverImage && post.type !== 'video' ? 'md:col-span-7' : ''}>
                <div className={`flex flex-wrap items-center gap-2 text-xs font-display font-bold uppercase tracking-widest text-[var(--editorial-primary)] ${headerStyle === 'minimal' ? 'justify-center' : ''}`}>
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--editorial-primary)]/10 text-[var(--editorial-primary)] border border-[var(--editorial-primary)]/25">
                    {getEditorialKindLabel(post.editorialKind)}
                  </span>
                  <a
                    href={`/categoria/${post.categorySlug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/categoria/${post.categorySlug}`);
                    }}
                    className="hover:underline"
                  >
                    {post.categoryName}
                  </a>
                  {post.seriesTitle && (
                    <>
                      <span aria-hidden="true" className="text-neutral-400">·</span>
                      <a
                        href={`/serie/${encodeURIComponent(post.seriesTitle.toLowerCase())}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate('/buscar');
                        }}
                        className="text-neutral-700 dark:text-neutral-300 hover:underline"
                      >
                        {post.seriesTitle}
                      </a>
                    </>
                  )}
                </div>

                <h1 className="mt-3 font-display text-3xl sm:text-5xl lg:text-[3.35rem] font-extrabold leading-[1.03] tracking-tight headline-balance">
                  {post.title}
                </h1>

                {post.subtitle && (
                  <p className="mt-4 text-lg sm:text-xl text-neutral-700 dark:text-neutral-300 leading-relaxed">
                    {post.subtitle}
                  </p>
                )}
              </div>

              {coverLayout === 'compact' && post.coverImage && post.type !== 'video' && (
                <figure className="md:col-span-5">
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-900 shadow-md">
                    <EditorialImage
                      src={post.coverImage}
                      alt={post.coverAlt || post.title}
                      fallbackTitle={post.title}
                      priority
                      sensitive={post.sensitiveContent}
                      sensitiveWarning={post.sensitiveWarning}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {(post.coverAlt || post.coverCredit) && (
                    <figcaption className="mt-1.5 text-[11px] text-neutral-500 italic">
                      {post.coverAlt || post.coverCredit}
                    </figcaption>
                  )}
                </figure>
              )}
            </div>
          </header>
        )}

        {/* Byline & Metadata */}
        <div className="mt-6 py-4 border-y border-neutral-300 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 ring-2 ring-[var(--editorial-primary)]/20 flex items-center justify-center">
              {resolvedAuthorAvatar ? (
                <EditorialImage
                  src={resolvedAuthorAvatar}
                  alt={resolvedAuthorName}
                  fallbackTitle={resolvedAuthorName}
                  allowInDataSaver
                />
              ) : (
                <span className="font-display text-base font-extrabold text-neutral-700 dark:text-neutral-200">
                  {resolvedAuthorName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <a
                href={`/colaborador/${authorTargetId}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/colaborador/${authorTargetId}`);
                }}
                className="inline-flex items-center gap-1.5 font-display text-base font-bold uppercase tracking-wide hover:text-[var(--editorial-primary)]"
              >
                <span>{resolvedAuthorName}</span>
                {verified && <VerifiedBadge size="xs" />}
              </a>
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                <span>Publicado: {formatDateEs(post.publishedAt || post.createdAt, true)}</span>
                {wasSignificantlyUpdated && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                      Actualizado: {formatDateEs(post.updatedAt, true)}
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-tabular">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {post.readTimeMinutes} min de lectura
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 font-tabular">
                  <Eye className="w-3 h-3" aria-hidden="true" />
                  {(post.viewCount || 0).toLocaleString('es-ES')} lecturas
                </span>
              </div>
            </div>
          </div>

          {/* Reader Accessibility & Bookmark Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-full overflow-hidden border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#161616]">
              {(['sm', 'md', 'lg', 'xl'] as FontSizeScale[]).map((s, idx) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFontSize(s)}
                  aria-label={`Tamaño de letra ${s}`}
                  className={`px-2.5 py-1.5 text-xs font-display font-bold cursor-pointer transition-colors ${
                    fontSize === s
                      ? 'bg-[#111111] text-white dark:bg-white dark:text-black'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {['A-', 'A', 'A+', 'A++'][idx]}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setReadingMode(!readingMode)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-display font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                readingMode
                  ? 'bg-[#111111] text-white border-[#111111] dark:bg-white dark:text-black'
                  : 'border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Modo lectura</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                if (!firebaseUser) {
                  setAuthModalOpen(true);
                  return;
                }
                try {
                  await toggleBookmark(post);
                } catch {
                  // Logged in AuthContext
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-display font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                isSaved
                  ? 'border-[var(--editorial-primary)] text-[var(--editorial-primary)] bg-[var(--editorial-primary)]/5'
                  : 'border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
              <span>{isSaved ? 'Guardado' : 'Guardar'}</span>
            </button>
          </div>
        </div>

        {/* Browser Speech Synthesis Audio Reader Bar */}
        <div className="mt-4 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-[var(--editorial-primary)] shrink-0" aria-hidden="true" />
            <span className="font-display text-xs font-bold uppercase tracking-wider">
              Versión en audio (lectura en voz alta)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Velocidad de lectura en voz alta"
              value={speechRate}
              onChange={(e) => setSpeechRate(Number(e.target.value))}
              className="px-2.5 py-1 rounded-full text-xs font-tabular border border-neutral-300 dark:border-neutral-700 bg-[#F8F6F1] dark:bg-[#1E1E1E]"
            >
              <option value={0.85}>0.85x</option>
              <option value={1}>1.0x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
            </select>
            <button
              type="button"
              onClick={handleToggleSpeech}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              {speechStatus === 'playing' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{speechStatus === 'playing' ? 'Pausar' : speechStatus === 'paused' ? 'Reanudar' : 'Escuchar'}</span>
            </button>
            {speechStatus !== 'idle' && (
              <button
                type="button"
                onClick={handleStopSpeech}
                aria-label="Detener audio"
                className="p-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 text-neutral-600 hover:text-red-600 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Full Cover Media / Zoomable Infographic */}
        {coverLayout === 'full' && post.coverImage && post.type !== 'video' && (
          <figure className="mt-8">
            <div
              className={`relative rounded-2xl overflow-hidden bg-neutral-900 shadow-lg ${
                post.type === 'infographic' ? 'cursor-zoom-in' : 'aspect-[16/9]'
              }`}
              onClick={() => {
                if (post.type === 'infographic') setInfographicOpen(true);
              }}
            >
              <EditorialImage
                src={post.coverImage}
                alt={post.coverAlt || post.title}
                fallbackTitle={post.title}
                priority
                sensitive={post.sensitiveContent}
                sensitiveWarning={post.sensitiveWarning}
                className={post.type === 'infographic' ? 'w-full h-auto object-contain' : 'w-full h-full object-cover'}
              />
              {post.type === 'infographic' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfographicOpen(true);
                  }}
                  className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/80 text-white font-display text-xs font-bold uppercase tracking-wider shadow cursor-pointer hover:bg-black"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Ampliar infografía</span>
                </button>
              )}
            </div>
            {(post.coverAlt || post.coverCredit) && (
              <figcaption className="mt-2.5 text-xs text-neutral-600 dark:text-neutral-400 italic flex flex-wrap justify-between gap-2">
                <span>{post.coverAlt}</span>
                {post.coverCredit && <span className="not-italic font-display uppercase tracking-wider">{post.coverCredit}</span>}
              </figcaption>
            )}
          </figure>
        )}

        {/* Downloadable Document / PDF Card */}
        {post.type === 'document' && sanitizeExternalUrl(post.mediaUrl || '') && (
          <div className="mt-8 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[var(--editorial-primary)]/10 text-[var(--editorial-primary)] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                  Documento adjunto para lectura y descarga
                </p>
                <p className="font-display text-lg font-bold mt-0.5">
                  {post.documentTitle || post.title}
                </p>
              </div>
            </div>
            <a
              href={sanitizeExternalUrl(post.mediaUrl || '')}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase tracking-wider shrink-0 transition-colors"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Abrir / Descargar PDF</span>
            </a>
          </div>
        )}

        {/* Enhanced Video Player with Chapters, Subtitles & Transcript */}
        {post.type === 'video' && embedInfo && embedInfo.src && (
          <section className="mt-8 space-y-4">
            <div className="rounded-2xl overflow-hidden border border-neutral-300 dark:border-neutral-800 bg-black shadow-lg">
              {showMediaDeferredBanner ? (
                <div className="p-10 text-center text-white space-y-3 bg-neutral-950">
                  <p className="font-display text-xs font-bold uppercase tracking-widest text-[#FCA5A5]">
                    Modo ahorro de datos activo
                  </p>
                  <p className="text-sm text-neutral-300">
                    El video externo no se cargó automáticamente para cuidar tu consumo móvil.
                  </p>
                  <button
                    type="button"
                    onClick={() => setMediaLoadedInDataSaver(true)}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white text-[#111111] font-display text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-neutral-200"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Cargar reproductor de video</span>
                  </button>
                </div>
              ) : embedInfo.kind === 'iframe' ? (
                <div className="aspect-video">
                  <iframe
                    src={embedInfo.src}
                    title={post.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : embedInfo.kind === 'video' ? (
                <video
                  ref={videoRef}
                  src={embedInfo.src}
                  controls
                  preload={isDataSaverActive ? 'none' : 'metadata'}
                  className="w-full aspect-video"
                  poster={sanitizeExternalUrl(parseMediaUrlMeta(post.coverImage || '').cleanUrl)}
                >
                  {post.mediaSubtitlesUrl && sanitizeExternalUrl(post.mediaSubtitlesUrl) && (
                    <track
                      kind="subtitles"
                      src={sanitizeExternalUrl(post.mediaSubtitlesUrl)}
                      srcLang="es"
                      label="Español"
                      default
                    />
                  )}
                </video>
              ) : (
                <div className="p-8 text-center text-white space-y-2">
                  <p className="text-sm">Enlace de video externo:</p>
                  <a href={embedInfo.src} target="_blank" rel="noopener noreferrer" className="underline text-[#FCA5A5]">
                    {embedInfo.src}
                  </a>
                </div>
              )}
            </div>

            {post.mediaDurationLabel && (
              <p className="text-xs font-tabular text-neutral-500">
                Duración total: {post.mediaDurationLabel}
              </p>
            )}

            {post.mediaChapters && post.mediaChapters.length > 0 && (
              <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 space-y-2.5">
                <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                  Capítulos del video
                </p>
                <div className="flex flex-wrap gap-2">
                  {post.mediaChapters.map((chap) => (
                    <button
                      key={chap.id}
                      type="button"
                      onClick={() => handleSeekVideoChapter(chap.timeSec)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:border-[var(--editorial-primary)] text-xs cursor-pointer transition-colors"
                    >
                      <span className="font-tabular font-bold text-[var(--editorial-primary)]">
                        {formatSecondsToTimestamp(chap.timeSec)}
                      </span>
                      <span>{chap.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {post.mediaTranscript && (
              <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4">
                <button
                  type="button"
                  onClick={() => setTranscriptOpen((v) => !v)}
                  className="w-full flex items-center justify-between font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  <span>Transcripción del video</span>
                  {transcriptOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {transcriptOpen && (
                  <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-line">
                    {post.mediaTranscript}
                  </p>
                )}
              </div>
            )}

            {post.mediaRelatedLinks && post.mediaRelatedLinks.length > 0 && (
              <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 space-y-2">
                <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                  Recursos mencionados
                </p>
                <ul className="space-y-1 text-xs">
                  {post.mediaRelatedLinks.map((lnk, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span>{lnk.label}</span>
                      {lnk.url && sanitizeExternalUrl(lnk.url) && (
                        <a
                          href={sanitizeExternalUrl(lnk.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--editorial-primary)] hover:underline inline-flex items-center gap-1"
                        >
                          Abrir <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Enhanced Audio / Podcast Player + Persistent Mini-Player Integration */}
        {post.type === 'audio' && currentAudioUrl && (
          <section className="mt-8 space-y-4">
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-[#111111] text-white p-5 sm:p-6 space-y-4 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-[#FCA5A5]">
                  <Headphones className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {post.seasonNumber || post.episodeNumber
                      ? `Pódcast · ${post.seasonNumber ? `Temp. ${post.seasonNumber} ` : ''}${
                          post.episodeNumber ? `Ep. ${post.episodeNumber}` : ''
                        }`
                      : 'Reproductor de pódcast y crónica sonora'}
                  </span>
                </div>
                {post.mediaDurationLabel && (
                  <span className="font-tabular text-xs text-neutral-400">
                    Duración: {post.mediaDurationLabel}
                  </span>
                )}
              </div>

              {embedInfo?.kind === 'iframe' ? (
                showMediaDeferredBanner ? (
                  <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-neutral-300">
                      Ahorro de datos activo: pulsa para cargar el reproductor externo.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMediaLoadedInDataSaver(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-[#111111] font-display text-xs font-bold uppercase cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Cargar episodio</span>
                    </button>
                  </div>
                ) : (
                  <iframe
                    src={embedInfo.src}
                    title={post.title}
                    className="w-full h-40 rounded-xl"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  />
                )
              ) : (
                <div className="space-y-3">
                  {/* Unified Persistent Audio Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePlayCurrentEpisode()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                      >
                        {isThisAudioPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        <span>{isThisAudioPlaying ? 'Pausar episodio' : isThisAudioLoaded ? 'Reanudar' : 'Reproducir episodio'}</span>
                      </button>

                      {isThisAudioLoaded && (
                        <>
                          <button
                            type="button"
                            onClick={() => skipBy(-15)}
                            aria-label="Retroceder 15 segundos"
                            className="p-2 rounded-full border border-neutral-700 hover:border-white text-neutral-300 cursor-pointer"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => skipBy(15)}
                            aria-label="Adelantar 15 segundos"
                            className="p-2 rounded-full border border-neutral-700 hover:border-white text-neutral-300 cursor-pointer"
                          >
                            <RotateCw className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-tabular">
                      <span className="text-neutral-400">Velocidad:</span>
                      {[0.75, 1, 1.25, 1.5, 2].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setPlaybackRate(r)}
                          className={`px-2.5 py-0.5 rounded-full border cursor-pointer ${
                            globalAudioRate === r
                              ? 'bg-[var(--editorial-primary)] border-[var(--editorial-primary)] text-white'
                              : 'border-neutral-700 text-neutral-300'
                          }`}
                        >
                          {r}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {isThisAudioLoaded && (
                    <div className="space-y-1">
                      <input
                        type="range"
                        min={0}
                        max={Math.max(1, Math.floor(globalAudioDuration || 100))}
                        value={Math.floor(globalAudioTime)}
                        onChange={(e) => seekTo(Number(e.target.value))}
                        aria-label="Barra de progreso del episodio"
                        className="w-full accent-[var(--editorial-primary)] cursor-pointer"
                      />
                      <div className="flex justify-between font-tabular text-[11px] text-neutral-400">
                        <span>{formatSecondsToTimestamp(globalAudioTime)}</span>
                        <span>{formatSecondsToTimestamp(globalAudioDuration)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {post.mediaChapters && post.mediaChapters.length > 0 && (
                <div className="pt-3 border-t border-neutral-800 space-y-2">
                  <p className="font-display text-xs font-bold uppercase tracking-widest text-neutral-400">
                    Capítulos del episodio
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {post.mediaChapters.map((chap) => (
                      <button
                        key={chap.id}
                        type="button"
                        onClick={() => handlePlayCurrentEpisode(chap.timeSec)}
                        className="text-left px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-start gap-2.5 cursor-pointer transition-colors"
                      >
                        <span className="font-tabular text-xs font-bold text-[#FCA5A5] shrink-0">
                          {formatSecondsToTimestamp(chap.timeSec)}
                        </span>
                        <span className="text-xs text-neutral-200">{chap.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {post.episodeNotes && (
              <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 space-y-1.5">
                <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                  Notas del episodio
                </p>
                <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-line">
                  {post.episodeNotes}
                </p>
              </div>
            )}

            {post.mediaTranscript && (
              <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4">
                <button
                  type="button"
                  onClick={() => setTranscriptOpen((v) => !v)}
                  className="w-full flex items-center justify-between font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  <span>Transcripción completa del episodio</span>
                  {transcriptOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {transcriptOpen && (
                  <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-line">
                    {post.mediaTranscript}
                  </p>
                )}
              </div>
            )}

            {seriesEpisodes.length > 1 && (
              <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 space-y-2.5">
                <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                  Más episodios en {post.seriesTitle || 'esta serie'}
                </p>
                <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {seriesEpisodes.map((ep) => (
                    <li key={ep.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                      <a
                        href={`/articulo/${ep.slug}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/articulo/${ep.slug}`);
                        }}
                        className={`hover:text-[var(--editorial-primary)] truncate ${
                          ep.id === post.id ? 'font-bold text-[var(--editorial-primary)]' : ''
                        }`}
                      >
                        {ep.episodeNumber ? `Ep. ${ep.episodeNumber} · ` : ''}
                        {ep.title}
                      </a>
                      {ep.mediaDurationLabel && (
                        <span className="font-tabular text-neutral-500 shrink-0">{ep.mediaDurationLabel}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Photo Gallery Grid if galleryItems present */}
        {post.galleryItems && post.galleryItems.length > 0 && (
          <section className="mt-8 space-y-4">
            <h2 className="font-display text-lg font-bold uppercase tracking-wider border-b border-neutral-300 dark:border-neutral-800 pb-2">
              Galería fotográfica ({post.galleryItems.length} imágenes)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {post.galleryItems.map((item: GalleryItem, idx: number) => (
                <figure
                  key={item.id}
                  onClick={() => setLightboxIdx(idx)}
                  className="group cursor-pointer rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <EditorialImage
                      src={item.url}
                      alt={item.alt || item.caption}
                      fallbackTitle={item.caption}
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                    <span className="absolute top-2.5 right-2.5 rounded-full bg-black/70 text-white p-2 opacity-80 group-hover:opacity-100">
                      <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </div>
                  <figcaption className="p-3.5 text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    <p>{item.caption}</p>
                    {item.credit && (
                      <p className="mt-1 font-display uppercase tracking-wider text-neutral-500">
                        Crédito: {item.credit}
                      </p>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* Key Points Summary Box */}
        {post.keyPoints && post.keyPoints.length > 0 && (
          <aside className="max-w-[70ch] mx-auto mt-8 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 space-y-2.5">
            <h2 className="inline-flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-widest text-[var(--editorial-primary)]">
              <ListChecks className="w-4 h-4" aria-hidden="true" />
              <span>Puntos clave</span>
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-sm sm:text-base text-neutral-800 dark:text-neutral-200 leading-relaxed">
              {post.keyPoints.map((kp, i) => (
                <li key={i}>{renderInlineText(kp)}</li>
              ))}
            </ul>
          </aside>
        )}

        {/* Clickable Table of Contents */}
        {shouldShowToc && (
          <nav
            aria-label="Tabla de contenidos"
            className="max-w-[70ch] mx-auto mt-6 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 space-y-2.5"
          >
            <p className="inline-flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-widest text-[var(--editorial-primary)]">
              <List className="w-4 h-4" aria-hidden="true" />
              <span>Tabla de contenidos</span>
            </p>
            <ol className="space-y-1 text-sm">
              {headings.map((hd) => (
                <li
                  key={hd.id}
                  className={hd.level === 4 ? 'pl-8' : hd.level === 3 ? 'pl-4' : ''}
                >
                  <a
                    href={`#sec-${hd.id}`}
                    className="text-neutral-700 dark:text-neutral-300 hover:text-[var(--editorial-primary)] hover:underline"
                  >
                    {hd.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Article Body Column (65-72ch measure) */}
        <div className={`mt-10 max-w-[70ch] mx-auto space-y-6 font-editorial ${fontSizeClass[fontSize]}`}>
          {bodyBlocks.map((block: ContentBlock) => {
            switch (block.type) {
              case 'paragraph': {
                const isFirst = paragraphIdx === 0;
                paragraphIdx++;
                const classNames = isFirst
                  ? 'editorial-lead'
                  : post.paragraphIndent
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
                    <h4 id={anchorId} key={block.id} className="font-display text-xl font-bold tracking-tight pt-2 scroll-mt-16">
                      {block.text}
                    </h4>
                  );
                }
                if (block.level === 3) {
                  return (
                    <h3 id={anchorId} key={block.id} className="font-display text-2xl font-bold tracking-tight pt-3 scroll-mt-16">
                      {block.text}
                    </h3>
                  );
                }
                return (
                  <h2 id={anchorId} key={block.id} className="font-display text-3xl font-extrabold tracking-tight pt-5 scroll-mt-16">
                    {block.text}
                  </h2>
                );
              }
              case 'quote': {
                const wordCount = (block.text || '').trim().split(/\s+/).filter(Boolean).length;
                if (post.apaMode && wordCount >= 40) {
                  return (
                    <blockquote
                      key={block.id}
                      className="my-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] py-4 pr-5 apa-blockquote space-y-2"
                    >
                      <p className="text-[#111111] dark:text-[#F4F1EA]">
                        {renderInlineText(block.text || '')}
                      </p>
                      {block.author && (
                        <footer className="text-xs font-display font-bold uppercase tracking-wider text-neutral-500">
                          — {block.author}
                        </footer>
                      )}
                    </blockquote>
                  );
                }
                return (
                  <blockquote
                    key={block.id}
                    className="my-8 py-6 border-y border-neutral-400 dark:border-neutral-700 text-center px-4 space-y-3"
                  >
                    <p className="font-editorial italic text-2xl sm:text-3xl leading-snug text-[#111111] dark:text-[#F4F1EA]">
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
                          setQuoteShare({
                            text: block.text || '',
                            author: block.author || resolvedAuthorName,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300 hover:border-[var(--editorial-primary)] hover:text-[var(--editorial-primary)] cursor-pointer transition-colors"
                      >
                        <Quote className="w-3.5 h-3.5" />
                        <span>Compartir cita</span>
                      </button>
                    </div>
                  </blockquote>
                );
              }
              case 'speaker_quote':
                return (
                  <blockquote
                    key={block.id}
                    className="my-8 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-4 shadow-xs"
                  >
                    <p className="font-editorial italic text-xl sm:text-2xl leading-relaxed text-[#111111] dark:text-[#F4F1EA]">
                      “{block.text}”
                    </p>
                    <footer className="flex items-center gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                      {block.imageUrl && (
                        <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 bg-neutral-200 dark:bg-neutral-800">
                          <EditorialImage src={block.imageUrl} alt={block.author || ''} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        {block.author && (
                          <p className="font-display text-sm font-bold uppercase tracking-wider text-[var(--editorial-primary)]">
                            {block.author}
                          </p>
                        )}
                        {block.speakerRole && (
                          <p className="text-xs text-neutral-500">{block.speakerRole}</p>
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
                    ? 'border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/20'
                    : tone === 'key_fact'
                    ? 'border-[var(--editorial-primary)]/35 bg-neutral-100/90 dark:bg-neutral-900'
                    : block.type === 'context_box'
                    ? 'border-neutral-300 dark:border-neutral-800 bg-neutral-100/80 dark:bg-[#171717]'
                    : 'border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414]';
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
                      <p className="text-base leading-relaxed text-neutral-800 dark:text-neutral-200 whitespace-pre-line">
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
                        className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 space-y-1.5"
                      >
                        {col.title && (
                          <h4 className="font-display text-base font-bold uppercase tracking-wide text-[var(--editorial-primary)]">
                            {col.title}
                          </h4>
                        )}
                        <p className="text-sm sm:text-base leading-relaxed text-neutral-800 dark:text-neutral-200">
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
                          className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 space-y-1"
                        >
                          <p className="font-display text-3xl sm:text-4xl font-extrabold text-[var(--editorial-primary)] font-tabular">
                            {m.value}
                          </p>
                          <p className="font-display text-sm font-bold uppercase tracking-wide">{m.label}</p>
                          {m.detail && <p className="text-xs text-neutral-500">{m.detail}</p>}
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
                  <ol key={block.id} className="list-decimal pl-6 space-y-2">
                    {items.map((item, idx) => (
                      <li key={idx}>{renderInlineText(item)}</li>
                    ))}
                  </ol>
                ) : (
                  <ul key={block.id} className="list-disc pl-6 space-y-2">
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
                    className="my-7 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-[var(--editorial-primary)] shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="font-display text-base font-bold">
                          {block.documentTitle || 'Documento adjunto'}
                        </p>
                        {block.documentDescription && (
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
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
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-neutral-400 dark:border-neutral-700 font-display text-xs font-bold uppercase tracking-wider shrink-0 hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Descargar PDF</span>
                    </a>
                  </div>
                );
              }
              case 'image': {
                figureCounter++;
                return (
                  <figure key={block.id} className="my-8">
                    {post.apaMode && (
                      <p className="mb-1.5 font-display text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                        Figura {figureCounter}.
                      </p>
                    )}
                    <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-neutral-900">
                      <EditorialImage
                        src={block.imageUrl}
                        alt={block.imageAlt || block.imageCaption || 'Imagen editorial'}
                        fallbackTitle={block.imageCaption}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {(block.imageCaption || block.imageCredit) && (
                      <figcaption className="mt-2 text-xs text-neutral-600 dark:text-neutral-400 italic flex flex-wrap justify-between gap-2">
                        <span>{block.imageCaption}</span>
                        {block.imageCredit && <span className="not-italic font-display uppercase">{block.imageCredit}</span>}
                      </figcaption>
                    )}
                  </figure>
                );
              }
              case 'timeline':
                return (
                  <div key={block.id} className="my-8 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6">
                    {block.text && (
                      <h3 className="font-display text-lg font-extrabold uppercase tracking-wider text-[var(--editorial-primary)] mb-4">
                        {block.text}
                      </h3>
                    )}
                    <ol className="space-y-4">
                      {(block.timelineEntries || []).map((entry, idx) => (
                        <li key={idx} className="pb-4 border-b border-neutral-200 dark:border-neutral-800 last:border-b-0 last:pb-0">
                          <span className="font-tabular text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                            {entry.date}
                          </span>
                          <h4 className="font-display text-xl font-bold mt-0.5">{entry.title}</h4>
                          <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                            {entry.detail}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              case 'table': {
                tableCounter++;
                return (
                  <figure key={block.id} className="my-8 space-y-2">
                    {post.apaMode && (
                      <p className="font-display text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                        Tabla {tableCounter}. {block.text ? <span className="italic font-normal normal-case">{block.text}</span> : null}
                      </p>
                    )}
                    <div className="rounded-2xl overflow-x-auto border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414]">
                      {!post.apaMode && block.text && (
                        <p className="px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider border-b border-neutral-300 dark:border-neutral-800">
                          {block.text}
                        </p>
                      )}
                      <table className="w-full text-left text-sm">
                        {block.tableHeaders && block.tableHeaders.length > 0 && (
                          <thead className="border-b border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 font-display uppercase text-xs tracking-wider">
                            <tr>
                              {block.tableHeaders.map((h, i) => (
                                <th key={i} className="px-4 py-2.5 font-bold">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                        )}
                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                          {(block.tableRows || []).map((row, ri) => (
                            <tr key={ri}>
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-4 py-2.5 font-tabular">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {block.tableCaption && (
                      <figcaption className="text-xs text-neutral-600 dark:text-neutral-400 italic">
                        Nota. {block.tableCaption}
                      </figcaption>
                    )}
                  </figure>
                );
              }
              case 'divider':
                if (block.dividerVariant === 'asterisks') {
                  return (
                    <div key={block.id} aria-hidden="true" className="my-8 text-center font-display text-xl tracking-[0.6em] text-neutral-500">
                      * * *
                    </div>
                  );
                }
                if (block.dividerVariant === 'red_rule') {
                  return (
                    <hr key={block.id} className="my-8 border-t-2 border-[var(--editorial-primary)] w-16 mx-auto" />
                  );
                }
                return <hr key={block.id} className="my-8 border-neutral-300 dark:border-neutral-800 w-1/3 mx-auto" />;
              case 'social_embed': {
                const safeEmbed = sanitizeExternalUrl(block.embedUrl || '');
                if (!safeEmbed) return null;
                return (
                  <div key={block.id} className="my-6 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)]">
                        Publicación referenciada ({block.embedPlatform || 'Red social'})
                      </p>
                      <p className="text-sm truncate text-neutral-700 dark:text-neutral-300 mt-0.5">{safeEmbed}</p>
                    </div>
                    <a
                      href={safeEmbed}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-1.5 rounded-full border border-neutral-400 font-display text-xs font-bold uppercase shrink-0 hover:bg-neutral-900 hover:text-white dark:hover:bg-white dark:hover:text-black"
                    >
                      Abrir
                    </a>
                  </div>
                );
              }
              default:
                return null;
            }
          })}

          {/* Footnotes */}
          {footnotes.length > 0 && (
            <aside className="mt-10 pt-6 border-t border-neutral-300 dark:border-neutral-800 space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
              <h3 className="font-display text-xs font-bold uppercase tracking-widest text-neutral-900 dark:text-white">
                Notas al pie y aclaraciones
              </h3>
              {footnotes.map((fn, i) => (
                <p key={fn.id} id={`nota-${fn.footnoteNumber || i + 1}`} className="leading-relaxed">
                  <span className="font-tabular font-bold text-[var(--editorial-primary)] mr-2">
                    [{fn.footnoteNumber || i + 1}]
                  </span>
                  {fn.text}
                </p>
              ))}
            </aside>
          )}
        </div>

        {/* APA 7 Bibliographic References & Article Citation Button */}
        {(sortedApaRefs.length > 0 || post.apaMode) && (
          <section className="max-w-[70ch] mx-auto mt-10 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="inline-flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-widest text-[var(--editorial-primary)]">
                <BookMarked className="w-4 h-4" aria-hidden="true" />
                <span>Referencias (APA 7)</span>
              </h3>
              <button
                type="button"
                onClick={handleCopyApaCitation}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-[var(--editorial-primary)] text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
              >
                {copiedApa ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedApa ? 'Cita APA copiada' : 'Copiar cita de este artículo en formato APA'}</span>
              </button>
            </div>
            {sortedApaRefs.length > 0 && (
              <ol className="space-y-2.5 text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
                {sortedApaRefs.map((ref) => (
                  <li key={ref.id} className="apa-reference">
                    {ref.formatted}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {/* Sources Consulted */}
        {post.sources && post.sources.length > 0 && (
          <section className="max-w-[70ch] mx-auto mt-8 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 space-y-2.5">
            <h3 className="font-display text-xs font-extrabold uppercase tracking-widest text-[var(--editorial-primary)]">
              Fuentes consultadas
            </h3>
            <ul className="space-y-1.5 text-sm">
              {post.sources.map((src, idx) => {
                const safeUrl = sanitizeExternalUrl(src.url || '');
                return (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <span className="text-neutral-800 dark:text-neutral-200">• {src.label}</span>
                    {safeUrl && (
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-display font-bold uppercase text-[var(--editorial-primary)] hover:underline shrink-0"
                      >
                        Consultar <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Corrections & Transparency Box */}
        {post.corrections && post.corrections.length > 0 && (
          <section className="max-w-[70ch] mx-auto mt-8 rounded-2xl border border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/20 p-5 space-y-3">
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <History className="w-4 h-4" aria-hidden="true" />
              <span>Historial de correcciones y actualizaciones</span>
            </h3>
            <ul className="space-y-2.5 text-sm divide-y divide-amber-500/20">
              {post.corrections.map((c, idx) => (
                <li key={idx} className="pt-2.5 first:pt-0 space-y-0.5">
                  <p className="text-xs font-display font-bold uppercase tracking-wider text-neutral-500">
                    {c.date} · {c.editorName}
                  </p>
                  <p className="text-neutral-800 dark:text-neutral-200 leading-relaxed">{c.note}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="max-w-[70ch] mx-auto mt-10 pt-6 border-t border-neutral-300 dark:border-neutral-800 flex flex-wrap items-center gap-2 text-xs font-display uppercase tracking-wider">
            <span className="font-bold text-neutral-500">Etiquetas:</span>
            {post.tags.map((tag, i) => (
              <React.Fragment key={tag}>
                <a
                  href={`/etiqueta/${encodeURIComponent(tag)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/etiqueta/${encodeURIComponent(tag)}`);
                  }}
                  className="hover:text-[var(--editorial-primary)] underline underline-offset-4"
                >
                  #{tag}
                </a>
                {i < post.tags.length - 1 && <span aria-hidden="true" className="text-neutral-400">·</span>}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Share & Report Bar */}
        <div className="max-w-[70ch] mx-auto mt-6 py-4 border-y border-neutral-300 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-display font-bold uppercase tracking-wider">
            <span className="inline-flex items-center gap-1 text-neutral-500 mr-1">
              <Share2 className="w-3.5 h-3.5" aria-hidden="true" /> Compartir:
            </span>
            <a href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer" className="px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white transition-colors">
              WhatsApp
            </a>
            <a href={shareLinks.twitter} target="_blank" rel="noopener noreferrer" className="px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white transition-colors">
              X
            </a>
            <a href={shareLinks.facebook} target="_blank" rel="noopener noreferrer" className="px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white transition-colors">
              Facebook
            </a>
            <a href={shareLinks.telegram} target="_blank" rel="noopener noreferrer" className="px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white transition-colors">
              Telegram
            </a>
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar enlace'}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyApaCitation}
              className="px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>{copiedApa ? 'Cita copiada' : 'Citar APA'}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setQuoteShare({
                  text: post.subtitle || post.title,
                  author: resolvedAuthorName,
                })
              }
              className="px-3 py-1 rounded-full border border-[var(--editorial-primary)]/40 text-[var(--editorial-primary)] hover:bg-[var(--editorial-primary)] hover:text-white inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Quote className="w-3.5 h-3.5" />
              <span>Tarjeta de cita</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSharePreview((v) => !v)}
              className="px-2.5 py-1 text-neutral-500 hover:text-black dark:hover:text-white cursor-pointer"
            >
              Vista previa social
            </button>
          </div>

          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-wider text-neutral-500 hover:text-red-600 cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Denunciar contenido</span>
          </button>
        </div>

        {/* Social Preview Card */}
        {showSharePreview && (
          <div className="max-w-[70ch] mx-auto mt-4 rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#141414] grid grid-cols-1 sm:grid-cols-12 overflow-hidden">
            <div className="sm:col-span-4 aspect-[4/3]">
              <EditorialImage src={post.coverImage} alt={post.title} fallbackTitle={post.title} />
            </div>
            <div className="sm:col-span-8 p-4 space-y-1">
              <p className="text-[11px] font-display uppercase tracking-widest text-neutral-500">
                {siteConfig.siteName} · Tarjeta para redes sociales
              </p>
              <p className="font-display text-lg font-bold leading-snug">{post.title}</p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">{post.seoDescription || post.subtitle}</p>
            </div>
          </div>
        )}

        {/* Structured Compact Author Dossier ("Sobre el autor") */}
        <div className="max-w-[70ch] mx-auto mt-8 space-y-3">
          <AuthorDossierCard
            profile={isAdminIdentity ? adminIdentity : collabProfile}
            isAdminIdentity={isAdminIdentity}
            fallbackName={post.authorName}
            verified={verified}
            variant="compact"
            onNavigateProfile={() => navigate(`/colaborador/${authorTargetId}`)}
          />
          {siteConfig.authorLiabilityNotice && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 px-1">
              {siteConfig.authorLiabilityNotice}
            </p>
          )}
        </div>

        {/* Comments */}
        <div className="max-w-[70ch] mx-auto">
          {post.commentsEnabled === false ? (
            <p className="mt-10 pt-6 border-t border-neutral-300 dark:border-neutral-800 text-sm text-neutral-500 text-center">
              Los comentarios están deshabilitados para esta publicación.
            </p>
          ) : (
            <CommentsSection post={post} />
          )}
        </div>

        {/* Related Articles */}
        {relatedPosts.length > 0 && (
          <section className="mt-14 pt-10 border-t-2 border-[#111111] dark:border-neutral-700 space-y-6">
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
              Artículos relacionados
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((rp) => (
                <ArticleCard key={rp.id} post={rp} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Zoomable Infographic Lightbox */}
      {infographicOpen && post.coverImage && (
        <div className="fixed inset-0 z-50 bg-black/95 text-white flex flex-col p-4 sm:p-8" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs uppercase tracking-widest text-neutral-300">
              Infografía ampliada · {post.title}
            </span>
            <button
              type="button"
              onClick={() => setInfographicOpen(false)}
              aria-label="Cerrar visor"
              className="p-2 rounded-full hover:bg-neutral-800 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center my-4">
            <img
              src={sanitizeExternalUrl(parseMediaUrlMeta(post.coverImage).cleanUrl)}
              alt={post.coverAlt || post.title}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-full object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Lightbox Modal for Galleries */}
      {lightboxIdx !== null && post.galleryItems && post.galleryItems[lightboxIdx] && (
        <div className="fixed inset-0 z-50 bg-black/95 text-white flex flex-col justify-between p-4 sm:p-8" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs uppercase tracking-widest text-neutral-400 font-tabular">
              Fotografía {lightboxIdx + 1} de {post.galleryItems.length}
            </span>
            <button
              type="button"
              onClick={() => setLightboxIdx(null)}
              aria-label="Cerrar visor"
              className="p-2 rounded-full hover:bg-neutral-800 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="relative flex-1 flex items-center justify-center my-4 overflow-hidden">
            <button
              type="button"
              onClick={() => setLightboxIdx((lightboxIdx - 1 + post.galleryItems!.length) % post.galleryItems!.length)}
              aria-label="Imagen anterior"
              className="absolute left-2 p-3 rounded-full bg-black/60 hover:bg-black cursor-pointer z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <img
              src={sanitizeExternalUrl(parseMediaUrlMeta(post.galleryItems[lightboxIdx].url).cleanUrl)}
              alt={post.galleryItems[lightboxIdx].alt}
              referrerPolicy="no-referrer"
              className="max-h-[75vh] max-w-full object-contain rounded-xl"
            />
            <button
              type="button"
              onClick={() => setLightboxIdx((lightboxIdx + 1) % post.galleryItems!.length)}
              aria-label="Siguiente imagen"
              className="absolute right-2 p-3 rounded-full bg-black/60 hover:bg-black cursor-pointer z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
          <div className="max-w-3xl mx-auto text-center space-y-1">
            <p className="text-sm text-neutral-200">{post.galleryItems[lightboxIdx].caption}</p>
            <p className="text-xs font-display uppercase tracking-wider text-neutral-400">
              {post.galleryItems[lightboxIdx].credit}
            </p>
          </div>
        </div>
      )}

      {/* Quote Share Modal */}
      <QuoteShareModal
        open={Boolean(quoteShare)}
        quoteText={quoteShare?.text || ''}
        quoteAuthor={quoteShare?.author}
        articleTitle={post.title}
        siteName={siteConfig.siteName}
        primaryColor={siteConfig.primaryColor}
        onClose={() => setQuoteShare(null)}
      />

      {/* Report Content Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-[#F8F6F1] dark:bg-[#161616] border border-neutral-300 dark:border-neutral-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl font-extrabold uppercase">Denunciar contenido</h3>
              <button type="button" onClick={() => setReportOpen(false)} className="p-1.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleReportSubmit} className="space-y-3">
              <input
                type="text"
                name="report_hp"
                tabIndex={-1}
                autoComplete="off"
                value={reportHoneypot}
                onChange={(e) => setReportHoneypot(e.target.value)}
                className="hidden"
                aria-hidden="true"
              />
              <div>
                <label className="block font-display text-xs font-bold uppercase mb-1">Motivo</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                >
                  <option>Información inexacta o descontextualizada</option>
                  <option>Solicitud de rectificación o derecho a réplica</option>
                  <option>Infracción de derechos de autor</option>
                  <option>Discurso de odio o acoso</option>
                </select>
              </div>
              <div>
                <label className="block font-display text-xs font-bold uppercase mb-1">Tu nombre</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                />
              </div>
              <div>
                <label className="block font-display text-xs font-bold uppercase mb-1">Tu correo</label>
                <input
                  type="email"
                  required
                  minLength={5}
                  maxLength={200}
                  value={reportEmail}
                  onChange={(e) => setReportEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                />
              </div>
              <div>
                <label className="block font-display text-xs font-bold uppercase mb-1">Detalles</label>
                <textarea
                  required
                  rows={3}
                  minLength={5}
                  maxLength={3000}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Describe el problema o la rectificación solicitada..."
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                />
              </div>
              {!firebaseUser && (
                <div>
                  <label className="block font-display text-xs font-bold uppercase mb-1">
                    Verificación antispam: {reportChallenge.question}
                  </label>
                  <input
                    type="number"
                    required
                    inputMode="numeric"
                    value={reportChallengeAns}
                    onChange={(e) => setReportChallengeAns(e.target.value)}
                    placeholder="Respuesta numérica"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                  />
                </div>
              )}
              {reportErr && <p role="alert" className="text-xs text-red-600">{reportErr}</p>}
              <button
                type="submit"
                disabled={reportSubmitting}
                className="w-full py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display font-bold uppercase tracking-wider text-xs cursor-pointer disabled:opacity-60"
              >
                {reportSubmitting ? 'Enviando reporte...' : 'Enviar reporte a administración'}
              </button>
              {reportDone && <p className="text-xs text-emerald-600">{reportDone}</p>}
            </form>
          </div>
        </div>
      )}
    </article>
  );
};
