import React, { useMemo, useState } from 'react';
import { ArrowRight, Calendar, Camera, Headphones, Play, Radio, TrendingUp, Zap } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { formatDateEs, getEditorialKindLabel, toDate } from '../lib/utils';
import { HomepageSectionConfig, Post, PostType } from '../types/editorial';
import { ArticleCard } from './ArticleCard';
import { EditorialImage } from './EditorialImage';

export const HomePage: React.FC = () => {
  const {
    siteConfig,
    publishedPosts,
    categories,
    seriesList,
    livestreams,
    activeLivestream,
    loading,
    navigate,
  } = useSite();

  const [feedTypeFilter, setFeedTypeFilter] = useState<'all' | PostType>('all');
  const [feedCatFilter, setFeedCatFilter] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(9);

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
    () => publishedPosts.filter((p) => p.breaking).slice(0, 6),
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
  const audioPosts = useMemo(() => publishedPosts.filter((p) => p.type === 'audio').slice(0, 3), [publishedPosts]);

  const scheduledStreams = useMemo(
    () =>
      livestreams
        .filter((s) => s.status === 'scheduled')
        .sort((a, b) => toDate(a.scheduledFor).getTime() - toDate(b.scheduledFor).getTime()),
    [livestreams]
  );

  const filteredFeed = useMemo(() => {
    return publishedPosts.filter((p) => {
      if (feedTypeFilter !== 'all' && p.type !== feedTypeFilter) return false;
      if (feedCatFilter !== 'all' && p.categorySlug !== feedCatFilter) return false;
      return true;
    });
  }, [publishedPosts, feedTypeFilter, feedCatFilter]);

  if (loading && publishedPosts.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-8 animate-pulse">
        <div className="h-[65vh] rounded-3xl bg-neutral-200 dark:bg-neutral-800" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-64 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-64 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>
    );
  }

  // Portada limpia "Muy pronto" cuando no hay contenido real publicado
  if (!loading && publishedPosts.length === 0 && !activeLivestream && scheduledStreams.length === 0) {
    return (
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 animate-fade-up">
        <section className="relative overflow-hidden rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-[#141414] via-[#1C0B0B] to-[#0D0D0D] text-[#F4F1EA] px-6 py-16 sm:px-14 sm:py-24 shadow-2xl">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[var(--editorial-primary)]/20 blur-3xl pointer-events-none" />
          <div className="relative max-w-2xl space-y-6">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/15 font-display text-xs font-bold uppercase tracking-widest text-[#FCA5A5]">
              Edición en preparación
            </span>
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
                <span>¿Eres colaborador? Únete a la red</span>
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const renderSection = (section: HomepageSectionConfig) => {
    switch (section.type) {
      case 'live': {
        if (!activeLivestream && scheduledStreams.length === 0) return null;
        return (
          <section key={section.id} className="space-y-4 animate-fade-up">
            {activeLivestream && (
              <div className="rounded-3xl border border-red-900/50 bg-gradient-to-br from-[#7F1D1D] via-[#1C0A0A] to-[#0D0D0D] text-white p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 text-xs font-display font-extrabold uppercase tracking-widest text-[#FCA5A5]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse shadow-[0_0_12px_#EF4444]" aria-hidden="true" />
                    <span>EN VIVO AHORA</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-tabular">{activeLivestream.viewerCount} espectadores</span>
                  </div>
                  <h2 className="font-display text-2xl sm:text-4xl font-extrabold leading-tight headline-balance">
                    {activeLivestream.title}
                  </h2>
                  <p className="text-sm text-neutral-300">
                    Conduce: {activeLivestream.hostName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/en-vivo/${activeLivestream.id}`)}
                  className="px-6 py-3.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display font-bold uppercase tracking-wider text-sm whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5"
                >
                  <Radio className="w-4 h-4" aria-hidden="true" />
                  <span>Ver transmisión</span>
                </button>
              </div>
            )}

            {scheduledStreams.length > 0 && (
              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[var(--editorial-primary)]/10 text-[var(--editorial-primary)] flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                      Próxima transmisión programada
                    </p>
                    <p className="font-display text-lg font-bold truncate">
                      {scheduledStreams[0].title}
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {formatDateEs(scheduledStreams[0].scheduledFor, true)} · {scheduledStreams[0].hostName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/en-vivo/${scheduledStreams[0].id}`)}
                  className="px-5 py-2.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-black font-display font-bold uppercase tracking-wider text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer"
                >
                  Ir a sala y cuenta regresiva
                </button>
              </div>
            )}
          </section>
        );
      }

      case 'hero': {
        if (!heroPost) return null;
        const railPosts = publishedPosts.filter((p) => p.id !== heroPost.id).slice(0, 4);
        return (
          <section key={section.id} className="space-y-8 animate-fade-up">
            {/* Full-screen Editorial Hero */}
            <article className="relative min-h-[70vh] lg:min-h-[78vh] rounded-3xl overflow-hidden bg-[#111111] shadow-2xl group flex items-end">
              <EditorialImage
                src={heroPost.coverImage}
                alt={heroPost.coverAlt || heroPost.title}
                fallbackTitle={heroPost.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/20" />

              {heroPost.coverCredit && (
                <span className="absolute top-4 right-5 px-3 py-1 rounded-full bg-black/55 backdrop-blur-xs text-[11px] text-white/85 font-display tracking-wide">
                  {heroPost.coverCredit}
                </span>
              )}

              <div className="relative z-10 w-full p-6 sm:p-10 lg:p-14 max-w-4xl space-y-4 text-white">
                <div className="flex flex-wrap items-center gap-2 text-xs font-display font-bold uppercase tracking-widest">
                  <span className="px-3 py-1 rounded-full bg-[var(--editorial-primary)] text-white">
                    {heroPost.categoryName}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-white/95">
                    {getEditorialKindLabel(heroPost.editorialKind)}
                  </span>
                  {heroPost.seriesTitle && (
                    <span className="px-3 py-1 rounded-full bg-black/50 border border-white/20 text-neutral-200">
                      {heroPost.seriesTitle}
                    </span>
                  )}
                </div>

                <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.02] tracking-tight headline-balance">
                  <a
                    href={`/articulo/${heroPost.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/articulo/${heroPost.slug}`);
                    }}
                    className="hover:text-[#FCA5A5] transition-colors"
                  >
                    {heroPost.title}
                  </a>
                </h1>

                {heroPost.subtitle && (
                  <p className="text-base sm:text-xl text-neutral-200 leading-relaxed max-w-3xl font-editorial">
                    {heroPost.subtitle}
                  </p>
                )}

                <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-300">
                    <span className="font-bold text-white">{heroPost.authorName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDateEs(heroPost.publishedAt || heroPost.createdAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-tabular">{heroPost.readTimeMinutes} min de lectura</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/articulo/${heroPost.slug}`)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#111111] hover:bg-[var(--editorial-primary)] hover:text-white font-display text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-md"
                  >
                    <span>Leer completo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </article>

            {/* Edición del día & Red CTA strip */}
            {railPosts.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-8 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 shadow-sm">
                  <h2 className="font-display text-sm font-extrabold uppercase tracking-widest text-[var(--editorial-primary)] pb-3 border-b border-neutral-200 dark:border-neutral-800">
                    Edición del día
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 divide-neutral-200 dark:divide-neutral-800">
                    {railPosts.map((p) => (
                      <ArticleCard key={p.id} post={p} variant="compact" />
                    ))}
                  </div>
                </div>

                <aside className="lg:col-span-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-[#141414] to-[#260D0D] text-white p-6 flex flex-col justify-between shadow-sm">
                  <div className="space-y-2">
                    <p className="font-display text-xs font-bold uppercase tracking-widest text-[#FCA5A5]">
                      Red de medios independientes
                    </p>
                    <h3 className="font-display text-2xl font-extrabold uppercase leading-tight">
                      Periodismo sin censura corporativa
                    </h3>
                    <p className="text-sm text-neutral-300 leading-relaxed">
                      Publicamos crónicas, investigaciones y opinión con transparencia editorial y pluralidad crítica.
                    </p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/unete')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] font-display text-xs font-bold uppercase tracking-wider text-white cursor-pointer transition-colors"
                    >
                      <span>Únete como colaborador</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/como-trabajamos')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/25 hover:bg-white hover:text-[#111111] font-display text-xs font-bold uppercase tracking-wider text-white cursor-pointer transition-colors"
                    >
                      <span>Cómo trabajamos</span>
                    </button>
                  </div>
                </aside>
              </div>
            )}
          </section>
        );
      }

      case 'featured': {
        if (featuredPosts.length === 0) return null;
        return (
          <section key={section.id} className="space-y-5">
            <div className="flex items-baseline justify-between border-b border-neutral-300 dark:border-neutral-800 pb-2">
              <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
                {section.title}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {featuredPosts.map((post) => (
                <ArticleCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        );
      }

      case 'breaking': {
        if (breakingPosts.length === 0) return null;
        return (
          <section key={section.id} className="rounded-2xl border border-[var(--editorial-primary)]/40 bg-white dark:bg-[#141414] p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 rounded-full bg-[var(--editorial-primary)] text-white font-display text-xs font-extrabold uppercase tracking-widest">
                {section.title}
              </span>
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                Actualizaciones recientes de nuestra redacción y colaboradores
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {breakingPosts.slice(0, 4).map((post) => (
                <article key={post.id} className="space-y-1.5">
                  <p className="text-xs font-display font-bold uppercase tracking-wider text-[var(--editorial-primary)]">
                    {post.categoryName} · {formatDateEs(post.publishedAt || post.createdAt)}
                  </p>
                  <h3 className="font-display text-lg font-bold leading-snug">
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
                </article>
              ))}
            </div>
          </section>
        );
      }

      case 'most_read': {
        if (mostReadPosts.length === 0) return null;
        return (
          <section key={section.id} className="rounded-2xl bg-white dark:bg-[#141414] border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3 mb-6">
              <TrendingUp className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
              <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
                {section.title}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {mostReadPosts.map((post, idx) => (
                <article key={post.id} className="flex md:flex-col gap-3 md:gap-2">
                  <span className="font-display text-3xl font-extrabold text-[var(--editorial-primary)] font-tabular leading-none">
                    0{idx + 1}
                  </span>
                  <div>
                    <p className="text-xs font-display uppercase tracking-wider text-neutral-500">
                      {post.categoryName}
                    </p>
                    <h3 className="mt-1 font-display text-lg font-bold leading-snug">
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
                    <p className="mt-1.5 text-xs font-tabular text-neutral-500">
                      {(post.viewCount || 0).toLocaleString('es-ES')} lecturas
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      }

      case 'opinion': {
        if (opinionPosts.length === 0) return null;
        return (
          <section key={section.id} className="space-y-5">
            <div className="flex items-baseline justify-between border-b border-neutral-300 dark:border-neutral-800 pb-2">
              <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
                {section.title}
              </h2>
              <a
                href="/categoria/opinion"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/categoria/opinion');
                }}
                className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)] hover:underline"
              >
                Ver todas las columnas
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          <section key={section.id} className="space-y-5">
            <div className="flex items-baseline justify-between border-b border-neutral-300 dark:border-neutral-800 pb-2">
              <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
                {section.title}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {seriesList.map((ser) => (
                <article
                  key={ser.id}
                  onClick={() => navigate(`/serie/${ser.slug}`)}
                  className="group cursor-pointer rounded-3xl border border-neutral-800 bg-[#111111] text-white grid grid-cols-1 sm:grid-cols-12 overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="sm:col-span-5 aspect-[4/3] sm:aspect-auto overflow-hidden">
                    <EditorialImage
                      src={ser.coverImage}
                      alt={ser.title}
                      fallbackTitle={ser.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="sm:col-span-7 p-6 flex flex-col justify-between">
                    <div>
                      <p className="font-display text-xs font-bold uppercase tracking-widest text-[#FCA5A5]">
                        Dossier especial
                      </p>
                      <h3 className="mt-1.5 font-display text-2xl font-bold leading-tight group-hover:underline">
                        {ser.title}
                      </h3>
                      <p className="mt-2 text-sm text-neutral-300 line-clamp-3 leading-relaxed">
                        {ser.description}
                      </p>
                    </div>
                    <span className="mt-4 inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wider text-white">
                      <span>Explorar dossier</span>
                      <ArrowRight className="w-3.5 h-3.5" />
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
        return (
          <section key={section.id} className="space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-300 dark:border-neutral-800 pb-2">
              <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight flex items-center gap-2">
                <Camera className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
                <span>{section.title}</span>
              </h2>
              <a
                href="/categoria/fotografia"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/categoria/fotografia');
                }}
                className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)] hover:underline"
              >
                Más fotografía
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {galleryPosts.map((post) => (
                <ArticleCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        );
      }

      case 'videos': {
        if (videoPosts.length === 0) return null;
        return (
          <section key={section.id} className="space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-300 dark:border-neutral-800 pb-2">
              <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight flex items-center gap-2">
                <Play className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
                <span>{section.title}</span>
              </h2>
              <a
                href="/categoria/video"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/categoria/video');
                }}
                className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)] hover:underline"
              >
                Más videos
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {videoPosts.map((post) => (
                <ArticleCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        );
      }

      case 'audio': {
        if (audioPosts.length === 0) return null;
        return (
          <section key={section.id} className="space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-300 dark:border-neutral-800 pb-2">
              <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight flex items-center gap-2">
                <Headphones className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
                <span>{section.title}</span>
              </h2>
              <a
                href="/categoria/audio-y-podcast"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/categoria/audio-y-podcast');
                }}
                className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)] hover:underline"
              >
                Todos los pódcasts
              </a>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {audioPosts.map((post) => (
                <ArticleCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        );
      }

      case 'categories_feed': {
        if (publishedPosts.length === 0) return null;
        return (
          <section key={section.id} className="space-y-6 pt-4 border-t border-neutral-300 dark:border-neutral-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="font-display text-3xl font-extrabold uppercase tracking-tight">
                {section.title}
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex flex-wrap gap-1 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#161616] p-1 text-xs font-display font-bold uppercase tracking-wider">
                  {(
                    [
                      ['all', 'Todo'],
                      ['article', 'Artículos'],
                      ['gallery', 'Galerías'],
                      ['video', 'Video'],
                      ['audio', 'Audio'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFeedTypeFilter(val)}
                      className={`px-3.5 py-1.5 rounded-full cursor-pointer transition-colors ${
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
                  className="px-4 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#161616] text-xs font-display font-bold uppercase tracking-wider"
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredFeed.slice(0, visibleCount).map((post) => (
                    <ArticleCard key={post.id} post={post} />
                  ))}
                </div>

                {visibleCount < filteredFeed.length && (
                  <div className="text-center pt-4">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((v) => v + 6)}
                      className="px-6 py-3 rounded-full border-2 border-[#111111] dark:border-neutral-500 font-display font-bold uppercase tracking-wider text-sm hover:bg-[#111111] hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer"
                    >
                      Cargar más publicaciones
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        );
      }

      default:
        return null;
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-12">
      {/* Cinta deslizante "Última hora" cuando existan notas marcadas como breaking */}
      {breakingPosts.length > 0 && (
        <div className="rounded-full border border-[var(--editorial-primary)]/40 bg-[#111111] text-white overflow-hidden flex items-center shadow-sm">
          <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--editorial-primary)] text-white font-display text-xs font-extrabold uppercase tracking-widest shrink-0">
            <Zap className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Última hora</span>
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
                  className="inline-flex items-center gap-3 px-6 text-xs sm:text-sm font-display font-semibold hover:text-[#FCA5A5] transition-colors whitespace-nowrap"
                >
                  <span className="text-[var(--editorial-primary)] uppercase font-bold">
                    {post.categoryName}
                  </span>
                  <span>{post.title}</span>
                  <span aria-hidden="true" className="text-neutral-600">•</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {orderedSections.map((sec) => renderSection(sec))}
    </main>
  );
};
