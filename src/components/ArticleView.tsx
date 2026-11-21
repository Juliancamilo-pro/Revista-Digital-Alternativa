import React, { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Headphones,
  History,
  Maximize2,
  Pause,
  Play,
  Quote,
  Share2,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FontSizeScale, useSite } from '../context/SiteContext';
import { checkActionCooldown, generateSpamChallenge, markActionCooldown } from '../lib/appCheck';
import { db } from '../lib/firebase';
import {
  buildShareLinks,
  formatDateEs,
  formatDateKey,
  generateId,
  getEditorialKindLabel,
  getEmbedUrl,
  sanitizeExternalUrl,
  toDate,
} from '../lib/utils';
import { CollaboratorPublic, ContentBlock, GalleryItem } from '../types/editorial';
import { ArticleCard } from './ArticleCard';
import { CommentsSection } from './CommentsSection';
import { EditorialImage } from './EditorialImage';
import { QuoteShareModal } from './QuoteShareModal';

/** Safe inline formatter for **bold**, *italic*, and [label](https://...) */
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

export const ArticleView: React.FC<{ slug: string }> = ({ slug }) => {
  const {
    publishedPosts,
    myPosts,
    allPostsForAdmin,
    collaborators,
    siteConfig,
    fontSize,
    setFontSize,
    readingMode,
    setReadingMode,
    navigate,
    setAuthModalOpen,
  } = useSite();

  const { firebaseUser, bookmarks, toggleBookmark } = useAuth();

  const post = useMemo(() => {
    const pool = [...publishedPosts, ...myPosts, ...allPostsForAdmin];
    return pool.find((p) => p.slug === slug || p.id === slug) || null;
  }, [publishedPosts, myPosts, allPostsForAdmin, slug]);

  const [fetchedAuthor, setFetchedAuthor] = useState<CollaboratorPublic | null>(null);
  const authorProfile = useMemo(() => {
    if (!post) return null;
    return collaborators.find((c) => c.uid === post.authorId) || fetchedAuthor;
  }, [collaborators, fetchedAuthor, post]);

  useEffect(() => {
    if (!post || collaborators.some((c) => c.uid === post.authorId)) {
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
  }, [post?.authorId, collaborators]);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showSharePreview, setShowSharePreview] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [quoteShare, setQuoteShare] = useState<{ text: string; author?: string } | null>(null);

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

  // Podcast HTML5 audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioRate, setAudioRate] = useState(1);

  const viewLoggedRef = useRef<string | null>(null);
  const enteredAtRef = useRef<number>(Date.now());

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

  // Sync browser title while reading article
  useEffect(() => {
    if (!post) return;
    document.title = `${post.title} – ${siteConfig.siteName}`;
    return () => {
      document.title = `${siteConfig.siteName} – Periodismo Independiente y Crítico`;
    };
  }, [post?.title, siteConfig.siteName]);

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

  // Keyboard navigation in lightbox
  useEffect(() => {
    if (lightboxIdx === null || !post?.galleryItems) return;
    const items = post.galleryItems;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null);
      if (e.key === 'ArrowRight') setLightboxIdx((i) => (i === null ? 0 : (i + 1) % items.length));
      if (e.key === 'ArrowLeft') setLightboxIdx((i) => (i === null ? 0 : (i - 1 + items.length) % items.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, post?.galleryItems]);

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
      ...post.blocks
        .filter((b) => b.type === 'paragraph' || b.type === 'heading' || b.type === 'quote')
        .map((b) => b.text || ''),
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
  let paragraphIdx = 0;

  const embedInfo = post.mediaUrl ? getEmbedUrl(post.mediaUrl) : null;
  const authorWeb = sanitizeExternalUrl(authorProfile?.websiteUrl || '');
  const authorX = sanitizeExternalUrl(authorProfile?.socialTwitter || '');
  const authorIg = sanitizeExternalUrl(authorProfile?.socialInstagram || '');
  const authorYt = sanitizeExternalUrl(authorProfile?.socialYoutube || '');

  return (
    <article className="relative animate-[fade-up-enter_0.35s_ease-out]">
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

        {/* Editorial Kicker & Kind Badge */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-display font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
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
              <span className="text-neutral-700 dark:text-neutral-300">{post.seriesTitle}</span>
            </>
          )}
        </div>

        {/* Headline & Deck */}
        <h1 className="mt-3 font-display text-3xl sm:text-5xl lg:text-[3.35rem] font-extrabold leading-[1.03] tracking-tight headline-balance">
          {post.title}
        </h1>

        {post.subtitle && (
          <p className="mt-4 text-lg sm:text-xl text-neutral-700 dark:text-neutral-300 leading-relaxed">
            {post.subtitle}
          </p>
        )}

        {/* Byline & Metadata */}
        <div className="mt-6 py-4 border-y border-neutral-300 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 ring-2 ring-[var(--editorial-primary)]/20">
              <EditorialImage
                src={authorProfile?.avatarUrl || post.authorAvatar || post.coverImage}
                alt={post.authorName}
                fallbackTitle={post.authorName}
              />
            </div>
            <div>
              <a
                href={`/colaborador/${post.authorId}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/colaborador/${post.authorId}`);
                }}
                className="font-display text-base font-bold uppercase tracking-wide hover:text-[var(--editorial-primary)]"
              >
                {post.authorName}
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

          {/* Reader Accessibility & Audio Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Font size selector */}
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

        {/* Cover Media */}
        {post.coverImage && post.type !== 'video' && (
          <figure className="mt-8">
            <div className="aspect-[16/9] rounded-2xl overflow-hidden bg-neutral-900 shadow-lg">
              <EditorialImage
                src={post.coverImage}
                alt={post.coverAlt || post.title}
                fallbackTitle={post.title}
                className="w-full h-full object-cover"
              />
            </div>
            {(post.coverAlt || post.coverCredit) && (
              <figcaption className="mt-2.5 text-xs text-neutral-600 dark:text-neutral-400 italic flex flex-wrap justify-between gap-2">
                <span>{post.coverAlt}</span>
                {post.coverCredit && <span className="not-italic font-display uppercase tracking-wider">{post.coverCredit}</span>}
              </figcaption>
            )}
          </figure>
        )}

        {/* Video Player if type === 'video' */}
        {post.type === 'video' && embedInfo && (
          <div className="mt-8 rounded-2xl overflow-hidden border border-neutral-300 dark:border-neutral-800 bg-black shadow-lg">
            {embedInfo.kind === 'iframe' ? (
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
              <video src={embedInfo.src} controls className="w-full aspect-video" poster={sanitizeExternalUrl(post.coverImage || '')} />
            ) : (
              <div className="p-8 text-center text-white space-y-2">
                <p className="text-sm">Enlace de video externo:</p>
                <a href={embedInfo.src} target="_blank" rel="noopener noreferrer" className="underline text-[#FCA5A5]">
                  {embedInfo.src}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Audio / Podcast Player if type === 'audio' */}
        {post.type === 'audio' && post.mediaUrl && (
          <div className="mt-8 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-[#111111] text-white p-5 space-y-3 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-[#FCA5A5]">
                <Headphones className="w-4 h-4" aria-hidden="true" />
                <span>Reproductor de pódcast y crónica sonora</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-tabular">
                <span>Velocidad:</span>
                {[0.75, 1, 1.25, 1.5, 2].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setAudioRate(r);
                      if (audioRef.current) audioRef.current.playbackRate = r;
                    }}
                    className={`px-2.5 py-0.5 rounded-full border cursor-pointer ${
                      audioRate === r ? 'bg-[var(--editorial-primary)] border-[var(--editorial-primary)] text-white' : 'border-neutral-700 text-neutral-300'
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>
            <audio
              ref={audioRef}
              controls
              src={sanitizeExternalUrl(post.mediaUrl)}
              onPlay={() => {
                if (audioRef.current) audioRef.current.playbackRate = audioRate;
              }}
              className="w-full"
            />
          </div>
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

        {/* Article Body Column (65-75ch measure) */}
        <div className={`mt-10 max-w-[68ch] mx-auto space-y-6 font-editorial ${fontSizeClass[fontSize]}`}>
          {bodyBlocks.map((block: ContentBlock) => {
            switch (block.type) {
              case 'paragraph': {
                const isFirst = paragraphIdx === 0;
                paragraphIdx++;
                return (
                  <p key={block.id} className={isFirst ? 'editorial-dropcap' : ''}>
                    {renderInlineText(block.text || '')}
                  </p>
                );
              }
              case 'heading':
                return block.level === 3 ? (
                  <h3 key={block.id} className="font-display text-2xl font-bold tracking-tight pt-3">
                    {block.text}
                  </h3>
                ) : (
                  <h2 key={block.id} className="font-display text-3xl font-extrabold tracking-tight pt-5">
                    {block.text}
                  </h2>
                );
              case 'quote':
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
                            author: block.author || post.authorName,
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
              case 'image':
                return (
                  <figure key={block.id} className="my-8">
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
              case 'table':
                return (
                  <div key={block.id} className="my-8 rounded-2xl overflow-x-auto border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414]">
                    {block.text && (
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
                );
              case 'divider':
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
                Notas al pie y fuentes
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

        {/* Corrections & Transparency Box */}
        {post.corrections && post.corrections.length > 0 && (
          <section className="max-w-[68ch] mx-auto mt-8 rounded-2xl border border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/20 p-5 space-y-3">
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <History className="w-4 h-4" aria-hidden="true" />
              <span>Historial de correcciones y actualizaciones</span>
            </h3>
            <ul className="space-y-2.5 text-sm">
              {post.corrections.map((c, idx) => (
                <li key={idx} className="border-l-2 border-amber-500 pl-3 space-y-0.5">
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
          <div className="max-w-[68ch] mx-auto mt-10 pt-6 border-t border-neutral-300 dark:border-neutral-800 flex flex-wrap items-center gap-2 text-xs font-display uppercase tracking-wider">
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
        <div className="max-w-[68ch] mx-auto mt-6 py-4 border-y border-neutral-300 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
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
              onClick={() =>
                setQuoteShare({
                  text: post.subtitle || post.title,
                  author: post.authorName,
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
          <div className="max-w-[68ch] mx-auto mt-4 rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#141414] grid grid-cols-1 sm:grid-cols-12 overflow-hidden">
            <div className="sm:col-span-4 aspect-[4/3]">
              <EditorialImage src={post.coverImage} alt={post.title} fallbackTitle={post.title} />
            </div>
            <div className="sm:col-span-8 p-4 space-y-1">
              <p className="text-[11px] font-display uppercase tracking-widest text-neutral-500">
                {siteConfig.siteName} · Tarjeta para redes sociales
              </p>
              <p className="font-display text-lg font-bold leading-snug">{post.title}</p>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">{post.subtitle}</p>
            </div>
          </div>
        )}

        {/* Author Bio & Liability Callout */}
        <div className="max-w-[68ch] mx-auto mt-8 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 ring-2 ring-[var(--editorial-primary)]/25">
                <EditorialImage
                  src={authorProfile?.avatarUrl || post.authorAvatar || post.coverImage}
                  alt={post.authorName}
                  fallbackTitle={post.authorName}
                />
              </div>
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                  Sobre la firma ·{' '}
                  {(authorProfile?.outletType || post.authorOutletType) === 'medio'
                    ? 'Medio o revista aliada'
                    : 'Periodista independiente'}
                </p>
                <p className="font-display text-2xl font-bold mt-0.5">{authorProfile?.name || post.authorName}</p>
                {authorProfile?.bio && (
                  <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1.5 leading-relaxed">
                    {authorProfile.bio}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/colaborador/${post.authorId}`)}
              className="px-5 py-2.5 rounded-full border border-[#111111] dark:border-neutral-600 font-display text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-black cursor-pointer transition-colors self-start sm:self-center"
            >
              Ver perfil y notas
            </button>
          </div>

          {(authorWeb || authorX || authorIg || authorYt) && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800 text-xs font-display font-bold uppercase tracking-wider">
              {authorWeb && (
                <a href={authorWeb} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-[var(--editorial-primary)]">
                  Sitio web <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {authorX && (
                <a href={authorX} target="_blank" rel="noopener noreferrer" className="px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-[var(--editorial-primary)]">
                  X
                </a>
              )}
              {authorIg && (
                <a href={authorIg} target="_blank" rel="noopener noreferrer" className="px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-[var(--editorial-primary)]">
                  Instagram
                </a>
              )}
              {authorYt && (
                <a href={authorYt} target="_blank" rel="noopener noreferrer" className="px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-[var(--editorial-primary)]">
                  YouTube
                </a>
              )}
            </div>
          )}

          {siteConfig.authorLiabilityNotice && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              {siteConfig.authorLiabilityNotice}
            </p>
          )}
        </div>

        {/* Comments */}
        <div className="max-w-[68ch] mx-auto">
          <CommentsSection post={post} />
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
              src={sanitizeExternalUrl(post.galleryItems[lightboxIdx].url)}
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
