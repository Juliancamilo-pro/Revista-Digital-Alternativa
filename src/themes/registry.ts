import type {
  EditorialThemeDefinition,
  SiteConfig,
  ThemeBannerConfig,
  ThemeColorTokens,
  ThemeFooterStyle,
  ThemeGarlandStyle,
  ThemeLayerSettings,
  ThemeLogoAccentStyle,
  ThemeMode,
  ThemeOrnamentId,
  ThemeParticleType,
  ThemeScheduleEntry,
  ThemeSettings,
} from '../types/editorial';
import { CLASICO_THEME, PRESET_THEMES } from './presets';

function sanitizePlainUiText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export const THEME_CACHE_STORAGE_KEY = 'revista_active_theme_cache_v1';

export const DEFAULT_THEME_LAYER_SETTINGS: ThemeLayerSettings = {
  particles: true,
  garland: true,
  corners: true,
  dividers: true,
  banner: true,
  footer: true,
  logo: true,
  hoverEffects: true,
};

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  intensity: 'normal',
  speed: 'normal',
  showOnMobile: true,
  calmInArticles: true,
  layers: { ...DEFAULT_THEME_LAYER_SETTINGS },
};

export const DEFAULT_THEME_BANNER: ThemeBannerConfig = {
  enabled: false,
  text: '',
  emoji: '',
  ctaLabel: '',
  ctaPath: '',
  countdownTarget: 'none',
};

export const DEFAULT_THEME_SCHEDULE: ThemeScheduleEntry[] = [
  {
    id: 'sched_invierno',
    themeId: 'invierno_blanco',
    label: 'Invierno blanco',
    startMonthDay: '01-07',
    endMonthDay: '01-31',
    enabled: true,
    priority: 10,
  },
  {
    id: 'sched_periodista',
    themeId: 'dia_periodista',
    label: 'Día del Periodista',
    startMonthDay: '02-03',
    endMonthDay: '02-10',
    enabled: true,
    priority: 20,
  },
  {
    id: 'sched_madre_padre',
    themeId: 'madre_padre',
    label: 'Mes de las Madres',
    startMonthDay: '05-01',
    endMonthDay: '05-31',
    enabled: true,
    priority: 15,
  },
  {
    id: 'sched_padre_junio',
    themeId: 'madre_padre',
    label: 'Día del Padre',
    startMonthDay: '06-10',
    endMonthDay: '06-14',
    enabled: false,
    priority: 18,
  },
  {
    id: 'sched_tolima',
    themeId: 'festival_tolima',
    label: 'Festival Folclórico del Tolima',
    startMonthDay: '06-15',
    endMonthDay: '06-30',
    enabled: true,
    priority: 25,
  },
  {
    id: 'sched_patria_julio',
    themeId: 'fiestas_patrias',
    label: '20 de Julio – Independencia',
    startMonthDay: '07-19',
    endMonthDay: '07-21',
    enabled: true,
    priority: 30,
  },
  {
    id: 'sched_patria_agosto',
    themeId: 'fiestas_patrias',
    label: '7 de Agosto – Batalla de Boyacá',
    startMonthDay: '08-06',
    endMonthDay: '08-08',
    enabled: true,
    priority: 30,
  },
  {
    id: 'sched_amor_amistad',
    themeId: 'amor_amistad',
    label: 'Amor y Amistad',
    startMonthDay: '09-01',
    endMonthDay: '09-30',
    enabled: true,
    priority: 15,
  },
  {
    id: 'sched_halloween',
    themeId: 'halloween',
    label: 'Halloween y Día de los Niños',
    startMonthDay: '10-25',
    endMonthDay: '11-02',
    enabled: true,
    priority: 25,
  },
  {
    id: 'sched_navidad',
    themeId: 'navidad_clasica',
    label: 'Navidad clásica',
    startMonthDay: '12-01',
    endMonthDay: '01-06',
    enabled: true,
    priority: 10,
  },
  {
    id: 'sched_velitas',
    themeId: 'dia_velitas',
    label: 'Día de las Velitas',
    startMonthDay: '12-07',
    endMonthDay: '12-08',
    enabled: true,
    priority: 40,
  },
  {
    id: 'sched_novenas',
    themeId: 'novenas_aguinaldos',
    label: 'Novenas de Aguinaldos',
    startMonthDay: '12-16',
    endMonthDay: '12-24',
    enabled: true,
    priority: 35,
  },
  {
    id: 'sched_anio_nuevo',
    themeId: 'anio_nuevo',
    label: 'Año Nuevo',
    startMonthDay: '12-28',
    endMonthDay: '01-02',
    enabled: true,
    priority: 45,
  },
];

const VALID_THEME_MODES = new Set<ThemeMode>(['manual', 'auto', 'off']);
const VALID_PARTICLES = new Set<ThemeParticleType>([
  'none',
  'snow',
  'heavy_snow',
  'confetti',
  'sparks',
  'stars',
  'fireworks_confetti',
  'bats',
  'hearts',
  'butterflies_petals',
  'petals',
  'ink_sparks',
]);
const VALID_GARLANDS = new Set<ThemeGarlandStyle>([
  'none',
  'lights',
  'lanterns',
  'stars',
  'sparkles',
  'bunting',
  'papel_picado',
  'floral',
  'mourning',
]);
const VALID_LOGO_ACCENTS = new Set<ThemeLogoAccentStyle>([
  'none',
  'santa_hat',
  'candle',
  'star',
  'laurel',
  'flower',
  'ribbon_bow',
  'hat_tolima',
  'quill',
  'snowflake',
  'mourning_ribbon',
]);
const VALID_FOOTER_STYLES = new Set<ThemeFooterStyle>([
  'none',
  'pines',
  'candles',
  'skyline',
  'tolima_peaks',
  'confetti_wave',
  'floral_vine',
  'lace',
  'mourning_bar',
]);
const VALID_ORNAMENTS = new Set<ThemeOrnamentId>([
  'bell',
  'bauble',
  'star',
  'bethlehem_star',
  'pine',
  'gift',
  'holly',
  'candle',
  'lantern',
  'candy_cane',
  'snowflake',
  'heart',
  'balloon',
  'pumpkin',
  'bat',
  'ghost',
  'web',
  'flower',
  'butterfly',
  'sombrero',
  'tiple',
  'papel_picado',
  'quill',
  'typewriter',
  'inkwell',
  'pennant',
  'tricolor_ribbon',
  'firework',
  'champagne',
  'mourning_ribbon',
  'frost',
  'ribbon',
]);

export function sanitizeHexOrColor(val: unknown, fallback: string): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return trimmed.toUpperCase();
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(\s*,\s*(0|1|0?\.\d+))?\s*\)$/.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

export function sanitizeMonthDay(val: unknown, fallback = '01-01'): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  const match = /^(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return fallback;
  const m = Number(match[1]);
  const d = Number(match[2]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return fallback;
  return trimmed;
}

export function sanitizeThemeMode(val: unknown): ThemeMode {
  if (typeof val === 'string' && VALID_THEME_MODES.has(val as ThemeMode)) {
    return val as ThemeMode;
  }
  return 'manual';
}

export function sanitizeThemeSettings(raw?: Partial<ThemeSettings> | null): ThemeSettings {
  const intensity =
    raw?.intensity === 'sutil' || raw?.intensity === 'festivo' ? raw.intensity : 'normal';
  const speed = raw?.speed === 'lenta' ? 'lenta' : 'normal';
  const layersRaw = raw?.layers || ({} as Partial<ThemeLayerSettings>);
  return {
    intensity,
    speed,
    showOnMobile: raw?.showOnMobile !== undefined ? Boolean(raw.showOnMobile) : true,
    calmInArticles: raw?.calmInArticles !== undefined ? Boolean(raw.calmInArticles) : true,
    layers: {
      particles: layersRaw.particles !== undefined ? Boolean(layersRaw.particles) : true,
      garland: layersRaw.garland !== undefined ? Boolean(layersRaw.garland) : true,
      corners: layersRaw.corners !== undefined ? Boolean(layersRaw.corners) : true,
      dividers: layersRaw.dividers !== undefined ? Boolean(layersRaw.dividers) : true,
      banner: layersRaw.banner !== undefined ? Boolean(layersRaw.banner) : true,
      footer: layersRaw.footer !== undefined ? Boolean(layersRaw.footer) : true,
      logo: layersRaw.logo !== undefined ? Boolean(layersRaw.logo) : true,
      hoverEffects: layersRaw.hoverEffects !== undefined ? Boolean(layersRaw.hoverEffects) : true,
    },
  };
}

export function sanitizeThemeSchedule(raw?: unknown): ThemeScheduleEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_THEME_SCHEDULE.map((s) => ({ ...s }));
  }
  return raw
    .slice(0, 30)
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, idx) => ({
      id: sanitizePlainUiText(item.id, 64).replace(/[^a-zA-Z0-9_-]/g, '') || `sched_${idx}`,
      themeId: sanitizePlainUiText(item.themeId, 64).replace(/[^a-zA-Z0-9_-]/g, '') || 'clasico',
      label: sanitizePlainUiText(item.label, 80) || 'Evento editorial',
      startMonthDay: sanitizeMonthDay(item.startMonthDay, '12-01'),
      endMonthDay: sanitizeMonthDay(item.endMonthDay, '12-31'),
      enabled: Boolean(item.enabled),
      priority: typeof item.priority === 'number' && Number.isFinite(item.priority) ? Math.min(100, Math.max(0, Math.round(item.priority))) : 10,
    }));
}

function sanitizePaletteTokens(raw: unknown, fallback: ThemeColorTokens): ThemeColorTokens {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    primary: sanitizeHexOrColor(src.primary, fallback.primary),
    accent: sanitizeHexOrColor(src.accent, fallback.accent),
    paper: sanitizeHexOrColor(src.paper, fallback.paper),
    ink: sanitizeHexOrColor(src.ink, fallback.ink),
    surface: sanitizeHexOrColor(src.surface, fallback.surface),
    muted: sanitizeHexOrColor(src.muted, fallback.muted),
    glow: sanitizeHexOrColor(src.glow, fallback.glow),
    border: sanitizeHexOrColor(src.border, fallback.border),
  };
}

export function sanitizeCustomThemes(raw?: unknown): EditorialThemeDefinition[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 10)
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, idx) => {
      const baseId = sanitizePlainUiText(item.basedOnThemeId, 64).replace(/[^a-zA-Z0-9_-]/g, '');
      const base = PRESET_THEMES.find((t) => t.id === baseId) || CLASICO_THEME;
      const cleanId =
        sanitizePlainUiText(item.id, 64).replace(/[^a-zA-Z0-9_-]/g, '') || `custom_${idx + 1}`;
      const paletteRaw =
        item.palette && typeof item.palette === 'object'
          ? (item.palette as Record<string, unknown>)
          : {};
      const ornamentsRaw = Array.isArray(item.ornaments) ? item.ornaments : base.ornaments;
      const ornaments = ornamentsRaw
        .filter((o): o is ThemeOrnamentId => typeof o === 'string' && VALID_ORNAMENTS.has(o as ThemeOrnamentId))
        .slice(0, 10);

      const safeCorner =
        typeof item.cornerOrnament === 'string' && (item.cornerOrnament === 'none' || VALID_ORNAMENTS.has(item.cornerOrnament as ThemeOrnamentId))
          ? (item.cornerOrnament as ThemeOrnamentId | 'none')
          : base.cornerOrnament;
      const safeDivider =
        typeof item.dividerOrnament === 'string' && (item.dividerOrnament === 'none' || VALID_ORNAMENTS.has(item.dividerOrnament as ThemeOrnamentId))
          ? (item.dividerOrnament as ThemeOrnamentId | 'none')
          : base.dividerOrnament;
      const safeHeading =
        typeof item.headingOrnament === 'string' && (item.headingOrnament === 'none' || VALID_ORNAMENTS.has(item.headingOrnament as ThemeOrnamentId))
          ? (item.headingOrnament as ThemeOrnamentId | 'none')
          : base.headingOrnament;

      return {
        id: cleanId.startsWith('custom_') ? cleanId : `custom_${cleanId}`.slice(0, 64),
        name: sanitizePlainUiText(item.name, 60) || 'Tema personalizado',
        emoji: sanitizePlainUiText(item.emoji, 12) || base.emoji || '✨',
        category: 'personalizado',
        description: sanitizePlainUiText(item.description, 160) || base.description,
        palette: {
          light: sanitizePaletteTokens(paletteRaw.light, base.palette.light),
          dark: sanitizePaletteTokens(paletteRaw.dark, base.palette.dark),
        },
        particleType:
          typeof item.particleType === 'string' && VALID_PARTICLES.has(item.particleType as ThemeParticleType)
            ? (item.particleType as ThemeParticleType)
            : base.particleType,
        ornaments: ornaments.length > 0 ? ornaments : base.ornaments,
        garlandStyle:
          typeof item.garlandStyle === 'string' && VALID_GARLANDS.has(item.garlandStyle as ThemeGarlandStyle)
            ? (item.garlandStyle as ThemeGarlandStyle)
            : base.garlandStyle,
        cornerOrnament: safeCorner,
        dividerOrnament: safeDivider,
        headingOrnament: safeHeading,
        logoAccent:
          typeof item.logoAccent === 'string' && VALID_LOGO_ACCENTS.has(item.logoAccent as ThemeLogoAccentStyle)
            ? (item.logoAccent as ThemeLogoAccentStyle)
            : base.logoAccent,
        footerStyle:
          typeof item.footerStyle === 'string' && VALID_FOOTER_STYLES.has(item.footerStyle as ThemeFooterStyle)
            ? (item.footerStyle as ThemeFooterStyle)
            : base.footerStyle,
        defaultBannerText: sanitizePlainUiText(item.defaultBannerText, 180) || base.defaultBannerText || '',
        defaultBannerEmoji: sanitizePlainUiText(item.defaultBannerEmoji, 16) || base.defaultBannerEmoji || '',
        hoverGlow: item.hoverGlow !== undefined ? Boolean(item.hoverGlow) : Boolean(base.hoverGlow),
        disableAnimations: Boolean(item.disableAnimations),
        isCustom: true,
        basedOnThemeId: base.id,
      };
    });
}

export function sanitizeThemeBanner(raw?: Partial<ThemeBannerConfig> | null): ThemeBannerConfig {
  const countdownTarget =
    raw?.countdownTarget === 'christmas' || raw?.countdownTarget === 'new_year'
      ? raw.countdownTarget
      : 'none';
  const rawCtaPath = typeof raw?.ctaPath === 'string' ? raw.ctaPath.trim().slice(0, 160) : '';
  const safeCtaPath = rawCtaPath.startsWith('/') ? rawCtaPath : '';

  return {
    enabled: Boolean(raw?.enabled),
    text: sanitizePlainUiText(raw?.text, 180),
    emoji: sanitizePlainUiText(raw?.emoji, 16),
    ctaLabel: sanitizePlainUiText(raw?.ctaLabel, 48),
    ctaPath: safeCtaPath,
    countdownTarget,
  };
}

export function getAllThemes(customThemes?: EditorialThemeDefinition[]): EditorialThemeDefinition[] {
  const safeCustom = sanitizeCustomThemes(customThemes);
  return [...PRESET_THEMES, ...safeCustom];
}

export function getColombiaMonthDay(now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const m = parts.find((p) => p.type === 'month')?.value || '01';
    const d = parts.find((p) => p.type === 'day')?.value || '01';
    return `${m}-${d}`;
  } catch {
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${m}-${d}`;
  }
}

export function isMonthDayInRange(mmdd: string, start: string, end: string): boolean {
  if (start <= end) {
    return mmdd >= start && mmdd <= end;
  }
  // Rango que cruza fin de año (ej. 12-01 a 01-06)
  return mmdd >= start || mmdd <= end;
}

export function getCountdownDaysColombia(target: 'christmas' | 'new_year' | 'none' | undefined, now = new Date()): { days: number; label: string } | null {
  if (!target || target === 'none') return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(now);
    const year = Number(parts.find((p) => p.type === 'year')?.value || now.getFullYear());
    const month = Number(parts.find((p) => p.type === 'month')?.value || now.getMonth() + 1);
    const day = Number(parts.find((p) => p.type === 'day')?.value || now.getDate());
    const todayUtc = Date.UTC(year, month - 1, day);

    if (target === 'christmas') {
      let targetYear = year;
      if (month === 12 && day > 25) targetYear = year + 1;
      const targetUtc = Date.UTC(targetYear, 11, 25);
      const diff = Math.round((targetUtc - todayUtc) / 86400000);
      if (diff === 0) return { days: 0, label: 'Hoy es Navidad' };
      return { days: diff, label: diff === 1 ? 'Falta 1 día para Navidad' : `Faltan ${diff} días para Navidad` };
    }

    const nextYearUtc = Date.UTC(year + 1, 0, 1);
    const diffNewYear = Math.round((nextYearUtc - todayUtc) / 86400000);
    if (month === 1 && day === 1) return { days: 0, label: '¡Feliz Año Nuevo!' };
    return {
      days: diffNewYear,
      label: diffNewYear === 1 ? 'Falta 1 día para Año Nuevo' : `Faltan ${diffNewYear} días para Año Nuevo`,
    };
  } catch {
    return null;
  }
}

export function resolveActiveTheme(
  siteConfig: Partial<SiteConfig>,
  previewThemeId?: string | null,
  now = new Date()
): {
  theme: EditorialThemeDefinition;
  source: 'preview' | 'manual' | 'auto' | 'off';
  matchedSchedule: ThemeScheduleEntry | null;
} {
  const all = getAllThemes(siteConfig.customThemes);

  if (previewThemeId) {
    const previewMatch = all.find((t) => t.id === previewThemeId);
    if (previewMatch) {
      return { theme: previewMatch, source: 'preview', matchedSchedule: null };
    }
  }

  const mode = sanitizeThemeMode(siteConfig.themeMode);
  if (mode === 'off') {
    return { theme: CLASICO_THEME, source: 'off', matchedSchedule: null };
  }

  if (mode === 'auto') {
    const mmdd = getColombiaMonthDay(now);
    const schedule = sanitizeThemeSchedule(siteConfig.themeSchedule);
    const matches = schedule
      .filter((entry) => entry.enabled && isMonthDayInRange(mmdd, entry.startMonthDay, entry.endMonthDay))
      .sort((a, b) => (b.priority ?? 10) - (a.priority ?? 10));

    for (const match of matches) {
      const found = all.find((t) => t.id === match.themeId);
      if (found) {
        return { theme: found, source: 'auto', matchedSchedule: match };
      }
    }
    return { theme: CLASICO_THEME, source: 'auto', matchedSchedule: null };
  }

  const requestedId = siteConfig.activeThemeId || 'clasico';
  const manualMatch = all.find((t) => t.id === requestedId) || CLASICO_THEME;
  return { theme: manualMatch, source: 'manual', matchedSchedule: null };
}
