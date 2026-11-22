import React, { useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Bookmark, BookOpenCheck, Download, ExternalLink, FileCheck2, Mail, MapPin, Scale, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { checkActionCooldown, generateSpamChallenge, markActionCooldown } from '../lib/appCheck';
import { db } from '../lib/firebase';
import {
  downloadTextFile,
  formatDateEs,
  generateId,
  generateRssXml,
  generateSitemapXml,
  sanitizeExternalUrl,
} from '../lib/utils';
import { ArticleCard } from './ArticleCard';
import { EditorialImage } from './EditorialImage';
import { VerifiedBadge } from './VerifiedBadge';

export const AboutPage: React.FC = () => {
  const { siteConfig } = useSite();
  const hasAbout = Boolean(siteConfig.aboutText?.trim());

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6 animate-fade-up">
      <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
        Identidad editorial
      </p>
      <h1 className="font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-tight">
        Quiénes somos
      </h1>
      {hasAbout ? (
        <div className="space-y-4 text-lg leading-relaxed whitespace-pre-line font-editorial">
          {siteConfig.aboutText}
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 text-base text-neutral-600 dark:text-neutral-300 leading-relaxed">
          La presentación institucional de {siteConfig.siteName} está siendo actualizada por el equipo editorial.
        </div>
      )}
      {siteConfig.authorLiabilityNotice?.trim() && (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 text-sm text-neutral-600 dark:text-neutral-300">
          {siteConfig.authorLiabilityNotice}
        </div>
      )}
    </main>
  );
};

export const HowWeWorkPage: React.FC = () => {
  const { siteConfig } = useSite();

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8 animate-fade-up">
      <header className="space-y-2 border-b border-neutral-200 dark:border-neutral-800 pb-6">
        <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
          Transparencia y rigor periodístico
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-tight">
          Cómo trabajamos
        </h1>
        <p className="text-base text-neutral-600 dark:text-neutral-400">
          Estándares editoriales, verificación de fuentes y política de correcciones públicas de {siteConfig.siteName}.
        </p>
      </header>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 sm:p-8 space-y-3 shadow-sm">
        <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight flex items-center gap-2">
          <BookOpenCheck className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
          <span>Criterios editoriales e independencia</span>
        </h2>
        {siteConfig.howWeWorkText?.trim() ? (
          <div className="text-base sm:text-lg leading-relaxed whitespace-pre-line font-editorial text-neutral-800 dark:text-neutral-200">
            {siteConfig.howWeWorkText}
          </div>
        ) : (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Cada pieza publicada separa explícitamente los géneros (investigación, análisis, crónica, reportaje u opinión), identifica a sus autoras o medios firmantes y evita conflictos de interés corporativos.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 sm:p-8 space-y-3 shadow-sm">
        <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
          <span>Verificación y manejo de fuentes</span>
        </h2>
        {siteConfig.sourcesPolicyText?.trim() ? (
          <div className="text-base sm:text-lg leading-relaxed whitespace-pre-line font-editorial text-neutral-800 dark:text-neutral-200">
            {siteConfig.sourcesPolicyText}
          </div>
        ) : (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Priorizamos documentos primarios, datos públicos contrastables y testimonios directos. Cuando una fuente requiere reserva por razones de seguridad, se explicita el criterio sin comprometer su integridad.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 sm:p-8 space-y-3 shadow-sm">
        <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight flex items-center gap-2">
          <Scale className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
          <span>Política de correcciones y fe de erratas</span>
        </h2>
        {siteConfig.correctionsPolicyText?.trim() ? (
          <div className="text-base sm:text-lg leading-relaxed whitespace-pre-line font-editorial text-neutral-800 dark:text-neutral-200">
            {siteConfig.correctionsPolicyText}
          </div>
        ) : (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Cuando se detecta un error factual tras la publicación, la corrección se realiza de manera visible dejando registro de fecha y modificación al pie o encabezado del artículo.
          </p>
        )}
      </section>
    </main>
  );
};

export const LegalPage: React.FC<{ kind: 'terms' | 'privacy' }> = ({ kind }) => {
  const { siteConfig } = useSite();
  const body = kind === 'terms' ? siteConfig.termsText : siteConfig.privacyText;
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6 animate-fade-up">
      <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
        Marco legal y editorial
      </p>
      <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">
        {kind === 'terms' ? 'Términos y condiciones' : 'Política de privacidad'}
      </h1>
      {body?.trim() ? (
        <div className="space-y-4 text-base leading-relaxed whitespace-pre-line font-editorial">
          {body}
        </div>
      ) : (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Documento en actualización por parte de la administración del medio.
        </p>
      )}
    </main>
  );
};

export const ContactRectificationPage: React.FC = () => {
  const { siteConfig } = useSite();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('Solicitud de rectificación o réplica');
  const [details, setDetails] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const challenge = useMemo(() => generateSpamChallenge(), []);
  const [challengeAnswer, setChallengeAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const contactEmail = (siteConfig.contactEmail || '').trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg('');
    setSent(false);
    if (honeypot.trim()) {
      setSent(true);
      return;
    }
    const cd = checkActionCooldown('contact_form', 30000);
    if (!cd.allowed) {
      setErrMsg(`Espera ${cd.remainingSec} segundos antes de enviar otro mensaje.`);
      return;
    }
    const cleanName = name.trim().slice(0, 120);
    const cleanEmail = email.trim().slice(0, 200);
    const cleanDetails = details.trim().slice(0, 3000);
    if (cleanName.length < 2) {
      setErrMsg('Ingresa tu nombre completo (mínimo 2 caracteres).');
      return;
    }
    if (cleanEmail.length < 5 || !cleanEmail.includes('@')) {
      setErrMsg('Ingresa un correo electrónico válido.');
      return;
    }
    if (cleanDetails.length < 5) {
      setErrMsg('Describe tu solicitud con al menos 5 caracteres.');
      return;
    }
    if (Number(challengeAnswer.trim()) !== challenge.expectedAnswer) {
      setErrMsg('Verifica la respuesta matemática de control antispam.');
      return;
    }

    setSubmitting(true);
    try {
      const id = generateId('rect');
      await setDoc(doc(db, 'reports_and_rectifications', id), {
        id,
        type: 'rectificacion',
        reporterName: cleanName,
        reporterEmail: cleanEmail,
        reason: reason.slice(0, 200),
        details: cleanDetails,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      markActionCooldown('contact_form');
      setSent(true);
      setDetails('');
      setChallengeAnswer('');
    } catch {
      setErrMsg('No se pudo enviar la solicitud en este momento. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6 animate-fade-up">
      <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
        Transparencia y derecho de réplica
      </p>
      <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">
        Contacto y rectificaciones
      </h1>
      <p className="text-base text-neutral-700 dark:text-neutral-300">
        {contactEmail ? (
          <>
            También puedes escribirnos directamente a{' '}
            <a href={`mailto:${contactEmail}`} className="underline text-[var(--editorial-primary)]">
              {contactEmail}
            </a>
            . Todas las solicitudes llegan directamente al panel de administración.
          </>
        ) : (
          'Utiliza este formulario para enviar solicitudes de rectificación, réplica o contacto editorial directamente al panel de administración.'
        )}
      </p>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 sm:p-8 space-y-4 shadow-sm">
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="hidden"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-display text-xs font-bold uppercase mb-1">Nombre completo</label>
            <input type="text" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
          </div>
          <div>
            <label className="block font-display text-xs font-bold uppercase mb-1">Correo electrónico</label>
            <input type="email" required minLength={5} maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
          </div>
        </div>
        <div>
          <label className="block font-display text-xs font-bold uppercase mb-1">Asunto</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm">
            <option>Solicitud de rectificación o réplica</option>
            <option>Contacto editorial / envío de fuentes</option>
            <option>Alianzas con medios independientes</option>
          </select>
        </div>
        <div>
          <label className="block font-display text-xs font-bold uppercase mb-1">Mensaje detallado</label>
          <textarea required rows={4} minLength={5} maxLength={3000} value={details} onChange={(e) => setDetails(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
        </div>
        <div>
          <label className="block font-display text-xs font-bold uppercase mb-1">
            Verificación antispam: {challenge.question}
          </label>
          <input
            type="text"
            inputMode="numeric"
            required
            value={challengeAnswer}
            onChange={(e) => setChallengeAnswer(e.target.value)}
            placeholder="Resultado"
            className="w-36 px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
          />
        </div>
        {errMsg && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {errMsg}
          </p>
        )}
        <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-60">
          <Send className="w-3.5 h-3.5" />
          <span>{submitting ? 'Enviando...' : 'Enviar solicitud'}</span>
        </button>
        {sent && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Tu solicitud fue recibida y registrada en la bandeja de administración.
          </p>
        )}
      </form>
    </main>
  );
};

export const CollaboratorProfilePage: React.FC<{ uid: string }> = ({ uid }) => {
  const { collaborators, adminIdentities, publishedPosts, siteConfig, navigate } = useSite();

  const isOwnerIdentity = uid === 'owner';
  const isMagazineIdentity = uid === 'magazine';
  const adminProfile = isOwnerIdentity
    ? adminIdentities.owner
    : isMagazineIdentity
    ? adminIdentities.magazine
    : null;

  const collabProfile = !adminProfile ? collaborators.find((c) => c.uid === uid) : null;

  const posts = useMemo(() => {
    if (isOwnerIdentity) {
      return publishedPosts.filter(
        (p) => p.authorProfileId === 'owner' || (!p.authorProfileId && p.authorIdentityType === 'owner')
      );
    }
    if (isMagazineIdentity) {
      return publishedPosts.filter(
        (p) => p.authorProfileId === 'magazine' || p.authorIdentityType === 'magazine'
      );
    }
    return publishedPosts.filter((p) => p.authorProfileId === uid || p.authorId === uid);
  }, [publishedPosts, uid, isOwnerIdentity, isMagazineIdentity]);

  const isVerified = Boolean(adminProfile || collabProfile?.status === 'active');

  const displayName =
    adminProfile?.name ||
    collabProfile?.name ||
    posts[0]?.authorName ||
    'Perfil editorial';

  const outletLabel = adminProfile
    ? adminProfile.roleTitle || (isMagazineIdentity ? 'Medio editorial independiente' : 'Fundador/a y Dirección')
    : collabProfile?.outletType === 'medio'
    ? 'Medio o revista colaboradora'
    : 'Periodista / Columnista independiente';

  const showAvatar = adminProfile ? true : Boolean(collabProfile?.showAvatar);
  const avatar = showAvatar
    ? adminProfile?.avatarUrl || collabProfile?.avatarUrl
    : undefined;
  const bio = adminProfile ? adminProfile.bio : collabProfile?.showBio ? collabProfile.bio : undefined;
  const website = adminProfile
    ? adminProfile.websiteUrl
    : collabProfile?.showWebsite
    ? collabProfile.websiteUrl
    : undefined;
  const twitter = adminProfile
    ? adminProfile.socialTwitter
    : collabProfile?.showSocialTwitter
    ? collabProfile.socialTwitter
    : undefined;
  const instagram = adminProfile
    ? adminProfile.socialInstagram
    : collabProfile?.showSocialInstagram
    ? collabProfile.socialInstagram
    : undefined;
  const youtube = adminProfile
    ? adminProfile.socialYoutube
    : collabProfile?.showSocialYoutube
    ? collabProfile.socialYoutube
    : undefined;
  const publicEmail = adminProfile
    ? adminProfile.publicEmail
    : collabProfile?.showPublicEmail
    ? collabProfile.publicEmail
    : undefined;
  const location = adminProfile
    ? adminProfile.location
    : collabProfile?.showLocation
    ? collabProfile.location
    : undefined;
  const topics = adminProfile
    ? adminProfile.topics
    : collabProfile?.showTopics
    ? collabProfile.topics
    : undefined;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-10 animate-fade-up">
      <div className="border-b border-neutral-300 dark:border-neutral-800 pb-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-neutral-900 shrink-0 ring-2 ring-[var(--editorial-primary)]/30">
          {avatar ? (
            <EditorialImage src={avatar} alt={displayName} fallbackTitle={displayName} allowInDataSaver />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white font-display text-3xl font-extrabold uppercase">
              {displayName.slice(0, 1)}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
            {outletLabel}
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight flex items-center gap-2.5">
            <span>{displayName}</span>
            {isVerified && <VerifiedBadge size="lg" />}
          </h1>
          {location && (
            <p className="text-xs text-neutral-500 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{location}</span>
            </p>
          )}
          {bio && (
            <p className="text-base text-neutral-700 dark:text-neutral-300 max-w-2xl leading-relaxed">
              {bio}
            </p>
          )}
          {Array.isArray(topics) && topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {topics.map((t) => (
                <span key={t} className="px-2.5 py-0.5 rounded-full bg-neutral-200/70 dark:bg-neutral-800 text-[11px] font-display uppercase tracking-wider">
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-3 text-xs font-display font-bold uppercase tracking-wider pt-1">
            {website && sanitizeExternalUrl(website) && (
              <a href={sanitizeExternalUrl(website)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 hover:text-[var(--editorial-primary)]">
                <ExternalLink className="w-3.5 h-3.5" /> Sitio web
              </a>
            )}
            {publicEmail && (
              <a href={`mailto:${publicEmail}`} className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 hover:text-[var(--editorial-primary)]">
                <Mail className="w-3.5 h-3.5" /> {publicEmail}
              </a>
            )}
            {twitter && (
              <span className="px-3 py-1 rounded-full bg-neutral-200/70 dark:bg-neutral-800">X: {twitter}</span>
            )}
            {instagram && (
              <span className="px-3 py-1 rounded-full bg-neutral-200/70 dark:bg-neutral-800">IG: {instagram}</span>
            )}
            {youtube && (
              <span className="px-3 py-1 rounded-full bg-neutral-200/70 dark:bg-neutral-800">YT: {youtube}</span>
            )}
            {Boolean(collabProfile?.showJoinDate && collabProfile.createdAt) && (
              <span className="px-3 py-1 rounded-full bg-neutral-200/70 dark:bg-neutral-800">
                Desde {formatDateEs(collabProfile?.createdAt)}
              </span>
            )}
            {(adminProfile || collabProfile?.showPostCount) && (
              <span className="px-3 py-1 rounded-full bg-neutral-200/70 dark:bg-neutral-800 font-tabular">
                {posts.length} {posts.length === 1 ? 'publicación' : 'publicaciones'}
              </span>
            )}
          </div>
        </div>
      </div>

      {siteConfig.authorLiabilityNotice?.trim() && (
        <p className="rounded-2xl text-xs text-neutral-500 border border-neutral-200 dark:border-neutral-800 p-4">
          {siteConfig.authorLiabilityNotice}
        </p>
      )}

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-8 text-center space-y-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Este perfil aún no registra publicaciones visibles.
          </p>
          <button
            type="button"
            onClick={() => navigate('/colaboradores')}
            className="px-4 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 font-display text-xs font-bold uppercase cursor-pointer"
          >
            Volver al directorio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((p) => (
            <ArticleCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </main>
  );
};

export const BookmarksPage: React.FC = () => {
  const { bookmarks, firebaseUser } = useAuth();
  const { publishedPosts, navigate, setAuthModalOpen } = useSite();

  if (!firebaseUser) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <Bookmark className="w-10 h-10 text-[var(--editorial-primary)] mx-auto" />
        <h1 className="font-display text-3xl font-extrabold uppercase">Artículos guardados</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Inicia sesión con tu cuenta para consultar tus lecturas guardadas.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="px-6 py-2.5 rounded-full bg-[var(--editorial-primary)] text-white font-display font-bold uppercase text-xs cursor-pointer"
        >
          Iniciar sesión
        </button>
      </main>
    );
  }

  const savedPosts = bookmarks
    .map((b) => publishedPosts.find((p) => p.id === b.postId))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase border-b border-neutral-300 dark:border-neutral-800 pb-4">
        Mis artículos guardados ({bookmarks.length})
      </h1>
      {savedPosts.length === 0 ? (
        <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 p-10 text-center space-y-3">
          <p className="text-neutral-600 dark:text-neutral-400">No has guardado artículos todavía.</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-5 py-2 rounded-full bg-[var(--editorial-primary)] text-white font-display text-xs font-bold uppercase cursor-pointer"
          >
            Explorar portada
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {savedPosts.map((p) => (
            <ArticleCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </main>
  );
};

export const FeedXmlPage: React.FC<{ kind: 'rss' | 'sitemap' }> = ({ kind }) => {
  const { publishedPosts, siteConfig } = useSite();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const xml =
    kind === 'rss'
      ? generateRssXml(publishedPosts, siteConfig, origin)
      : generateSitemapXml(publishedPosts, origin);
  const filename = kind === 'rss' ? 'rss.xml' : 'sitemap.xml';
  const mime = kind === 'rss' ? 'application/rss+xml;charset=utf-8' : 'application/xml;charset=utf-8';

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-300 dark:border-neutral-800 pb-4">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
            Sindicación y rastreo
          </p>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">
            {kind === 'rss' ? 'Feed RSS 2.0' : 'Mapa del sitio XML'}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => downloadTextFile(filename, xml, mime)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--editorial-primary)] text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Descargar {filename}</span>
        </button>
      </div>
      <pre className="p-5 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] overflow-x-auto text-xs font-tabular leading-relaxed">
        {xml}
      </pre>
    </main>
  );
};
