import React, { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { AnalyticsEvent, Post } from '../../types/editorial';

interface StatsTabProps {
  allPostsForAdmin: Post[];
  analytics: AnalyticsEvent[];
  totalCommentsCount: number;
  subscribersCount: number;
  onOpenArticle: (slug: string) => void;
}

export const StatsTab: React.FC<StatsTabProps> = ({
  allPostsForAdmin,
  analytics,
  totalCommentsCount,
  subscribersCount,
  onOpenArticle,
}) => {
  const [statsPeriod, setStatsPeriod] = useState<'today' | '7d' | '30d' | 'all'>('30d');

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

  const topArticles = useMemo(
    () =>
      [...allPostsForAdmin]
        .filter((p) => p.status === 'published')
        .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
        .slice(0, 10),
    [allPostsForAdmin]
  );

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-2xl font-extrabold uppercase">Estadísticas de audiencia</h2>
        <div className="inline-flex rounded-full overflow-hidden border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#141414] text-xs font-display font-bold uppercase">
          {(
            [
              ['today', 'Hoy'],
              ['7d', '7 días'],
              ['30d', '30 días'],
              ['all', 'Histórico'],
            ] as const
          ).map(([p, label]) => (
            <button
              key={p}
              type="button"
              onClick={() => setStatsPeriod(p)}
              className={`px-4 py-1.5 cursor-pointer ${
                statsPeriod === p ? 'bg-[var(--editorial-primary)] text-white' : ''
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4">
          <p className="text-xs font-display uppercase text-neutral-500">Visitas acumuladas</p>
          <p className="font-tabular text-2xl font-bold mt-1">{totalSiteViews.toLocaleString('es-ES')}</p>
        </div>
        <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4">
          <p className="text-xs font-display uppercase text-neutral-500">Sesiones período</p>
          <p className="font-tabular text-2xl font-bold mt-1">{filteredEvents.length.toLocaleString('es-ES')}</p>
        </div>
        <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4">
          <p className="text-xs font-display uppercase text-neutral-500">Lectura promedio</p>
          <p className="font-tabular text-2xl font-bold mt-1">
            {filteredEvents.length
              ? `${Math.round(filteredEvents.reduce((a, e) => a + e.readDurationSec, 0) / filteredEvents.length)}s`
              : '0s'}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4">
          <p className="text-xs font-display uppercase text-neutral-500">Comentarios</p>
          <p className="font-tabular text-2xl font-bold mt-1">{totalCommentsCount.toLocaleString('es-ES')}</p>
        </div>
        <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4">
          <p className="text-xs font-display uppercase text-neutral-500">Suscriptores</p>
          <p className="font-tabular text-2xl font-bold mt-1">{subscribersCount.toLocaleString('es-ES')}</p>
        </div>
      </div>

      {/* Top artículos más leídos */}
      <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold uppercase">Top artículos más leídos</h3>
          <span className="font-tabular text-xs text-neutral-500">
            {topArticles.length} publicados
          </span>
        </div>
        {topArticles.length === 0 ? (
          <p className="px-5 py-6 text-sm text-neutral-500">No hay publicaciones con lecturas registradas todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-neutral-200 dark:border-neutral-800 font-display text-xs uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">Publicación</th>
                  <th className="px-4 py-2.5">Categoría</th>
                  <th className="px-4 py-2.5">Autor / Medio</th>
                  <th className="px-4 py-2.5 text-right">Tiempo</th>
                  <th className="px-4 py-2.5 text-right">Lecturas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {topArticles.map((art, i) => (
                  <tr key={art.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
                    <td className="px-4 py-2.5 font-tabular text-neutral-500">{i + 1}</td>
                    <td className="px-4 py-2.5 max-w-sm">
                      <button
                        type="button"
                        onClick={() => onOpenArticle(art.slug)}
                        className="inline-flex items-center gap-1.5 text-left font-semibold hover:text-[var(--editorial-primary)] cursor-pointer"
                      >
                        <span className="line-clamp-1">{art.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-60" aria-hidden="true" />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{art.categoryName}</td>
                    <td className="px-4 py-2.5 text-xs">{art.authorName}</td>
                    <td className="px-4 py-2.5 text-right font-tabular text-xs text-neutral-500">
                      {art.readTimeMinutes} min
                    </td>
                    <td className="px-4 py-2.5 text-right font-tabular font-bold">
                      {(art.viewCount || 0).toLocaleString('es-ES')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Desglose por categoría, autor, formato y fuentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 space-y-3">
          <h3 className="font-display text-lg font-bold uppercase">Visitas por categoría</h3>
          {viewsByCategory.map(([cat, count]) => (
            <div key={cat} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{cat}</span>
                <span className="font-tabular">{count.toLocaleString('es-ES')}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-2 bg-[var(--editorial-primary)]"
                  style={{
                    width: `${Math.min(100, Math.round((count / Math.max(1, totalSiteViews)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 space-y-3">
          <h3 className="font-display text-lg font-bold uppercase">Visitas por colaborador y formato</h3>
          {viewsByAuthor.slice(0, 6).map(([authName, count]) => (
            <div
              key={authName}
              className="flex justify-between text-xs py-1 border-b border-neutral-200 dark:border-neutral-800"
            >
              <span>{authName}</span>
              <span className="font-tabular font-bold">{count.toLocaleString('es-ES')}</span>
            </div>
          ))}
          <div className="pt-2 flex flex-wrap gap-4 text-xs font-display uppercase">
            {viewsByType.map(([t, c]) => (
              <span key={t}>
                {t}: <strong className="font-tabular">{c.toLocaleString('es-ES')}</strong>
              </span>
            ))}
          </div>
          {trafficSources.length > 0 && (
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 text-xs">
              <span className="font-display font-bold uppercase">Fuentes de tráfico: </span>
              {trafficSources.map(([src, c]) => `${src} (${c})`).join(' · ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
