import React, { useMemo, useState } from 'react';
import { Clock, Headphones, Play, Search, SlidersHorizontal, Tag, X } from 'lucide-react';
import { AudioTrackItem, useMediaPlayer } from '../context/MediaPlayerContext';
import { useSite } from '../context/SiteContext';
import { getEmbedUrl, sanitizeExternalUrl, toDate } from '../lib/utils';
import { Post, PostType } from '../types/editorial';
import { ArticleCard } from './ArticleCard';
import { EditorialButton, EmptyState, FilterChip } from './ui/EditorialPrimitives';

interface SearchPageProps {
  initialCategorySlug?: string;
  initialTag?: string;
  initialSeriesSlug?: string;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  initialCategorySlug,
  initialTag,
  initialSeriesSlug,
}) => {
  const {
    publishedPosts,
    hasMorePublishedPosts,
    loadMorePublishedPosts,
    categories,
    collaborators,
    adminIdentities,
    seriesList,
    currentPath,
    navigate,
  } = useSite();
  const { playTrack } = useMediaPlayer();

  const initialQueryFromUrl = useMemo(() => {
    const queryIdx = currentPath.indexOf('?');
    if (queryIdx !== -1) {
      return new URLSearchParams(currentPath.slice(queryIdx + 1)).get('q') || '';
    }
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('q') || '';
    }
    return '';
  }, [currentPath]);

  const [queryText, setQueryText] = useState(initialQueryFromUrl);
  const [typeFilter, setTypeFilter] = useState<'all' | PostType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategorySlug || 'all');
  const [authorFilter, setAuthorFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d' | '365d'>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'views'>('relevance');
  const [activeTag, setActiveTag] = useState<string>(initialTag || '');

  React.useEffect(() => {
    setQueryText(initialQueryFromUrl);
  }, [initialQueryFromUrl]);

  React.useEffect(() => {
    setCategoryFilter(initialCategorySlug || 'all');
  }, [initialCategorySlug]);

  React.useEffect(() => {
    setActiveTag(initialTag || '');
  }, [initialTag]);

  const activeCategory = categories.find((c) => c.slug === categoryFilter);
  const activeSeries = seriesList.find((s) => s.slug === initialSeriesSlug);

  const tagCloud = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of publishedPosts) {
      for (const t of p.tags || []) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [publishedPosts]);

  const suggestions = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (q.length < 2) return [];
    return publishedPosts
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.authorName.toLowerCase().includes(q) ||
          (p.tags || []).some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [queryText, publishedPosts]);

  const results = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    const now = Date.now();
    const dayMs = 86400000;

    const scored: Array<{ post: Post; score: number }> = [];

    for (const p of publishedPosts) {
      if (typeFilter !== 'all' && p.type !== typeFilter) continue;
      if (categoryFilter !== 'all' && p.categorySlug !== categoryFilter) continue;
      if (activeSeries && p.seriesId !== activeSeries.id) continue;
      if (authorFilter !== 'all' && p.authorId !== authorFilter && p.authorProfileId !== authorFilter) continue;
      if (activeTag && !(p.tags || []).includes(activeTag)) continue;

      const pubTime = toDate(p.publishedAt || p.createdAt).getTime();
      if (dateFilter === 'today' && now - pubTime > dayMs) continue;
      if (dateFilter === '7d' && now - pubTime > 7 * dayMs) continue;
      if (dateFilter === '30d' && now - pubTime > 30 * dayMs) continue;
      if (dateFilter === '365d' && now - pubTime > 365 * dayMs) continue;

      if (!q) {
        scored.push({ post: p, score: 1 });
        continue;
      }

      let score = 0;
      if (p.title.toLowerCase().includes(q)) score += 10;
      if ((p.subtitle || '').toLowerCase().includes(q)) score += 5;
      if (p.authorName.toLowerCase().includes(q)) score += 6;
      if ((p.tags || []).some((t) => t.toLowerCase().includes(q))) score += 4;
      const bodyText = (p.blocks || []).map((b) => b.text || '').join(' ').toLowerCase();
      if (bodyText.includes(q)) score += 2;

      if (score > 0) scored.push({ post: p, score });
    }

    scored.sort((a, b) => {
      if (sortBy === 'views') {
        return (b.post.viewCount || 0) - (a.post.viewCount || 0);
      }
      if (!q && Boolean(a.post.pinnedInFeed) !== Boolean(b.post.pinnedInFeed)) {
        return a.post.pinnedInFeed ? -1 : 1;
      }
      if (sortBy === 'relevance' && q) {
        if (b.score !== a.score) return b.score - a.score;
      }
      return (
        toDate(b.post.publishedAt || b.post.createdAt).getTime() -
        toDate(a.post.publishedAt || a.post.createdAt).getTime()
      );
    });

    return scored.map((s) => s.post);
  }, [
    publishedPosts,
    queryText,
    typeFilter,
    categoryFilter,
    activeSeries,
    authorFilter,
    activeTag,
    dateFilter,
    sortBy,
  ]);

  const pageTitle = activeSeries
    ? activeSeries.title
    : activeTag
    ? `Etiqueta: #${activeTag}`
    : activeCategory
    ? activeCategory.name
    : 'Buscador y archivo editorial';

  const clearFilters = () => {
    setQueryText('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setAuthorFilter('all');
    setDateFilter('all');
    setActiveTag('');
    setSortBy('relevance');
  };

  return (
    <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      <header className="border-b-2 border-[var(--editorial-ink)]/85 pb-5 space-y-2">
        <p className="font-display text-xs font-bold uppercase tracking-[0.14em] text-[var(--editorial-primary)]">
          {activeSeries
            ? 'Dossier especial'
            : activeTag
            ? 'Archivo temático'
            : activeCategory
            ? 'Sección editorial'
            : 'Explorador de contenidos'}
        </p>
        <h1 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight text-[var(--editorial-ink)]">
          {pageTitle}
        </h1>
        {(activeCategory?.description || activeSeries?.description) && (
          <p className="text-base text-[var(--editorial-muted)] max-w-3xl leading-relaxed font-editorial">
            {activeSeries?.description || activeCategory?.description}
          </p>
        )}
      </header>

      {/* Series Audio Playlist & Episode Order */}
      {activeSeries &&
        results.length > 0 &&
        (() => {
          const orderedSeriesPosts = [...results].sort((a, b) => {
            const epA = (a.seasonNumber || 1) * 10000 + (a.episodeNumber || 999);
            const epB = (b.seasonNumber || 1) * 10000 + (b.episodeNumber || 999);
            if (epA !== epB) return epA - epB;
            return (
              toDate(a.publishedAt || a.createdAt).getTime() -
              toDate(b.publishedAt || b.createdAt).getTime()
            );
          });
          const playableAudioQueue: AudioTrackItem[] = orderedSeriesPosts
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

          return (
            <section className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                    Índice cronológico de la serie ({orderedSeriesPosts.length} entregas)
                  </p>
                  <h2 className="font-display text-xl font-extrabold uppercase tracking-tight text-[var(--editorial-ink)]">
                    Lista de episodios y entregas
                  </h2>
                </div>
                {playableAudioQueue.length > 0 && (
                  <EditorialButton onClick={() => playTrack(playableAudioQueue[0], playableAudioQueue)}>
                    <Headphones className="w-4 h-4" aria-hidden="true" />
                    <span>Reproducir serie en audio ({playableAudioQueue.length})</span>
                  </EditorialButton>
                )}
              </div>
              <ol className="divide-y divide-[var(--editorial-border)]">
                {orderedSeriesPosts.map((ep, idx) => {
                  const epAudio = playableAudioQueue.find((t) => t.postId === ep.id);
                  return (
                    <li key={ep.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0 flex items-center gap-3">
                        <span className="font-tabular text-xs font-bold text-[var(--editorial-primary)] w-8 shrink-0">
                          {ep.episodeNumber ? `Ep.${ep.episodeNumber}` : `0${idx + 1}`}
                        </span>
                        <a
                          href={`/articulo/${ep.slug}`}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate(`/articulo/${ep.slug}`);
                          }}
                          className="font-display font-bold hover:text-[var(--editorial-primary)] truncate text-[var(--editorial-ink)]"
                        >
                          {ep.title}
                        </a>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs text-[var(--editorial-muted)]">
                        <span className="inline-flex items-center gap-1 font-tabular">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {ep.mediaDurationLabel || `${ep.readTimeMinutes} min`}
                        </span>
                        {epAudio && (
                          <button
                            type="button"
                            onClick={() => playTrack(epAudio, playableAudioQueue)}
                            aria-label={`Reproducir ${ep.title}`}
                            className="p-1.5 rounded-full bg-[var(--editorial-ink)] text-[var(--editorial-paper)] hover:bg-[var(--editorial-primary)] hover:text-white cursor-pointer transition-colors"
                          >
                            <Play className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })()}

      {/* Search Bar & Filters */}
      <div className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 space-y-4 shadow-xs">
        <div className="relative">
          <div className="flex items-center rounded-xl border border-[var(--editorial-border)] bg-[var(--editorial-paper)] focus-within:border-[var(--editorial-primary)] transition-colors">
            <Search className="w-5 h-5 text-[var(--editorial-muted)] ml-3.5 shrink-0" aria-hidden="true" />
            <input
              type="search"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Buscar por titular, texto, etiqueta, periodista o medio colaborador..."
              aria-label="Buscar publicaciones"
              className="w-full px-3 py-3 bg-transparent text-sm sm:text-base text-[var(--editorial-ink)] placeholder:text-[var(--editorial-muted)]/70 focus:outline-none"
            />
            {queryText && (
              <button
                type="button"
                onClick={() => setQueryText('')}
                aria-label="Borrar búsqueda"
                className="p-2 mr-1 rounded-full text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className="mt-1.5 rounded-xl overflow-hidden border border-[var(--editorial-border)] bg-[var(--editorial-surface)] divide-y divide-[var(--editorial-border)] shadow-lg">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navigate(`/articulo/${s.slug}`)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--editorial-surface-subtle)] flex items-center justify-between gap-3 cursor-pointer"
                >
                  <span className="font-display font-bold text-[var(--editorial-ink)]">{s.title}</span>
                  <span className="text-xs text-[var(--editorial-muted)] shrink-0">{s.authorName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Format quick chips */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['all', 'Todo'],
              ['article', 'Artículos'],
              ['gallery', 'Galerías'],
              ['video', 'Videos'],
              ['audio', 'Audio / Pódcast'],
              ['infographic', 'Infografías'],
              ['document', 'Documentos'],
            ] as const
          ).map(([val, label]) => (
            <FilterChip key={val} active={typeFilter === val} onClick={() => setTypeFilter(val)}>
              {label}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-[var(--editorial-border)]">
          <span className="inline-flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-wider text-[var(--editorial-muted)]">
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            Refinar:
          </span>

          <select
            aria-label="Categoría"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3.5 py-2 rounded-full bg-[var(--editorial-paper)] border border-[var(--editorial-border)] text-xs font-display font-bold uppercase text-[var(--editorial-ink)] cursor-pointer focus:outline-none focus:border-[var(--editorial-primary)]"
          >
            <option value="all">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Colaborador o medio"
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
            className="px-3.5 py-2 rounded-full bg-[var(--editorial-paper)] border border-[var(--editorial-border)] text-xs font-display font-bold uppercase text-[var(--editorial-ink)] cursor-pointer focus:outline-none focus:border-[var(--editorial-primary)]"
          >
            <option value="all">Todos los autores y medios</option>
            <option value="owner">{adminIdentities.owner.name}</option>
            <option value="magazine">{adminIdentities.magazine.name}</option>
            {collaborators
              .filter((col) => col.status === 'active')
              .map((col) => (
                <option key={col.uid} value={col.uid}>
                  {col.name}
                </option>
              ))}
          </select>

          <select
            aria-label="Fecha"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | '7d' | '30d' | '365d')}
            className="px-3.5 py-2 rounded-full bg-[var(--editorial-paper)] border border-[var(--editorial-border)] text-xs font-display font-bold uppercase text-[var(--editorial-ink)] cursor-pointer focus:outline-none focus:border-[var(--editorial-primary)]"
          >
            <option value="all">Cualquier fecha</option>
            <option value="today">Hoy</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="365d">Último año</option>
          </select>

          <select
            aria-label="Ordenar resultados"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'relevance' | 'date' | 'views')}
            className="px-3.5 py-2 rounded-full bg-[var(--editorial-paper)] border border-[var(--editorial-border)] text-xs font-display font-bold uppercase text-[var(--editorial-ink)] cursor-pointer focus:outline-none focus:border-[var(--editorial-primary)]"
          >
            <option value="relevance">Por relevancia</option>
            <option value="date">Más recientes</option>
            <option value="views">Más leídas</option>
          </select>

          {activeTag && (
            <button
              type="button"
              onClick={() => setActiveTag('')}
              className="px-3.5 py-2 rounded-full border border-[var(--editorial-primary)] text-[var(--editorial-primary)] text-xs font-display font-bold uppercase cursor-pointer"
            >
              Quitar #{activeTag} ×
            </button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <p className="text-xs font-display font-bold uppercase tracking-widest text-[var(--editorial-muted)] font-tabular">
        {results.length} {results.length === 1 ? 'publicación encontrada' : 'publicaciones encontradas'}
      </p>

      {results.length === 0 ? (
        <EmptyState
          icon={<Search className="w-6 h-6" />}
          kicker="Archivo editorial"
          title="Sin coincidencias"
          description="No se encontraron publicaciones con los criterios seleccionados."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <EditorialButton variant="secondary" onClick={clearFilters}>
                Limpiar filtros
              </EditorialButton>
              {hasMorePublishedPosts && (
                <EditorialButton variant="primary" onClick={loadMorePublishedPosts}>
                  Cargar más del archivo
                </EditorialButton>
              )}
            </div>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((p) => (
              <ArticleCard key={p.id} post={p} />
            ))}
          </div>
          {hasMorePublishedPosts && (
            <div className="text-center">
              <EditorialButton variant="secondary" size="lg" onClick={loadMorePublishedPosts}>
                Cargar más del archivo
              </EditorialButton>
            </div>
          )}
        </div>
      )}

      {/* Tag Cloud */}
      {tagCloud.length > 0 && (
        <section className="pt-8 border-t border-[var(--editorial-border)] space-y-3">
          <h2 className="font-display text-lg font-extrabold uppercase tracking-wider flex items-center gap-2 text-[var(--editorial-ink)]">
            <Tag className="w-4 h-4 text-[var(--editorial-primary)]" aria-hidden="true" />
            <span>Nube de etiquetas</span>
          </h2>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {tagCloud.map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                className={`font-display uppercase tracking-wide cursor-pointer hover:text-[var(--editorial-primary)] transition-colors ${
                  activeTag === tag
                    ? 'text-[var(--editorial-primary)] font-extrabold underline'
                    : 'text-[var(--editorial-ink)]/85'
                }`}
                style={{ fontSize: `${Math.min(20, 12 + count * 2)}px` }}
              >
                #{tag}{' '}
                <span className="text-[11px] font-tabular text-[var(--editorial-muted)]">({count})</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};
