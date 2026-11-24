import React from 'react';
import { Bookmark, Camera, FileSpreadsheet, FileText, Headphones, Pin, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { useTheme } from '../context/ThemeContext';
import { formatDateEs, getEditorialKindLabel } from '../lib/utils';
import { Post } from '../types/editorial';
import { EditorialImage } from './EditorialImage';
import { ThemeCardRibbon } from './themes/ThemeOrnaments';
import { VerifiedBadge } from './VerifiedBadge';

interface ArticleCardProps {
  post: Post;
  variant?: 'standard' | 'compact' | 'opinion' | 'featured_lead' | 'video';
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ post, variant = 'standard' }) => {
  const { navigate, setAuthModalOpen, isAuthorVerified, collaborators, siteConfig, adminIdentities } = useSite();
  const { showHoverEffects } = useTheme();
  const { firebaseUser, bookmarks, toggleBookmark } = useAuth();
  const isSaved = bookmarks.some((b) => b.postId === post.id);
  const isCollabUid = collaborators.some((c) => c.uid === post.authorId);
  const authorTargetId =
    post.authorProfileId ||
    (post.authorIdentityType === 'owner'
      ? 'owner'
      : post.authorIdentityType === 'magazine'
      ? 'magazine'
      : !isCollabUid &&
        (post.authorName === siteConfig.siteName || post.authorName === adminIdentities.magazine.name)
      ? 'magazine'
      : !isCollabUid && post.authorName === adminIdentities.owner.name
      ? 'owner'
      : post.authorId);
  const verified = isAuthorVerified(authorTargetId, post.authorIdentityType, post.authorVerified, post.authorName);

  const handleOpen = () => navigate(`/articulo/${post.slug}`);

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!firebaseUser) {
      setAuthModalOpen(true);
      return;
    }
    try {
      await toggleBookmark(post);
    } catch {
      // Handled in AuthContext log
    }
  };

  const formatLabel =
    post.type === 'gallery'
      ? 'Galería'
      : post.type === 'video'
      ? 'Video'
      : post.type === 'audio'
      ? 'Pódcast'
      : post.type === 'infographic'
      ? 'Infografía'
      : post.type === 'document'
      ? 'Documento'
      : post.type === 'livestream'
      ? 'Archivo'
      : null;

  const FormatIcon =
    post.type === 'gallery'
      ? Camera
      : post.type === 'video'
      ? Play
      : post.type === 'audio'
      ? Headphones
      : post.type === 'infographic'
      ? FileSpreadsheet
      : post.type === 'document' || post.type === 'livestream'
      ? FileText
      : null;

  const kindLabel = getEditorialKindLabel(post.editorialKind);

  if (variant === 'compact') {
    return (
      <article className="group py-3.5 first:pt-1 last:pb-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-display font-bold uppercase tracking-wider text-[var(--editorial-primary)]">
          <span>{post.categoryName}</span>
          <span aria-hidden="true" className="text-neutral-400">·</span>
          <span className="text-neutral-700 dark:text-neutral-300">{kindLabel}</span>
          {formatLabel && (
            <>
              <span aria-hidden="true" className="text-neutral-400">·</span>
              <span>{formatLabel}</span>
            </>
          )}
          {post.pinnedInFeed && (
            <span className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-300">
              <Pin className="w-3 h-3" aria-hidden="true" />
              <span>Fijada</span>
            </span>
          )}
        </div>
        <h3 className="mt-1 font-display text-lg sm:text-[19px] font-bold leading-[1.15] headline-balance line-clamp-2">
          <a
            href={`/articulo/${post.slug}`}
            onClick={(e) => {
              e.preventDefault();
              handleOpen();
            }}
            className="hover:text-[var(--editorial-primary)] transition-colors"
          >
            {post.title}
          </a>
        </h3>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
          <span className="font-semibold text-neutral-800 dark:text-neutral-200 inline-flex items-center gap-1 truncate max-w-[65%]">
            <span className="truncate">{post.authorName}</span>
            {verified && <VerifiedBadge size="xs" />}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-tabular shrink-0">{post.readTimeMinutes} min</span>
        </div>
      </article>
    );
  }

  if (variant === 'opinion') {
    return (
      <article className={`group h-full rounded-2xl border border-neutral-300/80 dark:border-neutral-800 bg-[var(--editorial-surface)] p-6 flex flex-col justify-between shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 ${showHoverEffects ? 'theme-card-hover-glow' : ''}`}>
        <div>
          <div className="flex items-center gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="w-12 h-12 rounded-full shrink-0 overflow-hidden bg-neutral-200 dark:bg-neutral-800 ring-2 ring-[var(--editorial-primary)]/25">
              <EditorialImage
                src={post.authorAvatar || post.coverImage}
                alt={`Retrato de ${post.authorName}`}
                fallbackTitle={post.authorName}
                width={96}
                height={96}
                allowInDataSaver
              />
            </div>
            <div className="min-w-0">
              <a
                href={`/colaborador/${authorTargetId}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/colaborador/${authorTargetId}`);
                }}
                className="font-display text-base font-bold uppercase tracking-wide text-[#111111] dark:text-white hover:text-[var(--editorial-primary)] inline-flex items-center gap-1.5 max-w-full"
              >
                <span className="truncate">{post.authorName}</span>
                {verified && <VerifiedBadge size="xs" />}
              </a>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                {post.authorOutletType === 'medio' ? 'Medio colaborador' : 'Columnista independiente'} · {kindLabel}
              </p>
            </div>
          </div>
          <h3 className="mt-4 font-display text-2xl font-bold leading-[1.12] headline-balance line-clamp-3">
            <a
              href={`/articulo/${post.slug}`}
              onClick={(e) => {
                e.preventDefault();
                handleOpen();
              }}
              className="hover:text-[var(--editorial-primary)] transition-colors"
            >
              {post.title}
            </a>
          </h3>
          {post.subtitle && (
            <p className="mt-2.5 text-sm text-neutral-700 dark:text-neutral-300 line-clamp-3 leading-relaxed font-editorial">
              {post.subtitle}
            </p>
          )}
        </div>
        <div className="mt-5 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
          <span>{formatDateEs(post.publishedAt || post.createdAt)} · {post.readTimeMinutes} min</span>
          <button
            type="button"
            onClick={handleBookmark}
            aria-label={isSaved ? 'Quitar de guardados' : 'Guardar artículo'}
            className={`p-1.5 rounded-full cursor-pointer transition-colors ${isSaved ? 'text-[var(--editorial-primary)]' : 'hover:text-black dark:hover:text-white'}`}
          >
            <Bookmark className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        </div>
      </article>
    );
  }

  const isLead = variant === 'featured_lead';
  const isVideo = variant === 'video';
  const aspectClass = isLead || isVideo ? 'aspect-[16/9]' : 'aspect-[16/10]';

  return (
    <article className={`group h-full flex flex-col rounded-2xl overflow-hidden border border-neutral-300/80 dark:border-neutral-800 bg-[var(--editorial-surface)] shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 ${showHoverEffects ? 'theme-card-hover-glow' : ''}`}>
      <a
        href={`/articulo/${post.slug}`}
        onClick={(e) => {
          e.preventDefault();
          handleOpen();
        }}
        className={`relative ${aspectClass} overflow-hidden bg-neutral-900 block shrink-0`}
      >
        <EditorialImage
          src={post.coverImage}
          alt={post.coverAlt || post.title}
          fallbackTitle={post.title}
          width={isLead ? 1000 : 800}
          height={isLead ? 562 : 500}
          sensitive={post.sensitiveContent}
          sensitiveWarning={post.sensitiveWarning}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {isVideo && (
          <div className="absolute inset-0 bg-black/25 flex items-center justify-center pointer-events-none">
            <span className="w-12 h-12 rounded-full bg-[var(--editorial-primary)]/95 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Play className="w-5 h-5 fill-current ml-0.5" aria-hidden="true" />
            </span>
          </div>
        )}
        {FormatIcon && (
          <div className="absolute bottom-3 left-3 z-10 rounded bg-[#111111]/90 text-white px-2.5 py-1 flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-wider">
            <FormatIcon className="w-3.5 h-3.5 text-[var(--editorial-primary)]" aria-hidden="true" />
            <span>{formatLabel}</span>
            {post.mediaDurationLabel && (
              <span className="font-tabular text-neutral-300 border-l border-white/25 pl-1.5">
                {post.mediaDurationLabel}
              </span>
            )}
          </div>
        )}
        {post.pinnedInFeed && (
          <div className="absolute top-3 left-3 z-10 rounded bg-[#111111]/90 text-amber-300 px-2.5 py-1 flex items-center gap-1 text-[10px] font-display font-bold uppercase tracking-wider">
            <Pin className="w-3 h-3" aria-hidden="true" />
            <span>Nota fijada</span>
          </div>
        )}
        {(isLead || post.pinnedInFeed) && <ThemeCardRibbon />}
      </a>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 text-xs font-display font-bold uppercase tracking-wider">
            <div className="flex items-center gap-1.5 text-[var(--editorial-primary)] min-w-0">
              <a
                href={`/categoria/${post.categorySlug}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/categoria/${post.categorySlug}`);
                }}
                className="hover:underline truncate"
              >
                {post.categoryName}
              </a>
              <span aria-hidden="true" className="text-neutral-400">·</span>
              <span className="text-neutral-700 dark:text-neutral-300 shrink-0">{kindLabel}</span>
            </div>
            <button
              type="button"
              onClick={handleBookmark}
              aria-label={isSaved ? 'Quitar de guardados' : 'Guardar artículo'}
              className={`p-1.5 rounded-full cursor-pointer shrink-0 transition-colors ${isSaved ? 'text-[var(--editorial-primary)]' : 'text-neutral-500 hover:text-black dark:hover:text-white'}`}
            >
              <Bookmark className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} />
            </button>
          </div>

          <h3
            className={`mt-2 font-display font-bold leading-[1.1] headline-balance line-clamp-3 ${
              isLead ? 'text-2xl sm:text-[1.85rem]' : 'text-xl sm:text-2xl'
            }`}
          >
            <a
              href={`/articulo/${post.slug}`}
              onClick={(e) => {
                e.preventDefault();
                handleOpen();
              }}
              className="hover:text-[var(--editorial-primary)] transition-colors"
            >
              {post.title}
            </a>
          </h3>

          {post.subtitle && (
            <p className="mt-2.5 text-sm text-neutral-700 dark:text-neutral-300 line-clamp-3 leading-relaxed font-editorial">
              {post.subtitle}
            </p>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
          <a
            href={`/colaborador/${authorTargetId}`}
            onClick={(e) => {
              e.preventDefault();
              navigate(`/colaborador/${authorTargetId}`);
            }}
            className="font-semibold text-neutral-900 dark:text-neutral-200 hover:underline inline-flex items-center gap-1"
          >
            <span>{post.authorName}</span>
            {verified && <VerifiedBadge size="xs" />}
          </a>
          <span aria-hidden="true">·</span>
          <span>{formatDateEs(post.publishedAt || post.createdAt)}</span>
          <span aria-hidden="true">·</span>
          <span className="font-tabular">{post.readTimeMinutes} min</span>
        </div>
      </div>
    </article>
  );
};
