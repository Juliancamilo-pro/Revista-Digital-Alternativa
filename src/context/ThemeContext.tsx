import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  CLASICO_THEME,
  THEME_CACHE_STORAGE_KEY,
  getAllThemes,
  resolveActiveTheme,
  sanitizeThemeBanner,
  sanitizeThemeMode,
  sanitizeThemeSettings,
} from '../themes';
import {
  EditorialThemeDefinition,
  ThemeBannerConfig,
  ThemeMode,
  ThemeScheduleEntry,
  ThemeSettings,
} from '../types/editorial';
import { useDataSaver } from './DataSaverContext';
import { useSite } from './SiteContext';

interface ThemeContextValue {
  activeTheme: EditorialThemeDefinition;
  allThemes: EditorialThemeDefinition[];
  themeMode: ThemeMode;
  themeSource: 'preview' | 'manual' | 'auto' | 'off';
  matchedSchedule: ThemeScheduleEntry | null;
  themeSettings: ThemeSettings;
  themeBanner: ThemeBannerConfig;
  isDecorated: boolean;
  isCalmRoute: boolean;
  isMobileViewport: boolean;
  prefersReducedMotion: boolean;
  effectiveAnimationsEnabled: boolean;
  showParticles: boolean;
  showGarland: boolean;
  showCorners: boolean;
  showDividers: boolean;
  showBanner: boolean;
  showFooterDecoration: boolean;
  showLogoAccent: boolean;
  showHoverEffects: boolean;
  previewThemeId: string | null;
  setPreviewThemeId: (themeId: string | null) => void;
  isPreviewing: boolean;
  previewSettingsOverride: ThemeSettings | null;
  setPreviewSettingsOverride: (settings: ThemeSettings | null) => void;
  previewBannerOverride: ThemeBannerConfig | null;
  setPreviewBannerOverride: (banner: ThemeBannerConfig | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { siteConfig, isDark, currentPath, readingMode } = useSite();
  const { isDataSaverActive } = useDataSaver();

  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
  const [previewSettingsOverride, setPreviewSettingsOverrideState] = useState<ThemeSettings | null>(null);
  const [previewBannerOverride, setPreviewBannerOverrideState] = useState<ThemeBannerConfig | null>(null);

  const setPreviewSettingsOverride = useCallback((next: ThemeSettings | null) => {
    setPreviewSettingsOverrideState((prev) => {
      if (prev === next) return prev;
      if (prev === null || next === null) return next;
      try {
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      } catch {
        // Fallback to updating if serialization fails
      }
      return next;
    });
  }, []);

  const setPreviewBannerOverride = useCallback((next: ThemeBannerConfig | null) => {
    setPreviewBannerOverrideState((prev) => {
      if (prev === next) return prev;
      if (prev === null || next === null) return next;
      try {
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      } catch {
        // Fallback to updating if serialization fails
      }
      return next;
    });
  }, []);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMqChange = () => setPrefersReducedMotion(Boolean(mq?.matches));
    mq?.addEventListener?.('change', onMqChange);

    const onResize = () => setIsMobileViewport(window.innerWidth < 768);
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      mq?.removeEventListener?.('change', onMqChange);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const allThemes = useMemo(
    () => getAllThemes(siteConfig.customThemes),
    [siteConfig.customThemes]
  );

  const themeMode = useMemo(() => sanitizeThemeMode(siteConfig.themeMode), [siteConfig.themeMode]);

  const resolved = useMemo(
    () => resolveActiveTheme(siteConfig, previewThemeId),
    [siteConfig, previewThemeId]
  );

  const activeTheme = resolved.theme;

  const themeSettings = useMemo(
    () => sanitizeThemeSettings(previewSettingsOverride || siteConfig.themeSettings),
    [previewSettingsOverride, siteConfig.themeSettings]
  );

  const themeBanner = useMemo(
    () => sanitizeThemeBanner(previewBannerOverride || siteConfig.themeBanner),
    [previewBannerOverride, siteConfig.themeBanner]
  );

  const isDecorated = activeTheme.id !== 'clasico' && (resolved.source === 'preview' || themeMode !== 'off');

  const pathname = currentPath.split('?')[0].replace(/\/+$/, '') || '/';
  const isArticleRoute = pathname.startsWith('/articulo/');
  const isAdminOrEditorRoute =
    pathname.startsWith('/admin') || pathname.startsWith('/colaborador-panel');
  const isCalmRoute = Boolean(
    readingMode || (isArticleRoute && themeSettings.calmInArticles) || isAdminOrEditorRoute
  );

  // When themeMode is off or Clasico, keep user's siteConfig.primaryColor / accentColor intact
  const effectivePalette = useMemo(() => {
    const modeTokens = isDark ? activeTheme.palette.dark : activeTheme.palette.light;
    if (activeTheme.id === 'clasico' && siteConfig.primaryColor) {
      return {
        ...modeTokens,
        primary: siteConfig.primaryColor || CLASICO_THEME.palette.light.primary,
        accent: siteConfig.accentColor || CLASICO_THEME.palette.light.accent,
      };
    }
    return modeTokens;
  }, [activeTheme, isDark, siteConfig.primaryColor, siteConfig.accentColor]);

  // Apply data-theme & CSS variables on <html> and cache into localStorage for pre-paint script
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', activeTheme.id);
    root.style.setProperty('--editorial-primary', effectivePalette.primary);
    root.style.setProperty('--editorial-accent', effectivePalette.accent);
    root.style.setProperty('--editorial-paper', effectivePalette.paper);
    root.style.setProperty('--editorial-ink', effectivePalette.ink);
    root.style.setProperty('--editorial-surface', effectivePalette.surface);
    root.style.setProperty('--editorial-muted', effectivePalette.muted);
    root.style.setProperty('--editorial-glow', effectivePalette.glow);
    root.style.setProperty('--editorial-border', effectivePalette.border);

    if (!previewThemeId) {
      try {
        const lightTokens =
          activeTheme.id === 'clasico'
            ? {
                ...activeTheme.palette.light,
                primary: siteConfig.primaryColor || CLASICO_THEME.palette.light.primary,
                accent: siteConfig.accentColor || CLASICO_THEME.palette.light.accent,
              }
            : activeTheme.palette.light;
        const darkTokens =
          activeTheme.id === 'clasico'
            ? {
                ...activeTheme.palette.dark,
                primary: siteConfig.primaryColor || CLASICO_THEME.palette.dark.primary,
                accent: siteConfig.accentColor || CLASICO_THEME.palette.dark.accent,
              }
            : activeTheme.palette.dark;

        localStorage.setItem(
          THEME_CACHE_STORAGE_KEY,
          JSON.stringify({
            id: activeTheme.id,
            light: lightTokens,
            dark: darkTokens,
          })
        );
      } catch {
        // Storage unavailable
      }
    }
  }, [activeTheme, effectivePalette, previewThemeId, siteConfig.primaryColor, siteConfig.accentColor]);

  const effectiveAnimationsEnabled = Boolean(
    isDecorated &&
      !activeTheme.disableAnimations &&
      !prefersReducedMotion &&
      !isDataSaverActive
  );

  const mobileAllowed = !isMobileViewport || themeSettings.showOnMobile;
  const layers = themeSettings.layers;

  const showParticles = Boolean(
    isDecorated &&
      effectiveAnimationsEnabled &&
      activeTheme.particleType !== 'none' &&
      layers.particles &&
      mobileAllowed &&
      !isCalmRoute
  );

  const showGarland = Boolean(
    isDecorated &&
      activeTheme.garlandStyle !== 'none' &&
      layers.garland &&
      mobileAllowed &&
      !isCalmRoute
  );

  const showCorners = Boolean(
    isDecorated &&
      activeTheme.cornerOrnament !== 'none' &&
      layers.corners &&
      mobileAllowed &&
      !isCalmRoute
  );

  const showDividers = Boolean(
    isDecorated &&
      activeTheme.dividerOrnament !== 'none' &&
      layers.dividers &&
      !isCalmRoute
  );

  const showBanner = Boolean(
    isDecorated &&
      layers.banner &&
      themeBanner.enabled &&
      (themeBanner.text.trim().length > 0 || activeTheme.defaultBannerText) &&
      !readingMode &&
      !isAdminOrEditorRoute
  );

  const showFooterDecoration = Boolean(
    isDecorated &&
      activeTheme.footerStyle !== 'none' &&
      layers.footer &&
      !readingMode
  );

  const showLogoAccent = Boolean(
    isDecorated &&
      activeTheme.logoAccent !== 'none' &&
      layers.logo &&
      !readingMode
  );

  const showHoverEffects = Boolean(
    isDecorated &&
      activeTheme.hoverGlow &&
      layers.hoverEffects &&
      !prefersReducedMotion &&
      !isDataSaverActive
  );

  const resetPreview = useCallback(
    (nextId: string | null) => {
      setPreviewThemeId(nextId);
      if (!nextId) {
        setPreviewSettingsOverride(null);
        setPreviewBannerOverride(null);
      }
    },
    []
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      activeTheme,
      allThemes,
      themeMode,
      themeSource: resolved.source,
      matchedSchedule: resolved.matchedSchedule,
      themeSettings,
      themeBanner,
      isDecorated,
      isCalmRoute,
      isMobileViewport,
      prefersReducedMotion,
      effectiveAnimationsEnabled,
      showParticles,
      showGarland,
      showCorners,
      showDividers,
      showBanner,
      showFooterDecoration,
      showLogoAccent,
      showHoverEffects,
      previewThemeId,
      setPreviewThemeId: resetPreview,
      isPreviewing: Boolean(previewThemeId),
      previewSettingsOverride,
      setPreviewSettingsOverride,
      previewBannerOverride,
      setPreviewBannerOverride,
    }),
    [
      activeTheme,
      allThemes,
      themeMode,
      resolved.source,
      resolved.matchedSchedule,
      themeSettings,
      themeBanner,
      isDecorated,
      isCalmRoute,
      isMobileViewport,
      prefersReducedMotion,
      effectiveAnimationsEnabled,
      showParticles,
      showGarland,
      showCorners,
      showDividers,
      showBanner,
      showFooterDecoration,
      showLogoAccent,
      showHoverEffects,
      previewThemeId,
      resetPreview,
      previewSettingsOverride,
      setPreviewSettingsOverride,
      previewBannerOverride,
      setPreviewBannerOverride,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return ctx;
}
