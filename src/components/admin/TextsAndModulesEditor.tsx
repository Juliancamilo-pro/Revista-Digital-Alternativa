import React from 'react';
import { Eye, RotateCcw, Save } from 'lucide-react';
import { DEFAULT_HOMEPAGE_SECTIONS, DEFAULT_SITE_CONFIG, DEFAULT_SITE_UI_TEXTS, sanitizePlainUiText, sanitizeSiteUiTexts } from '../../lib/seedData';
import { HomepageSectionConfig, SiteConfig, SiteUiTexts } from '../../types/editorial';

interface TextsAndModulesEditorProps {
  cfgDraft: SiteConfig;
  setCfgDraft: React.Dispatch<React.SetStateAction<SiteConfig>>;
  onSave: (next: SiteConfig, msg: string, logAction: string) => void;
}

interface UiFieldMeta {
  key: keyof Required<SiteUiTexts>;
  label: string;
  max: number;
  multiline?: boolean;
  group: 'header' | 'home' | 'footer';
}

const UI_TEXT_FIELDS: UiFieldMeta[] = [
  { key: 'headerEditionBadge', label: 'Etiqueta de edición (cabecera)', max: 40, group: 'header' },
  { key: 'headerEditionNumber', label: 'Número de edición', max: 24, group: 'header' },
  { key: 'headerJoinCta', label: 'Enlace corto superior ("Colaborar")', max: 32, group: 'header' },

  { key: 'dailyStripLabel', label: 'Título columna "Edición del día"', max: 50, group: 'home' },
  { key: 'joinBannerKicker', label: 'Antetítulo tarjeta "Únete"', max: 60, group: 'home' },
  { key: 'joinBannerTitle', label: 'Titular tarjeta "Únete"', max: 90, group: 'home' },
  { key: 'joinBannerSubtitle', label: 'Descripción tarjeta "Únete"', max: 220, multiline: true, group: 'home' },
  { key: 'joinBannerCta', label: 'Botón CTA "Únete"', max: 48, group: 'home' },

  { key: 'footerAboutBlurb', label: 'Reseña institucional en pie de página', max: 240, multiline: true, group: 'footer' },
  { key: 'footerOriginLine', label: 'Lema territorial ("Hecho en el Tolima...")', max: 80, group: 'footer' },
  { key: 'footerSectionsTitle', label: 'Título columna Secciones', max: 40, group: 'footer' },
  { key: 'footerTransparencyTitle', label: 'Título columna Transparencia', max: 50, group: 'footer' },
  { key: 'footerNewsletterTitle', label: 'Título del boletín semanal', max: 50, group: 'footer' },
  { key: 'footerNewsletterSubtitle', label: 'Descripción del boletín', max: 200, multiline: true, group: 'footer' },
  { key: 'footerNewsletterCta', label: 'Texto botón suscripción boletín', max: 48, group: 'footer' },
  { key: 'footerCopyrightNote', label: 'Nota final de derechos de autor', max: 180, group: 'footer' },
];

export const TextsAndModulesEditor: React.FC<TextsAndModulesEditorProps> = ({
  cfgDraft,
  setCfgDraft,
  onSave,
}) => {
  const uiTexts = sanitizeSiteUiTexts(cfgDraft.uiTexts);

  const updateUiField = (key: keyof Required<SiteUiTexts>, rawValue: string) => {
    setCfgDraft((prev) => ({
      ...prev,
      uiTexts: {
        ...DEFAULT_SITE_UI_TEXTS,
        ...(prev.uiTexts || {}),
        [key]: rawValue,
      },
    }));
  };

  const restoreUiField = (key: keyof Required<SiteUiTexts>) => {
    updateUiField(key, DEFAULT_SITE_UI_TEXTS[key]);
  };

  const updateSectionField = (
    id: string,
    field: 'title' | 'subtitle' | 'ctaLabel',
    value: string
  ) => {
    setCfgDraft((prev) => ({
      ...prev,
      homepageSections: prev.homepageSections.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    }));
  };

  const restoreSectionDefaults = (sec: HomepageSectionConfig) => {
    const def = DEFAULT_HOMEPAGE_SECTIONS.find((d) => d.type === sec.type);
    if (!def) return;
    setCfgDraft((prev) => ({
      ...prev,
      homepageSections: prev.homepageSections.map((s) =>
        s.id === sec.id
          ? { ...s, title: def.title, subtitle: def.subtitle || '', ctaLabel: def.ctaLabel || '' }
          : s
      ),
    }));
  };

  const handleSaveTexts = () => {
    const cleanTagline = sanitizePlainUiText(cfgDraft.tagline, 240);
    const cleanUi = sanitizeSiteUiTexts(cfgDraft.uiTexts);
    const cleanSections = cfgDraft.homepageSections.map((s) => {
      const def = DEFAULT_HOMEPAGE_SECTIONS.find((d) => d.type === s.type);
      return {
        ...s,
        title: sanitizePlainUiText(s.title, 90) || def?.title || s.title,
        subtitle: sanitizePlainUiText(s.subtitle, 160),
        ctaLabel: sanitizePlainUiText(s.ctaLabel, 60),
      };
    });
    const nextCfg: SiteConfig = {
      ...cfgDraft,
      tagline: cleanTagline || DEFAULT_SITE_CONFIG.tagline,
      uiTexts: cleanUi,
      homepageSections: cleanSections,
    };
    setCfgDraft(nextCfg);
    onSave(
      nextCfg,
      'Textos editoriales y módulos de portada guardados (texto plano sanitizado).',
      'Textos y módulos de portada actualizados'
    );
  };

  const renderFieldGroup = (title: string, group: 'header' | 'home' | 'footer') => {
    const items = UI_TEXT_FIELDS.filter((f) => f.group === group);
    return (
      <div className="space-y-4">
        <h3 className="font-display text-sm font-extrabold uppercase tracking-wider text-[var(--editorial-primary)] border-b border-neutral-200 dark:border-neutral-800 pb-2">
          {title}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {group === 'header' && (
            <div className="md:col-span-2 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="font-display text-xs font-bold uppercase tracking-wide">
                  Subtítulo / Lema principal de la revista
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-tabular text-[11px] text-neutral-500">
                    {(cfgDraft.tagline || '').length} / 240
                  </span>
                  <button
                    type="button"
                    onClick={() => setCfgDraft((p) => ({ ...p, tagline: DEFAULT_SITE_CONFIG.tagline }))}
                    className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase text-neutral-600 dark:text-neutral-300 hover:text-[var(--editorial-primary)] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>Restaurar original</span>
                  </button>
                </div>
              </div>
              <input
                type="text"
                maxLength={240}
                value={cfgDraft.tagline || ''}
                onChange={(e) => setCfgDraft((p) => ({ ...p, tagline: e.target.value }))}
                className="w-full px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              />
            </div>
          )}

          {items.map((field) => {
            const val = (cfgDraft.uiTexts?.[field.key] ?? DEFAULT_SITE_UI_TEXTS[field.key]) || '';
            return (
              <div key={field.key} className={`space-y-1.5 ${field.multiline ? 'md:col-span-2' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <label className="font-display text-xs font-bold uppercase tracking-wide">
                    {field.label}
                  </label>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-tabular text-[11px] text-neutral-500">
                      {val.length} / {field.max}
                    </span>
                    <button
                      type="button"
                      onClick={() => restoreUiField(field.key)}
                      title="Restaurar texto original"
                      className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase text-neutral-600 dark:text-neutral-300 hover:text-[var(--editorial-primary)] cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" aria-hidden="true" />
                      <span>Restaurar</span>
                    </button>
                  </div>
                </div>
                {field.multiline ? (
                  <textarea
                    rows={2}
                    maxLength={field.max}
                    value={val}
                    onChange={(e) => updateUiField(field.key, e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                  />
                ) : (
                  <input
                    type="text"
                    maxLength={field.max}
                    value={val}
                    onChange={(e) => updateUiField(field.key, e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Vista previa en vivo */}
      <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-[#F8F6F1] dark:bg-[#101010] p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
          <span className="inline-flex items-center gap-1.5 font-display text-xs font-extrabold uppercase tracking-widest text-[var(--editorial-primary)]">
            <Eye className="w-4 h-4" aria-hidden="true" />
            <span>Vista previa editorial (cabecera, invitación y pie de página)</span>
          </span>
          <span className="text-[11px] text-neutral-500">
            Se eliminan etiquetas HTML automáticamente al guardar
          </span>
        </div>

        <div className="rounded-xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] overflow-hidden text-xs">
          <div className="px-4 py-1.5 bg-[#F1EDE4] dark:bg-[#181818] border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2 font-display uppercase tracking-wider">
            <span>
              <strong className="text-[var(--editorial-primary)]">{uiTexts.headerEditionBadge}</strong> ·{' '}
              <span className="font-tabular">{uiTexts.headerEditionNumber}</span>
            </span>
            <span className="normal-case font-editorial text-neutral-600 dark:text-neutral-300 truncate max-w-md">
              {sanitizePlainUiText(cfgDraft.tagline, 240) || DEFAULT_SITE_CONFIG.tagline}
            </span>
            <span className="font-bold">{uiTexts.headerJoinCta}</span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 space-y-1">
              <p className="font-display font-extrabold uppercase text-[var(--editorial-primary)]">
                {uiTexts.dailyStripLabel}
              </p>
              <p className="text-neutral-500">Vista previa de la columna lateral junto a la nota principal.</p>
            </div>
            <div className="rounded-xl bg-[#161212] text-white p-3 space-y-1">
              <p className="font-display text-[10px] font-bold uppercase tracking-widest text-[#FCA5A5]">
                {uiTexts.joinBannerKicker}
              </p>
              <p className="font-display text-sm font-extrabold uppercase">{uiTexts.joinBannerTitle}</p>
              <p className="text-[11px] text-neutral-300 line-clamp-2">{uiTexts.joinBannerSubtitle}</p>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-[var(--editorial-primary)] text-[10px] font-display font-bold uppercase">
                {uiTexts.joinBannerCta}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Formularios de textos fijos */}
      <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-8">
        {renderFieldGroup('Cabecera y subtítulo de la revista', 'header')}
        {renderFieldGroup('Bloques de portada ("Edición del día" y "Únete")', 'home')}
        {renderFieldGroup('Pie de página y boletín', 'footer')}
      </div>

      {/* Títulos, subtítulos y CTA de módulos de portada */}
      <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-4">
        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
          <h3 className="font-display text-base font-extrabold uppercase tracking-tight">
            Título, subtítulo y botón (CTA) de cada módulo de portada
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Personaliza los encabezados visibles en la página de inicio sin alterar el orden de bloques.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...cfgDraft.homepageSections]
            .filter((s) => s.type !== 'live')
            .sort((a, b) => a.order - b.order)
            .map((sec) => (
              <div
                key={sec.id}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-[#F8F6F1]/70 dark:bg-[#181818] p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-xs font-extrabold uppercase tracking-widest text-[var(--editorial-primary)]">
                    Módulo: {sec.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => restoreSectionDefaults(sec)}
                    className="inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase text-neutral-600 dark:text-neutral-300 hover:text-[var(--editorial-primary)] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>Restaurar módulo</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-neutral-500">
                    <span className="font-display font-bold uppercase">Título</span>
                    <span className="font-tabular">{(sec.title || '').length} / 90</span>
                  </div>
                  <input
                    type="text"
                    maxLength={90}
                    value={sec.title || ''}
                    onChange={(e) => updateSectionField(sec.id, 'title', e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-neutral-500">
                    <span className="font-display font-bold uppercase">Subtítulo (opcional)</span>
                    <span className="font-tabular">{(sec.subtitle || '').length} / 160</span>
                  </div>
                  <input
                    type="text"
                    maxLength={160}
                    value={sec.subtitle || ''}
                    onChange={(e) => updateSectionField(sec.id, 'subtitle', e.target.value)}
                    placeholder="Descripción breve debajo del título..."
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-neutral-500">
                    <span className="font-display font-bold uppercase">Texto de enlace / CTA (opcional)</span>
                    <span className="font-tabular">{(sec.ctaLabel || '').length} / 60</span>
                  </div>
                  <input
                    type="text"
                    maxLength={60}
                    value={sec.ctaLabel || ''}
                    onChange={(e) => updateSectionField(sec.id, 'ctaLabel', e.target.value)}
                    placeholder="Ej. Ver todas las columnas"
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                  />
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSaveTexts}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display font-bold uppercase tracking-wider text-xs cursor-pointer shadow-sm transition-colors"
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          <span>Guardar textos y módulos</span>
        </button>
      </div>
    </div>
  );
};
