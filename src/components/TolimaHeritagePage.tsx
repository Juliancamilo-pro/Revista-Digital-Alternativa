import React, { useMemo } from 'react';
import { ArrowRight, Compass, MapPin, Music2, Utensils } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { ArticleCard } from './ArticleCard';
import { TricolorHairline } from './TolimaAccents';
import { EditorialButton, EmptyState, SectionHeader } from './ui/EditorialPrimitives';

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
      <section className="tolima-weave-bg rounded-3xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] overflow-hidden shadow-xs">
        <TricolorHairline />
        <div className="p-6 sm:p-10 lg:p-12 space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-xs font-display font-bold uppercase tracking-[0.16em] text-[var(--editorial-primary)]">
            <span>Identidad regional</span>
            <span aria-hidden="true" className="text-[var(--editorial-muted)]">·</span>
            <span>Hecho en el Tolima, para Colombia</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold uppercase tracking-tight leading-[1.02] headline-balance">
            Tolima, Capital Musical de Colombia
          </h1>

          <p className="font-editorial text-base sm:text-xl text-[var(--editorial-muted)] max-w-3xl leading-relaxed">
            Desde Ibagué y las estribaciones de la Cordillera Central, {siteConfig.siteName} informa con mirada territorial, memoria sonora y rigor periodístico sobre la vida social, cultural y política del departamento y del país.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <EditorialButton size="lg" onClick={() => navigate('/categoria/cultura')}>
              <span>Explorar Cultura</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </EditorialButton>
            <EditorialButton variant="secondary" size="lg" onClick={() => navigate('/buscar')}>
              <span>Buscar en todo el archivo</span>
            </EditorialButton>
          </div>
        </div>
      </section>

      {/* Tres pilares culturales reales del Tolima */}
      <section aria-label="Patrimonio cultural y geográfico del Tolima" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <article className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-6 space-y-3 hover:border-[var(--editorial-primary)]/40 transition-colors">
          <div className="flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-widest text-[var(--editorial-primary)]">
            <Music2 className="w-4 h-4" aria-hidden="true" />
            <span>Música y folclor</span>
          </div>
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
            Tierra del bambuco, la guabina y el rajaleña
          </h2>
          <p className="font-editorial text-sm sm:text-base text-[var(--editorial-muted)] leading-relaxed">
            El Conservatorio del Tolima, los duetos tradicionales de tiple y guitarra, y el Festival Folclórico Colombiano que cada junio reúne expresiones de todo el país consolidaron a Ibagué como referente musical nacional.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-6 space-y-3 hover:border-[var(--editorial-primary)]/40 transition-colors">
          <div className="flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-widest text-[var(--editorial-primary)]">
            <Utensils className="w-4 h-4" aria-hidden="true" />
            <span>Gastronomía tradicional</span>
          </div>
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
            Tamal, lechona y achiras en la mesa tolimense
          </h2>
          <p className="font-editorial text-sm sm:text-base text-[var(--editorial-muted)] leading-relaxed">
            La cocina campesina del departamento combina saberes de hoja de plátano, hornos de barro y maíz: el tamal tolimense de receta tradicional, la lechona artesanal de El Espinal e Ibagué y las achiras del sur tolimense.
          </p>
        </article>

        <article className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-6 space-y-3 hover:border-[var(--editorial-primary)]/40 transition-colors">
          <div className="flex items-center gap-2 font-display text-xs font-extrabold uppercase tracking-widest text-[var(--editorial-primary)]">
            <MapPin className="w-4 h-4" aria-hidden="true" />
            <span>Territorio y paisaje</span>
          </div>
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">
            Del Nevado del Tolima al valle del Magdalena
          </h2>
          <p className="font-editorial text-sm sm:text-base text-[var(--editorial-muted)] leading-relaxed">
            Entre los páramos de la Cordillera Central, el Cañón del Combeima y las llanuras bañadas por el río Magdalena, el territorio articula agricultura cafetera, arroz, agua y defensa ambiental comunitaria.
          </p>
        </article>
      </section>

      {/* Publicaciones reales asociadas al territorio */}
      <section className="space-y-6">
        <SectionHeader
          kicker="Archivo editorial conectado"
          title="Cobertura regional, territorio y cultura"
          action={
            <span className="font-tabular text-xs font-bold uppercase text-[var(--editorial-muted)]">
              {regionalPosts.length} {regionalPosts.length === 1 ? 'publicación' : 'publicaciones'}
            </span>
          }
        />

        {regionalPosts.length === 0 ? (
          <EmptyState
            icon={<Compass className="w-6 h-6" aria-hidden="true" />}
            title="Cobertura regional en preparación"
            description="Aún no hay publicaciones etiquetadas con Tolima, Ibagué o Cultura en la edición actual. Cuando la redacción publique notas sobre el territorio, aparecerán automáticamente aquí."
            action={
              <EditorialButton variant="secondary" onClick={() => navigate('/unete')}>
                ¿Reporteas desde el Tolima? Únete a la red
              </EditorialButton>
            }
          />
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
