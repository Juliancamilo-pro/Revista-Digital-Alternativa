import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  CopyPlus,
  Eye,
  EyeOff,
  HeartHandshake,
  Layers,
  Megaphone,
  Palette,
  Plus,
  PowerOff,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
  DEFAULT_THEME_BANNER,
  DEFAULT_THEME_SCHEDULE,
  DEFAULT_THEME_SETTINGS,
  PRESET_THEMES,
  getAllThemes,
  getColombiaMonthDay,
  resolveActiveTheme,
  sanitizeCustomThemes,
  sanitizeThemeBanner,
  sanitizeThemeMode,
  sanitizeThemeSchedule,
  sanitizeThemeSettings,
} from '../../themes';
import {
  EditorialThemeDefinition,
  SiteConfig,
  ThemeCategory,
  ThemeFooterStyle,
  ThemeGarlandStyle,
  ThemeIntensity,
  ThemeLayerSettings,
  ThemeLogoAccentStyle,
  ThemeMode,
  ThemeOrnamentId,
  ThemeParticleType,
  ThemeScheduleEntry,
  ThemeSpeed,
} from '../../types/editorial';
import { ThemeOrnament } from '../themes/ThemeOrnaments';

interface ThemesTabProps {
  cfgDraft: SiteConfig;
  setCfgDraft: React.Dispatch<React.SetStateAction<SiteConfig>>;
  onSaveConfig: (next: SiteConfig, msg: string, logAction: string) => Promise<void>;
}

const CATEGORY_LABELS: Array<{ id: 'all' | ThemeCategory; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'navidad', label: 'Navidad' },
  { id: 'cultural', label: 'Cultura' },
  { id: 'patria', label: 'Patria' },
  { id: 'conmemoracion', label: 'Conmemoración' },
  { id: 'temporada', label: 'Temporada' },
  { id: 'personalizado', label: 'Personalizados' },
];

const PARTICLE_OPTIONS: Array<{ value: ThemeParticleType; label: string }> = [
  { value: 'none', label: 'Sin partículas' },
  { value: 'snow', label: 'Nieve suave' },
  { value: 'heavy_snow', label: 'Nevada continua' },
  { value: 'sparks', label: 'Chispas cálidas' },
  { value: 'stars', label: 'Estrellas titilantes' },
  { value: 'confetti', label: 'Confeti tricolor / festivo' },
  { value: 'fireworks_confetti', label: 'Confeti + destellos' },
  { value: 'bats', label: 'Murciélagos nocturnos' },
  { value: 'hearts', label: 'Corazones flotantes' },
  { value: 'butterflies_petals', label: 'Pétalos y brillos folclóricos' },
  { value: 'petals', label: 'Pétalos florales' },
  { value: 'ink_sparks', label: 'Motas de tinta editorial' },
];

const GARLAND_OPTIONS: Array<{ value: ThemeGarlandStyle; label: string }> = [
  { value: 'none', label: 'Sin guirnalda' },
  { value: 'lights', label: 'Luces navideñas' },
  { value: 'lanterns', label: 'Faroles cálidos' },
  { value: 'stars', label: 'Estrellas' },
  { value: 'sparkles', label: 'Destellos dorados' },
  { value: 'bunting', label: 'Banderines tricolor' },
  { value: 'papel_picado', label: 'Papel picado festivo' },
  { value: 'floral', label: 'Guirnalda floral' },
  { value: 'mourning', label: 'Cinta sobria de luto' },
];

const LOGO_ACCENT_OPTIONS: Array<{ value: ThemeLogoAccentStyle; label: string }> = [
  { value: 'none', label: 'Sin adorno en logotipo' },
  { value: 'santa_hat', label: 'Gorro navideño' },
  { value: 'candle', label: 'Velita' },
  { value: 'star', label: 'Estrella' },
  { value: 'hat_tolima', label: 'Sombrero tolimense' },
  { value: 'laurel', label: 'Cinta tricolor' },
  { value: 'flower', label: 'Flor' },
  { value: 'ribbon_bow', label: 'Lazo festivo' },
  { value: 'quill', label: 'Pluma periodística' },
  { value: 'snowflake', label: 'Copo de nieve' },
  { value: 'mourning_ribbon', label: 'Lazo negro de duelo' },
];

const ORNAMENT_OPTIONS: Array<{ value: ThemeOrnamentId | 'none'; label: string }> = [
  { value: 'none', label: 'Ninguno' },
  { value: 'bell', label: 'Campana' },
  { value: 'bauble', label: 'Esfera navideña' },
  { value: 'star', label: 'Estrella' },
  { value: 'bethlehem_star', label: 'Estrella de Belén' },
  { value: 'pine', label: 'Pino navideño' },
  { value: 'gift', label: 'Regalo' },
  { value: 'holly', label: 'Muérdago' },
  { value: 'candle', label: 'Velita' },
  { value: 'lantern', label: 'Farol' },
  { value: 'snowflake', label: 'Copo de nieve' },
  { value: 'frost', label: 'Escarcha' },
  { value: 'heart', label: 'Corazón' },
  { value: 'flower', label: 'Flor' },
  { value: 'ribbon', label: 'Lazo' },
  { value: 'pumpkin', label: 'Calabaza' },
  { value: 'bat', label: 'Murciélago' },
  { value: 'web', label: 'Telaraña' },
  { value: 'butterfly', label: 'Mariposa' },
  { value: 'sombrero', label: 'Sombrero tolimense' },
  { value: 'tiple', label: 'Tiple' },
  { value: 'papel_picado', label: 'Papel picado' },
  { value: 'pennant', label: 'Banderín tricolor' },
  { value: 'tricolor_ribbon', label: 'Cinta tricolor' },
  { value: 'quill', label: 'Pluma' },
  { value: 'typewriter', label: 'Máquina de escribir' },
  { value: 'firework', label: 'Fuego artificial' },
  { value: 'champagne', label: 'Copa celebración' },
  { value: 'mourning_ribbon', label: 'Lazo negro de duelo' },
];

const FOOTER_OPTIONS: Array<{ value: ThemeFooterStyle; label: string }> = [
  { value: 'none', label: 'Estándar sin silueta' },
  { value: 'pines', label: 'Silueta de pinos' },
  { value: 'candles', label: 'Velitas en horizonte' },
  { value: 'tolima_peaks', label: 'Cordillera y nevados del Tolima' },
  { value: 'floral_vine', label: 'Borde floral' },
  { value: 'skyline', label: 'Silueta nocturna' },
  { value: 'confetti_wave', label: 'Onda festiva' },
  { value: 'lace', label: 'Encaje editorial' },
  { value: 'mourning_bar', label: 'Franja de luto' },
];

const LAYER_LABELS: Array<{ key: keyof ThemeLayerSettings; label: string; desc: string }> = [
  { key: 'particles', label: 'Partículas ambientales', desc: 'Nieve, pétalos, chispas o confeti en canvas ligero (≤ 30 fps).' },
  { key: 'garland', label: 'Guirnalda en cabecera', desc: 'Luces, faroles, banderines o papel picado bajo la barra superior.' },
  { key: 'corners', label: 'Adornos en esquinas y tarjetas', desc: 'Detalles simétricos en portada y notas destacadas.' },
  { key: 'dividers', label: 'Separadores e íconos de títulos', desc: 'Viñetas SVG junto a encabezados y entre secciones.' },
  { key: 'banner', label: 'Banner de saludo superior', desc: 'Mensaje editorial descartable con cuenta regresiva opcional.' },
  { key: 'footer', label: 'Silueta en pie de página', desc: 'Remate horizontal sobre el pie de página.' },
  { key: 'logo', label: 'Detalle sobre el logotipo', desc: 'Gorro navideño, sombrero tolimense, pluma o lazo en la marca.' },
  { key: 'hoverEffects', label: 'Brillo sutil en tarjetas', desc: 'Halo de color temático al pasar el cursor en notas.' },
];

export const ThemesTab: React.FC<ThemesTabProps> = ({ cfgDraft, setCfgDraft, onSaveConfig }) => {
  const {
    activeTheme,
    themeSource,
    matchedSchedule,
    previewThemeId,
    setPreviewThemeId,
    setPreviewSettingsOverride,
    setPreviewBannerOverride,
    isPreviewing,
  } = useTheme();

  const [categoryFilter, setCategoryFilter] = useState<'all' | ThemeCategory>('all');
  const [saving, setSaving] = useState(false);
  const [customEditor, setCustomEditor] = useState<EditorialThemeDefinition | null>(null);

  const themeMode = sanitizeThemeMode(cfgDraft.themeMode);
  const themeSettings = useMemo(
    () => sanitizeThemeSettings(cfgDraft.themeSettings),
    [cfgDraft.themeSettings]
  );
  const themeSchedule = useMemo(
    () => sanitizeThemeSchedule(cfgDraft.themeSchedule),
    [cfgDraft.themeSchedule]
  );
  const customThemes = useMemo(
    () => sanitizeCustomThemes(cfgDraft.customThemes),
    [cfgDraft.customThemes]
  );
  const themeBanner = useMemo(
    () => sanitizeThemeBanner(cfgDraft.themeBanner),
    [cfgDraft.themeBanner]
  );
  const allThemes = useMemo(() => getAllThemes(customThemes), [customThemes]);

  const draftResolved = useMemo(
    () => resolveActiveTheme(cfgDraft, null),
    [cfgDraft]
  );

  const settingsJson = useMemo(() => JSON.stringify(themeSettings), [themeSettings]);
  const bannerJson = useMemo(() => JSON.stringify(themeBanner), [themeBanner]);
  const lastPreviewSyncRef = React.useRef<{
    previewing: boolean;
    settingsJson: string;
    bannerJson: string;
  }>({
    previewing: false,
    settingsJson: '',
    bannerJson: '',
  });

  // Sync live preview settings/banner when preview mode is active (idempotent ref guard prevents update loops)
  useEffect(() => {
    const prev = lastPreviewSyncRef.current;
    if (isPreviewing) {
      if (!prev.previewing || prev.settingsJson !== settingsJson) {
        setPreviewSettingsOverride(themeSettings);
      }
      if (!prev.previewing || prev.bannerJson !== bannerJson) {
        setPreviewBannerOverride(themeBanner);
      }
      lastPreviewSyncRef.current = {
        previewing: true,
        settingsJson,
        bannerJson,
      };
    } else if (prev.previewing) {
      setPreviewSettingsOverride(null);
      setPreviewBannerOverride(null);
      lastPreviewSyncRef.current = {
        previewing: false,
        settingsJson: '',
        bannerJson: '',
      };
    }
  }, [
    isPreviewing,
    settingsJson,
    bannerJson,
    themeSettings,
    themeBanner,
    setPreviewSettingsOverride,
    setPreviewBannerOverride,
  ]);

  // Clear temporary overrides on unmount (keep previewThemeId if admin intentionally explores HomePage!)
  useEffect(() => {
    return () => {
      setPreviewSettingsOverride(null);
      setPreviewBannerOverride(null);
    };
  }, [setPreviewSettingsOverride, setPreviewBannerOverride]);

  const updateThemeSettings = (patch: Partial<typeof themeSettings>) => {
    setCfgDraft((prev) => ({
      ...prev,
      themeSettings: {
        ...sanitizeThemeSettings(prev.themeSettings),
        ...patch,
      },
    }));
  };

  const updateLayer = (key: keyof ThemeLayerSettings, value: boolean) => {
    setCfgDraft((prev) => {
      const current = sanitizeThemeSettings(prev.themeSettings);
      return {
        ...prev,
        themeSettings: {
          ...current,
          layers: {
            ...current.layers,
            [key]: value,
          },
        },
      };
    });
  };

  const handleSaveAll = async (overrideDraft?: SiteConfig, customLog?: string, customMsg?: string) => {
    setSaving(true);
    try {
      const target = overrideDraft || cfgDraft;
      await onSaveConfig(
        target,
        customMsg || 'Tema y decoración publicados para toda la revista.',
        customLog ||
          `Tema actualizado (${target.themeMode || 'manual'} · ${target.activeThemeId || 'clasico'})`
      );
      setPreviewThemeId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleActivateThemeQuick = (theme: EditorialThemeDefinition) => {
    const nextDraft: SiteConfig = {
      ...cfgDraft,
      themeMode: 'manual',
      activeThemeId: theme.id,
      themeBanner:
        theme.id === 'clasico'
          ? { ...themeBanner, enabled: false }
          : themeBanner.text.trim()
          ? themeBanner
          : {
              ...themeBanner,
              text: theme.defaultBannerText || '',
              emoji: theme.defaultBannerEmoji || theme.emoji,
            },
    };
    setCfgDraft(nextDraft);
    setPreviewThemeId(theme.id);
  };

  const handleEmergencyMourning = async () => {
    const mourningTheme = allThemes.find((t) => t.id === 'duelo_luto') || PRESET_THEMES[0];
    const nextDraft: SiteConfig = {
      ...cfgDraft,
      themeMode: 'manual',
      activeThemeId: 'duelo_luto',
      themeSettings: {
        ...themeSettings,
        layers: {
          ...themeSettings.layers,
          particles: false,
          hoverEffects: false,
        },
      },
      themeBanner: {
        ...themeBanner,
        enabled: true,
        text: mourningTheme.defaultBannerText || 'Edición especial de duelo y memoria.',
        emoji: mourningTheme.defaultBannerEmoji || '🖤',
        countdownTarget: 'none',
      },
    };
    setCfgDraft(nextDraft);
    await handleSaveAll(
      nextDraft,
      'Activación rápida de modo Duelo / Luto',
      'Modo Duelo / Luto activado sin animaciones.'
    );
  };

  const handleEmergencyDisableAll = async () => {
    const nextDraft: SiteConfig = {
      ...cfgDraft,
      themeMode: 'off',
      activeThemeId: 'clasico',
      themeBanner: {
        ...themeBanner,
        enabled: false,
      },
    };
    setCfgDraft(nextDraft);
    await handleSaveAll(
      nextDraft,
      'Decoración de temporada desactivada (Clásico)',
      'Decoración desactivada: la revista volvió al diseño Clásico original.'
    );
  };

  const handleCloneToCustom = (base: EditorialThemeDefinition) => {
    if (!base.isCustom && customThemes.length >= 10) {
      return;
    }
    if (base.isCustom) {
      setCustomEditor({ ...base, palette: { light: { ...base.palette.light }, dark: { ...base.palette.dark } } });
      return;
    }
    const cloneId = `custom_${Date.now().toString(36)}`;
    setCustomEditor({
      ...base,
      id: cloneId,
      name: `${base.name} (Personalizado)`.slice(0, 60),
      category: 'personalizado',
      isCustom: true,
      basedOnThemeId: base.id,
      palette: {
        light: { ...base.palette.light },
        dark: { ...base.palette.dark },
      },
      ornaments: [...base.ornaments],
    });
  };

  const handleSaveCustomTheme = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEditor) return;
    const sanitizedList = sanitizeCustomThemes([
      ...customThemes.filter((t) => t.id !== customEditor.id),
      customEditor,
    ]);
    setCfgDraft((prev) => ({
      ...prev,
      customThemes: sanitizedList,
      activeThemeId: customEditor.id,
      themeMode: 'manual',
    }));
    setPreviewThemeId(customEditor.id);
    setCustomEditor(null);
  };

  const handleDeleteCustomTheme = (themeId: string) => {
    const nextCustom = customThemes.filter((t) => t.id !== themeId);
    setCfgDraft((prev) => ({
      ...prev,
      customThemes: nextCustom,
      activeThemeId: prev.activeThemeId === themeId ? 'clasico' : prev.activeThemeId,
    }));
    if (previewThemeId === themeId) setPreviewThemeId(null);
  };

  const visibleThemes = allThemes.filter(
    (t) => categoryFilter === 'all' || t.category === categoryFilter
  );

  const colombiaTodayMmDd = getColombiaMonthDay();

  return (
    <div className="space-y-8">
      {/* Cabecera de control y acciones rápidas */}
      <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-[var(--editorial-surface)] p-5 sm:p-6 space-y-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
              <Palette className="w-4 h-4" aria-hidden="true" />
              <span>Dirección de arte estacional</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight">
              Temas y decoración de la revista
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
              Cambia paletas, adornos SVG, partículas y saludos especiales sin alterar artículos ni accesibilidad. El tema <strong>Clásico</strong> mantiene el diseño original intacto.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={saving}
              onClick={handleEmergencyMourning}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-400 dark:border-neutral-600 bg-neutral-900 text-white hover:bg-neutral-800 font-display text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-60"
            >
              <HeartHandshake className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Activar Duelo / Luto</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleEmergencyDisableAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-red-600 text-xs font-display font-bold uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-60"
            >
              <PowerOff className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
              <span>Desactivar todo</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveAll()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer shadow-sm transition-colors disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{saving ? 'Publicando...' : 'Publicar cambios'}</span>
            </button>
          </div>
        </div>

        {/* Estado actual y selector de modo */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-7 flex flex-wrap items-center gap-2">
            {(
              [
                ['manual', 'Manual (elijo el tema)'],
                ['auto', `Automático por calendario (hoy ${colombiaTodayMmDd})`],
                ['off', 'Desactivado (solo Clásico)'],
              ] as Array<[ThemeMode, string]>
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setCfgDraft((prev) => ({ ...prev, themeMode: m }))}
                className={`px-3.5 py-2 rounded-full text-xs font-display font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                  themeMode === m
                    ? 'bg-[#111111] text-white border-[#111111] dark:bg-white dark:text-black dark:border-white'
                    : 'border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="lg:col-span-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-black/[0.03] dark:bg-white/[0.03] px-4 py-2.5 text-xs flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-display font-bold uppercase tracking-wider text-neutral-500">
                {isPreviewing ? 'Previsualizando ahora' : 'Tema según configuración actual'}
              </p>
              <p className="font-display text-sm font-extrabold uppercase truncate">
                {isPreviewing ? `${activeTheme.emoji} ${activeTheme.name}` : `${draftResolved.theme.emoji} ${draftResolved.theme.name}`}
              </p>
              {themeSource === 'auto' && matchedSchedule && (
                <p className="text-[11px] text-neutral-500 truncate">
                  Regla calendario: {matchedSchedule.label || matchedSchedule.themeId}
                </p>
              )}
            </div>
            {isPreviewing && (
              <button
                type="button"
                onClick={() => setPreviewThemeId(null)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-neutral-400 dark:border-neutral-600 text-[11px] font-display font-bold uppercase cursor-pointer shrink-0"
              >
                <EyeOff className="w-3 h-3" aria-hidden="true" />
                <span>Salir vista previa</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Catálogo visual de temas */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-extrabold uppercase tracking-tight">
              Catálogo de temas ({allThemes.length})
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Previsualiza cualquier tema antes de guardarlo o duplica uno existente para crear tu propia paleta personalizada ({customThemes.length}/10).
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs font-display font-bold uppercase">
            {CATEGORY_LABELS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1 rounded-full border cursor-pointer transition-colors ${
                  categoryFilter === cat.id
                    ? 'bg-[var(--editorial-primary)] text-white border-[var(--editorial-primary)]'
                    : 'border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleThemes.map((theme) => {
            const isSelected = (cfgDraft.activeThemeId || 'clasico') === theme.id && themeMode !== 'off';
            const isPreviewed = previewThemeId === theme.id;
            const previewOrnament =
              theme.headingOrnament !== 'none'
                ? theme.headingOrnament
                : theme.cornerOrnament !== 'none'
                ? theme.cornerOrnament
                : theme.ornaments[0] || null;

            return (
              <article
                key={theme.id}
                className={`rounded-2xl border p-4 flex flex-col justify-between gap-4 transition-all ${
                  isSelected
                    ? 'border-[var(--editorial-primary)] ring-2 ring-[var(--editorial-primary)]/25 bg-[var(--editorial-surface)] shadow-md'
                    : 'border-neutral-300 dark:border-neutral-800 bg-[var(--editorial-surface)]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span aria-hidden="true" className="text-lg leading-none">
                          {theme.emoji}
                        </span>
                        <h4 className="font-display text-lg font-extrabold uppercase tracking-tight leading-tight">
                          {theme.name}
                        </h4>
                      </div>
                      <p className="text-[11px] font-display font-bold uppercase tracking-wider text-neutral-500 mt-0.5">
                        {theme.category}
                        {theme.defaultStartMonthDay && theme.defaultEndMonthDay
                          ? ` · ${theme.defaultStartMonthDay} al ${theme.defaultEndMonthDay}`
                          : ''}
                      </p>
                    </div>
                    {previewOrnament && (
                      <div className="w-9 h-9 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-center shrink-0 bg-black/[0.02] dark:bg-white/[0.02]">
                        <ThemeOrnament id={previewOrnament} size="sm" />
                      </div>
                    )}
                  </div>

                  {/* Muestras de paleta claro y oscuro */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-display font-bold uppercase">
                    <div
                      className="rounded-xl p-2 border border-neutral-300/80 flex items-center justify-between gap-1"
                      style={{ backgroundColor: theme.palette.light.paper, color: theme.palette.light.ink }}
                    >
                      <span>Claro</span>
                      <span className="flex items-center gap-1">
                        <span className="w-3.5 h-3.5 rounded-full border border-black/15" style={{ backgroundColor: theme.palette.light.primary }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-black/15" style={{ backgroundColor: theme.palette.light.accent }} />
                      </span>
                    </div>
                    <div
                      className="rounded-xl p-2 border border-neutral-700 flex items-center justify-between gap-1"
                      style={{ backgroundColor: theme.palette.dark.paper, color: theme.palette.dark.ink }}
                    >
                      <span>Oscuro</span>
                      <span className="flex items-center gap-1">
                        <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: theme.palette.dark.primary }} />
                        <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: theme.palette.dark.accent }} />
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {theme.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-800 text-xs font-display font-bold uppercase">
                  <button
                    type="button"
                    onClick={() => handleActivateThemeQuick(theme)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--editorial-primary)] text-white'
                        : 'bg-[#111111] dark:bg-white text-white dark:text-black hover:opacity-90'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" aria-hidden="true" />}
                    <span>{isSelected ? 'Elegido' : 'Activar'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewThemeId(isPreviewed ? null : theme.id)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                      isPreviewed
                        ? 'border-[var(--editorial-primary)] text-[var(--editorial-primary)] bg-[var(--editorial-primary)]/10'
                        : 'border-neutral-300 dark:border-neutral-700 hover:border-black dark:hover:border-white'
                    }`}
                  >
                    {isPreviewed ? <EyeOff className="w-3 h-3" aria-hidden="true" /> : <Eye className="w-3 h-3" aria-hidden="true" />}
                    <span>{isPreviewed ? 'Quitar vista' : 'Previsualizar'}</span>
                  </button>

                  {(theme.isCustom || customThemes.length < 10) && (
                    <button
                      type="button"
                      onClick={() => handleCloneToCustom(theme)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 hover:border-[var(--editorial-primary)] cursor-pointer transition-colors"
                    >
                      <CopyPlus className="w-3 h-3" aria-hidden="true" />
                      <span>{theme.isCustom ? 'Editar' : 'Personalizar'}</span>
                    </button>
                  )}

                  {theme.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomTheme(theme.id)}
                      aria-label={`Eliminar tema personalizado ${theme.name}`}
                      className="p-1.5 rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Editor inline de tema personalizado */}
      {customEditor && (
        <form
          onSubmit={handleSaveCustomTheme}
          className="rounded-2xl border-2 border-[var(--editorial-primary)] bg-[var(--editorial-surface)] p-6 space-y-5 shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
            <h3 className="font-display text-xl font-extrabold uppercase flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
              <span>Editor de tema personalizado</span>
            </h3>
            <button
              type="button"
              onClick={() => setCustomEditor(null)}
              className="text-xs font-display font-bold uppercase text-neutral-500 hover:text-black dark:hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-display text-xs font-bold uppercase mb-1">Nombre del tema</label>
              <input
                type="text"
                required
                maxLength={60}
                value={customEditor.name}
                onChange={(e) => setCustomEditor({ ...customEditor, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] text-sm"
              />
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Emoji</label>
              <input
                type="text"
                maxLength={12}
                value={customEditor.emoji}
                onChange={(e) => setCustomEditor({ ...customEditor, emoji: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] text-sm"
              />
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Partículas</label>
              <select
                value={customEditor.particleType}
                onChange={(e) => setCustomEditor({ ...customEditor, particleType: e.target.value as ThemeParticleType })}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] text-xs"
              >
                {PARTICLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-display text-xs font-bold uppercase mb-1">Descripción breve</label>
            <input
              type="text"
              maxLength={160}
              value={customEditor.description}
              onChange={(e) => setCustomEditor({ ...customEditor, description: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] text-sm"
            />
          </div>

          {/* Paletas claro y oscuro */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(['light', 'dark'] as const).map((modeKey) => (
              <div key={modeKey} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
                <h4 className="font-display text-xs font-extrabold uppercase tracking-wider">
                  Paleta {modeKey === 'light' ? 'Modo Claro' : 'Modo Oscuro'}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  {(
                    [
                      ['primary', 'Primario'],
                      ['accent', 'Acento'],
                      ['paper', 'Fondo papel'],
                      ['surface', 'Superficie tarjetas'],
                      ['ink', 'Texto principal'],
                      ['muted', 'Texto secundario'],
                    ] as const
                  ).map(([tokenKey, tokenLabel]) => (
                    <label key={tokenKey} className="space-y-1">
                      <span className="block font-display text-[11px] font-bold uppercase text-neutral-500">
                        {tokenLabel}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={customEditor.palette[modeKey][tokenKey].startsWith('#') ? customEditor.palette[modeKey][tokenKey] : '#B91C1C'}
                          onChange={(e) =>
                            setCustomEditor({
                              ...customEditor,
                              palette: {
                                ...customEditor.palette,
                                [modeKey]: {
                                  ...customEditor.palette[modeKey],
                                  [tokenKey]: e.target.value.toUpperCase(),
                                },
                              },
                            })
                          }
                          className="w-9 h-8 rounded border border-neutral-300 cursor-pointer shrink-0"
                        />
                        <span className="font-mono text-[10px] truncate">{customEditor.palette[modeKey][tokenKey]}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Capas SVG del tema personalizado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block font-display text-[11px] font-bold uppercase mb-1">Guirnalda</label>
              <select
                value={customEditor.garlandStyle}
                onChange={(e) => setCustomEditor({ ...customEditor, garlandStyle: e.target.value as ThemeGarlandStyle })}
                className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] text-xs"
              >
                {GARLAND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-display text-[11px] font-bold uppercase mb-1">Logo</label>
              <select
                value={customEditor.logoAccent}
                onChange={(e) => setCustomEditor({ ...customEditor, logoAccent: e.target.value as ThemeLogoAccentStyle })}
                className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] text-xs"
              >
                {LOGO_ACCENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-display text-[11px] font-bold uppercase mb-1">Esquinas</label>
              <select
                value={customEditor.cornerOrnament}
                onChange={(e) => setCustomEditor({ ...customEditor, cornerOrnament: e.target.value as ThemeOrnamentId | 'none' })}
                className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] text-xs"
              >
                {ORNAMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-display text-[11px] font-bold uppercase mb-1">Separadores</label>
              <select
                value={customEditor.dividerOrnament}
                onChange={(e) => setCustomEditor({ ...customEditor, dividerOrnament: e.target.value as ThemeOrnamentId | 'none' })}
                className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] text-xs"
              >
                {ORNAMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-display text-[11px] font-bold uppercase mb-1">Ícono títulos</label>
              <select
                value={customEditor.headingOrnament}
                onChange={(e) => setCustomEditor({ ...customEditor, headingOrnament: e.target.value as ThemeOrnamentId | 'none' })}
                className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] text-xs"
              >
                {ORNAMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-display text-[11px] font-bold uppercase mb-1">Pie de página</label>
              <select
                value={customEditor.footerStyle}
                onChange={(e) => setCustomEditor({ ...customEditor, footerStyle: e.target.value as ThemeFooterStyle })}
                className="w-full px-2.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] text-xs"
              >
                {FOOTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(customEditor.hoverGlow)}
                onChange={(e) => setCustomEditor({ ...customEditor, hoverGlow: e.target.checked })}
              />
              <span>Activar brillo sutil al pasar el cursor</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(customEditor.disableAnimations)}
                onChange={(e) => setCustomEditor({ ...customEditor, disableAnimations: e.target.checked })}
              />
              <span>Estático (desactivar todas las animaciones)</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="px-5 py-2 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Guardar en borrador y previsualizar
            </button>
          </div>
        </form>
      )}

      {/* Controles de intensidad, capas y banner de saludo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-[var(--editorial-surface)] p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
            <Layers className="w-4 h-4 text-[var(--editorial-primary)]" aria-hidden="true" />
            <h3 className="font-display text-lg font-extrabold uppercase tracking-tight">
              Intensidad y capas decorativas
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1.5">Intensidad de partículas</label>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-display font-bold uppercase">
                {(['sutil', 'normal', 'festivo'] as ThemeIntensity[]).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => updateThemeSettings({ intensity: val })}
                    className={`py-2 rounded-xl border cursor-pointer ${
                      themeSettings.intensity === val
                        ? 'bg-[var(--editorial-primary)] text-white border-[var(--editorial-primary)]'
                        : 'border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1.5">Velocidad de movimiento</label>
              <div className="grid grid-cols-2 gap-1.5 text-xs font-display font-bold uppercase">
                {(['lenta', 'normal'] as ThemeSpeed[]).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => updateThemeSettings({ speed: val })}
                    className={`py-2 rounded-xl border cursor-pointer ${
                      themeSettings.speed === val
                        ? 'bg-[var(--editorial-primary)] text-white border-[var(--editorial-primary)]'
                        : 'border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
            <label className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={themeSettings.showOnMobile}
                onChange={(e) => updateThemeSettings({ showOnMobile: e.target.checked })}
                className="mt-0.5"
              />
              <span>
                <strong className="block font-display uppercase">Mostrar adornos en celulares</strong>
                <span className="text-neutral-500">En móvil mantiene un tope máximo de 18 partículas.</span>
              </span>
            </label>

            <label className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={themeSettings.calmInArticles}
                onChange={(e) => updateThemeSettings({ calmInArticles: e.target.checked })}
                className="mt-0.5"
              />
              <span>
                <strong className="block font-display uppercase">Lectura serena en artículos</strong>
                <span className="text-neutral-500">Oculta partículas y guirnaldas dentro de las notas para no distraer.</span>
              </span>
            </label>
          </div>

          <div className="space-y-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-neutral-500">
              Activar o apagar cada capa
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {LAYER_LABELS.map((item) => (
                <label
                  key={item.key}
                  className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-2.5 flex items-start gap-2 cursor-pointer hover:border-neutral-400"
                >
                  <input
                    type="checkbox"
                    checked={themeSettings.layers[item.key]}
                    onChange={(e) => updateLayer(item.key, e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <strong className="block font-display uppercase text-[11px]">{item.label}</strong>
                    <span className="text-[11px] text-neutral-500 leading-snug block">{item.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Banner de saludo editorial */}
        <section className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-[var(--editorial-surface)] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[var(--editorial-primary)]" aria-hidden="true" />
              <h3 className="font-display text-lg font-extrabold uppercase tracking-tight">
                Banner de saludo editorial
              </h3>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase cursor-pointer">
              <input
                type="checkbox"
                checked={themeBanner.enabled}
                onChange={(e) =>
                  setCfgDraft((prev) => ({
                    ...prev,
                    themeBanner: { ...themeBanner, enabled: e.target.checked },
                  }))
                }
              />
              <span>Visible</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Emoji</label>
              <input
                type="text"
                maxLength={16}
                value={themeBanner.emoji || ''}
                placeholder={draftResolved.theme.emoji}
                onChange={(e) =>
                  setCfgDraft((prev) => ({
                    ...prev,
                    themeBanner: { ...themeBanner, emoji: e.target.value },
                  }))
                }
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] text-sm"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block font-display text-xs font-bold uppercase mb-1">Cuenta regresiva (opcional)</label>
              <select
                value={themeBanner.countdownTarget || 'none'}
                onChange={(e) =>
                  setCfgDraft((prev) => ({
                    ...prev,
                    themeBanner: {
                      ...themeBanner,
                      countdownTarget: e.target.value as 'none' | 'christmas' | 'new_year',
                    },
                  }))
                }
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] text-xs"
              >
                <option value="none">Sin cuenta regresiva</option>
                <option value="christmas">Días para Navidad (25 de diciembre)</option>
                <option value="new_year">Días para Año Nuevo (1 de enero)</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-display text-xs font-bold uppercase">Mensaje de saludo (máx. 180)</label>
              {draftResolved.theme.defaultBannerText && (
                <button
                  type="button"
                  onClick={() =>
                    setCfgDraft((prev) => ({
                      ...prev,
                      themeBanner: {
                        ...themeBanner,
                        enabled: true,
                        text: draftResolved.theme.defaultBannerText || '',
                        emoji: draftResolved.theme.defaultBannerEmoji || draftResolved.theme.emoji,
                      },
                    }))
                  }
                  className="text-[11px] font-display font-bold uppercase text-[var(--editorial-primary)] hover:underline cursor-pointer"
                >
                  Usar saludo sugerido del tema
                </button>
              )}
            </div>
            <textarea
              rows={2}
              maxLength={180}
              value={themeBanner.text}
              placeholder="Ej: Felices fiestas desde el Tolima. Gracias por leer periodismo independiente."
              onChange={(e) =>
                setCfgDraft((prev) => ({
                  ...prev,
                  themeBanner: { ...themeBanner, text: e.target.value },
                }))
              }
              className="w-full p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Texto de botón (opcional)</label>
              <input
                type="text"
                maxLength={48}
                value={themeBanner.ctaLabel || ''}
                placeholder="Ej: Especial Tolima"
                onChange={(e) =>
                  setCfgDraft((prev) => ({
                    ...prev,
                    themeBanner: { ...themeBanner, ctaLabel: e.target.value },
                  }))
                }
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] text-xs"
              />
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Ruta de destino (/...)</label>
              <input
                type="text"
                maxLength={160}
                value={themeBanner.ctaPath || ''}
                placeholder="/tolima"
                onChange={(e) =>
                  setCfgDraft((prev) => ({
                    ...prev,
                    themeBanner: { ...themeBanner, ctaPath: e.target.value },
                  }))
                }
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] text-xs"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Calendario editorial editable */}
      <section className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-[var(--editorial-surface)] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <div>
            <h3 className="font-display text-xl font-extrabold uppercase tracking-tight flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-[var(--editorial-primary)]" aria-hidden="true" />
              <span>Calendario automático de fiestas y eventos ({themeSchedule.length}/30)</span>
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Usa formato <code className="font-mono">MM-DD</code> (zona horaria Colombia). Si dos rangos coinciden, gana la prioridad más alta.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCfgDraft((prev) => ({
                  ...prev,
                  themeSchedule: DEFAULT_THEME_SCHEDULE.map((s) => ({ ...s })),
                }))
              }
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Restablecer calendario</span>
            </button>
            {themeSchedule.length < 30 && (
              <button
                type="button"
                onClick={() =>
                  setCfgDraft((prev) => ({
                    ...prev,
                    themeSchedule: [
                      ...themeSchedule,
                      {
                        id: `sched_${Date.now().toString(36)}`,
                        themeId: 'clasico',
                        label: 'Nueva fecha especial',
                        startMonthDay: '12-01',
                        endMonthDay: '12-31',
                        enabled: true,
                        priority: 20,
                      },
                    ],
                  }))
                }
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black text-xs font-display font-bold uppercase cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Agregar fecha</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-200 dark:border-neutral-800 font-display uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="py-2 pr-3">Activo</th>
                <th className="py-2 pr-3">Celebración</th>
                <th className="py-2 pr-3">Tema asignado</th>
                <th className="py-2 pr-3">Inicio (MM-DD)</th>
                <th className="py-2 pr-3">Fin (MM-DD)</th>
                <th className="py-2 pr-3">Prioridad</th>
                <th className="py-2 text-right">Quitar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {themeSchedule.map((entry, idx) => {
                const updateEntry = (patch: Partial<ThemeScheduleEntry>) => {
                  const next = themeSchedule.map((item, i) => (i === idx ? { ...item, ...patch } : item));
                  setCfgDraft((prev) => ({ ...prev, themeSchedule: next }));
                };
                return (
                  <tr key={entry.id}>
                    <td className="py-2.5 pr-3">
                      <input
                        type="checkbox"
                        aria-label={`Activar ${entry.label || entry.themeId}`}
                        checked={entry.enabled}
                        onChange={(e) => updateEntry({ enabled: e.target.checked })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        maxLength={80}
                        value={entry.label || ''}
                        onChange={(e) => updateEntry({ label: e.target.value })}
                        className="w-full min-w-[160px] px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)]"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        value={entry.themeId}
                        onChange={(e) => updateEntry({ themeId: e.target.value })}
                        className="px-2.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)]"
                      >
                        {allThemes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.emoji} {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        maxLength={5}
                        placeholder="12-01"
                        value={entry.startMonthDay}
                        onChange={(e) => updateEntry({ startMonthDay: e.target.value })}
                        className="w-20 px-2 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] font-mono"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        maxLength={5}
                        placeholder="01-06"
                        value={entry.endMonthDay}
                        onChange={(e) => updateEntry({ endMonthDay: e.target.value })}
                        className="w-20 px-2 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] font-mono"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={entry.priority ?? 10}
                        onChange={(e) => updateEntry({ priority: Number(e.target.value) || 0 })}
                        className="w-16 px-2 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-[var(--editorial-paper)] font-mono"
                      />
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setCfgDraft((prev) => ({
                            ...prev,
                            themeSchedule: themeSchedule.filter((_, i) => i !== idx),
                          }))
                        }
                        aria-label={`Eliminar fecha ${entry.label || entry.id}`}
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveAll()}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{saving ? 'Publicando...' : 'Publicar temas y calendario'}</span>
          </button>
        </div>
      </section>
    </div>
  );
};
