import React, { Suspense, lazy } from 'react';
import { RefreshCw, WifiOff, X } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { AuthModal } from './components/AuthModal';
import { EditorialPageSkeleton } from './components/EditorialSkeletons';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { MiniAudioPlayer } from './components/MiniAudioPlayer';
import { OfflineIndicator } from './components/PWAInstallButton';
import { ThemeGreetingBanner } from './components/themes/ThemeGreetingBanner';
import { ThemeParticleCanvas } from './components/themes/ThemeParticleCanvas';
import { ThemePreviewFloatingBar } from './components/themes/ThemePreviewFloatingBar';
import { AuthProvider } from './context/AuthContext';
import { DataSaverProvider, useDataSaver } from './context/DataSaverContext';
import { MediaPlayerProvider, useMediaPlayer } from './context/MediaPlayerContext';
import { SiteProvider, useSite } from './context/SiteContext';
import { ThemeProvider } from './context/ThemeContext';
import { usePWAUpdate } from './hooks/usePWAUpdate';

const HomePage = lazy(() => import('./components/HomePage').then((m) => ({ default: m.HomePage })));
const ArticleView = lazy(() => import('./components/ArticleView').then((m) => ({ default: m.ArticleView })));
const SearchPage = lazy(() => import('./components/SearchPage').then((m) => ({ default: m.SearchPage })));
const CollaboratorsPage = lazy(() =>
  import('./components/CollaboratorsPage').then((m) => ({ default: m.CollaboratorsPage }))
);
const JoinCollaboratorPage = lazy(() =>
  import('./components/JoinCollaboratorPage').then((m) => ({ default: m.JoinCollaboratorPage }))
);
const CollaboratorPanel = lazy(() =>
  import('./components/CollaboratorPanel').then((m) => ({ default: m.CollaboratorPanel }))
);
const AdminPanel = lazy(() => import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel })));
const TolimaHeritagePage = lazy(() =>
  import('./components/TolimaHeritagePage').then((m) => ({ default: m.TolimaHeritagePage }))
);
const AboutPage = lazy(() => import('./components/StaticPages').then((m) => ({ default: m.AboutPage })));
const BookmarksPage = lazy(() => import('./components/StaticPages').then((m) => ({ default: m.BookmarksPage })));
const CollaboratorProfilePage = lazy(() =>
  import('./components/StaticPages').then((m) => ({ default: m.CollaboratorProfilePage }))
);
const ContactRectificationPage = lazy(() =>
  import('./components/StaticPages').then((m) => ({ default: m.ContactRectificationPage }))
);
const FeedXmlPage = lazy(() => import('./components/StaticPages').then((m) => ({ default: m.FeedXmlPage })));
const HowWeWorkPage = lazy(() => import('./components/StaticPages').then((m) => ({ default: m.HowWeWorkPage })));
const LegalPage = lazy(() => import('./components/StaticPages').then((m) => ({ default: m.LegalPage })));

const EditorialRouter: React.FC = () => {
  const { currentPath } = useSite();
  const { autoNotice, dismissAutoNotice } = useDataSaver();
  const { currentTrack } = useMediaPlayer();
  const { needsRefresh, applyUpdate, dismissUpdate } = usePWAUpdate();
  const pathname = currentPath.split('?')[0].replace(/\/+$/, '') || '/';
  const segments = pathname.split('/').filter(Boolean);

  let view: React.ReactNode = <HomePage />;

  if (pathname === '/' || segments.length === 0) {
    view = <HomePage />;
  } else if (segments[0] === 'articulo' && segments[1]) {
    view = <ArticleView slug={decodeURIComponent(segments[1])} />;
  } else if (segments[0] === 'categoria') {
    view = <SearchPage initialCategorySlug={segments[1] ? decodeURIComponent(segments[1]) : undefined} />;
  } else if (segments[0] === 'etiqueta') {
    view = <SearchPage initialTag={segments[1] ? decodeURIComponent(segments[1]) : undefined} />;
  } else if (segments[0] === 'serie') {
    view = <SearchPage initialSeriesSlug={segments[1] ? decodeURIComponent(segments[1]) : undefined} />;
  } else if (segments[0] === 'buscar') {
    view = <SearchPage />;
  } else if (segments[0] === 'tolima') {
    view = <TolimaHeritagePage />;
  } else if (segments[0] === 'colaboradores') {
    view = <CollaboratorsPage />;
  } else if (segments[0] === 'unete') {
    view = <JoinCollaboratorPage />;
  } else if (segments[0] === 'colaborador' && segments[1]) {
    view = <CollaboratorProfilePage uid={decodeURIComponent(segments[1])} />;
  } else if (segments[0] === 'colaborador-panel') {
    view = <CollaboratorPanel />;
  } else if (segments[0] === 'admin') {
    view = <AdminPanel />;
  } else if (segments[0] === 'favoritos') {
    view = <BookmarksPage />;
  } else if (segments[0] === 'quienes-somos') {
    view = <AboutPage />;
  } else if (segments[0] === 'como-trabajamos') {
    view = <HowWeWorkPage />;
  } else if (segments[0] === 'contacto') {
    view = <ContactRectificationPage />;
  } else if (segments[0] === 'terminos') {
    view = <LegalPage kind="terms" />;
  } else if (segments[0] === 'privacidad') {
    view = <LegalPage kind="privacy" />;
  } else if (segments[0] === 'rss.xml') {
    view = <FeedXmlPage kind="rss" />;
  } else if (segments[0] === 'sitemap.xml') {
    view = <FeedXmlPage kind="sitemap" />;
  }

  return (
    <div className={`min-h-screen flex flex-col bg-[var(--editorial-paper)] text-[var(--editorial-ink)] transition-colors duration-300 ${currentTrack ? 'pb-20' : ''}`}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--editorial-primary)] focus:text-white focus:font-display focus:text-xs focus:font-bold focus:uppercase"
      >
        Saltar al contenido principal
      </a>
      <ThemeParticleCanvas />
      <Header />
      <ThemeGreetingBanner />
      <div id="main-content" tabIndex={-1} className="flex-1 focus:outline-none relative z-10">
        <Suspense fallback={<EditorialPageSkeleton />}>{view}</Suspense>
      </div>
      <Footer />
      <MiniAudioPlayer />
      <AuthModal />
      <OfflineIndicator />
      <ThemePreviewFloatingBar />

      {needsRefresh && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed ${currentTrack ? 'bottom-24' : 'bottom-4'} left-4 z-50 max-w-sm rounded-2xl border border-[var(--editorial-primary)]/50 bg-[#141414] text-white px-4 py-3 shadow-2xl space-y-2.5 text-xs`}
        >
          <p className="font-display font-bold uppercase tracking-wider text-white">
            Hay una nueva edición disponible
          </p>
          <p className="text-neutral-300 leading-relaxed">
            Actualiza para cargar las mejoras más recientes de la revista.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyUpdate()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display font-bold uppercase tracking-wider cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Actualizar</span>
            </button>
            <button
              type="button"
              onClick={dismissUpdate}
              className="px-3 py-1.5 rounded-full border border-neutral-700 text-neutral-300 hover:text-white font-display font-bold uppercase tracking-wider cursor-pointer"
            >
              Después
            </button>
          </div>
        </div>
      )}

      {autoNotice && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed ${currentTrack ? 'bottom-20' : 'bottom-4'} right-4 z-50 max-w-sm rounded-2xl border border-amber-500/40 bg-[#141414] text-white px-4 py-3 shadow-xl flex items-start gap-3 text-xs`}
        >
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="flex-1 leading-relaxed">{autoNotice}</p>
          <button
            type="button"
            onClick={dismissAutoNotice}
            aria-label="Cerrar aviso de ahorro de datos"
            className="text-neutral-400 hover:text-white cursor-pointer p-0.5"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <DataSaverProvider>
          <AuthProvider>
            <SiteProvider>
              <ThemeProvider>
                <MediaPlayerProvider>
                  <EditorialRouter />
                </MediaPlayerProvider>
              </ThemeProvider>
            </SiteProvider>
          </AuthProvider>
        </DataSaverProvider>
      </MotionConfig>
    </ErrorBoundary>
  );
}
