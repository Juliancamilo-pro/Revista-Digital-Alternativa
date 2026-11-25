import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Camera,
  Headphones,
  Newspaper,
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
import { EditorialButton, EmptyState, FilterChip, SectionHeader } from './ui/EditorialPrimitives';
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

  // Portada limpia cuando no hay contenido publicado todavía
  if (!loading && publishedPosts.length === 0) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 animate-fade-up">
        <section className="relative overflow-hidden rounded-3xl border border-[var(--editorial-border)] bg-gradient-to-br from-[#141414] via-[#1C0B0B] to-[#0D0D0D] text-[#F4F1EA] px-6 py-16 sm:px-14 sm:py-24 shadow-2xl">
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
              <EditorialButton size="lg" onClick={() => navigate('/como-trabajamos')}>
                <span>Cómo trabajamos</span>
                <ArrowRight className="w-4 h-4" />
              </EditorialButton>
              <EditorialButton
                size="lg"
                variant="secondary"
                onClick={() => navigate('/unete')}
                className="!bg-transparent !text-white !border-white/30 hover:!bg-white hover:!text-[#111111]"
              >
                <span>{joinBannerCta}</span>
              </EditorialButton>
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
        const heroKindLabel = getEditorialKindLabel(heroPost.editorialKind);
        const showHeroKind =
          Boolean(heroKindLabel) &&
          heroKindLabel.trim().toLowerCase() !== (heroPost.categoryName || '').trim().toLowerCase();

        return (
          <section key={section.id} className="space-y-6 animate-fade-up">
            {/* Retícula 12 columnas: 8/12 apertura principal 16:9 + 4/12 columna lateral */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <article
                className={`relative lg:col-span-8 rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 group flex flex-col ${
                  showHoverEffects ? 'theme-card-hover-glow' : ''
                }`}
              >
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
                    fallbackCategory={heroPost.categoryName}
                    width={1280}
                    height={720}
                    priority
                    sensitive={heroPost.sensitiveContent}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                  {heroPost.coverCredit && (
                    <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-xs text-[11px] text-white font-display tracking-wide">
                      {heroPost.coverCredit}
                    </span>
                  )}
                </a>

                <div className="p-5 sm:p-8 flex-1 flex flex-col justify-between gap-5">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-display font-bold uppercase tracking-[0.12em]">
                      <a
                        href={`/categoria/${heroPost.categorySlug}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/categoria/${heroPost.categorySlug}`);
                        }}
                        className="text-[var(--editorial-primary)] hover:underline"
                      >
                        {heroPost.categoryName}
                      </a>
                      {showHeroKind && (
                        <>
                          <span aria-hidden="true" className="text-[var(--editorial-muted)]/60">
                            ·
                          </span>
                          <span className="text-[var(--editorial-muted)]">{heroKindLabel}</span>
                        </>
                      )}
                      {heroPost.seriesTitle && (
                        <>
                          <span aria-hidden="true" className="text-[var(--editorial-muted)]/60">
                            ·
                          </span>
                          <span className="text-[var(--editorial-ink)]">{heroPost.seriesTitle}</span>
                        </>
                      )}
                    </div>

                    <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold leading-[1.04] tracking-tight headline-balance text-[var(--editorial-ink)]">
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
                      <p className="text-base sm:text-lg text-[var(--editorial-muted)] leading-relaxed font-editorial line-clamp-3">
                        {heroPost.subtitle}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[var(--editorial-border)] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--editorial-muted)]">
                      <a
                        href={`/colaborador/${heroAuthorTargetId}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/colaborador/${heroAuthorTargetId}`);
                        }}
                        className="inline-flex items-center gap-1.5 font-bold text-[var(--editorial-ink)] hover:text-[var(--editorial-primary)] transition-colors"
                      >
                        <span>{heroPost.authorName}</span>
                        {heroVerified && <VerifiedBadge size="xs" />}
                      </a>
                      <span aria-hidden="true">·</span>
                      <span>{formatDateEs(heroPost.publishedAt || heroPost.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-tabular">{heroPost.readTimeMinutes} min de lectura</span>
                    </div>

                    <EditorialButton
                      variant="ink"
                      size="md"
                      onClick={() => navigate(`/articulo/${heroPost.slug}`)}
                    >
                      <span>{section.ctaLabel || 'Leer completo'}</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </EditorialButton>
                  </div>
                </div>
              </article>

              {/* Columna lateral 4/12 */}
              <aside className="lg:col-span-4 flex flex-col justify-between gap-5">
                <div className="flex-1 rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 flex flex-col shadow-xs">
                  <div className="flex items-center justify-between border-b-2 border-[var(--editorial-primary)] pb-2.5 mb-2">
                    <h2 className="font-display text-sm font-extrabold uppercase tracking-widest text-[var(--editorial-primary)] flex items-center gap-1.5">
                      <ThemeHeadingIcon />
                      <span>{dailyStripLabel}</span>
                    </h2>
                    <span className="font-tabular text-[11px] text-[var(--editorial-muted)] uppercase">
                      {railPosts.length} notas
                    </span>
                  </div>

                  {railPosts.length > 0 ? (
                    <div className="divide-y divide-[var(--editorial-border)] flex-1 flex flex-col justify-between">
                      {railPosts.map((p, idx) => (
                        <ArticleCard
                          key={p.id}
                          post={p}
                          variant="compact"
                          indexLabel={`0${idx + 1}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--editorial-muted)] py-6 font-editorial">
                      Más entregas editoriales en preparación.
                    </p>
                  )}
                </div>

                {/* Bloque de vinculación editable */}
                <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-[#141414] via-[#1B1212] to-[#2C0D0D] text-white p-5 sm:p-6 space-y-3 shadow-sm">
                  <p className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-[#FCA5A5]">
                    {joinBannerKicker}
                  </p>
                  <h3 className="font-display text-xl sm:text-2xl font-extrabold uppercase leading-tight">
                    {joinBannerTitle}
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed line-clamp-2">
                    {joinBannerSubtitle}
                  </p>
                  <div className="pt-1">
                    <EditorialButton variant="primary" size="md" onClick={() => navigate('/unete')}>
                      <span>{joinBannerCta}</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </EditorialButton>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        );
      }

      case 'breaking': {
        if (breakingPosts.length === 0) return null;
        const shouldMarquee = breakingPosts.length >= 3 && !isDataSaverActive;
        return (
          <section
            key={section.id}
            aria-label={section.title || 'Última hora'}
            className="min-h-10 rounded-xl border border-[var(--editorial-primary)]/40 bg-[#141414] text-white overflow-hidden flex items-center shadow-xs"
          >
            <span className="self-stretch inline-flex items-center gap-1.5 px-3.5 sm:px-4 bg-[var(--editorial-primary)] text-white font-display text-xs font-extrabold uppercase tracking-widest shrink-0">
              <Zap className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{section.title || 'Última hora'}</span>
            </span>
            {shouldMarquee ? (
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
                      <span className="text-[#FCA5A5] uppercase font-bold">{post.categoryName}</span>
                      <span>{post.title}</span>
                      <span aria-hidden="true" className="text-neutral-600">
                        ·
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 overflow-x-auto">
                {breakingPosts.map((post) => (
                  <a
                    key={post.id}
                    href={`/articulo/${post.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/articulo/${post.slug}`);
                    }}
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-display font-semibold hover:text-[#FCA5A5] transition-colors whitespace-nowrap"
                  >
                    <span className="text-[#FCA5A5] uppercase font-bold">{post.categoryName}</span>
                    <span>{post.title}</span>
                  </a>
                ))}
              </div>
            )}
          </section>
        );
      }

      case 'featured': {
        if (featuredPosts.length === 0) return null;
        const [firstFeatured, ...restFeatured] = featuredPosts;
        const leadColClass =
          restFeatured.length === 0
            ? 'md:col-span-2 lg:col-span-12'
            : restFeatured.length === 1
            ? 'md:col-span-1 lg:col-span-7'
            : 'md:col-span-2 lg:col-span-6';
        return (
          <motion.section
            key={section.id}
            initial={isDataSaverActive ? false : { opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08 }}
            transition={{ duration: 0.28 }}
            className="space-y-6 editorial-rule-top pt-8"
          >
            <SectionHeader
              kicker="Selección de portada"
              title={section.title || 'Destacados'}
              subtitle={section.subtitle}
              ornament={<ThemeHeadingIcon />}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-stretch">
              {firstFeatured && (
                <div className={leadColClass}>
                  <ArticleCard post={firstFeatured} variant="featured_lead" />
                </div>
              )}
              {restFeatured.slice(0, 2).map((post) => (
                <div
                  key={post.id}
                  className={restFeatured.length === 1 ? 'lg:col-span-5' : 'lg:col-span-3'}
                >
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
              {topRead && (
                <article
                  className={`lg:col-span-7 rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] overflow-hidden shadow-xs hover:shadow-lg transition-shadow flex flex-col sm:flex-row group ${
                    showHoverEffects ? 'theme-card-hover-glow' : ''
                  }`}
                >
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
                      fallbackCategory={topRead.categoryName}
                      width={700}
                      height={525}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  </a>
                  <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-3">
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                        <span className="font-tabular px-2 py-0.5 rounded-full bg-[var(--editorial-primary)]/10">
                          #01 Más leída
                        </span>
                        <span>{topRead.categoryName}</span>
                      </div>
                      <h3 className="font-display text-2xl sm:text-[1.75rem] font-extrabold leading-tight headline-balance text-[var(--editorial-ink)]">
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
                        <p className="text-sm text-[var(--editorial-muted)] line-clamp-3 font-editorial">
                          {topRead.subtitle}
                        </p>
                      )}
                    </div>
                    <div className="pt-3 border-t border-[var(--editorial-border)] flex items-center justify-between text-xs text-[var(--editorial-muted)]">
                      <span className="font-semibold text-[var(--editorial-ink)]">{topRead.authorName}</span>
                      <span className="font-tabular font-semibold">
                        {(topRead.viewCount || 0).toLocaleString('es-CO')} lecturas
                      </span>
                    </div>
                  </div>
                </article>
              )}

              <aside className="lg:col-span-5 rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 sm:p-6 shadow-xs flex flex-col">
                <div className="flex items-center justify-between border-b-2 border-[var(--editorial-primary)] pb-2.5 mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[var(--editorial-primary)]" aria-hidden="true" />
                    <h2 className="font-display text-lg font-extrabold uppercase tracking-tight flex items-center gap-1.5 text-[var(--editorial-ink)]">
                      <span>{section.title}</span>
                      <ThemeHeadingIcon />
                    </h2>
                  </div>
                  {section.subtitle && (
                    <span className="text-[11px] text-[var(--editorial-muted)] hidden sm:inline">
                      {section.subtitle}
                    </span>
                  )}
                </div>
                <ol className="divide-y divide-[var(--editorial-border)] flex-1 flex flex-col justify-between">
                  {(otherRead.length > 0 ? otherRead : mostReadPosts).map((post, idx) => {
                    const rank = otherRead.length > 0 ? idx + 2 : idx + 1;
                    return (
                      <li key={post.id} className="py-2.5 first:pt-1 last:pb-1 flex items-start gap-3">
                        <span className="font-display text-2xl font-extrabold text-[var(--editorial-primary)] font-tabular leading-none pt-0.5 shrink-0">
                          0{rank}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-display font-bold uppercase tracking-wider text-[var(--editorial-muted)]">
                            {post.categoryName} · {(post.viewCount || 0).toLocaleString('es-CO')} lecturas
                          </p>
                          <h3 className="font-display text-base sm:text-[17px] font-bold leading-snug line-clamp-2 mt-0.5 text-[var(--editorial-ink)]">
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
          <section key={section.id} className="space-y-6 editorial-rule-top pt-8">
            <SectionHeader
              kicker="Voces y análisis"
              title={section.title || 'Opinión'}
              subtitle={section.subtitle}
              ornament={<ThemeHeadingIcon />}
              action={
                <EditorialButton
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/categoria/opinion')}
                  className="text-[var(--editorial-primary)]"
                >
                  <span>{section.ctaLabel || 'Ver todas las columnas'}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </EditorialButton>
              }
            />
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
          <section key={section.id} className="space-y-6 editorial-rule-top pt-8">
            <SectionHeader
              kicker="Investigación por entregas"
              title={section.title || 'Especiales'}
              subtitle={section.subtitle}
              ornament={<ThemeHeadingIcon />}
            />
            <div className="flex gap-5 overflow-x-auto pb-3 snap-x snap-mandatory">
              {seriesList.map((ser) => (
                <article
                  key={ser.id}
                  onClick={() => navigate(`/serie/${ser.slug}`)}
                  className="w-[290px] sm:w-[320px] shrink-0 snap-start group cursor-pointer rounded-2xl border border-neutral-800 bg-[#141414] text-white overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex flex-col"
                >
                  <div className="aspect-[16/10] overflow-hidden shrink-0">
                    <EditorialImage
                      src={ser.coverImage}
                      alt={ser.title}
                      fallbackTitle={ser.title}
                      fallbackCategory="Especial seriado"
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
          <section key={section.id} className="space-y-6 editorial-rule-top pt-8">
            <SectionHeader
              kicker="Mirada documental"
              title={section.title || 'Fotoperiodismo'}
              subtitle={section.subtitle}
              ornament={<Camera className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />}
              action={
                <EditorialButton
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/categoria/fotografia')}
                  className="text-[var(--editorial-primary)]"
                >
                  <span>{section.ctaLabel || 'Más fotografía'}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </EditorialButton>
              }
            />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
              {leadGallery && (
                <div className={sideGalleries.length > 0 ? 'md:col-span-7' : 'md:col-span-12'}>
                  <ArticleCard post={leadGallery} variant="featured_lead" />
                </div>
              )}
              {sideGalleries.length > 0 && (
                <div className="md:col-span-5 grid grid-cols-1 gap-5">
                  {sideGalleries.map((post) => (
                    <ArticleCard key={post.id} post={post} variant="horizontal" />
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
          <section key={section.id} className="space-y-6 editorial-rule-top pt-8">
            <SectionHeader
              kicker="Audiovisual"
              title={section.title || 'Video'}
              subtitle={section.subtitle}
              ornament={<Play className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />}
              action={
                <EditorialButton
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/categoria/video')}
                  className="text-[var(--editorial-primary)]"
                >
                  <span>{section.ctaLabel || 'Más videos'}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </EditorialButton>
              }
            />
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
          <section key={section.id} className="space-y-6 editorial-rule-top pt-8">
            <SectionHeader
              kicker="Periodismo sonoro"
              title={section.title || 'Audio y Pódcast'}
              subtitle={section.subtitle}
              ornament={<Headphones className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />}
              action={
                <EditorialButton
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/categoria/audio-y-podcast')}
                  className="text-[var(--editorial-primary)]"
                >
                  <span>{section.ctaLabel || 'Todos los pódcasts'}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </EditorialButton>
              }
            />

            <div className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] divide-y divide-[var(--editorial-border)] shadow-xs overflow-hidden">
              {audioPosts.map((post) => {
                const mediaSrc = sanitizeExternalUrl(post.mediaUrl || '');
                const isActiveTrack = currentTrack?.postId === post.id;
                const isThisPlaying = isActiveTrack && globalAudioPlaying;
                return (
                  <article
                    key={post.id}
                    className={`p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      isActiveTrack
                        ? 'bg-[var(--editorial-primary)]/[0.06]'
                        : 'hover:bg-[var(--editorial-surface-subtle)]'
                    }`}
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
                            ? 'bg-[var(--editorial-ink)] text-[var(--editorial-paper)]'
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
                          {post.seasonNumber && (
                            <>
                              <span aria-hidden="true" className="text-[var(--editorial-muted)]/60">
                                ·
                              </span>
                              <span className="font-tabular">T{post.seasonNumber}</span>
                            </>
                          )}
                          {post.episodeNumber && (
                            <>
                              <span aria-hidden="true" className="text-[var(--editorial-muted)]/60">
                                ·
                              </span>
                              <span className="font-tabular">Ep. {post.episodeNumber}</span>
                            </>
                          )}
                          {post.mediaDurationLabel && (
                            <>
                              <span aria-hidden="true" className="text-[var(--editorial-muted)]/60">
                                ·
                              </span>
                              <span className="font-tabular text-[var(--editorial-muted)]">
                                {post.mediaDurationLabel}
                              </span>
                            </>
                          )}
                          {isThisPlaying && (
                            <span className="inline-flex items-end gap-0.5 h-3 ml-1" aria-label="Reproduciendo">
                              <span className="w-0.5 h-2.5 bg-[var(--editorial-primary)] rounded-full" />
                              <span className="w-0.5 h-3 bg-[var(--editorial-primary)] rounded-full" />
                              <span className="w-0.5 h-1.5 bg-[var(--editorial-primary)] rounded-full" />
                            </span>
                          )}
                        </div>
                        <h3 className="font-display text-lg sm:text-xl font-bold leading-snug line-clamp-1 text-[var(--editorial-ink)]">
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
                        <p className="text-xs text-[var(--editorial-muted)] truncate">
                          {post.authorName} · {formatDateEs(post.publishedAt || post.createdAt)}
                        </p>
                      </div>
                    </div>

                    <EditorialButton
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/articulo/${post.slug}`)}
                      className="self-start sm:self-center shrink-0"
                    >
                      <span>Escuchar nota</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </EditorialButton>
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
          <section key={section.id} className="space-y-6 editorial-rule-top pt-8">
            <SectionHeader
              kicker="Red colaborativa"
              title={section.title || 'Conozcan a nuestros colaboradores'}
              subtitle={section.subtitle}
              ornament={<Users className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />}
              action={
                <EditorialButton
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/colaboradores')}
                  className="text-[var(--editorial-primary)]"
                >
                  <span>{section.ctaLabel || 'Ver directorio completo'}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </EditorialButton>
              }
            />

            <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
              {directoryCards.map((item) => (
                <article
                  key={item.id}
                  onClick={() => navigate(`/colaborador/${item.id}`)}
                  className="w-[260px] sm:w-[285px] shrink-0 snap-start cursor-pointer rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 flex items-start gap-3.5 hover:shadow-lg hover:border-[var(--editorial-primary)]/45 transition-all"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-neutral-900 text-white shrink-0 flex items-center justify-center font-display text-lg font-extrabold uppercase">
                    {item.avatarUrl ? (
                      <EditorialImage
                        src={item.avatarUrl}
                        alt={item.name}
                        fallbackTitle={item.name}
                        fallbackCategory={item.subtitle}
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
                    <h3 className="font-display text-lg font-extrabold uppercase tracking-tight flex items-center gap-1.5 text-[var(--editorial-ink)]">
                      <span className="truncate">{item.name}</span>
                      {item.verified && <VerifiedBadge size="xs" />}
                    </h3>
                    {item.bio && (
                      <p className="text-xs text-[var(--editorial-muted)] line-clamp-2 leading-relaxed">
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
            <SectionHeader
              kicker="Archivo abierto"
              title={section.title || 'Todas las publicaciones'}
              subtitle={section.subtitle}
              ornament={<ThemeHeadingIcon />}
              action={
                <select
                  aria-label="Filtrar por categoría"
                  value={feedCatFilter}
                  onChange={(e) => setFeedCatFilter(e.target.value)}
                  className="px-4 py-2 min-h-[40px] rounded-full border border-[var(--editorial-border)] bg-[var(--editorial-surface)] text-[var(--editorial-ink)] text-xs font-display font-bold uppercase tracking-wider cursor-pointer focus:outline-none focus:border-[var(--editorial-primary)]"
                >
                  <option value="all">Todas las categorías</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              }
            />

            {/* Chips de formato */}
            <div className="flex flex-wrap items-center gap-2">
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
                <FilterChip
                  key={val}
                  active={feedTypeFilter === val}
                  onClick={() => setFeedTypeFilter(val)}
                >
                  {label}
                </FilterChip>
              ))}
            </div>

            {filteredFeed.length === 0 ? (
              <EmptyState
                icon={<Newspaper className="w-6 h-6" />}
                kicker="Sin coincidencias"
                title="No encontramos entregas con estos filtros"
                description="Prueba seleccionando otro formato o volviendo a mostrar todas las categorías del archivo."
                action={
                  <EditorialButton
                    variant="secondary"
                    onClick={() => {
                      setFeedTypeFilter('all');
                      setFeedCatFilter('all');
                    }}
                  >
                    Limpiar filtros
                  </EditorialButton>
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
                  {filteredFeed.slice(0, visibleCount).map((post) => (
                    <ArticleCard key={post.id} post={post} />
                  ))}
                </div>

                {canLoadMore && (
                  <div className="text-center pt-4">
                    <EditorialButton
                      variant="secondary"
                      size="lg"
                      onClick={() => {
                        setHasExpandedFeed(true);
                        const nextVisible = visibleCount + 6;
                        setVisibleCount(nextVisible);
                        if (nextVisible >= filteredFeed.length && hasMorePublishedPosts) {
                          loadMorePublishedPosts();
                        }
                      }}
                    >
                      <span>{section.ctaLabel || 'Cargar más publicaciones'}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </EditorialButton>
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
                className="tolima-weave-bg rounded-3xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] overflow-hidden shadow-xs"
              >
                <TricolorHairline />
                <div className="p-6 sm:p-8 space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div className="space-y-2 max-w-2xl">
                      <p className="font-display text-xs font-bold uppercase tracking-[0.14em] text-[var(--editorial-primary)]">
                        Identidad regional · Hecho en el Tolima, para Colombia
                      </p>
                      <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight flex items-center gap-2 text-[var(--editorial-ink)]">
                        <ThemeHeadingIcon />
                        <span>Tolima, Capital Musical de Colombia</span>
                      </h2>
                      <p className="font-editorial text-sm sm:text-base text-[var(--editorial-muted)] leading-relaxed">
                        Territorio, cultura, memoria sonora, opinión pública y formatos multimedia desde el corazón andino del país.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <EditorialButton variant="primary" size="md" onClick={() => navigate('/tolima')}>
                        <span>Especial Tolima</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </EditorialButton>
                      {(
                        [
                          ['/categoria/colombia', 'Colombia'],
                          ['/categoria/cultura', 'Cultura'],
                          ['/categoria/opinion', 'Opinión'],
                          ['/categoria/video', 'Multimedia'],
                        ] as const
                      ).map(([path, label]) => (
                        <FilterChip key={path} onClick={() => navigate(path)}>
                          {label}
                        </FilterChip>
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
                    <div className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface-subtle)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <p className="text-sm text-[var(--editorial-muted)]">
                        Explora nuestra ruta especial del departamento: música tradicional, gastronomía tolimense y periodismo territorial.
                      </p>
                      <EditorialButton
                        variant="secondary"
                        size="md"
                        onClick={() => navigate('/tolima')}
                        className="shrink-0"
                      >
                        <span>Visitar página Tolima</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </EditorialButton>
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
