import React from 'react';
import {
  Briefcase,
  Building2,
  Calendar,
  ExternalLink,
  Landmark,
  Mail,
  MapPin,
  UserCheck,
} from 'lucide-react';
import { formatDateEs, sanitizeExternalUrl } from '../lib/utils';
import { AdminPublicIdentity, CollaboratorPublic, PoliticalAffiliationChoice } from '../types/editorial';
import { EditorialImage } from './EditorialImage';
import { VerifiedBadge } from './VerifiedBadge';

export interface PublicAuthorDossierData {
  id: string;
  name: string;
  outletLabel: string;
  avatarUrl?: string;
  bio?: string;
  profession?: string;
  jobTitle?: string;
  organization?: string;
  city?: string;
  country?: string;
  location?: string;
  publicAge?: number;
  politicalAffiliation?: PoliticalAffiliationChoice;
  politicalPartyName?: string;
  politicalPartyRole?: string;
  politicalPartyLogoUrl?: string;
  websiteUrl?: string;
  publicEmail?: string;
  socialTwitter?: string;
  socialInstagram?: string;
  socialYoutube?: string;
  topics: string[];
  joinDateLabel?: string;
  showPostCount: boolean;
}

export function extractPublicAuthorDossier(
  profile: CollaboratorPublic | AdminPublicIdentity | null | undefined,
  options?: { isAdminIdentity?: boolean; fallbackName?: string }
): PublicAuthorDossierData {
  const isAdmin = Boolean(options?.isAdminIdentity || (profile && 'identityType' in profile));
  const adminProfile = isAdmin ? (profile as AdminPublicIdentity | null | undefined) : null;
  const collabProfile = !isAdmin ? (profile as CollaboratorPublic | null | undefined) : null;

  const name = profile?.name || options?.fallbackName || 'Autor editorial';
  const outletLabel = adminProfile
    ? adminProfile.roleTitle ||
      (adminProfile.identityType === 'magazine' ? 'Medio editorial independiente' : 'Fundador/a y Dirección')
    : collabProfile?.outletType === 'medio'
    ? 'Medio o revista colaboradora'
    : 'Periodista / Columnista independiente';

  const adminShowOrLegacy = (explicitFlag: boolean | undefined, valuePresent: boolean) =>
    explicitFlag !== undefined ? Boolean(explicitFlag) : valuePresent;

  const canAvatar = isAdmin
    ? adminShowOrLegacy(adminProfile?.showAvatar, Boolean(adminProfile?.avatarUrl))
    : Boolean(collabProfile?.showAvatar);
  const canBio = isAdmin
    ? adminShowOrLegacy(adminProfile?.showBio, Boolean(adminProfile?.bio))
    : Boolean(collabProfile?.showBio);
  const canWebsite = isAdmin
    ? adminShowOrLegacy(adminProfile?.showWebsite, Boolean(adminProfile?.websiteUrl))
    : Boolean(collabProfile?.showWebsite);
  const canTwitter = isAdmin
    ? adminShowOrLegacy(adminProfile?.showSocialTwitter, Boolean(adminProfile?.socialTwitter))
    : Boolean(collabProfile?.showSocialTwitter);
  const canInstagram = isAdmin
    ? adminShowOrLegacy(adminProfile?.showSocialInstagram, Boolean(adminProfile?.socialInstagram))
    : Boolean(collabProfile?.showSocialInstagram);
  const canYoutube = isAdmin
    ? adminShowOrLegacy(adminProfile?.showSocialYoutube, Boolean(adminProfile?.socialYoutube))
    : Boolean(collabProfile?.showSocialYoutube);
  const canEmail = isAdmin
    ? adminShowOrLegacy(adminProfile?.showPublicEmail, Boolean(adminProfile?.publicEmail))
    : Boolean(collabProfile?.showPublicEmail);
  const canLocation = isAdmin
    ? adminShowOrLegacy(adminProfile?.showLocation, Boolean(adminProfile?.location))
    : Boolean(collabProfile?.showLocation);
  const canTopics = isAdmin
    ? adminShowOrLegacy(adminProfile?.showTopics, Boolean(adminProfile?.topics?.length))
    : Boolean(collabProfile?.showTopics);

  const canProfession = Boolean(profile?.showProfession);
  const canJobTitle = Boolean(profile?.showJobTitle);
  const canOrganization = Boolean(profile?.showOrganization);
  const canCityCountry = Boolean(profile?.showCityCountry);
  const canAge = Boolean(profile?.showAge);
  const canPolitical = Boolean(profile?.showPoliticalAffiliation);
  const canPartyLogo = Boolean(profile?.showPoliticalPartyLogo);

  const safeAge =
    canAge && typeof profile?.publicAge === 'number' && profile.publicAge >= 18 && profile.publicAge <= 120
      ? profile.publicAge
      : undefined;

  return {
    id: adminProfile ? adminProfile.id : collabProfile?.uid || '',
    name,
    outletLabel,
    avatarUrl: canAvatar ? profile?.avatarUrl : undefined,
    bio: canBio ? profile?.bio : undefined,
    profession: canProfession ? profile?.profession : undefined,
    jobTitle: canJobTitle ? profile?.jobTitle : undefined,
    organization: canOrganization ? profile?.organization : undefined,
    city: canCityCountry ? profile?.city : undefined,
    country: canCityCountry ? profile?.country : undefined,
    location: canLocation ? profile?.location : undefined,
    publicAge: safeAge,
    politicalAffiliation: canPolitical ? profile?.politicalAffiliation : undefined,
    politicalPartyName: canPolitical ? profile?.politicalPartyName : undefined,
    politicalPartyRole: canPolitical ? profile?.politicalPartyRole : undefined,
    politicalPartyLogoUrl: canPolitical && canPartyLogo ? profile?.politicalPartyLogoUrl : undefined,
    websiteUrl: canWebsite ? profile?.websiteUrl : undefined,
    publicEmail: canEmail ? profile?.publicEmail : undefined,
    socialTwitter: canTwitter ? profile?.socialTwitter : undefined,
    socialInstagram: canInstagram ? profile?.socialInstagram : undefined,
    socialYoutube: canYoutube ? profile?.socialYoutube : undefined,
    topics: canTopics && Array.isArray(profile?.topics) ? profile.topics : [],
    joinDateLabel:
      collabProfile?.showJoinDate && collabProfile?.createdAt
        ? formatDateEs(collabProfile.createdAt)
        : undefined,
    showPostCount: isAdmin ? true : Boolean(collabProfile?.showPostCount),
  };
}

function getPoliticalLabel(choice?: PoliticalAffiliationChoice, partyName?: string): string {
  if (choice === 'yes') return partyName?.trim() || 'Militancia declarada';
  if (choice === 'no') return 'Sin afiliación a partidos o movimientos políticos';
  if (choice === 'prefer_not_to_say') return 'Prefiere no declarar afiliación política';
  return '';
}

interface AuthorDossierCardProps {
  profile: CollaboratorPublic | AdminPublicIdentity | null | undefined;
  isAdminIdentity?: boolean;
  fallbackName?: string;
  verified: boolean;
  variant: 'compact' | 'full';
  postCount?: number;
  onNavigateProfile?: () => void;
}

export const AuthorDossierCard: React.FC<AuthorDossierCardProps> = ({
  profile,
  isAdminIdentity = false,
  fallbackName,
  verified,
  variant,
  postCount = 0,
  onNavigateProfile,
}) => {
  const dossier = extractPublicAuthorDossier(profile, { isAdminIdentity, fallbackName });
  const cleanWeb = dossier.websiteUrl ? sanitizeExternalUrl(dossier.websiteUrl) : '';
  const cityCountryLabel = [dossier.city, dossier.country].filter(Boolean).join(', ') || dossier.location || '';
  const politicalLabel = getPoliticalLabel(dossier.politicalAffiliation, dossier.politicalPartyName);
  const hasWorkBlock = Boolean(dossier.jobTitle || dossier.organization || cityCountryLabel);
  const hasContactBlock = Boolean(
    cleanWeb || dossier.publicEmail || dossier.socialTwitter || dossier.socialInstagram || dossier.socialYoutube
  );

  if (variant === 'compact') {
    const roleSummary = [dossier.jobTitle, dossier.organization].filter(Boolean).join(' · ') || dossier.profession;
    return (
      <section
        aria-label="Sobre el autor"
        className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-6 space-y-4 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row items-start gap-4">
          {dossier.avatarUrl ? (
            <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 bg-[var(--editorial-surface-subtle)] ring-2 ring-[var(--editorial-primary)]/25">
              <EditorialImage src={dossier.avatarUrl} alt={dossier.name} fallbackTitle={dossier.name} allowInDataSaver />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-neutral-900 text-white shrink-0 flex items-center justify-center font-display text-2xl font-extrabold uppercase">
              {dossier.name.slice(0, 1)}
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-[11px] font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                Sobre el autor · {dossier.outletLabel}
              </p>
              {onNavigateProfile && (
                <button
                  type="button"
                  onClick={onNavigateProfile}
                  className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)] hover:underline cursor-pointer"
                >
                  Ver ficha completa →
                </button>
              )}
            </div>

            <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight flex flex-wrap items-center gap-2 text-[var(--editorial-ink)]">
              <span>{dossier.name}</span>
              {verified && <VerifiedBadge size="sm" />}
              {dossier.publicAge !== undefined && (
                <span className="font-editorial text-sm font-normal normal-case text-[var(--editorial-muted)]">
                  · {dossier.publicAge} años
                </span>
              )}
            </h2>

            {(roleSummary || cityCountryLabel) && (
              <p className="text-xs text-[var(--editorial-muted)] flex flex-wrap items-center gap-x-3 gap-y-1">
                {roleSummary && (
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{roleSummary}</span>
                  </span>
                )}
                {cityCountryLabel && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{cityCountryLabel}</span>
                  </span>
                )}
              </p>
            )}

            {dossier.bio && (
              <p className="text-sm text-[var(--editorial-ink)]/85 leading-relaxed pt-1">
                {dossier.bio}
              </p>
            )}
          </div>
        </div>

        {(politicalLabel || hasContactBlock) && (
          <div className="pt-3 border-t border-[var(--editorial-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
            {politicalLabel && (
              <div className="flex items-center gap-2 text-[var(--editorial-muted)]">
                {dossier.politicalPartyLogoUrl && (
                  <img
                    src={sanitizeExternalUrl(dossier.politicalPartyLogoUrl)}
                    alt={`Logo de ${dossier.politicalPartyName || 'organización política'}`}
                    className="w-6 h-6 rounded object-contain bg-white border border-[var(--editorial-border)]"
                  />
                )}
                <span>
                  <strong className="text-[var(--editorial-ink)]">Afiliación declarada:</strong> {politicalLabel}
                  {dossier.politicalPartyRole ? ` (${dossier.politicalPartyRole})` : ''}
                </span>
              </div>
            )}

            {hasContactBlock && (
              <div className="flex flex-wrap items-center gap-3 font-display text-[11px] font-bold uppercase tracking-wider text-[var(--editorial-muted)]">
                {cleanWeb && (
                  <a href={cleanWeb} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-[var(--editorial-primary)]">
                    <ExternalLink className="w-3 h-3" /> Sitio web
                  </a>
                )}
                {dossier.publicEmail && (
                  <a href={`mailto:${dossier.publicEmail}`} className="inline-flex items-center gap-1 hover:text-[var(--editorial-primary)]">
                    <Mail className="w-3 h-3" /> {dossier.publicEmail}
                  </a>
                )}
                {dossier.socialTwitter && <span>X: {dossier.socialTwitter}</span>}
                {dossier.socialInstagram && <span>IG: {dossier.socialInstagram}</span>}
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="border-b border-[var(--editorial-border)] pb-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-neutral-900 shrink-0 ring-2 ring-[var(--editorial-primary)]/30">
          {dossier.avatarUrl ? (
            <EditorialImage src={dossier.avatarUrl} alt={dossier.name} fallbackTitle={dossier.name} allowInDataSaver />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white font-display text-3xl font-extrabold uppercase">
              {dossier.name.slice(0, 1)}
            </div>
          )}
        </div>
        <div className="space-y-2 min-w-0 flex-1">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
            {dossier.outletLabel}
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight flex flex-wrap items-center gap-2.5 text-[var(--editorial-ink)]">
            <span>{dossier.name}</span>
            {verified && <VerifiedBadge size="lg" />}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--editorial-muted)]">
            {dossier.publicAge !== undefined && (
              <span className="inline-flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{dossier.publicAge} años</span>
              </span>
            )}
            {cityCountryLabel && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{cityCountryLabel}</span>
              </span>
            )}
            {dossier.joinDateLabel && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                <span>En la red desde {dossier.joinDateLabel}</span>
              </span>
            )}
            {dossier.showPostCount && (
              <span className="font-tabular font-semibold text-[var(--editorial-ink)]">
                {postCount} {postCount === 1 ? 'publicación' : 'publicaciones'}
              </span>
            )}
          </div>
          {dossier.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {dossier.topics.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-0.5 rounded-full border border-[var(--editorial-border)] bg-[var(--editorial-surface-subtle)] text-[11px] font-display uppercase tracking-wider text-[var(--editorial-ink)]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {(dossier.bio || dossier.profession || hasWorkBlock || politicalLabel || hasContactBlock) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {dossier.bio && (
            <div className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 space-y-2">
              <h2 className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                Quién es
              </h2>
              <p className="text-sm sm:text-base text-[var(--editorial-ink)]/85 leading-relaxed whitespace-pre-line">
                {dossier.bio}
              </p>
            </div>
          )}

          {dossier.profession && (
            <div className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 space-y-2">
              <h2 className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)] flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" aria-hidden="true" />
                <span>A qué se dedica</span>
              </h2>
              <p className="text-sm sm:text-base text-[var(--editorial-ink)]/85 leading-relaxed">
                {dossier.profession}
              </p>
            </div>
          )}

          {hasWorkBlock && (
            <div className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 space-y-2">
              <h2 className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Dónde trabaja</span>
              </h2>
              <dl className="space-y-1 text-sm text-[var(--editorial-ink)]/85">
                {dossier.jobTitle && (
                  <div>
                    <dt className="inline font-semibold text-[var(--editorial-ink)]">Cargo actual: </dt>
                    <dd className="inline">{dossier.jobTitle}</dd>
                  </div>
                )}
                {dossier.organization && (
                  <div>
                    <dt className="inline font-semibold text-[var(--editorial-ink)]">Organización / medio: </dt>
                    <dd className="inline">{dossier.organization}</dd>
                  </div>
                )}
                {cityCountryLabel && (
                  <div>
                    <dt className="inline font-semibold text-[var(--editorial-ink)]">Ubicación: </dt>
                    <dd className="inline">{cityCountryLabel}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {politicalLabel && (
            <div className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 space-y-2.5">
              <h2 className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)] flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Afiliación política</span>
              </h2>
              <div className="flex items-center gap-3">
                {dossier.politicalPartyLogoUrl && (
                  <img
                    src={sanitizeExternalUrl(dossier.politicalPartyLogoUrl)}
                    alt={`Logotipo de ${dossier.politicalPartyName || 'movimiento político'}`}
                    className="w-12 h-12 rounded-xl object-contain bg-white border border-[var(--editorial-border)] p-1 shrink-0"
                  />
                )}
                <div className="text-sm text-[var(--editorial-ink)]">
                  <p className="font-semibold">{politicalLabel}</p>
                  {dossier.politicalPartyRole && (
                    <p className="text-xs text-[var(--editorial-muted)]">Rol o cargo: {dossier.politicalPartyRole}</p>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-[var(--editorial-muted)] italic">
                Información declarada directamente por el propio autor.
              </p>
            </div>
          )}

          {hasContactBlock && (
            <div className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 space-y-2.5 md:col-span-2">
              <h2 className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
                Contacto y redes
              </h2>
              <div className="flex flex-wrap gap-2.5 text-xs font-display font-bold uppercase tracking-wider">
                {cleanWeb && (
                  <a
                    href={cleanWeb}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[var(--editorial-border)] hover:border-[var(--editorial-primary)] hover:text-[var(--editorial-primary)] transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Sitio web
                  </a>
                )}
                {dossier.publicEmail && (
                  <a
                    href={`mailto:${dossier.publicEmail}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[var(--editorial-border)] hover:border-[var(--editorial-primary)] hover:text-[var(--editorial-primary)] transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" /> {dossier.publicEmail}
                  </a>
                )}
                {dossier.socialTwitter && (
                  <span className="px-3.5 py-1.5 rounded-full bg-[var(--editorial-surface-subtle)] border border-[var(--editorial-border)]">
                    X: {dossier.socialTwitter}
                  </span>
                )}
                {dossier.socialInstagram && (
                  <span className="px-3.5 py-1.5 rounded-full bg-[var(--editorial-surface-subtle)] border border-[var(--editorial-border)]">
                    Instagram: {dossier.socialInstagram}
                  </span>
                )}
                {dossier.socialYoutube && (
                  <span className="px-3.5 py-1.5 rounded-full bg-[var(--editorial-surface-subtle)] border border-[var(--editorial-border)]">
                    YouTube: {dossier.socialYoutube}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
