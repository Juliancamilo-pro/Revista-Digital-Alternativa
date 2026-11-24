import React, { useMemo, useState } from 'react';
import { BookOpen, Briefcase, Calendar, ExternalLink, Filter, Mail, MapPin, Search, Shield, Users } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { sanitizeExternalUrl } from '../lib/utils';
import { AdminPublicIdentity, CollaboratorPublic } from '../types/editorial';
import { extractPublicAuthorDossier } from './AuthorDossierCard';
import { EditorialImage } from './EditorialImage';
import { VerifiedBadge } from './VerifiedBadge';

export const CollaboratorsPage: React.FC = () => {
  const { collaborators, adminIdentities, publishedPosts, siteConfig, navigate } = useSite();
  const [searchText, setSearchText] = useState('');
  const [outletFilter, setOutletFilter] = useState<'all' | 'medio' | 'independiente'>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');

  const countPostsForIdentity = (id: string) =>
    publishedPosts.filter((p) => p.authorProfileId === id || p.authorId === id).length;

  const visibleAdminProfiles = useMemo(() => {
    const list: AdminPublicIdentity[] = [];
    if (adminIdentities.owner?.showInDirectory !== false) list.push(adminIdentities.owner);
    if (adminIdentities.magazine?.showInDirectory !== false) list.push(adminIdentities.magazine);
    return list;
  }, [adminIdentities]);

  const publicCollaborators = useMemo(() => {
    return collaborators
      .filter(
        (c) =>
          c.status === 'active' &&
          c.showInDirectory === true &&
          c.directoryHidden !== true
      )
      .sort((a, b) => {
        if (Boolean(a.directoryFeatured) !== Boolean(b.directoryFeatured)) {
          return a.directoryFeatured ? -1 : 1;
        }
        const oa = a.directoryOrder ?? 999;
        const ob = b.directoryOrder ?? 999;
        if (oa !== ob) return oa - ob;
        if ((b.postCount || 0) !== (a.postCount || 0)) {
          return (b.postCount || 0) - (a.postCount || 0);
        }
        return (a.name || '').localeCompare(b.name || '', 'es');
      });
  }, [collaborators]);

  const availableTopics = useMemo(() => {
    const set = new Set<string>();
    visibleAdminProfiles.forEach((p) => (p.topics || []).forEach((t) => set.add(t)));
    publicCollaborators.forEach((c) => {
      if (c.showTopics && Array.isArray(c.topics)) {
        c.topics.forEach((t) => set.add(t));
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [visibleAdminProfiles, publicCollaborators]);

  const matchesFilters = (
    name: string,
    outletType: string,
    bio: string | undefined,
    topics: string[] | undefined
  ) => {
    if (outletFilter !== 'all' && outletType !== outletFilter) return false;
    if (topicFilter !== 'all' && !(topics || []).includes(topicFilter)) return false;
    const q = searchText.trim().toLowerCase();
    if (!q) return true;
    const hay = `${name} ${bio || ''} ${(topics || []).join(' ')}`.toLowerCase();
    return hay.includes(q);
  };

  const filteredAdmins = visibleAdminProfiles.filter((a) =>
    matchesFilters(a.name, a.outletType, a.bio, a.topics)
  );
  const filteredCollabs = publicCollaborators.filter((c) =>
    matchesFilters(
      c.name,
      c.outletType,
      c.showBio ? c.bio : undefined,
      c.showTopics ? c.topics : undefined
    )
  );

  const renderCollaboratorCard = (c: CollaboratorPublic) => {
    const postTotal = Math.max(c.postCount || 0, countPostsForIdentity(c.uid));
    const d = extractPublicAuthorDossier(c);
    const web = d.websiteUrl ? sanitizeExternalUrl(d.websiteUrl) : '';
    const cityLabel = [d.city, d.country].filter(Boolean).join(', ') || d.location || '';
    const roleSummary = [d.jobTitle, d.organization].filter(Boolean).join(' · ') || d.profession;
    const hasSocials = Boolean(d.socialTwitter || d.socialInstagram || d.socialYoutube);

    return (
      <article
        key={c.uid}
        className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 flex flex-col justify-between shadow-sm hover:shadow-lg transition-shadow"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            {d.avatarUrl ? (
              <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 shrink-0 ring-2 ring-[var(--editorial-primary)]/20">
                <EditorialImage src={d.avatarUrl} alt={d.name} fallbackTitle={d.name} allowInDataSaver />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-neutral-900 text-white shrink-0 flex items-center justify-center font-display text-2xl font-extrabold uppercase">
                {d.name.slice(0, 1)}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-display font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                  {c.outletType === 'medio' ? 'Medio colaborador' : 'Periodista independiente'}
                </span>
                {c.directoryFeatured && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-display font-bold uppercase tracking-wider">
                    Destacado
                  </span>
                )}
              </div>
              <h3 className="mt-1 font-display text-xl font-extrabold uppercase tracking-tight flex items-center gap-1.5">
                <a
                  href={`/colaborador/${c.uid}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/colaborador/${c.uid}`);
                  }}
                  className="hover:text-[var(--editorial-primary)] truncate"
                >
                  {d.name}
                </a>
                {c.status === 'active' && <VerifiedBadge size="sm" />}
              </h3>
              {roleSummary && (
                <p className="text-xs text-neutral-600 dark:text-neutral-300 flex items-center gap-1 mt-0.5 truncate">
                  <Briefcase className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{roleSummary}</span>
                </p>
              )}
              {(cityLabel || d.publicAge !== undefined) && (
                <p className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                  {cityLabel && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{cityLabel}</span>
                    </span>
                  )}
                  {d.publicAge !== undefined && <span className="shrink-0">· {d.publicAge} años</span>}
                </p>
              )}
            </div>
          </div>

          {d.bio && (
            <p className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-3 leading-relaxed">
              {d.bio}
            </p>
          )}

          {d.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {d.topics.slice(0, 5).map((topic) => (
                <span
                  key={topic}
                  className="px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-display uppercase tracking-wider text-neutral-700 dark:text-neutral-300"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
          {(web || hasSocials || d.publicEmail) && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-600 dark:text-neutral-400">
              {web && (
                <a
                  href={web}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:text-[var(--editorial-primary)]"
                >
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  <span>Sitio</span>
                </a>
              )}
              {d.publicEmail && (
                <a
                  href={`mailto:${d.publicEmail}`}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:text-[var(--editorial-primary)]"
                >
                  <Mail className="w-3 h-3" aria-hidden="true" />
                  <span>Contacto</span>
                </a>
              )}
              {d.socialTwitter && (
                <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                  X: {d.socialTwitter}
                </span>
              )}
              {d.socialInstagram && (
                <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                  IG: {d.socialInstagram}
                </span>
              )}
              {d.socialYoutube && (
                <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                  YT: {d.socialYoutube}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-neutral-500">
            <div className="flex flex-wrap items-center gap-2">
              {d.showPostCount && (
                <span className="font-tabular inline-flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                  {postTotal} {postTotal === 1 ? 'publicación' : 'publicaciones'}
                </span>
              )}
              {d.joinDateLabel && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                  Desde {d.joinDateLabel}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => navigate(`/colaborador/${c.uid}`)}
              className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)] hover:underline cursor-pointer"
            >
              Ver perfil →
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 animate-fade-up">
      <header className="space-y-3 border-b border-neutral-300 dark:border-neutral-800 pb-6">
        <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)] flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Red editorial independiente</span>
        </p>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-tight">
              Conozcan a nuestros colaboradores
            </h1>
            <p className="mt-2 text-base text-neutral-600 dark:text-neutral-400 max-w-2xl">
              Dirección editorial, periodistas independientes y medios aliados que hacen posible el periodismo crítico sin filtros corporativos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/unete')}
            className="self-start md:self-auto px-5 py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
          >
            {siteConfig.uiTexts?.joinBannerCta || 'Únete a la red'}
          </button>
        </div>
      </header>

      {/* Search & Filters */}
      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 sm:p-5 space-y-3 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar por nombre, biografía o tema..."
              aria-label="Buscar colaboradores"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
            />
          </div>
          <div className="md:col-span-3">
            <select
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value as 'all' | 'medio' | 'independiente')}
              aria-label="Filtrar por modalidad"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
            >
              <option value="all">Todas las modalidades</option>
              <option value="medio">Medios colaboradores</option>
              <option value="independiente">Periodistas independientes</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <div className="relative flex items-center">
              <Filter className="w-3.5 h-3.5 text-neutral-400 absolute left-3 pointer-events-none" aria-hidden="true" />
              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                aria-label="Filtrar por tema"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              >
                <option value="all">Todos los temas</option>
                {availableTopics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Admin Founding Identities */}
      {filteredAdmins.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xs font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[var(--editorial-primary)]" aria-hidden="true" />
            <span>Dirección y medio fundador</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredAdmins.map((idCard) => {
              const postTotal = countPostsForIdentity(idCard.id);
              const d = extractPublicAuthorDossier(idCard, { isAdminIdentity: true });
              const web = d.websiteUrl ? sanitizeExternalUrl(d.websiteUrl) : '';
              const cityLabel = [d.city, d.country].filter(Boolean).join(', ') || d.location || '';
              const roleSummary = [d.jobTitle, d.organization].filter(Boolean).join(' · ') || d.profession;
              return (
                <article
                  key={idCard.id}
                  className="rounded-2xl border-2 border-[#111111]/15 dark:border-neutral-700 bg-white dark:bg-[#141414] p-6 flex flex-col justify-between shadow-sm"
                >
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-900 shrink-0 ring-2 ring-amber-500/40">
                        {d.avatarUrl ? (
                          <EditorialImage
                            src={d.avatarUrl}
                            alt={d.name}
                            fallbackTitle={d.name}
                            allowInDataSaver
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white font-display text-2xl font-extrabold uppercase">
                            {d.name.slice(0, 1)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-display font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                          {idCard.roleTitle || (idCard.id === 'magazine' ? 'Medio editor' : 'Dirección editorial')}
                        </span>
                        <h3 className="mt-0.5 font-display text-2xl font-extrabold uppercase tracking-tight flex items-center gap-1.5">
                          <a
                            href={`/colaborador/${idCard.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(`/colaborador/${idCard.id}`);
                            }}
                            className="hover:text-[var(--editorial-primary)] truncate"
                          >
                            {d.name}
                          </a>
                          <VerifiedBadge size="md" />
                        </h3>
                        {roleSummary && (
                          <p className="text-xs text-neutral-600 dark:text-neutral-300 flex items-center gap-1 mt-0.5 truncate">
                            <Briefcase className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span className="truncate">{roleSummary}</span>
                          </p>
                        )}
                        {(cityLabel || d.publicAge !== undefined) && (
                          <p className="text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                            {cityLabel && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3" aria-hidden="true" />
                                <span>{cityLabel}</span>
                              </span>
                            )}
                            {d.publicAge !== undefined && <span>· {d.publicAge} años</span>}
                          </p>
                        )}
                      </div>
                    </div>

                    {d.bio && (
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed line-clamp-3">
                        {d.bio}
                      </p>
                    )}

                    {d.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {d.topics.slice(0, 5).map((topic) => (
                          <span
                            key={topic}
                            className="px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-display uppercase tracking-wider"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
                    <div className="flex items-center gap-3">
                      <span className="font-tabular">
                        {postTotal} {postTotal === 1 ? 'publicación' : 'publicaciones'}
                      </span>
                      {web && (
                        <a
                          href={web}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-[var(--editorial-primary)]"
                        >
                          <ExternalLink className="w-3 h-3" aria-hidden="true" /> Sitio
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/colaborador/${idCard.id}`)}
                      className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)] hover:underline cursor-pointer"
                    >
                      Ver perfil →
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Collaborator Directory */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xs font-bold uppercase tracking-widest text-neutral-500">
            Colaboradores públicos ({filteredCollabs.length})
          </h2>
        </div>

        {filteredCollabs.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-8 text-center space-y-2">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {publicCollaborators.length === 0
                ? 'Aún no hay colaboradores que hayan habilitado su perfil público en el directorio.'
                : 'No se encontraron colaboradores con los filtros aplicados.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCollabs.map(renderCollaboratorCard)}
          </div>
        )}
      </section>
    </main>
  );
};
