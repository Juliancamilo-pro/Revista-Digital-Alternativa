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
  variant?: 'standard' | 'compact' | 'horizontal' | 'opinion' | 'featured_lead' | 'video';
  indexLabel?: string;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({
  post,
  variant = 'standard',
  indexLabel,
}) => {
  const { navigate, setAuthModalOpen, isAuthorVerified, collaborators, siteConfig, adminIdentities } =
    useSite();
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
  const verified = isAuthorVerified(
    authorTargetId,
    post.authorIdentityType,
    post.authorVerified,
    post.authorName
  );

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
      // Handled in AuthContext
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
  const showDistinctKind =
    Boolean(kindLabel) &&
    kindLabel.trim().toLowerCase() !== (post.categoryName || '').trim().toLowerCase();

  if (variant === 'compact') {
    return (
      <article className="group py-3.5 first:pt-1 last:pb-1 flex items-start gap-3">
        {indexLabel && (
          <span className="font-display text-2xl font-extrabold text-[var(--editorial-primary)] font-tabular leading-none pt-0.5 shrink-0">
            {indexLabel}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-display font-bold uppercase tracking-[0.1em] text-[var(--editorial-primary)]">
            <span>{post.categoryName}</span>
            {showDistinctKind && (
              <>
                <span aria-hidden="true" className="text-[var(--editorial-muted)]/60">
                  ·
                </span>
                <span className="text-[var(--editorial-muted)]">{kindLabel}</span>
              </>
            )}
            {formatLabel && (
              <>
                <span aria-hidden="true" className="text-[var(--editorial-muted)]/60">
                  ·
                </span>
                <span>{formatLabel}</span>
              </>
            )}
            {post.pinnedInFeed && (
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                <Pin className="w-3 h-3" aria-hidden="true" />
                <span>Fijada</span>
              </span>
            )}
          </div>
          <h3 className="mt-1 font-display text-lg sm:text-[19px] font-bold leading-[1.15] headline-balance line-clamp-2 text-[var(--editorial-ink)]">
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
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--editorial-muted)]">
            <span className="font-semibold text-[var(--editorial-ink)] inline-flex items-center gap-1 truncate max-w-[65%]">
              <span className="truncate">{post.authorName}</span>
              {verified && <VerifiedBadge size="xs" />}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-tabular shrink-0">{post.readTimeMinutes} min</span>
          </div>
        </div>
      </article>
    );
  }

  if (variant === 'horizontal') {
    return (
      <article
        className={`group rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] overflow-hidden grid grid-cols-12 shadow-xs hover:shadow-lg hover:border-[var(--editorial-primary)]/45 transition-all duration-300 ${
          showHoverEffects ? 'theme-card-hover-glow' : ''
        }`}
      >
        <a
          href={`/articulo/${post.slug}`}
          onClick={(e) => {
            e.preventDefault();
            handleOpen();
          }}
          className="col-span-5 aspect-[4/3] bg-neutral-900 overflow-hidden relative block"
        >
          <EditorialImage
            src={post.coverImage}
            alt={post.coverAlt || post.title}
            fallbackTitle={post.title}
            fallbackCategory={post.categoryName}
            width={480}
            height={360}
            sensitive={post.sensitiveContent}
            sensitiveWarning={post.sensitiveWarning}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </a>
        <div className="col-span-7 p-4 flex flex-col justify-between gap-2">
          <div>
            <p className="text-[10px] font-display font-bold uppercase tracking-[0.12em] text-[var(--editorial-primary)]">
              {post.galleryItems?.length
                ? `${post.galleryItems.length} fotografías`
                : formatLabel || post.categoryName}
            </p>
            <h3 className="mt-1 font-display text-lg font-bold leading-tight line-clamp-2 text-[var(--editorial-ink)]">
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
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--editorial-muted)]">
            <span className="truncate">{post.authorName}</span>
            <span className="font-tabular shrink-0">{post.readTimeMinutes} min</span>
          </div>
        </div>
      </article>
    );
  }

  if (variant === 'opinion') {
    return (
      <article
        className={`group h-full rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-6 flex flex-col justify-between shadow-xs hover:shadow-lg hover:border-[var(--editorial-primary)]/45 transition-all duration-300 ${
          showHoverEffects ? 'theme-card-hover-glow' : ''
        }`}
      >
        <div>
          <div className="flex items-center gap-3 pb-4 border-b border-[var(--editorial-border)]">
            <div className="w-12 h-12 rounded-full shrink-0 overflow-hidden bg-[var(--editorial-surface-subtle)] ring-2 ring-[var(--editorial-primary)]/25">
              <EditorialImage
                src={post.authorAvatar || post.coverImage}
                alt={`Retrato de ${post.authorName}`}
                fallbackTitle={post.authorName}
                fallbackCategory="Columna"
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
                className="font-display text-base font-bold uppercase tracking-wide text-[var(--editorial-ink)] hover:text-[var(--editorial-primary)] inline-flex items-center gap-1.5 max-w-full"
              >
                <span className="truncate">{post.authorName}</span>
                {verified && <VerifiedBadge size="xs" />}
              </a>
              <p className="text-xs text-[var(--editorial-muted)] truncate">
                {post.authorOutletType === 'medio' ? 'Medio colaborador' : 'Columnista'} · {kindLabel}
              </p>
            </div>
          </div>
          <h3 className="mt-4 font-display text-2xl font-bold leading-[1.12] headline-balance line-clamp-3 text-[var(--editorial-ink)]">
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
            <p className="mt-2.5 text-sm text-[var(--editorial-muted)] line-clamp-3 leading-relaxed font-editorial">
              {post.subtitle}
            </p>
          )}
        </div>
        <div className="mt-5 pt-3 border-t border-[var(--editorial-border)] flex items-center justify-between text-xs text-[var(--editorial-muted)]">
          <span>
            {formatDateEs(post.publishedAt || post.createdAt)} ·{' '}
            <span className="font-tabular">{post.readTimeMinutes} min</span>
          </span>
          <button
            type="button"
            onClick={handleBookmark}
            aria-label={isSaved ? 'Quitar de guardados' : 'Guardar artículo'}
            className={`p-2 rounded-full cursor-pointer transition-colors ${
              isSaved
                ? 'text-[var(--editorial-primary)]'
                : 'text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]'
            }`}
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
    <article
      className={`group h-full flex flex-col rounded-2xl overflow-hidden border border-[var(--editorial-border)] bg-[var(--editorial-surface)] shadow-xs hover:shadow-lg hover:border-[var(--editorial-primary)]/45 transition-all duration-300 ${
        showHoverEffects ? 'theme-card-hover-glow' : ''
      }`}
    >
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
          fallbackCategory={post.categoryName}
          width={isLead ? 1000 : 800}
          height={isLead ? 562 : 500}
          sensitive={post.sensitiveContent}
          sensitiveWarning={post.sensitiveWarning}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {isVideo && (
          <div className="absolute inset-0 bg-black/25 flex items-center justify-center pointer-events-none">
            <span className="w-12 h-12 rounded-full bg-[var(--editorial-primary)]/95 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Play className="w-5 h-5 fill-current ml-0.5" aria-hidden="true" />
            </span>
          </div>
        )}
        {FormatIcon && (
          <div className="absolute bottom-3 left-3 z-10 rounded-full bg-[#111111]/85 backdrop-blur-xs text-white px-2.5 py-1 flex items-center gap-1.5 text-[11px] font-display font-bold uppercase tracking-wider">
            <FormatIcon className="w-3.5 h-3.5 text-[#FCA5A5]" aria-hidden="true" />
            <span>{formatLabel}</span>
            {post.mediaDurationLabel && (
              <span className="font-tabular text-neutral-300 border-l border-white/25 pl-1.5">
                {post.mediaDurationLabel}
              </span>
            )}
          </div>
        )}
        {post.pinnedInFeed && (
          <div className="absolute top-3 left-3 z-10 rounded-full bg-[#111111]/85 backdrop-blur-xs text-amber-300 px-2.5 py-1 flex items-center gap-1 text-[10px] font-display font-bold uppercase tracking-wider">
            <Pin className="w-3 h-3" aria-hidden="true" />
            <span>Fijada</span>
          </div>
        )}
        {(isLead || post.pinnedInFeed) && <ThemeCardRibbon />}
      </a>

      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 text-[11px] font-display font-bold uppercase tracking-[0.1em]">
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
              {showDistinctKind && (
                <>
                  <span aria-hidden="true" className="text-[var(--editorial-muted)]/60">
                    ·
                  </span>
                  <span className="text-[var(--editorial-muted)] shrink-0">{kindLabel}</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleBookmark}
              aria-label={isSaved ? 'Quitar de guardados' : 'Guardar artículo'}
              className={`p-1.5 rounded-full cursor-pointer shrink-0 transition-colors ${
                isSaved
                  ? 'text-[var(--editorial-primary)]'
                  : 'text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]'
              }`}
            >
              <Bookmark className="w-4 h-4" fill={isSaved ? 'currentColor' : 'none'} />
            </button>
          </div>

          <h3
            className={`mt-2 font-display font-bold leading-[1.1] headline-balance line-clamp-3 text-[var(--editorial-ink)] ${
              isLead ? 'text-2xl sm:text-[1.85rem]' : 'text-xl sm:text-[1.35rem]'
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
            <p className="mt-2.5 text-sm text-[var(--editorial-muted)] line-clamp-3 leading-relaxed font-editorial">
              {post.subtitle}
            </p>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-[var(--editorial-border)] flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--editorial-muted)]">
          <a
            href={`/colaborador/${authorTargetId}`}
            onClick={(e) => {
              e.preventDefault();
              navigate(`/colaborador/${authorTargetId}`);
            }}
            className="font-semibold text-[var(--editorial-ink)] hover:text-[var(--editorial-primary)] transition-colors inline-flex items-center gap-1"
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
