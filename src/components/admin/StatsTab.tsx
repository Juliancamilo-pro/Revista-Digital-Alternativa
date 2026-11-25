import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  ExternalLink,
  Eye,
  MessageSquare,
  Search,
  Timer,
  Users,
} from 'lucide-react';
import { AnalyticsEvent, Post } from '../../types/editorial';
import {
  EditorialStatCard,
  EmptyState,
  FilterChip,
  SectionHeader,
  editorialInputClass,
} from '../ui/EditorialPrimitives';

interface StatsTabProps {
  allPostsForAdmin: Post[];
  analytics: AnalyticsEvent[];
  totalCommentsCount: number;
  subscribersCount: number;
  onOpenArticle: (slug: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  article: 'Artículos',
  opinion: 'Opinión',
  video: 'Video',
  audio: 'Audio / Pódcast',
  gallery: 'Galería',
};

const TYPE_COLORS = [
  'var(--editorial-primary)',
  '#0F766E',
  '#B45309',
  '#4338CA',
  '#BE185D',
];

export const StatsTab: React.FC<StatsTabProps> = ({
  allPostsForAdmin,
  analytics,
  totalCommentsCount,
  subscribersCount,
  onOpenArticle,
}) => {
  const [statsPeriod, setStatsPeriod] = useState<'today' | '7d' | '30d' | 'all'>('30d');
  const [articleQuery, setArticleQuery] = useState('');

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const dayMs = 86400000;
    return analytics.filter((ev) => {
      const raw = ev.createdAt as { toDate?: () => Date } | string | number | undefined;
      const t =
        raw && typeof raw === 'object' && typeof raw.toDate === 'function'
          ? raw.toDate().getTime()
          : raw
          ? new Date(raw as string | number).getTime()
          : 0;
      if (statsPeriod === 'today') return now - t <= dayMs;
      if (statsPeriod === '7d') return now - t <= 7 * dayMs;
      if (statsPeriod === '30d') return now - t <= 30 * dayMs;
      return true;
    });
  }, [analytics, statsPeriod]);

  const totalSiteViews = useMemo(
    () => allPostsForAdmin.reduce((acc, p) => acc + (p.viewCount || 0), 0),
    [allPostsForAdmin]
  );

  const avgReadSeconds = useMemo(() => {
    if (!filteredEvents.length) return 0;
    return Math.round(
      filteredEvents.reduce((acc, ev) => acc + (ev.readDurationSec || 0), 0) / filteredEvents.length
    );
  }, [filteredEvents]);

  const topArticles = useMemo(() => {
    const q = articleQuery.trim().toLowerCase();
    const list = [...allPostsForAdmin]
      .filter((p) => p.status === 'published')
      .filter((p) =>
        q
          ? p.title.toLowerCase().includes(q) ||
            p.authorName.toLowerCase().includes(q) ||
            p.categoryName.toLowerCase().includes(q)
          : true
      )
      .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    return q ? list.slice(0, 20) : list.slice(0, 10);
  }, [allPostsForAdmin, articleQuery]);

  const viewsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allPostsForAdmin) {
      map.set(p.categoryName, (map.get(p.categoryName) || 0) + (p.viewCount || 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [allPostsForAdmin]);

  const viewsByAuthor = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allPostsForAdmin) {
      map.set(p.authorName, (map.get(p.authorName) || 0) + (p.viewCount || 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [allPostsForAdmin]);

  const viewsByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allPostsForAdmin) {
      map.set(p.type, (map.get(p.type) || 0) + (p.viewCount || 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [allPostsForAdmin]);

  const trafficSources = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of filteredEvents) {
      map.set(ev.referrerSource || 'directo', (map.get(ev.referrerSource || 'directo') || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredEvents]);

  // SVG Donut ring geometry for formats
  const typeRingData = useMemo(() => {
    const total = Math.max(
      1,
      viewsByType.reduce((acc, [, v]) => acc + v, 0)
    );
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    return viewsByType.map(([key, value], idx) => {
      const ratio = value / total;
      const strokeLength = ratio * circumference;
      const item = {
        key,
        label: TYPE_LABELS[key] || key,
        value,
        percent: Math.round(ratio * 100),
        color: TYPE_COLORS[idx % TYPE_COLORS.length],
        dasharray: `${strokeLength} ${circumference}`,
        dashoffset: -offset,
      };
      offset += strokeLength;
      return item;
    });
  }, [viewsByType]);

  const maxCategoryViews = Math.max(1, viewsByCategory[0]?.[1] || 1);

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Inteligencia de audiencia"
        title="Estadísticas de lectura"
        subtitle="Métricas acumuladas de publicaciones y sesiones registradas en el período seleccionado."
        action={
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['today', 'Hoy'],
                ['7d', '7 días'],
                ['30d', '30 días'],
                ['all', 'Histórico'],
              ] as const
            ).map(([p, label]) => (
              <FilterChip key={p} active={statsPeriod === p} onClick={() => setStatsPeriod(p)}>
                {label}
              </FilterChip>
            ))}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <EditorialStatCard
          label="Visitas acumuladas"
          value={totalSiteViews.toLocaleString('es-CO')}
          hint={`${allPostsForAdmin.filter((p) => p.status === 'published').length} notas publicadas`}
          icon={<Eye className="w-4 h-4" aria-hidden="true" />}
          accent
        />
        <EditorialStatCard
          label="Sesiones período"
          value={filteredEvents.length.toLocaleString('es-CO')}
          hint="Eventos de lectura"
          icon={<BarChart3 className="w-4 h-4" aria-hidden="true" />}
        />
        <EditorialStatCard
          label="Lectura promedio"
          value={`${avgReadSeconds}s`}
          hint="Duración por sesión"
          icon={<Timer className="w-4 h-4" aria-hidden="true" />}
        />
        <EditorialStatCard
          label="Comentarios"
          value={totalCommentsCount.toLocaleString('es-CO')}
          hint="Conversación total"
          icon={<MessageSquare className="w-4 h-4" aria-hidden="true" />}
        />
        <EditorialStatCard
          label="Suscriptores"
          value={subscribersCount.toLocaleString('es-CO')}
          hint="Boletín semanal"
          icon={<Users className="w-4 h-4" aria-hidden="true" />}
        />
      </div>

      {/* Gráficos de distribución */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Visitas por categoría */}
        <section className="lg:col-span-7 rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--editorial-border)] pb-3">
            <h3 className="font-display text-lg font-extrabold uppercase tracking-tight">
              Visitas por categoría
            </h3>
            <span className="font-tabular text-xs text-[var(--editorial-muted)]">
              {viewsByCategory.length} secciones
            </span>
          </div>

          {viewsByCategory.length === 0 ? (
            <p className="text-sm text-[var(--editorial-muted)] py-4">
              Aún no hay lecturas categorizadas registradas.
            </p>
          ) : (
            <div className="space-y-3">
              {viewsByCategory.map(([cat, count]) => {
                const relWidth = Math.max(2, Math.round((count / maxCategoryViews) * 100));
                const sharePct = Math.round((count / Math.max(1, totalSiteViews)) * 100);
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-semibold text-[var(--editorial-ink)] truncate">{cat}</span>
                      <span className="font-tabular text-[var(--editorial-muted)] shrink-0">
                        <strong className="text-[var(--editorial-ink)]">{count.toLocaleString('es-CO')}</strong> · {sharePct}%
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden bg-[var(--editorial-surface-subtle)] border border-[var(--editorial-border)]">
                      <div
                        className="h-full rounded-full bg-[var(--editorial-primary)] transition-all duration-500"
                        style={{ width: `${relWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Donut de formatos + fuentes de tráfico */}
        <section className="lg:col-span-5 rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--editorial-border)] pb-3">
            <h3 className="font-display text-lg font-extrabold uppercase tracking-tight">
              Formatos y tráfico
            </h3>
            <span className="font-tabular text-xs text-[var(--editorial-muted)]">
              Distribución
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative w-28 h-28 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--editorial-surface-subtle)"
                  strokeWidth="12"
                />
                {typeRingData.map((seg) => (
                  <circle
                    key={seg.key}
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="12"
                    strokeDasharray={seg.dasharray}
                    strokeDashoffset={seg.dashoffset}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-tabular text-sm font-extrabold leading-none">
                  {totalSiteViews.toLocaleString('es-CO')}
                </span>
                <span className="font-display text-[9px] uppercase tracking-wider text-[var(--editorial-muted)] mt-0.5">
                  Lecturas
                </span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-1.5 text-xs">
              {typeRingData.map((seg) => (
                <div key={seg.key} className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="truncate">{seg.label}</span>
                  </span>
                  <span className="font-tabular font-bold shrink-0">
                    {seg.value.toLocaleString('es-CO')} ({seg.percent}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--editorial-border)] space-y-2">
            <p className="font-display text-[11px] font-bold uppercase tracking-wider text-[var(--editorial-muted)]">
              Autores y medios con mayor alcance
            </p>
            <div className="space-y-1.5">
              {viewsByAuthor.slice(0, 5).map(([authName, count]) => (
                <div
                  key={authName}
                  className="flex items-center justify-between text-xs py-1 border-b border-[var(--editorial-border)] last:border-b-0"
                >
                  <span className="truncate pr-2 font-medium">{authName}</span>
                  <span className="font-tabular font-bold shrink-0">{count.toLocaleString('es-CO')}</span>
                </div>
              ))}
            </div>
          </div>

          {trafficSources.length > 0 && (
            <div className="pt-3 border-t border-[var(--editorial-border)]">
              <p className="font-display text-[11px] font-bold uppercase tracking-wider text-[var(--editorial-muted)] mb-2">
                Fuentes de tráfico del período
              </p>
              <div className="flex flex-wrap gap-1.5">
                {trafficSources.map(([src, c]) => (
                  <span
                    key={src}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--editorial-border)] bg-[var(--editorial-surface-subtle)] text-[11px] font-display font-bold uppercase"
                  >
                    <span>{src}</span>
                    <span className="font-tabular text-[var(--editorial-primary)]">{c}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Top artículos más leídos */}
      <section className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--editorial-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-extrabold uppercase tracking-tight">
              Artículos más leídos
            </h3>
            <p className="text-xs text-[var(--editorial-muted)]">
              Ranking de publicaciones activas por lecturas registradas.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search
              className="w-3.5 h-3.5 text-[var(--editorial-muted)] absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={articleQuery}
              onChange={(e) => setArticleQuery(e.target.value)}
              placeholder="Filtrar por título o autor..."
              aria-label="Filtrar ranking de artículos"
              className={`${editorialInputClass} pl-8 py-1.5 text-xs`}
            />
          </div>
        </div>

        {topArticles.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<BookOpen className="w-5 h-5" aria-hidden="true" />}
              title="Sin resultados en el ranking"
              description={
                articleQuery
                  ? 'No encontramos artículos publicados que coincidan con tu búsqueda.'
                  : 'Todavía no hay publicaciones con lecturas registradas.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-[var(--editorial-border)] bg-[var(--editorial-surface-subtle)] font-display text-[11px] uppercase tracking-wider text-[var(--editorial-muted)]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Publicación</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Autor / Medio</th>
                  <th className="px-4 py-3 text-right">Tiempo</th>
                  <th className="px-4 py-3 text-right">Lecturas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--editorial-border)]">
                {topArticles.map((art, i) => (
                  <tr key={art.id} className="hover:bg-[var(--editorial-surface-subtle)]/70 transition-colors">
                    <td className="px-4 py-3 font-tabular font-bold text-[var(--editorial-muted)]">
                      {String(i + 1).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-3 max-w-sm">
                      <button
                        type="button"
                        onClick={() => onOpenArticle(art.slug)}
                        className="inline-flex items-center gap-1.5 text-left font-semibold hover:text-[var(--editorial-primary)] cursor-pointer transition-colors"
                      >
                        <span className="line-clamp-1">{art.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-60" aria-hidden="true" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--editorial-muted)]">{art.categoryName}</td>
                    <td className="px-4 py-3 text-xs">{art.authorName}</td>
                    <td className="px-4 py-3 text-right font-tabular text-xs text-[var(--editorial-muted)]">
                      {art.readTimeMinutes} min
                    </td>
                    <td className="px-4 py-3 text-right font-tabular font-extrabold text-[var(--editorial-ink)]">
                      {(art.viewCount || 0).toLocaleString('es-CO')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
