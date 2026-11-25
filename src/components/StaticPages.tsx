import React, { useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Bookmark, BookOpenCheck, Download, FileCheck2, Scale, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { checkActionCooldown, generateSpamChallenge, markActionCooldown } from '../lib/appCheck';
import { db } from '../lib/firebase';
import {
  downloadTextFile,
  generateId,
  generateRssXml,
  generateSitemapXml,
} from '../lib/utils';
import { ArticleCard } from './ArticleCard';
import { AuthorDossierCard } from './AuthorDossierCard';
import {
  EditorialButton,
  EditorialNotice,
  EmptyState,
  SectionHeader,
  editorialInputClass,
} from './ui/EditorialPrimitives';

export const AboutPage: React.FC = () => {
  const { siteConfig } = useSite();
  const hasAbout = Boolean(siteConfig.aboutText?.trim());

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-6 animate-fade-up">
      <header className="border-b border-[var(--editorial-border)] pb-5 space-y-2">
        <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-[var(--editorial-primary)]">
          Identidad editorial
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-tight">
          Quiénes somos
        </h1>
        <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-muted)]">
          Hecho en el Tolima, para Colombia
        </p>
      </header>

      {hasAbout ? (
        <div className="editorial-prose text-lg leading-relaxed whitespace-pre-line font-editorial text-[var(--editorial-ink)]">
          {siteConfig.aboutText}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-6 text-base text-[var(--editorial-muted)] leading-relaxed">
          La presentación institucional de {siteConfig.siteName} está siendo actualizada por el equipo editorial.
        </div>
      )}

      {siteConfig.authorLiabilityNotice?.trim() && (
        <EditorialNotice tone="info">{siteConfig.authorLiabilityNotice}</EditorialNotice>
      )}
    </main>
  );
};

export const HowWeWorkPage: React.FC = () => {
  const { siteConfig } = useSite();

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-8 animate-fade-up">
      <header className="space-y-2 border-b border-[var(--editorial-border)] pb-6">
        <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-[var(--editorial-primary)]">
          Transparencia y rigor periodístico
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold uppercase tracking-tight">
          Cómo trabajamos
        </h1>
        <p className="text-base text-[var(--editorial-muted)]">
          Estándares editoriales, verificación de fuentes y política de correcciones públicas de {siteConfig.siteName}.
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-6 sm:p-8 space-y-3">
        <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight flex items-center gap-2">
          <BookOpenCheck className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
          <span>Criterios editoriales e independencia</span>
        </h2>
        {siteConfig.howWeWorkText?.trim() ? (
          <div className="text-base sm:text-lg leading-relaxed whitespace-pre-line font-editorial text-[var(--editorial-ink)]">
            {siteConfig.howWeWorkText}
          </div>
        ) : (
          <p className="text-sm sm:text-base text-[var(--editorial-muted)] leading-relaxed">
            Cada pieza publicada separa explícitamente los géneros (investigación, análisis, crónica, reportaje u opinión), identifica a sus autoras o medios firmantes y evita conflictos de interés corporativos.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-6 sm:p-8 space-y-3">
        <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
          <span>Verificación y manejo de fuentes</span>
        </h2>
        {siteConfig.sourcesPolicyText?.trim() ? (
          <div className="text-base sm:text-lg leading-relaxed whitespace-pre-line font-editorial text-[var(--editorial-ink)]">
            {siteConfig.sourcesPolicyText}
          </div>
        ) : (
          <p className="text-sm sm:text-base text-[var(--editorial-muted)] leading-relaxed">
            Priorizamos documentos primarios, datos públicos contrastables y testimonios directos. Cuando una fuente requiere reserva por razones de seguridad, se explicita el criterio sin comprometer su integridad.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-6 sm:p-8 space-y-3">
        <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight flex items-center gap-2">
          <Scale className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
          <span>Política de correcciones y fe de erratas</span>
        </h2>
        {siteConfig.correctionsPolicyText?.trim() ? (
          <div className="text-base sm:text-lg leading-relaxed whitespace-pre-line font-editorial text-[var(--editorial-ink)]">
            {siteConfig.correctionsPolicyText}
          </div>
        ) : (
          <p className="text-sm sm:text-base text-[var(--editorial-muted)] leading-relaxed">
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
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-6 animate-fade-up">
      <header className="border-b border-[var(--editorial-border)] pb-5 space-y-1.5">
        <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-[var(--editorial-primary)]">
          Marco legal y editorial
        </p>
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">
          {kind === 'terms' ? 'Términos y condiciones' : 'Política de privacidad'}
        </h1>
      </header>
      {body?.trim() ? (
        <div className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-6 sm:p-8 text-base leading-relaxed whitespace-pre-line font-editorial text-[var(--editorial-ink)]">
          {body}
        </div>
      ) : (
        <EditorialNotice tone="info">
          Documento en actualización por parte de la administración del medio.
        </EditorialNotice>
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
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12 space-y-6 animate-fade-up">
      <header className="border-b border-[var(--editorial-border)] pb-5 space-y-2">
        <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-[var(--editorial-primary)]">
          Transparencia y derecho de réplica
        </p>
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">
          Contacto y rectificaciones
        </h1>
        <p className="text-base text-[var(--editorial-muted)] leading-relaxed">
          {contactEmail ? (
            <>
              También puedes escribirnos directamente a{' '}
              <a
                href={`mailto:${contactEmail}`}
                className="underline text-[var(--editorial-primary)] font-medium"
              >
                {contactEmail}
              </a>
              . Todas las solicitudes llegan directamente al panel de administración.
            </>
          ) : (
            'Utiliza este formulario para enviar solicitudes de rectificación, réplica o contacto editorial directamente al panel de administración.'
          )}
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-6 sm:p-8 space-y-4"
      >
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
            <label className="block font-display text-xs font-bold uppercase mb-1.5">
              Nombre completo
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={editorialInputClass}
            />
          </div>
          <div>
            <label className="block font-display text-xs font-bold uppercase mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              minLength={5}
              maxLength={200}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={editorialInputClass}
            />
          </div>
        </div>
        <div>
          <label className="block font-display text-xs font-bold uppercase mb-1.5">Asunto</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={editorialInputClass}
          >
            <option>Solicitud de rectificación o réplica</option>
            <option>Contacto editorial / envío de fuentes</option>
            <option>Alianzas con medios independientes</option>
          </select>
        </div>
        <div>
          <label className="block font-display text-xs font-bold uppercase mb-1.5">
            Mensaje detallado
          </label>
          <textarea
            required
            rows={4}
            minLength={5}
            maxLength={3000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className={editorialInputClass}
          />
        </div>
        <div>
          <label className="block font-display text-xs font-bold uppercase mb-1.5">
            Verificación antispam: {challenge.question}
          </label>
          <input
            type="text"
            inputMode="numeric"
            required
            value={challengeAnswer}
            onChange={(e) => setChallengeAnswer(e.target.value)}
            placeholder="Resultado"
            className={`${editorialInputClass} w-40`}
          />
        </div>

        {errMsg && <EditorialNotice tone="error">{errMsg}</EditorialNotice>}
        {sent && (
          <EditorialNotice tone="success">
            Tu solicitud fue recibida y registrada en la bandeja de administración.
          </EditorialNotice>
        )}

        <EditorialButton type="submit" disabled={submitting} size="lg">
          <Send className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{submitting ? 'Enviando...' : 'Enviar solicitud'}</span>
        </EditorialButton>
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
  const activeProfile = adminProfile || collabProfile;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-10 animate-fade-up">
      <AuthorDossierCard
        profile={activeProfile}
        isAdminIdentity={Boolean(adminProfile)}
        fallbackName={posts[0]?.authorName || 'Perfil editorial'}
        verified={isVerified}
        variant="full"
        postCount={posts.length}
      />

      {siteConfig.authorLiabilityNotice?.trim() && (
        <EditorialNotice tone="info">{siteConfig.authorLiabilityNotice}</EditorialNotice>
      )}

      {posts.length === 0 ? (
        <EmptyState
          title="Sin publicaciones visibles todavía"
          description="Este perfil editorial aún no registra notas publicadas en la edición actual."
          action={
            <EditorialButton variant="secondary" onClick={() => navigate('/colaboradores')}>
              Volver al directorio
            </EditorialButton>
          }
        />
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
      <main className="max-w-3xl mx-auto px-4 py-14">
        <EmptyState
          icon={<Bookmark className="w-6 h-6" aria-hidden="true" />}
          kicker="Biblioteca personal"
          title="Artículos guardados"
          description="Inicia sesión con tu cuenta para consultar tus lecturas guardadas y sincronizarlas entre dispositivos."
          action={
            <EditorialButton size="lg" onClick={() => setAuthModalOpen(true)}>
              Iniciar sesión
            </EditorialButton>
          }
        />
      </main>
    );
  }

  const savedPosts = bookmarks
    .map((b) => publishedPosts.find((p) => p.id === b.postId))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-7 animate-fade-up">
      <SectionHeader
        kicker="Lecturas reservadas"
        title={`Mis artículos guardados (${bookmarks.length})`}
        subtitle="Colección personal de reportajes, columnas y crónicas guardadas para leer después."
      />
      {savedPosts.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="w-6 h-6" aria-hidden="true" />}
          title="Aún no guardas artículos"
          description="Cuando marques una publicación con el botón Guardar, aparecerá aquí organizada."
          action={<EditorialButton onClick={() => navigate('/')}>Explorar portada</EditorialButton>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      <SectionHeader
        kicker="Sindicación y rastreo"
        title={kind === 'rss' ? 'Feed RSS 2.0' : 'Mapa del sitio XML'}
        action={
          <EditorialButton onClick={() => downloadTextFile(filename, xml, mime)}>
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Descargar {filename}</span>
          </EditorialButton>
        }
      />
      <pre className="p-5 rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] overflow-x-auto text-xs font-tabular leading-relaxed">
        {xml}
      </pre>
    </main>
  );
};
