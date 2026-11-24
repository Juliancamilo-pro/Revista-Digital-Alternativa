import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Camera,
  Headphones,
  Pause,
  Play,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useDataSaver } from '../context/DataSaverContext';
import { useMediaPlayer } from '../context/MediaPlayerContext';
import { useSite } from '../context/SiteContext';
import { useTheme } from '../context/ThemeContext';
import { formatDateEs, getEditorialKindLabel, sanitizeExternalUrl } from '../lib/utils';
import { HomepageSectionConfig, Post, PostType } from '../types/editorial';
import { ArticleCard } from './ArticleCard';
import { EditorialImage } from './EditorialImage';
import { EditorialHomeSkeleton } from './EditorialSkeletons';
import { TricolorHairline } from './TolimaAccents';
import { ThemeCornerOrnaments, ThemeHeadingIcon } from './themes/ThemeOrnaments';
import { ThemeSectionDivider } from './themes/ThemeSectionDivider';
import { VerifiedBadge } from './VerifiedBadge';

export const HomePage: React.FC = () => {
  const {
    siteConfig,
    publishedPosts,
    hasMorePublishedPosts,
    loadMorePublishedPosts,
    categories,
    seriesList,
    collaborators,
    adminIdentities,
    isAuthorVerified,
    loading,
    navigate,
  } = useSite();
  const { isDataSaverActive } = useDataSaver();
  const { showHoverEffects } = useTheme();
  const { currentTrack, isPlaying: globalAudioPlaying, playTrack } = useMediaPlayer();

  const [feedTypeFilter, setFeedTypeFilter] = useState<'all' | PostType>('all');
  const [feedCatFilter, setFeedCatFilter] = useState<string>('all');
  const [hasExpandedFeed, setHasExpandedFeed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(() => (isDataSaverActive ? 6 : 9));

  useEffect(() => {
    if (!hasExpandedFeed) {
      setVisibleCount(isDataSaverActive ? 6 : 9);
    }
  }, [isDataSaverActive, hasExpandedFeed]);

  const orderedSections = useMemo(() => {
    return [...(siteConfig.homepageSections || [])]
      .filter((s) => s.enabled)
      .sort((a, b) => a.order - b.order);
  }, [siteConfig.homepageSections]);

  const heroPost = useMemo(() => {
    if (siteConfig.heroPostId) {
      const found = publishedPosts.find((p) => p.id === siteConfig.heroPostId);
      if (found) return found;
    }
    return publishedPosts.find((p) => p.featured) || publishedPosts[0] || null;
  }, [publishedPosts, siteConfig.heroPostId]);

  const featuredPosts = useMemo(() => {
    const pinned = (siteConfig.featuredPostIds || [])
      .map((id) => publishedPosts.find((p) => p.id === id))
      .filter((p): p is Post => Boolean(p && p.id !== heroPost?.id));
    if (pinned.length >= 3) return pinned.slice(0, 3);
    const extras = publishedPosts.filter(
      (p) => p.id !== heroPost?.id && !pinned.some((x) => x.id === p.id) && p.featured
    );
    const fallback = publishedPosts.filter(
      (p) => p.id !== heroPost?.id && !pinned.some((x) => x.id === p.id) && !extras.some((x) => x.id === p.id)
    );
    return [...pinned, ...extras, ...fallback].slice(0, 3);
  }, [publishedPosts, siteConfig.featuredPostIds, heroPost]);

  const breakingPosts = useMemo(
    () => publishedPosts.filter((p) => p.breaking).slice(0, 8),
    [publishedPosts]
  );

  const mostReadPosts = useMemo(
    () => [...publishedPosts].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, 5),
    [publishedPosts]
  );

  const opinionPosts = useMemo(
    () =>
      publishedPosts
        .filter((p) => p.categorySlug === 'opinion' || p.editorialKind === 'opinion' || p.authorOutletType === 'independiente')
        .slice(0, 3),
    [publishedPosts]
  );

  const galleryPosts = useMemo(() => publishedPosts.filter((p) => p.type === 'gallery').slice(0, 3), [publishedPosts]);
  const videoPosts = useMemo(() => publishedPosts.filter((p) => p.type === 'video').slice(0, 3), [publishedPosts]);
  const audioPosts = useMemo(() => publishedPosts.filter((p) => p.type === 'audio').slice(0, 5), [publishedPosts]);

  const regionalHighlightPosts = useMemo(() => {
    const terms = ['tolima', 'ibague', 'ibagué', 'tolimense', 'cultura', 'colombia'];
    return publishedPosts
      .filter((p) => {
        const hay = `${p.categorySlug} ${p.categoryName} ${p.title} ${p.subtitle || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
        return terms.some((t) => hay.includes(t));
      })
      .slice(0, 3);
  }, [publishedPosts]);

  const directoryCards = useMemo(() => {
    const cards: Array<{
      id: string;
      name: string;
      subtitle: string;
      bio?: string;
      avatarUrl?: string;
      verified: boolean;
      isAdmin: boolean;
    }> = [];

    if (adminIdentities.owner?.showInDirectory !== false) {
      cards.push({
        id: adminIdentities.owner.id,
        name: adminIdentities.owner.name,
        subtitle: adminIdentities.owner.roleTitle || 'Dirección editorial',
        bio: adminIdentities.owner.bio,
        avatarUrl: adminIdentities.owner.avatarUrl,
        verified: true,
        isAdmin: true,
      });
    }
    if (adminIdentities.magazine?.showInDirectory !== false) {
      cards.push({
        id: adminIdentities.magazine.id,
        name: adminIdentities.magazine.name,
        subtitle: adminIdentities.magazine.roleTitle || 'Medio editor',
        bio: adminIdentities.magazine.bio,
        avatarUrl: adminIdentities.magazine.avatarUrl,
        verified: true,
        isAdmin: true,
      });
    }

    const activeCollabs = collaborators
      .filter((c) => c.status === 'active' && c.showInDirectory === true && c.directoryHidden !== true)
      .sort((a, b) => {
        if (Boolean(a.directoryFeatured) !== Boolean(b.directoryFeatured)) {
          return a.directoryFeatured ? -1 : 1;
        }
        const oa = a.directoryOrder ?? 999;
        const ob = b.directoryOrder ?? 999;
        if (oa !== ob) return oa - ob;
        return (b.postCount || 0) - (a.postCount || 0);
      });

    for (const c of activeCollabs) {
      cards.push({
        id: c.uid,
        name: c.name,
        subtitle: c.outletType === 'medio' ? 'Medio colaborador' : 'Periodista independiente',
        bio: c.showBio ? c.bio : undefined,
        avatarUrl: c.showAvatar ? c.avatarUrl : undefined,
        verified: c.status === 'active',
        isAdmin: false,
      });
    }

    return cards.slice(0, 8);
  }, [adminIdentities, collaborators]);

  const filteredFeed = useMemo(() => {
    const filtered = publishedPosts.filter((p) => {
      if (feedTypeFilter !== 'all' && p.type !== feedTypeFilter) return false;
      if (feedCatFilter !== 'all' && p.categorySlug !== feedCatFilter) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (Boolean(a.pinnedInFeed) !== Boolean(b.pinnedInFeed)) {
        return a.pinnedInFeed ? -1 : 1;
      }
      return 0;
    });
  }, [publishedPosts, feedTypeFilter, feedCatFilter]);

  const uiTexts = siteConfig.uiTexts;
  const dailyStripLabel = uiTexts?.dailyStripLabel || 'Edición del día';
  const joinBannerKicker = uiTexts?.joinBannerKicker || 'Red de medios independientes';
  const joinBannerTitle = uiTexts?.joinBannerTitle || 'Periodismo sin censura corporativa';
  const joinBannerSubtitle =
    uiTexts?.joinBannerSubtitle ||
    'Publicamos crónicas, investigaciones y opinión con transparencia editorial y pluralidad crítica.';
  const joinBannerCta = uiTexts?.joinBannerCta || 'Únete como colaborador';

  if (loading && publishedPosts.length === 0) {
    return <EditorialHomeSkeleton />;
  }

  // Portada limpia "Muy pronto" cuando no hay contenido real publicado
  if (!loading && publishedPosts.length === 0) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 animate-fade-up">
        <section className="relative overflow-hidden rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-[#141414] via-[#1C0B0B] to-[#0D0D0D] text-[#F4F1EA] px-6 py-16 sm:px-14 sm:py-24 shadow-2xl">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[var(--editorial-primary)]/20 blur-3xl pointer-events-none" />
          <div className="relative max-w-2xl space-y-6">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-[#FCA5A5]">
              Edición en preparación · Hecho en el Tolima, para Colombia
            </p>
            <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold uppercase tracking-tight leading-[0.98] headline-balance text-white">
              Muy pronto
            </h1>
            <p className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wide text-[var(--editorial-primary)]">
              {siteConfig.siteName}
            </p>
            {siteConfig.tagline && (
              <p className="text-base sm:text-xl text-neutral-300 leading-relaxed font-editorial">
                {siteConfig.tagline}
              </p>
            )}
            <div className="pt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/como-trabajamos')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-sm"
              >
                <span>Cómo trabajamos</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/unete')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/25 hover:bg-white hover:text-[#111111] text-white font-display text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                <span>{joinBannerCta}</span>
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const audioQueue = audioPosts
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

  const renderSection = (section: HomepageSectionConfig) => {
    switch (section.type) {
      case 'hero': {
        if (!heroPost) return null;
        const railPosts = publishedPosts.filter((p) => p.id !== heroPost.id).slice(0, 3);
        const heroIsCollab = collaborators.some((c) => c.uid === heroPost.authorId);
        const heroAuthorTargetId =
          heroPost.authorProfileId ||
          (heroPost.authorIdentityType === 'owner'
            ? 'owner'
            : heroPost.authorIdentityType === 'magazine'
            ? 'magazine'
            : !heroIsCollab &&
              (heroPost.authorName === siteConfig.siteName ||
                heroPost.authorName === adminIdentities.magazine.name)
            ? 'magazine'
            : !heroIsCollab && heroPost.authorName === adminIdentities.owner.name
            ? 'owner'
            : heroPost.authorId);
        const heroVerified = isAuthorVerified(
          heroAuthorTargetId,
          heroPost.authorIdentityType,
          heroPost.authorVerified,
          heroPost.authorName
        );

        return (
          <section key={section.id} className="space-y-6 animate-fade-up">
            {/* Retícula 12 columnas: 8/12 apertura principal 16:9 + 4/12 columna lateral con las 3 notas siguientes */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <article className={`relative lg:col-span-8 rounded-2xl border border-neutral-300/80 dark:border-neutral-800 bg-[var(--editorial-surface)] overflow-hidden shadow-sm hover:shadow-xl transition-shadow group flex flex-col ${showHoverEffects ? 'theme-card-hover-glow' : ''}`}>
                <ThemeCornerOrnaments variant="hero" />
                <a
                  href={`/articulo/${heroPost.slug}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/articulo/${heroPost.slug}`);
                  }}
                  className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-900 block shrink-0"
                >
                  <EditorialImage
                    src={heroPost.coverImage}
                    alt={heroPost.coverAlt || heroPost.title}
                    fallbackTitle={heroPost.title}
                    width={1280}
                    height={720}
                    priority
                    sensitive={heroPost.sensitiveContent}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  {heroPost.coverCredit && (
                    <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded bg-black/70 text-[11px] text-white font-display tracking-wide">
                      {heroPost.coverCredit}
                    </span>
                  )}
                </a>

                <div className="p-5 sm:p-7 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-display font-bold uppercase tracking-widest">
                      <span className="px-2.5 py-0.5 rounded bg-[var(--editorial-primary)] text-white">
                        {heroPost.categoryName}
                      </span>
                      <span aria-hidden="true" className="text-neutral-400">·</span>
                      <span className="text-neutral-700 dark:text-neutral-300">
                        {getEditorialKindLabel(heroPost.editorialKind)}
                      </span>
                      {heroPost.seriesTitle && (
                        <>
                          <span aria-hidden="true" className="text-neutral-400">·</span>
                          <span className="text-neutral-600 dark:text-neutral-400">
                            {heroPost.seriesTitle}
                          </span>
                        </>
                      )}
                    </div>

                    <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold leading-[1.04] tracking-tight headline-balance text-[#111111] dark:text-[#F4F1EA]">
                      <a
                        href={`/articulo/${heroPost.slug}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/articulo/${heroPost.slug}`);
                        }}
                        className="hover:text-[var(--editorial-primary)] transition-colors"
                      >
                        {heroPost.title}
                      </a>
                    </h1>

                    {heroPost.subtitle && (
                      <p className="text-base sm:text-lg text-neutral-700 dark:text-neutral-300 leading-relaxed font-editorial line-clamp-3">
                        {heroPost.subtitle}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                      <a
                        href={`/colaborador/${heroAuthorTargetId}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/colaborador/${heroAuthorTargetId}`);
                        }}
                        className="inline-flex items-center gap-1.5 font-bold text-neutral-900 dark:text-white hover:text-[var(--editorial-primary)] transition-colors"
                      >
                        <span>{heroPost.authorName}</span>
                        {heroVerified && <VerifiedBadge size="xs" />}
                      </a>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateEs(heroPost.publishedAt || heroPost.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-tabular">{heroPost.readTimeMinutes} min</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/articulo/${heroPost.slug}`)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111111] dark:bg-white text-white dark:text-[#111111] hover:bg-[var(--editorial-primary)] dark:hover:bg-[var(--editorial-primary)] dark:hover:text-white font-display text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      <span>{section.ctaLabel || 'Leer completo'}</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>

              {/* Columna lateral 4/12: 3 notas compactas + invitación editorial */}
              <aside className="lg:col-span-4 flex flex-col justify-between gap-5">
                <div className="flex-1 rounded-2xl border border-neutral-300/80 dark:border-neutral-800 bg-[var(--editorial-surface)] p-5 flex flex-col shadow-sm">
                  <div className="flex items-center justify-between border-b-2 border-[var(--editorial-primary)] pb-2.5 mb-2">
                    <h2 className="font-display text-sm font-extrabold uppercase tracking-widest text-[var(--editorial-primary)] flex items-center gap-1.5">
                      <ThemeHeadingIcon />
                      <span>{dailyStripLabel}</span>
                    </h2>
                    <span className="font-tabular text-[11px] text-neutral-500 uppercase">
                      {railPosts.length} notas
                    </span>
                  </div>

                  {railPosts.length > 0 ? (
                    <div className="divide-y divide-neutral-200 dark:divide-neutral-800 flex-1 flex flex-col justify-between">
                      {railPosts.map((p) => (
                        <ArticleCard key={p.id} post={p} variant="compact" />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 py-6 font-editorial">
                      Más entregas editoriales en preparación.
                    </p>
                  )}
                </div>

                {/* Tarjeta compacta "Únete como colaborador" */}
                <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-[#141414] to-[#280D0D] text-white p-5 space-y-3 shadow-sm">
                  <p className="font-display text-[11px] font-bold uppercase tracking-widest text-[#FCA5A5]">
                    {joinBannerKicker}
                  </p>
                  <h3 className="font-display text-xl font-extrabold uppercase leading-tight">
                    {joinBannerTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed line-clamp-2">
                    {joinBannerSubtitle}
                  </p>
                  <div className="pt-1 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/unete')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] font-display text-xs font-bold uppercase tracking-wider text-white cursor-pointer transition-colors"
                    >
                      <span>{joinBannerCta}</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        );
      }

      case 'breaking': {
        if (breakingPosts.length === 0) return null;
        return (
          <section
            key={section.id}
            aria-label={section.title || 'Última hora'}
            className="h-10 rounded-xl border border-[var(--editorial-primary)]/40 bg-[#111111] text-white overflow-hidden flex items-center shadow-sm"
          >
            <span className="h-full inline-flex items-center gap-1.5 px-3.5 sm:px-4 bg-[var(--editorial-primary)] text-white font-display text-xs font-extrabold uppercase tracking-widest shrink-0">
              <Zap className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{section.title || 'Última hora'}</span>
            </span>
            <div className="flex-1 overflow-hidden">
              <div className="animate-marquee-ticker py-2">
                {[...breakingPosts, ...breakingPosts].map((post, idx) => (
                  <a
                    key={`${post.id}_${idx}`}
                    href={`/articulo/${post.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/articulo/${post.slug}`);
                    }}
                    className="inline-flex items-center gap-2.5 px-5 text-xs sm:text-sm font-display font-semibold hover:text-[#FCA5A5] transition-colors whitespace-nowrap"
                  >
                    <span className="text-[#FCA5A5] uppercase font-bold">
                      {post.categoryName}
                    </span>
                    <span>{post.title}</span>
                    <span aria-hidden="true" className="text-neutral-600">·</span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        );
      }

      case 'featured': {
        if (featuredPosts.length === 0) return null;
        const [firstFeatured, ...restFeatured] = featuredPosts;
        return (
          <motion.section
            key={section.id}
            initial={isDataSaverActive ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08 }}
            transition={{ duration: 0.28 }}
            className="space-y-5 editorial-rule-top pt-8"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-300 dark:border-neutral-800 pb-2.5">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight flex items-center gap-2">
                  <ThemeHeadingIcon />
                  <span>{section.title}</span>
                </h2>
                {section.subtitle && (
                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
                    {section.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* 1 grande (6/12) + 2 medianas (3/12 cada una) en escritorio */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch">
              {firstFeatured && (
                <div className="md:col-span-2 lg:col-span-6">
                  <ArticleCard post={firstFeatured} variant="featured_lead" />
                </div>
              )}
              {restFeatured.slice(0, 2).map((post) => (
                <div key={post.id} className="lg:col-span-3">
                  <ArticleCard post={post} />
                </div>
              ))}
            </div>
          </motion.section>
        );
      }

      case 'most_read': {
        if (mostReadPosts.length === 0) return null;
        const [topRead, ...otherRead] = mostReadPosts;
        return (
          <section key={section.id} className="editorial-rule-top pt-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Lectura principal destacada (7/12) */}
              {topRead && (
                <article className="lg:col-span-7 rounded-2xl border border-neutral-300/80 dark:border-neutral-800 bg-[var(--editorial-surface)] overflow-hidden shadow-sm flex flex-col sm:flex-row">
                  <a
                    href={`/articulo/${topRead.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/articulo/${topRead.slug}`);
                    }}
                    className="sm:w-5/12 aspect-[16/10] sm:aspect-auto shrink-0 bg-neutral-900 overflow-hidden block"
                  >
                    <EditorialImage
                      src={topRead.coverImage}
                      alt={topRead.coverAlt || topRead.title}
                      fallbackTitle={topRead.title}
                      width={700}
                      height={525}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </a>
                  <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                        <span className="font-tabular px-2 py-0.5 rounded bg-[var(--editorial-primary)]/10">
                          #01 Más leída
                        </span>
                        <span>{topRead.categoryName}</span>
                      </div>
                      <h3 className="font-display text-2xl sm:text-[1.7rem] font-extrabold leading-tight headline-balance">
                        <a
                          href={`/articulo/${topRead.slug}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/articulo/${topRead.slug}`);
                          }}
                          className="hover:text-[var(--editorial-primary)] transition-colors"
                        >
                          {topRead.title}
                        </a>
                      </h3>
                      {topRead.subtitle && (
                        <p className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-3 font-editorial">
                          {topRead.subtitle}
                        </p>
                      )}
                    </div>
                    <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400">
                      <span>{topRead.authorName}</span>
                      <span className="font-tabular font-semibold">
                        {(topRead.viewCount || 0).toLocaleString('es-CO')} lecturas
                      </span>
                    </div>
                  </div>
                </article>
              )}

              {/* Lista numerada compacta en columna lateral (5/12) */}
              <aside className="lg:col-span-5 rounded-2xl border border-neutral-300/80 dark:border-neutral-800 bg-[var(--editorial-surface)] p-5 sm:p-6 shadow-sm flex flex-col">
                <div className="flex items-center justify-between border-b-2 border-[var(--editorial-primary)] pb-2.5 mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[var(--editorial-primary)]" aria-hidden="true" />
                    <h2 className="font-display text-lg font-extrabold uppercase tracking-tight flex items-center gap-1.5">
                      <span>{section.title}</span>
                      <ThemeHeadingIcon />
                    </h2>
                  </div>
                  {section.subtitle && (
                    <span className="text-[11px] text-neutral-500 hidden sm:inline">{section.subtitle}</span>
                  )}
                </div>
                <ol className="divide-y divide-neutral-200 dark:divide-neutral-800 flex-1 flex flex-col justify-between">
                  {(otherRead.length > 0 ? otherRead : mostReadPosts).map((post, idx) => {
                    const rank = otherRead.length > 0 ? idx + 2 : idx + 1;
                    return (
                      <li key={post.id} className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-3">
                        <span className="font-display text-2xl font-extrabold text-[var(--editorial-primary)] font-tabular leading-none pt-0.5 shrink-0">
                          0{rank}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-display font-bold uppercase tracking-wider text-neutral-500">
                            {post.categoryName} · {(post.viewCount || 0).toLocaleString('es-CO')} lecturas
                          </p>
                          <h3 className="font-display text-base sm:text-[17px] font-bold leading-snug line-clamp-2 mt-0.5">
                            <a
                              href={`/articulo/${post.slug}`}
                              onClick={(e) => {
                                e.preventDefault();
                                navigate(`/articulo/${post.slug}`);
                              }}
                              className="hover:text-[var(--editorial-primary)] transition-colors"
                            >
                              {post.title}
                            </a>
                          </h3>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </aside>
            </div>
          </section>
        );
      }

      case 'opinion': {
        if (opinionPosts.length === 0) return null;
        return (
          <section key={section.id} className="space-y-5 editorial-rule-top pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-300 dark:border-neutral-800 pb-2.5">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight flex items-center gap-2">
                  <ThemeHeadingIcon />
                  <span>{section.title}</span>
                </h2>
                {section.subtitle && (
                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
                    {section.subtitle}
                  </p>
                )}
              </div>
              <a
                href="/categoria/opinion"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/categoria/opinion');
                }}
                className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)] hover:underline"
              >
                {section.ctaLabel || 'Ver todas las columnas'}
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {opinionPosts.map((post) => (
                <ArticleCard key={post.id} post={post} variant="opinion" />
              ))}
            </div>
          </section>
        );
      }

      case 'series': {
        if (seriesList.length === 0) return null;
        return (
          <section key={section.id} className="space-y-5 editorial-rule-top pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-300 dark:border-neutral-800 pb-2.5">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight flex items-center gap-2">
                  <ThemeHeadingIcon />
                  <span>{section.title}</span>
                </h2>
                {section.subtitle && (
                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
                    {section.subtitle}
                  </p>
                )}
              </div>
            </div>
            {/* Carrusel horizontal con tarjetas de ancho fijo */}
            <div className="flex gap-5 overflow-x-auto pb-3 snap-x snap-mandatory">
              {seriesList.map((ser) => (
                <article
                  key={ser.id}
                  onClick={() => navigate(`/serie/${ser.slug}`)}
                  className="w-[290px] sm:w-[320px] shrink-0 snap-start group cursor-pointer rounded-2xl border border-neutral-800 bg-[#111111] text-white overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
                >
                  <div className="aspect-[16/10] overflow-hidden shrink-0">
                    <EditorialImage
                      src={ser.coverImage}
                      alt={ser.title}
                      fallbackTitle={ser.title}
                      width={640}
                      height={400}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <p className="font-display text-[11px] font-bold uppercase tracking-widest text-[#FCA5A5]">
                        Especial seriado
                      </p>
                      <h3 className="mt-1 font-display text-xl font-bold leading-tight line-clamp-2 group-hover:underline">
                        {ser.title}
                      </h3>
                      <p className="mt-2 text-xs sm:text-sm text-neutral-300 line-clamp-3 leading-relaxed">
                        {ser.description}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider text-white pt-2 border-t border-white/10">
                      <span>{section.ctaLabel || 'Explorar dossier'}</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      }

      case 'galleries': {
        if (galleryPosts.length === 0) return null;
        const [leadGallery, ...sideGalleries] = galleryPosts;
        return (
          <section key={section.id} className="space-y-5 editorial-rule-top pt-8">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-300 dark:border-neutral-800 pb-2.5">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
                  <span>{section.title}</span>
                </h2>
                {section.subtitle && (
                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
                    {section.subtitle}
                  </p>
                )}
              </div>
              <a
                href="/categoria/fotografia"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/categoria/fotografia');
                }}
                className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)] hover:underline"
              >
                {section.ctaLabel || 'Más fotografía'}
              </a>
            </div>

            {/* Mosaico editorial */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
              {leadGallery && (
                <div className={sideGalleries.length > 0 ? 'md:col-span-7' : 'md:col-span-12'}>
                  <ArticleCard post={leadGallery} variant="featured_lead" />
                </div>
              )}
              {sideGalleries.length > 0 && (
                <div className="md:col-span-5 grid grid-cols-1 gap-5">
                  {sideGalleries.map((post) => (
                    <article
                      key={post.id}
                      onClick={() => navigate(`/articulo/${post.slug}`)}
                      className="group cursor-pointer rounded-2xl border border-neutral-300/80 dark:border-neutral-800 bg-[var(--editorial-surface)] overflow-hidden grid grid-cols-12 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="col-span-5 aspect-[4/3] bg-neutral-900 overflow-hidden">
                        <EditorialImage
                          src={post.coverImage}
                          alt={post.coverAlt || post.title}
                          fallbackTitle={post.title}
                          width={400}
                          height={300}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="col-span-7 p-4 flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] font-display font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                            {post.galleryItems?.length ? `${post.galleryItems.length} fotos` : 'Fotorreportaje'}
                          </p>
                          <h3 className="mt-1 font-display text-lg font-bold leading-tight line-clamp-2 group-hover:text-[var(--editorial-primary)]">
                            {post.title}
                          </h3>
                        </div>
                        <p className="text-xs text-neutral-500 mt-2">{post.authorName}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      }

      case 'videos': {
        if (videoPosts.length === 0) return null;
        return (
          <section key={section.id} className="space-y-5 editorial-rule-top pt-8">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-300 dark:border-neutral-800 pb-2.5">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight flex items-center gap-2">
                  <Play className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
                  <span>{section.title}</span>
                </h2>
                {section.subtitle && (
                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
                    {section.subtitle}
                  </p>
                )}
              </div>
              <a
                href="/categoria/video"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/categoria/video');
                }}
                className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)] hover:underline"
              >
                {section.ctaLabel || 'Más videos'}
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {videoPosts.map((post) => (
                <ArticleCard key={post.id} post={post} variant="video" />
              ))}
            </div>
          </section>
        );
      }

      case 'audio': {
        if (audioPosts.length === 0) return null;
        return (
          <section key={section.id} className="space-y-5 editorial-rule-top pt-8">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-300 dark:border-neutral-800 pb-2.5">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight flex items-center gap-2">
                  <Headphones className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
                  <span>{section.title}</span>
                </h2>
                {section.subtitle && (
                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
                    {section.subtitle}
                  </p>
                )}
              </div>
              <a
                href="/categoria/audio-y-podcast"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/categoria/audio-y-podcast');
                }}
                className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)] hover:underline"
              >
                {section.ctaLabel || 'Todos los pódcasts'}
              </a>
            </div>

            {/* Lista compacta con reproductor integrado */}
            <div className="rounded-2xl border border-neutral-300/80 dark:border-neutral-800 bg-[var(--editorial-surface)] divide-y divide-neutral-200 dark:divide-neutral-800 shadow-sm">
              {audioPosts.map((post) => {
                const mediaSrc = sanitizeExternalUrl(post.mediaUrl || '');
                const isActiveTrack = currentTrack?.postId === post.id;
                const isThisPlaying = isActiveTrack && globalAudioPlaying;
                return (
                  <article
                    key={post.id}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-100/60 dark:hover:bg-neutral-900/40 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!mediaSrc) {
                            navigate(`/articulo/${post.slug}`);
                            return;
                          }
                          playTrack(
                            {
                              postId: post.id,
                              title: post.title,
                              slug: post.slug,
                              authorName: post.authorName,
                              mediaUrl: mediaSrc,
                              coverImage: post.coverImage,
                              seasonNumber: post.seasonNumber,
                              episodeNumber: post.episodeNumber,
                            },
                            audioQueue
                          );
                        }}
                        aria-label={isThisPlaying ? `Pausar ${post.title}` : `Reproducir ${post.title}`}
                        className={`w-11 h-11 rounded-full shrink-0 flex items-center justify-center cursor-pointer transition-colors ${
                          isThisPlaying
                            ? 'bg-[#111111] dark:bg-white text-white dark:text-black'
                            : 'bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white'
                        }`}
                      >
                        {isThisPlaying ? (
                          <Pause className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5 fill-current" aria-hidden="true" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-display font-bold uppercase tracking-wider text-[var(--editorial-primary)]">
                          <span>{post.categoryName}</span>
                          {post.episodeNumber && (
                            <>
                              <span aria-hidden="true" className="text-neutral-400">·</span>
                              <span className="font-tabular">Ep. {post.episodeNumber}</span>
                            </>
                          )}
                          {post.mediaDurationLabel && (
                            <>
                              <span aria-hidden="true" className="text-neutral-400">·</span>
                              <span className="font-tabular text-neutral-600 dark:text-neutral-400">
                                {post.mediaDurationLabel}
                              </span>
                            </>
                          )}
                        </div>
                        <h3 className="font-display text-lg sm:text-xl font-bold leading-snug line-clamp-1">
                          <a
                            href={`/articulo/${post.slug}`}
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/articulo/${post.slug}`);
                            }}
                            className="hover:text-[var(--editorial-primary)] transition-colors"
                          >
                            {post.title}
                          </a>
                        </h3>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate">
                          {post.authorName} · {formatDateEs(post.publishedAt || post.createdAt)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/articulo/${post.slug}`)}
                      className="self-start sm:self-center shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-[var(--editorial-primary)] font-display text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                    >
                      <span>Escuchar nota</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        );
      }

      case 'collaborators': {
        if (directoryCards.length === 0) return null;
        return (
          <section key={section.id} className="space-y-5 editorial-rule-top pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-neutral-300 dark:border-neutral-800 pb-2.5">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight flex items-center gap-2">
                  <Users className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
                  <span>{section.title || 'Conozcan a nuestros colaboradores'}</span>
                </h2>
                {section.subtitle && (
                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
                    {section.subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => navigate('/colaboradores')}
                className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)] hover:underline cursor-pointer"
              >
                <span>{section.ctaLabel || 'Ver directorio completo'}</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
            {/* Carrusel horizontal con tarjetas de ancho fijo */}
            <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
              {directoryCards.map((item) => (
                <article
                  key={item.id}
                  onClick={() => navigate(`/colaborador/${item.id}`)}
                  className="w-[260px] sm:w-[280px] shrink-0 snap-start cursor-pointer rounded-2xl border border-neutral-300/80 dark:border-neutral-800 bg-[var(--editorial-surface)] p-5 flex items-start gap-3.5 hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-neutral-900 text-white shrink-0 flex items-center justify-center font-display text-lg font-extrabold uppercase">
                    {item.avatarUrl ? (
                      <EditorialImage
                        src={item.avatarUrl}
                        alt={item.name}
                        fallbackTitle={item.name}
                        width={96}
                        height={96}
                        allowInDataSaver
                      />
                    ) : (
                      item.name.slice(0, 1)
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-[10px] font-display font-bold uppercase tracking-widest text-[var(--editorial-primary)] truncate">
                      {item.subtitle}
                    </p>
                    <h3 className="font-display text-lg font-extrabold uppercase tracking-tight flex items-center gap-1.5">
                      <span className="truncate">{item.name}</span>
                      {item.verified && <VerifiedBadge size="xs" />}
                    </h3>
                    {item.bio && (
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                        {item.bio}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      }

      case 'categories_feed': {
        if (publishedPosts.length === 0) return null;
        const canLoadMore = visibleCount < filteredFeed.length || hasMorePublishedPosts;
        return (
          <motion.section
            key={section.id}
            initial={isDataSaverActive ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.05 }}
            transition={{ duration: 0.28 }}
            className="space-y-6 pt-8 editorial-rule-top"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight flex items-center gap-2">
                  <ThemeHeadingIcon />
                  <span>{section.title}</span>
                </h2>
                {section.subtitle && (
                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
                    {section.subtitle}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex flex-wrap gap-1 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#161616] p-1 text-xs font-display font-bold uppercase tracking-wider">
                  {(
                    [
                      ['all', 'Todo'],
                      ['article', 'Artículos'],
                      ['gallery', 'Galerías'],
                      ['video', 'Video'],
                      ['audio', 'Audio'],
                      ['infographic', 'Infografías'],
                      ['document', 'Documentos'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFeedTypeFilter(val)}
                      className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                        feedTypeFilter === val
                          ? 'bg-[var(--editorial-primary)] text-white'
                          : 'text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <select
                  aria-label="Filtrar por categoría"
                  value={feedCatFilter}
                  onChange={(e) => setFeedCatFilter(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#161616] text-xs font-display font-bold uppercase tracking-wider"
                >
                  <option value="all">Todas las categorías</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredFeed.length === 0 ? (
              <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 p-10 text-center">
                <p className="text-base text-neutral-600 dark:text-neutral-400">
                  No hay publicaciones con los filtros seleccionados.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                  {filteredFeed.slice(0, visibleCount).map((post) => (
                    <ArticleCard key={post.id} post={post} />
                  ))}
                </div>

                {canLoadMore && (
                  <div className="text-center pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setHasExpandedFeed(true);
                        const nextVisible = visibleCount + 6;
                        setVisibleCount(nextVisible);
                        if (nextVisible >= filteredFeed.length && hasMorePublishedPosts) {
                          loadMorePublishedPosts();
                        }
                      }}
                      className="px-6 py-3 rounded-full border-2 border-[#111111] dark:border-neutral-500 font-display font-bold uppercase tracking-wider text-sm hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer"
                    >
                      {section.ctaLabel || 'Cargar más publicaciones'}
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.section>
        );
      }

      default:
        return null;
    }
  };

  return (
    <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-12 sm:space-y-14">
      {orderedSections.map((sec, idx) => {
        if (sec.type === 'categories_feed') {
          return (
            <React.Fragment key={sec.id}>
              {idx > 0 && <ThemeSectionDivider />}
              {/* Vitrina regional: Tolima, Colombia, Cultura, Opinión y Multimedia */}
              <motion.section
                initial={isDataSaverActive ? false : { opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ duration: 0.28 }}
                className="tolima-weave-bg rounded-3xl border border-neutral-300 dark:border-neutral-800 bg-[var(--editorial-surface)] overflow-hidden shadow-sm"
              >
                <TricolorHairline />
                <div className="p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div className="space-y-2 max-w-2xl">
                      <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                        Identidad regional · Hecho en el Tolima, para Colombia
                      </p>
                      <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight flex items-center gap-2">
                        <ThemeHeadingIcon />
                        <span>Tolima, Capital Musical de Colombia</span>
                      </h2>
                      <p className="font-editorial text-sm sm:text-base text-neutral-700 dark:text-neutral-300 leading-relaxed">
                        Territorio, cultura, memoria sonora, opinión pública y formatos multimedia desde el corazón andino del país.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate('/tolima')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                      >
                        <span>Especial Tolima</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      {(
                        [
                          ['/categoria/colombia', 'Colombia'],
                          ['/categoria/cultura', 'Cultura'],
                          ['/categoria/opinion', 'Opinión'],
                          ['/categoria/video', 'Multimedia'],
                        ] as const
                      ).map(([path, label]) => (
                        <button
                          key={path}
                          type="button"
                          onClick={() => navigate(path)}
                          className="px-3.5 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-[var(--editorial-primary)] font-display text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {regionalHighlightPosts.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                      {regionalHighlightPosts.map((post) => (
                        <ArticleCard key={post.id} post={post} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-[#F8F6F1]/80 dark:bg-[#191919]/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">
                        Explora nuestra ruta especial del departamento: música tradicional, gastronomía tolimense y periodismo territorial.
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('/tolima')}
                        className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-neutral-400 dark:border-neutral-600 font-display text-xs font-bold uppercase tracking-wider hover:border-[var(--editorial-primary)] cursor-pointer"
                      >
                        <span>Visitar página Tolima</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.section>

              <ThemeSectionDivider />
              {renderSection(sec)}
            </React.Fragment>
          );
        }
        return (
          <React.Fragment key={sec.id}>
            {idx > 0 && idx % 2 === 0 && <ThemeSectionDivider />}
            {renderSection(sec)}
          </React.Fragment>
        );
      })}
    </main>
  );
};
