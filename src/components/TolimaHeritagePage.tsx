import React, { useMemo } from 'react';
import { ArrowRight, MapPin, Music2, Utensils } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { ArticleCard } from './ArticleCard';
import { TricolorHairline } from './TolimaAccents';

export const TolimaHeritagePage: React.FC = () => {
  const { publishedPosts, navigate, siteConfig } = useSite();

  const regionalPosts = useMemo(() => {
    const terms = ['tolima', 'ibague', 'ibagué', 'tolimense', 'cultura', 'folclor', 'combeima'];
    return publishedPosts.filter((p) => {
      const haystack = [
        p.categorySlug,
        p.categoryName,
        p.title,
        p.subtitle || '',
        ...(p.tags || []),
      ]
        .join(' ')
        .toLowerCase();
      return terms.some((term) => haystack.includes(term));
    });
  }, [publishedPosts]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12 animate-fade-up">
      {/* Cabecera cultural del Tolima */}
      <section className="tolima-weave-bg rounded-3xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] overflow-hidden shadow-sm">
        <TricolorHairline />
        <div className="p-6 sm:p-10 lg:p-12 space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-xs font-display font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
            <span>Identidad regional</span>
            <span aria-hidden="true" className="text-neutral-400">·</span>
            <span>Hecho en el Tolima, para Colombia</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold uppercase tracking-tight leading-[1.02] headline-balance">
            Tolima, Capital Musical de Colombia
          </h1>

          <p className="font-editorial text-base sm:text-xl text-neutral-700 dark:text-neutral-300 max-w-3xl leading-relaxed">
            Desde Ibagué y las estribaciones de la Cordillera Central, {siteConfig.siteName} informa con mirada territorial, memoria sonora y rigor periodístico sobre la vida social, cultural y política del departamento y del país.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/categoria/cultura')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
            >
              <span>Explorar Cultura</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/buscar')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
            >
              <span>Buscar en todo el archivo</span>
            </button>
          </div>
        </div>
      </section>

      {/* Tres pilares culturales reales del Tolima */}
      <section aria-label="Patrimonio cultural y geográfico del Tolima" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-3">
          <div className="flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-widest text-[var(--editorial-primary)]">
            <Music2 className="w-4 h-4" aria-hidden="true" />
            <span>Música y folclor</span>
          </div>
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
            Tierra del bambuco, la guabina y el rajaleña
          </h2>
          <p className="font-editorial text-sm sm:text-base text-neutral-700 dark:text-neutral-300 leading-relaxed">
            El Conservatorio del Tolima, los duetos tradicionales de tiple y guitarra, y el Festival Folclórico Colombiano que cada junio reúne expresiones de todo el país consolidaron a Ibagué como referente musical nacional.
          </p>
        </article>

        <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-3">
          <div className="flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-widest text-[var(--editorial-primary)]">
            <Utensils className="w-4 h-4" aria-hidden="true" />
            <span>Gastronomía tradicional</span>
          </div>
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
            Tamal, lechona y achiras en la mesa tolimense
          </h2>
          <p className="font-editorial text-sm sm:text-base text-neutral-700 dark:text-neutral-300 leading-relaxed">
            La cocina campesina del departamento combina saberes de hoja de plátano, hornos de barro y maíz: el tamal tolimense de receta tradicional, la lechona artesanal de El Espinal e Ibagué y las achiras del sur tolimense.
          </p>
        </article>

        <article className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-3">
          <div className="flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-widest text-[var(--editorial-primary)]">
            <MapPin className="w-4 h-4" aria-hidden="true" />
            <span>Territorio y paisaje</span>
          </div>
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
            Del Nevado del Tolima al valle del Magdalena
          </h2>
          <p className="font-editorial text-sm sm:text-base text-neutral-700 dark:text-neutral-300 leading-relaxed">
            Entre los páramos de la Cordillera Central, el Cañón del Combeima y las llanuras bañadas por el río Magdalena, el territorio articula agricultura cafetera, arroz, agua y defensa ambiental comunitaria.
          </p>
        </article>
      </section>

      {/* Publicaciones reales asociadas al territorio */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-300 dark:border-neutral-800 pb-3">
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
              Archivo editorial conectado
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
              Cobertura regional, territorio y cultura
            </h2>
          </div>
          <span className="font-tabular text-xs text-neutral-500">
            {regionalPosts.length} {regionalPosts.length === 1 ? 'publicación' : 'publicaciones'}
          </span>
        </div>

        {regionalPosts.length === 0 ? (
          <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-8 text-center space-y-3">
            <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
              Aún no hay publicaciones etiquetadas con Tolima, Ibagué o Cultura en la edición actual. Cuando la redacción o sus colaboradores publiquen notas sobre el territorio, aparecerán automáticamente aquí.
            </p>
            <button
              type="button"
              onClick={() => navigate('/unete')}
              className="px-5 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 font-display text-xs font-bold uppercase tracking-wider hover:border-[var(--editorial-primary)] cursor-pointer"
            >
              ¿Reporteas desde el Tolima? Únete a la red
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regionalPosts.map((post) => (
              <ArticleCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
