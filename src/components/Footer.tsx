import React, { useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Bell, BellOff, FileCode2, Mail, Rss } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import { checkActionCooldown, markActionCooldown } from '../lib/appCheck';
import { db } from '../lib/firebase';
import {
  disableArticleAlerts,
  getArticleAlertsEnabled,
  isArticleAlertsSupported,
  requestArticleAlertsPermission,
} from '../lib/notifications';
import { downloadTextFile, generateId, generateRssXml, generateSitemapXml, sanitizeExternalUrl } from '../lib/utils';

export const Footer: React.FC = () => {
  const { siteConfig, categories, publishedPosts, readingMode, navigate } = useSite();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [websiteTrap, setWebsiteTrap] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(() => getArticleAlertsEnabled());
  const [alertsMessage, setAlertsMessage] = useState<string | null>(null);

  if (readingMode) return null;

  const twitterUrl = sanitizeExternalUrl(siteConfig.socialLinks?.twitter || '');
  const instagramUrl = sanitizeExternalUrl(siteConfig.socialLinks?.instagram || '');
  const youtubeUrl = sanitizeExternalUrl(siteConfig.socialLinks?.youtube || '');
  const telegramUrl = sanitizeExternalUrl(siteConfig.socialLinks?.telegram || '');
  const facebookUrl = sanitizeExternalUrl(siteConfig.socialLinks?.facebook || '');
  const hasSocialLinks = Boolean(twitterUrl || instagramUrl || youtubeUrl || telegramUrl || facebookUrl);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (websiteTrap.trim()) {
      setFeedback({ ok: true, text: 'Suscripción registrada.' });
      return;
    }
    const cd = checkActionCooldown('newsletter', 30000);
    if (!cd.allowed) {
      setFeedback({ ok: false, text: `Espera ${cd.remainingSec}s antes de enviar otra suscripción.` });
      return;
    }
    const cleanEmail = email.trim().toLowerCase().slice(0, 200);
    if (cleanEmail.length < 5 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFeedback({ ok: false, text: 'Ingresa un correo electrónico válido.' });
      return;
    }
    setSubmitting(true);
    try {
      const id = generateId('sub');
      await setDoc(doc(db, 'newsletter_subscribers', id), {
        id,
        email: cleanEmail,
        name: name.trim().slice(0, 120),
        createdAt: serverTimestamp(),
      });
      markActionCooldown('newsletter');
      setEmail('');
      setName('');
      setFeedback({ ok: true, text: 'Suscripción confirmada al boletín editorial.' });
    } catch {
      setFeedback({ ok: false, text: 'No se pudo completar la suscripción en este momento.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadRss = () => {
    const xml = generateRssXml(publishedPosts, siteConfig, window.location.origin);
    downloadTextFile('rss.xml', xml, 'application/rss+xml;charset=utf-8');
  };

  const handleDownloadSitemap = () => {
    const xml = generateSitemapXml(publishedPosts, window.location.origin);
    downloadTextFile('sitemap.xml', xml, 'application/xml;charset=utf-8');
  };

  return (
    <footer className="mt-20 rounded-t-3xl border-t-4 border-[var(--editorial-primary)] bg-[#111111] text-[#F4F1EA] shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-neutral-800">
          {/* Brand & Manifesto */}
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight text-white">
              {siteConfig.siteName}
            </h2>
            <p className="text-sm text-neutral-300 leading-relaxed">
              {siteConfig.tagline}
            </p>
            <p className="font-display text-xs font-bold uppercase tracking-widest text-amber-300">
              Hecho en el Tolima, para Colombia
            </p>
            {hasSocialLinks && (
              <div className="flex flex-wrap gap-2 pt-1 text-xs font-display uppercase tracking-wider text-neutral-300">
                {twitterUrl && (
                  <a href={twitterUrl} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 hover:border-[var(--editorial-primary)] hover:text-white transition-colors">
                    X
                  </a>
                )}
                {instagramUrl && (
                  <a href={instagramUrl} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 hover:border-[var(--editorial-primary)] hover:text-white transition-colors">
                    Instagram
                  </a>
                )}
                {youtubeUrl && (
                  <a href={youtubeUrl} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 hover:border-[var(--editorial-primary)] hover:text-white transition-colors">
                    YouTube
                  </a>
                )}
                {telegramUrl && (
                  <a href={telegramUrl} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 hover:border-[var(--editorial-primary)] hover:text-white transition-colors">
                    Telegram
                  </a>
                )}
                {facebookUrl && (
                  <a href={facebookUrl} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 hover:border-[var(--editorial-primary)] hover:text-white transition-colors">
                    Facebook
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Sections */}
          <div>
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)] mb-4">
              Secciones
            </h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-neutral-300">
              {categories.slice(0, 12).map((cat) => (
                <li key={cat.id}>
                  <a
                    href={`/categoria/${cat.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/categoria/${cat.slug}`);
                    }}
                    className="hover:text-white transition-colors"
                  >
                    {cat.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Institutional & Legal */}
          <div>
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)] mb-4">
              Transparencia y Red
            </h3>
            <ul className="space-y-2 text-sm text-neutral-300">
              <li>
                <a href="/tolima" onClick={(e) => { e.preventDefault(); navigate('/tolima'); }} className="hover:text-white font-semibold text-amber-200">
                  Tolima, Capital Musical
                </a>
              </li>
              <li>
                <a href="/quienes-somos" onClick={(e) => { e.preventDefault(); navigate('/quienes-somos'); }} className="hover:text-white">
                  Quiénes somos
                </a>
              </li>
              <li>
                <a href="/como-trabajamos" onClick={(e) => { e.preventDefault(); navigate('/como-trabajamos'); }} className="hover:text-white">
                  Cómo trabajamos
                </a>
              </li>
              <li>
                <a href="/colaboradores" onClick={(e) => { e.preventDefault(); navigate('/colaboradores'); }} className="hover:text-white font-semibold text-white">
                  Conozcan a nuestros colaboradores
                </a>
              </li>
              <li>
                <a href="/unete" onClick={(e) => { e.preventDefault(); navigate('/unete'); }} className="hover:text-white">
                  Únete como colaborador
                </a>
              </li>
              <li>
                <a href="/contacto" onClick={(e) => { e.preventDefault(); navigate('/contacto'); }} className="hover:text-white">
                  Contacto y rectificaciones
                </a>
              </li>
              <li>
                <a href="/terminos" onClick={(e) => { e.preventDefault(); navigate('/terminos'); }} className="hover:text-white">
                  Términos y condiciones
                </a>
              </li>
              <li>
                <a href="/privacidad" onClick={(e) => { e.preventDefault(); navigate('/privacidad'); }} className="hover:text-white">
                  Política de privacidad
                </a>
              </li>
            </ul>
            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-neutral-800 text-xs font-display uppercase tracking-wider text-neutral-400">
              <button type="button" onClick={handleDownloadRss} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-900 hover:text-white cursor-pointer">
                <Rss className="w-3.5 h-3.5" aria-hidden="true" />
                <span>RSS</span>
              </button>
              <button type="button" onClick={handleDownloadSitemap} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-900 hover:text-white cursor-pointer">
                <FileCode2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Sitemap</span>
              </button>
            </div>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)] mb-4">
              Boletín semanal
            </h3>
            <p className="text-sm text-neutral-300 mb-3">
              Recibe investigaciones, columnas y especiales sin algoritmos intermediarios.
            </p>
            <form onSubmit={handleSubscribe} className="space-y-2.5">
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={websiteTrap}
                onChange={(e) => setWebsiteTrap(e.target.value)}
                className="hidden"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre (opcional)"
                className="w-full px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[var(--editorial-primary)]"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.org"
                className="w-full px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[var(--editorial-primary)]"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display font-bold uppercase tracking-wider text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{submitting ? 'Suscribiendo...' : 'Suscribirme al boletín'}</span>
              </button>
            </form>
            {feedback && (
              <p className={`mt-2 text-xs ${feedback.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                {feedback.text}
              </p>
            )}

            {isArticleAlertsSupported() && (
              <div className="mt-4 pt-4 border-t border-neutral-800 space-y-2">
                <button
                  type="button"
                  onClick={async () => {
                    setAlertsMessage(null);
                    if (alertsEnabled) {
                      disableArticleAlerts();
                      setAlertsEnabled(false);
                      setAlertsMessage('Alertas de nuevas publicaciones desactivadas.');
                    } else {
                      const res = await requestArticleAlertsPermission();
                      setAlertsEnabled(res.ok);
                      setAlertsMessage(res.message);
                    }
                  }}
                  className={`w-full py-2 px-3 rounded-xl border text-xs font-display font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    alertsEnabled
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                      : 'border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-500'
                  }`}
                >
                  {alertsEnabled ? (
                    <>
                      <BellOff className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Alertas PWA activas (desactivar)</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Alertas de nuevas publicaciones (PWA)</span>
                    </>
                  )}
                </button>
                {alertsMessage && (
                  <p className="text-[11px] text-neutral-300 leading-snug">{alertsMessage}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Author liability & Copyright */}
        <div className="pt-8 space-y-3 text-xs text-neutral-400 leading-relaxed">
          {siteConfig.authorLiabilityNotice && (
            <p className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 text-neutral-300">
              {siteConfig.authorLiabilityNotice}
            </p>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
            <span>
              © {new Date().getFullYear()} {siteConfig.siteName}. Hecho en el Tolima, para Colombia. Periodismo independiente sin filtros corporativos.
            </span>
            {siteConfig.contactEmail?.trim() && (
              <span>Contacto editorial: {siteConfig.contactEmail.trim()}</span>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
