import React from 'react';
import { WifiOff, X } from 'lucide-react';
import { AdminPanel } from './components/AdminPanel';
import { ArticleView } from './components/ArticleView';
import { AuthModal } from './components/AuthModal';
import { CollaboratorPanel } from './components/CollaboratorPanel';
import { CollaboratorsPage } from './components/CollaboratorsPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { JoinCollaboratorPage } from './components/JoinCollaboratorPage';
import { OfflineIndicator } from './components/PWAInstallButton';
import { SearchPage } from './components/SearchPage';
import {
  AboutPage,
  BookmarksPage,
  CollaboratorProfilePage,
  ContactRectificationPage,
  FeedXmlPage,
  HowWeWorkPage,
  LegalPage,
} from './components/StaticPages';
import { AuthProvider } from './context/AuthContext';
import { DataSaverProvider, useDataSaver } from './context/DataSaverContext';
import { MediaPlayerProvider, useMediaPlayer } from './context/MediaPlayerContext';
import { SiteProvider, useSite } from './context/SiteContext';
import { MiniAudioPlayer } from './components/MiniAudioPlayer';

const EditorialRouter: React.FC = () => {
  const { currentPath } = useSite();
  const { autoNotice, dismissAutoNotice } = useDataSaver();
  const { currentTrack } = useMediaPlayer();
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
    <div className={`min-h-screen flex flex-col bg-[#F8F6F1] text-[#111111] dark:bg-[#0D0D0D] dark:text-[#F4F1EA] ${currentTrack ? 'pb-20' : ''}`}>
      <Header />
      <div className="flex-1">{view}</div>
      <Footer />
      <MiniAudioPlayer />
      <AuthModal />
      <OfflineIndicator />

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
      <DataSaverProvider>
        <AuthProvider>
          <SiteProvider>
            <MediaPlayerProvider>
              <EditorialRouter />
            </MediaPlayerProvider>
          </SiteProvider>
        </AuthProvider>
      </DataSaverProvider>
    </ErrorBoundary>
  );
}
