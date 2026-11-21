import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEFAULT_CATEGORIES, DEFAULT_SITE_CONFIG } from '../lib/seedData';
import { toDate, updateDynamicAppIcons } from '../lib/utils';
import { Category, CollaboratorPublic, Livestream, Post, SeriesItem, SiteConfig } from '../types/editorial';
import { useAuth } from './AuthContext';

export type FontSizeScale = 'sm' | 'md' | 'lg' | 'xl';

interface SiteContextValue {
  siteConfig: SiteConfig;
  categories: Category[];
  seriesList: SeriesItem[];
  publishedPosts: Post[];
  myPosts: Post[];
  allPostsForAdmin: Post[];
  livestreams: Livestream[];
  activeLivestream: Livestream | null;
  collaborators: CollaboratorPublic[];
  loading: boolean;
  isDark: boolean;
  toggleDark: () => void;
  fontSize: FontSizeScale;
  setFontSize: (size: FontSizeScale) => void;
  readingMode: boolean;
  setReadingMode: (val: boolean) => void;
  currentPath: string;
  navigate: (path: string) => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export const SiteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, isAdmin, isActiveCollaborator } = useAuth();

  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG as SiteConfig);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES as Category[]);
  const [seriesList, setSeriesList] = useState<SeriesItem[]>([]);
  const [publishedPosts, setPublishedPosts] = useState<Post[]>([]);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [allPostsForAdmin, setAllPostsForAdmin] = useState<Post[]>([]);
  const [livestreams, setLivestreams] = useState<Livestream[]>([]);
  const [collaborators, setCollaborators] = useState<CollaboratorPublic[]>([]);
  const [loading, setLoading] = useState(true);

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('revista_theme') === 'dark';
  });
  const [fontSize, setFontSizeState] = useState<FontSizeScale>(() => {
    if (typeof window === 'undefined') return 'md';
    return (localStorage.getItem('revista_font_size') as FontSizeScale) || 'md';
  });
  const [readingMode, setReadingMode] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname + window.location.search;
  });

  const navigate = useCallback((path: string) => {
    if (typeof window === 'undefined') return;
    if (path !== window.location.pathname + window.location.search) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPop = () => setCurrentPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Theme & CSS variables sync
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('revista_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('revista_theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--editorial-primary', siteConfig.primaryColor || '#B91C1C');
    root.style.setProperty('--editorial-accent', siteConfig.accentColor || '#991B1B');
    document.title = `${siteConfig.siteName} – Periodismo Independiente y Crítico`;
    updateDynamicAppIcons(siteConfig.logoUrl, siteConfig.siteName, siteConfig.primaryColor);
  }, [siteConfig.primaryColor, siteConfig.accentColor, siteConfig.siteName, siteConfig.logoUrl]);

  const setFontSize = (size: FontSizeScale) => {
    setFontSizeState(size);
    localStorage.setItem('revista_font_size', size);
  };

  // Public real-time Firestore listeners (zero fictional fallback data)
  useEffect(() => {
    let configSettled = false;
    let postsSettled = false;

    const markReadyIfSettled = () => {
      if (configSettled && postsSettled) {
        setLoading(false);
      }
    };

    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    const unsubConfig = onSnapshot(
      doc(db, 'site_config', 'main'),
      (snap) => {
        if (snap.exists()) {
          setSiteConfig({ ...DEFAULT_SITE_CONFIG, ...(snap.data() as Partial<SiteConfig>) });
        } else {
          setSiteConfig(DEFAULT_SITE_CONFIG as SiteConfig);
        }
        configSettled = true;
        markReadyIfSettled();
      },
      (err) => {
        console.warn('site_config listener:', err);
        configSettled = true;
        markReadyIfSettled();
      }
    );

    const unsubCats = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => d.data() as Category).sort((a, b) => a.order - b.order);
          setCategories(list);
        }
      },
      (err) => console.warn('categories listener:', err)
    );

    const unsubSeries = onSnapshot(
      collection(db, 'series'),
      (snap) => {
        setSeriesList(snap.docs.map((d) => d.data() as SeriesItem));
      },
      (err) => console.warn('series listener:', err)
    );

    const unsubPosts = onSnapshot(
      query(collection(db, 'posts'), where('status', '==', 'published')),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Post)
          .sort((a, b) => toDate(b.publishedAt || b.createdAt).getTime() - toDate(a.publishedAt || a.createdAt).getTime());
        setPublishedPosts(list);
        postsSettled = true;
        markReadyIfSettled();
      },
      (err) => {
        console.warn('published posts listener:', err);
        postsSettled = true;
        markReadyIfSettled();
      }
    );

    const unsubStreams = onSnapshot(
      collection(db, 'livestreams'),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Livestream)
          .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
        setLivestreams(list);
      },
      (err) => console.warn('livestreams listener:', err)
    );

    const unsubCollabs = onSnapshot(
      query(collection(db, 'collaborators_public'), where('status', '==', 'active')),
      (snap) => {
        setCollaborators(snap.docs.map((d) => d.data() as CollaboratorPublic));
      },
      (err) => console.warn('collaborators listener:', err)
    );

    return () => {
      clearTimeout(safetyTimer);
      unsubConfig();
      unsubCats();
      unsubSeries();
      unsubPosts();
      unsubStreams();
      unsubCollabs();
    };
  }, []);

  // Author's own posts listener
  useEffect(() => {
    if (!firebaseUser) {
      setMyPosts([]);
      return;
    }
    const q = query(collection(db, 'posts'), where('authorId', '==', firebaseUser.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Post)
          .sort((a, b) => toDate(b.updatedAt || b.createdAt).getTime() - toDate(a.updatedAt || a.createdAt).getTime());
        setMyPosts(list);
      },
      (err) => console.warn('myPosts listener:', err)
    );
    return () => unsub();
  }, [firebaseUser]);

  // Admin full posts listener
  useEffect(() => {
    if (!isAdmin) {
      setAllPostsForAdmin([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'posts'),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as Post)
          .sort((a, b) => toDate(b.updatedAt || b.createdAt).getTime() - toDate(a.updatedAt || a.createdAt).getTime());
        setAllPostsForAdmin(list);
      },
      (err) => console.warn('admin posts listener:', err)
    );
    return () => unsub();
  }, [isAdmin]);

  // Promote overdue scheduled posts when Admin or authorized Collaborator is online
  useEffect(() => {
    if (!firebaseUser) return;
    const checkScheduled = () => {
      const now = Date.now();
      const candidates = isAdmin
        ? allPostsForAdmin
        : isActiveCollaborator && siteConfig.autoPublishCollaborators
        ? myPosts
        : [];

      for (const p of candidates) {
        if (p.status === 'scheduled' && p.scheduledFor && toDate(p.scheduledFor).getTime() <= now) {
          updateDoc(doc(db, 'posts', p.id), {
            status: 'published',
            publishedAt: p.publishedAt || serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch(() => undefined);
        }
      }
    };
    checkScheduled();
    const timer = setInterval(checkScheduled, 60000);
    return () => clearInterval(timer);
  }, [firebaseUser, isAdmin, isActiveCollaborator, siteConfig.autoPublishCollaborators, allPostsForAdmin, myPosts]);

  const activeLivestream = useMemo(
    () => livestreams.find((s) => s.status === 'live') || null,
    [livestreams]
  );

  return (
    <SiteContext.Provider
      value={{
        siteConfig,
        categories,
        seriesList,
        publishedPosts,
        myPosts,
        allPostsForAdmin,
        livestreams,
        activeLivestream,
        collaborators,
        loading,
        isDark,
        toggleDark: () => setIsDark((d) => !d),
        fontSize,
        setFontSize,
        readingMode,
        setReadingMode,
        currentPath,
        navigate,
        authModalOpen,
        setAuthModalOpen,
      }}
    >
      {children}
    </SiteContext.Provider>
  );
};

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite debe usarse dentro de SiteProvider');
  return ctx;
}
