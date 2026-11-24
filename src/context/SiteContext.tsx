import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { maybeNotifyNewPost } from '../lib/notifications';
import { loadFeedCache, saveFeedCache } from '../lib/offlineCache';
import { isTimestampLike } from '../lib/postValidation';
import { DEFAULT_ADMIN_IDENTITIES, DEFAULT_CATEGORIES, DEFAULT_HOMEPAGE_SECTIONS, DEFAULT_SITE_CONFIG, DEFAULT_SITE_UI_TEXTS, sanitizeSiteUiTexts } from '../lib/seedData';
import {
  sanitizeCustomThemes,
  sanitizeThemeBanner,
  sanitizeThemeMode,
  sanitizeThemeSchedule,
  sanitizeThemeSettings,
} from '../themes/registry';
import { toDate, updateDynamicAppIcons } from '../lib/utils';
import { AdminPublicIdentity, Category, CollaboratorPublic, HomepageSectionConfig, Post, SeriesItem, SiteConfig } from '../types/editorial';
import { useAuth } from './AuthContext';

export type FontSizeScale = 'sm' | 'md' | 'lg' | 'xl';

interface SiteContextValue {
  siteConfig: SiteConfig;
  categories: Category[];
  seriesList: SeriesItem[];
  publishedPosts: Post[];
  hasMorePublishedPosts: boolean;
  loadMorePublishedPosts: () => void;
  myPosts: Post[];
  allPostsForAdmin: Post[];
  collaborators: CollaboratorPublic[];
  activeCollaboratorIds: Set<string>;
  adminIdentities: Record<'owner' | 'magazine', AdminPublicIdentity>;
  isAuthorVerified: (
    authorId?: string,
    identityType?: string,
    legacyFlag?: boolean,
    authorName?: string
  ) => boolean;
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

function normalizeHomepageSections(sections?: HomepageSectionConfig[]): HomepageSectionConfig[] {
  if (!Array.isArray(sections) || sections.length === 0) return DEFAULT_HOMEPAGE_SECTIONS;
  const cleaned = sections.filter((s) => s.type !== 'live');
  if (!cleaned.some((s) => s.type === 'collaborators')) {
    const feedIdx = cleaned.findIndex((s) => s.type === 'categories_feed');
    const collabItem: HomepageSectionConfig = {
      id: 'sec_collaborators',
      type: 'collaborators',
      title: 'Conozcan a nuestros colaboradores',
      enabled: true,
      order: feedIdx >= 0 ? feedIdx : cleaned.length,
    };
    if (feedIdx >= 0) cleaned.splice(feedIdx, 0, collabItem);
    else cleaned.push(collabItem);
  }
  return cleaned.sort((a, b) => a.order - b.order);
}

export const SiteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, isAdmin, isActiveCollaborator } = useAuth();

  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_SITE_CONFIG as SiteConfig);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES as Category[]);
  const [seriesList, setSeriesList] = useState<SeriesItem[]>([]);
  const [publishedPosts, setPublishedPosts] = useState<Post[]>(() => loadFeedCache());
  const [postsLimit, setPostsLimit] = useState(24);
  const [hasMorePublishedPosts, setHasMorePublishedPosts] = useState(false);
  const [useOrderedPostsQuery, setUseOrderedPostsQuery] = useState(() => {
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem('revista_posts_unordered_fallback') !== '1';
  });
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [allPostsForAdmin, setAllPostsForAdmin] = useState<Post[]>([]);
  const [collaborators, setCollaborators] = useState<CollaboratorPublic[]>([]);
  const [adminIdentities, setAdminIdentities] = useState<Record<'owner' | 'magazine', AdminPublicIdentity>>({
    owner: { ...DEFAULT_ADMIN_IDENTITIES.owner },
    magazine: { ...DEFAULT_ADMIN_IDENTITIES.magazine },
  });
  const [loading, setLoading] = useState<boolean>(() => loadFeedCache().length === 0);
  const siteNameRef = useRef<string>(DEFAULT_SITE_CONFIG.siteName);

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
    siteNameRef.current = siteConfig.siteName;
    document.title = `${siteConfig.siteName} – Periodismo Independiente y Crítico`;
    updateDynamicAppIcons(siteConfig.logoUrl, siteConfig.siteName, siteConfig.primaryColor);
  }, [siteConfig.primaryColor, siteConfig.siteName, siteConfig.logoUrl]);

  const setFontSize = useCallback((size: FontSizeScale) => {
    setFontSizeState(size);
    try {
      localStorage.setItem('revista_font_size', size);
    } catch {
      // Ignore storage restrictions
    }
  }, []);

  const toggleDark = useCallback(() => {
    setIsDark((d) => !d);
  }, []);

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2200);

    const unsubConfig = onSnapshot(
      doc(db, 'site_config', 'main'),
      (snap) => {
        if (snap.exists()) {
          const raw = snap.data() as Partial<SiteConfig>;
          setSiteConfig({
            ...DEFAULT_SITE_CONFIG,
            ...raw,
            uiTexts: sanitizeSiteUiTexts({ ...DEFAULT_SITE_UI_TEXTS, ...(raw.uiTexts || {}) }),
            homepageSections: normalizeHomepageSections(raw.homepageSections),
            activeThemeId: raw.activeThemeId || 'clasico',
            themeMode: sanitizeThemeMode(raw.themeMode),
            themeSettings: sanitizeThemeSettings(raw.themeSettings),
            themeSchedule: sanitizeThemeSchedule(raw.themeSchedule),
            customThemes: sanitizeCustomThemes(raw.customThemes),
            themeBanner: sanitizeThemeBanner(raw.themeBanner),
          });
        } else {
          setSiteConfig(DEFAULT_SITE_CONFIG as SiteConfig);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('site_config listener:', err);
        setLoading(false);
      }
    );

    const unsubCats = onSnapshot(
      collection(db, 'categories'),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs
            .map((d) => d.data() as Category)
            .filter((c) => c.slug !== 'en-vivo')
            .sort((a, b) => a.order - b.order);
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

    const unsubCollabs = onSnapshot(
      query(collection(db, 'collaborators_public'), where('status', '==', 'active')),
      (snap) => {
        setCollaborators(snap.docs.map((d) => d.data() as CollaboratorPublic));
      },
      (err) => console.warn('collaborators listener:', err)
    );

    const unsubAdminIds = onSnapshot(
      collection(db, 'admin_identities'),
      (snap) => {
        const next: Record<'owner' | 'magazine', AdminPublicIdentity> = {
          owner: { ...DEFAULT_ADMIN_IDENTITIES.owner },
          magazine: { ...DEFAULT_ADMIN_IDENTITIES.magazine },
        };
        snap.docs.forEach((d) => {
          const item = d.data() as AdminPublicIdentity;
          if (d.id === 'owner') next.owner = { ...next.owner, ...item };
          if (d.id === 'magazine') next.magazine = { ...next.magazine, ...item };
        });
        setAdminIdentities(next);
      },
      (err) => console.warn('admin_identities listener:', err)
    );

    return () => {
      clearTimeout(safetyTimer);
      unsubConfig();
      unsubCats();
      unsubSeries();
      unsubCollabs();
      unsubAdminIds();
    };
  }, []);

  useEffect(() => {
    const baseQuery = useOrderedPostsQuery
      ? query(
          collection(db, 'posts'),
          where('status', '==', 'published'),
          orderBy('publishedAt', 'desc'),
          limit(postsLimit + 1)
        )
      : query(collection(db, 'posts'), where('status', '==', 'published'), limit(postsLimit + 1));

    const unsubPosts = onSnapshot(
      baseQuery,
      (snap) => {
        const hasMore = snap.docs.length > postsLimit;
        setHasMorePublishedPosts(hasMore);
        const list = snap.docs
          .slice(0, postsLimit)
          .map((d) => d.data() as Post)
          .sort((a, b) => toDate(b.publishedAt || b.createdAt).getTime() - toDate(a.publishedAt || a.createdAt).getTime());
        setPublishedPosts(list);
        saveFeedCache(list);
        if (list[0]) {
          void maybeNotifyNewPost(list[0], siteNameRef.current);
        }
        setLoading(false);
      },
      (err) => {
        const code = (err as { code?: string })?.code || '';
        if (useOrderedPostsQuery && (code === 'failed-precondition' || String(err).toLowerCase().includes('index'))) {
          try {
            sessionStorage.setItem('revista_posts_unordered_fallback', '1');
          } catch {
            // Ignore restricted storage
          }
          setUseOrderedPostsQuery(false);
          return;
        }
        console.warn('published posts listener:', err);
        setLoading(false);
      }
    );

    return () => unsubPosts();
  }, [postsLimit, useOrderedPostsQuery]);

  const loadMorePublishedPosts = useCallback(() => {
    setPostsLimit((prev) => prev + 24);
  }, []);

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
          const safePublishedAt = p.publishedAt
            ? isTimestampLike(p.publishedAt)
              ? p.publishedAt
              : Timestamp.fromDate(toDate(p.publishedAt))
            : serverTimestamp();
          updateDoc(doc(db, 'posts', p.id), {
            status: 'published',
            publishedAt: safePublishedAt,
            updatedAt: serverTimestamp(),
          }).catch(() => undefined);
        }
      }
    };
    checkScheduled();
    const timer = setInterval(checkScheduled, 60000);
    return () => clearInterval(timer);
  }, [firebaseUser, isAdmin, isActiveCollaborator, siteConfig.autoPublishCollaborators, allPostsForAdmin, myPosts]);

  const activeCollaboratorIds = useMemo(
    () => new Set(collaborators.filter((c) => c.status === 'active').map((c) => c.uid)),
    [collaborators]
  );

  const allCollaboratorIds = useMemo(
    () => new Set(collaborators.map((c) => c.uid)),
    [collaborators]
  );

  const isAuthorVerified = useCallback(
    (authorId?: string, identityType?: string, legacyFlag?: boolean, authorName?: string) => {
      if (authorId === 'owner' || authorId === 'magazine') return true;
      if (authorId && activeCollaboratorIds.has(authorId)) return true;
      // Si el UID figura en colaboradores pero no está activo, está suspendido -> sin insignia
      if (authorId && allCollaboratorIds.has(authorId)) return false;
      if (identityType === 'owner' || identityType === 'magazine') return true;
      if (legacyFlag) return true;
      const trimmedName = (authorName || '').trim().toLowerCase();
      if (trimmedName) {
        const adminNames = [
          siteConfig.siteName,
          adminIdentities.owner?.name,
          adminIdentities.magazine?.name,
        ]
          .filter(Boolean)
          .map((n) => n.trim().toLowerCase());
        if (adminNames.includes(trimmedName)) return true;
      }
      return false;
    },
    [activeCollaboratorIds, allCollaboratorIds, siteConfig.siteName, adminIdentities]
  );

  const contextValue = useMemo<SiteContextValue>(
    () => ({
      siteConfig,
      categories,
      seriesList,
      publishedPosts,
      hasMorePublishedPosts,
      loadMorePublishedPosts,
      myPosts,
      allPostsForAdmin,
      collaborators,
      activeCollaboratorIds,
      adminIdentities,
      isAuthorVerified,
      loading,
      isDark,
      toggleDark,
      fontSize,
      setFontSize,
      readingMode,
      setReadingMode,
      currentPath,
      navigate,
      authModalOpen,
      setAuthModalOpen,
    }),
    [
      siteConfig,
      categories,
      seriesList,
      publishedPosts,
      hasMorePublishedPosts,
      loadMorePublishedPosts,
      myPosts,
      allPostsForAdmin,
      collaborators,
      activeCollaboratorIds,
      adminIdentities,
      isAuthorVerified,
      loading,
      isDark,
      toggleDark,
      fontSize,
      setFontSize,
      readingMode,
      currentPath,
      navigate,
      authModalOpen,
    ]
  );

  return <SiteContext.Provider value={contextValue}>{children}</SiteContext.Provider>;
};

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite debe usarse dentro de SiteProvider');
  return ctx;
}
