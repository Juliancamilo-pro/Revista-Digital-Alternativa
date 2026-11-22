import React, { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Tag } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { toDate } from '../lib/utils';
import { Post, PostType } from '../types/editorial';
import { ArticleCard } from './ArticleCard';

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
  const { publishedPosts, categories, collaborators, adminIdentities, seriesList, navigate } = useSite();

  const [queryText, setQueryText] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | PostType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategorySlug || 'all');
  const [authorFilter, setAuthorFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '365d'>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance');
  const [activeTag, setActiveTag] = useState<string>(initialTag || '');

  // Keep filters synced when navigating between categories/tags
  React.useEffect(() => {
    setCategoryFilter(initialCategorySlug || 'all');
  }, [initialCategorySlug]);

  React.useEffect(() => {
    setActiveTag(initialTag || '');
  }, [initialTag]);

  const activeCategory = categories.find((c) => c.slug === categoryFilter);
  const activeSeries = seriesList.find((s) => s.slug === initialSeriesSlug);

  // Tag cloud calculation
  const tagCloud = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of publishedPosts) {
      for (const t of p.tags || []) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [publishedPosts]);

  // Live instant suggestions while typing
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

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="border-b-2 border-[#111111] dark:border-neutral-700 pb-5 space-y-2">
        <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
          {activeSeries ? 'Serie especial' : activeTag ? 'Archivo temático' : activeCategory ? 'Sección' : 'Explorador de contenidos'}
        </p>
        <h1 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight">
          {pageTitle}
        </h1>
        {(activeCategory?.description || activeSeries?.description) && (
          <p className="text-base text-neutral-600 dark:text-neutral-300 max-w-3xl">
            {activeSeries?.description || activeCategory?.description}
          </p>
        )}
      </div>

      {/* Search Bar & Filters */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 space-y-4 shadow-sm">
        <div className="relative">
          <div className="flex items-center rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[#F8F6F1] dark:bg-[#1C1C1C]">
            <Search className="w-5 h-5 text-neutral-500 ml-3.5 shrink-0" aria-hidden="true" />
            <input
              type="search"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Buscar por titular, texto, etiqueta, periodista o medio colaborador..."
              aria-label="Buscar publicaciones"
              className="w-full px-3 py-3 bg-transparent text-sm sm:text-base focus:outline-none"
            />
          </div>

          {/* Instant Suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-1 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-[#F8F6F1] dark:bg-[#1A1A1A] divide-y divide-neutral-200 dark:divide-neutral-800 shadow-lg">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navigate(`/articulo/${s.slug}`)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-200/70 dark:hover:bg-neutral-800 flex items-center justify-between gap-3 cursor-pointer"
                >
                  <span className="font-display font-bold">{s.title}</span>
                  <span className="text-xs text-neutral-500 shrink-0">{s.authorName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-wider text-neutral-500">
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            Filtros:
          </span>

          <select
            aria-label="Tipo de contenido"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | PostType)}
            className="px-3.5 py-1.5 rounded-full bg-[#F8F6F1] dark:bg-[#1C1C1C] border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase"
          >
            <option value="all">Todos los formatos</option>
            <option value="article">Artículos</option>
            <option value="gallery">Galerías</option>
            <option value="video">Videos</option>
            <option value="audio">Audio / Pódcast</option>
            <option value="infographic">Infografías</option>
            <option value="document">Documentos / PDF</option>
          </select>

          <select
            aria-label="Categoría"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3.5 py-1.5 rounded-full bg-[#F8F6F1] dark:bg-[#1C1C1C] border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase"
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
            className="px-3.5 py-1.5 rounded-full bg-[#F8F6F1] dark:bg-[#1C1C1C] border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase"
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
            onChange={(e) => setDateFilter(e.target.value as 'all' | '7d' | '30d' | '365d')}
            className="px-3.5 py-1.5 rounded-full bg-[#F8F6F1] dark:bg-[#1C1C1C] border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase"
          >
            <option value="all">Cualquier fecha</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="365d">Último año</option>
          </select>

          <select
            aria-label="Ordenar resultados"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'relevance' | 'date')}
            className="px-3.5 py-1.5 rounded-full bg-[#F8F6F1] dark:bg-[#1C1C1C] border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase"
          >
            <option value="relevance">Ordenar por relevancia</option>
            <option value="date">Más recientes primero</option>
          </select>

          {activeTag && (
            <button
              type="button"
              onClick={() => setActiveTag('')}
              className="px-3 py-1 rounded-full border border-[var(--editorial-primary)] text-[var(--editorial-primary)] text-xs font-display font-bold uppercase cursor-pointer"
            >
              Quitar #{activeTag} ×
            </button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <p className="text-xs font-display font-bold uppercase tracking-widest text-neutral-500 font-tabular">
        {results.length} {results.length === 1 ? 'publicación encontrada' : 'publicaciones encontradas'}
      </p>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-10 text-center space-y-3">
          <p className="text-base text-neutral-600 dark:text-neutral-400">
            No se encontraron resultados con los criterios actuales.
          </p>
          <button
            type="button"
            onClick={() => {
              setQueryText('');
              setTypeFilter('all');
              setCategoryFilter('all');
              setAuthorFilter('all');
              setDateFilter('all');
              setActiveTag('');
            }}
            className="px-5 py-2 rounded-full border border-neutral-400 text-xs font-display font-bold uppercase cursor-pointer"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((p) => (
            <ArticleCard key={p.id} post={p} />
          ))}
        </div>
      )}

      {/* Tag Cloud */}
      {tagCloud.length > 0 && (
        <section className="pt-8 border-t border-neutral-300 dark:border-neutral-800 space-y-3">
          <h2 className="font-display text-lg font-extrabold uppercase tracking-wider flex items-center gap-2">
            <Tag className="w-4 h-4 text-[var(--editorial-primary)]" aria-hidden="true" />
            <span>Nube de etiquetas</span>
          </h2>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {tagCloud.map(([tag, count]) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(tag)}
                className={`font-display uppercase tracking-wide cursor-pointer hover:text-[var(--editorial-primary)] ${
                  activeTag === tag ? 'text-[var(--editorial-primary)] font-extrabold underline' : 'text-neutral-700 dark:text-neutral-300'
                }`}
                style={{ fontSize: `${Math.min(20, 12 + count * 2)}px` }}
              >
                #{tag} <span className="text-[11px] font-tabular text-neutral-500">({count})</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};
