import React, { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  ChevronDown,
  Gauge,
  LogOut,
  Menu,
  Moon,
  Search,
  Shield,
  Sun,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDataSaver } from '../context/DataSaverContext';
import { useSite } from '../context/SiteContext';
import { parseMediaUrlMeta, sanitizeExternalUrl } from '../lib/utils';
import { DataSaverMode } from '../types/editorial';
import { PWAInstallButton } from './PWAInstallButton';

export const Header: React.FC = () => {
  const {
    siteConfig,
    categories,
    isDark,
    toggleDark,
    readingMode,
    navigate,
    currentPath,
    setAuthModalOpen,
  } = useSite();
  const { firebaseUser, userAccount, isAdmin, isCollaborator, logout } = useAuth();
  const { mode: dataSaverMode, setMode: setDataSaverMode, isDataSaverActive, connectionLabel } = useDataSaver();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [saverOpen, setSaverOpen] = useState(false);
  const sectionsRef = useRef<HTMLDivElement | null>(null);
  const saverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sectionsOpen && !saverOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (sectionsRef.current && !sectionsRef.current.contains(e.target as Node)) {
        setSectionsOpen(false);
      }
      if (saverRef.current && !saverRef.current.contains(e.target as Node)) {
        setSaverOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSectionsOpen(false);
        setSaverOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [sectionsOpen, saverOpen]);

  if (readingMode) return null;

  const primaryCategories = categories.filter((c) => !c.parentId).slice(0, 5);
  const customLogo = parseMediaUrlMeta(sanitizeExternalUrl(siteConfig.logoUrl || '')).cleanUrl;
  const logoSrc = customLogo || '/brand-mark.png';

  const handleNav = (path: string) => {
    setMobileMenuOpen(false);
    setSectionsOpen(false);
    setSaverOpen(false);
    navigate(path);
  };

  const saverOptions: Array<{ value: DataSaverMode; label: string; desc: string }> = [
    { value: 'auto', label: 'Automático', desc: 'Se activa si detecta red lenta o ahorro del navegador' },
    { value: 'on', label: 'Activado', desc: 'Difiere imágenes y multimedia para ahorrar datos' },
    { value: 'off', label: 'Desactivado', desc: 'Carga siempre todas las imágenes y medios' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-[#F8F6F1]/90 dark:bg-[#0D0D0D]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 lg:gap-5 xl:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleNav('/');
          }}
          className="flex items-center gap-2 sm:gap-2.5 min-w-0 sm:shrink-0 group focus-visible:outline-2 focus-visible:outline-[var(--editorial-primary)]"
        >
          <img
            src={logoSrc}
            alt={siteConfig.siteName}
            referrerPolicy="no-referrer"
            className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-lg object-contain bg-white p-0.5 border border-neutral-200 dark:border-neutral-700 shadow-xs"
          />
          <span className="font-display text-[13.5px] sm:text-lg xl:text-xl font-extrabold uppercase tracking-tight leading-[1.05] text-[#111111] dark:text-[#F4F1EA] group-hover:text-[var(--editorial-primary)] transition-colors sm:whitespace-nowrap">
            {siteConfig.siteName}
          </span>
        </a>

        {/* Zone 2: Single-line Category Navigation */}
        <nav aria-label="Secciones principales" className="hidden lg:flex items-center gap-3.5 xl:gap-5 text-xs xl:text-sm font-display font-semibold uppercase tracking-wide min-w-0">
          {primaryCategories.map((cat) => {
            const target = `/categoria/${cat.slug}`;
            const active = currentPath === target;
            return (
              <a
                key={cat.id}
                href={target}
                onClick={(e) => {
                  e.preventDefault();
                  handleNav(target);
                }}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  active
                    ? 'border-[var(--editorial-primary)] text-[var(--editorial-primary)]'
                    : 'border-transparent text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white hover:border-neutral-400'
                }`}
              >
                {cat.name}
              </a>
            );
          })}

          <div className="relative" ref={sectionsRef}>
            <button
              type="button"
              onClick={() => setSectionsOpen((s) => !s)}
              aria-expanded={sectionsOpen}
              className="inline-flex items-center gap-1 whitespace-nowrap shrink-0 py-1 text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white cursor-pointer"
            >
              <span>Secciones</span>
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            {sectionsOpen && (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl bg-[#F8F6F1] dark:bg-[#161616] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-3 grid grid-cols-1 gap-1 z-50">
                {categories.map((cat) => (
                  <a
                    key={cat.id}
                    href={`/categoria/${cat.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav(`/categoria/${cat.slug}`);
                    }}
                    className="px-3 py-1.5 rounded-xl text-sm font-display font-medium tracking-wide hover:bg-neutral-200/70 dark:hover:bg-neutral-800 flex items-center justify-between transition-colors"
                  >
                    <span>{cat.parentId ? `↳ ${cat.name}` : cat.name}</span>
                  </a>
                ))}
                <div className="border-t border-neutral-200 dark:border-neutral-800 mt-1 pt-1.5 space-y-1">
                  <a
                    href="/colaboradores"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav('/colaboradores');
                    }}
                    className="px-3 py-1.5 rounded-xl text-sm font-display font-bold text-[var(--editorial-primary)] hover:bg-neutral-200/70 dark:hover:bg-neutral-800 flex items-center gap-2"
                  >
                    <Users className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Conozcan a nuestros colaboradores</span>
                  </a>
                  <a
                    href="/como-trabajamos"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav('/como-trabajamos');
                    }}
                    className="px-3 py-1.5 rounded-xl text-sm font-display font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 block"
                  >
                    Cómo trabajamos
                  </a>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Zone 3: Compact Actions */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
          {/* Selector Modo Ahorro de Datos */}
          <div className="relative" ref={saverRef}>
            <button
              type="button"
              onClick={() => setSaverOpen((v) => !v)}
              aria-expanded={saverOpen}
              aria-label={`Modo ahorro de datos: ${
                dataSaverMode === 'auto' ? 'Automático' : dataSaverMode === 'on' ? 'Activado' : 'Desactivado'
              }`}
              title={`Ahorro de datos (${connectionLabel})`}
              className={`inline-flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-full text-xs font-display font-bold uppercase tracking-wider cursor-pointer transition-colors border ${
                isDataSaverActive
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-800 dark:text-amber-300'
                  : 'border-neutral-300/70 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden xl:inline">
                {dataSaverMode === 'auto' ? 'Ahorro: Auto' : dataSaverMode === 'on' ? 'Ahorro: Sí' : 'Ahorro: No'}
              </span>
            </button>

            {saverOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-[#F8F6F1] dark:bg-[#161616] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-3 z-50 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="font-display text-xs font-extrabold uppercase tracking-wider">
                    Modo ahorro de datos
                  </span>
                  <span className="text-[10px] font-tabular text-neutral-500">
                    {isDataSaverActive ? 'Activo' : 'Normal'}
                  </span>
                </div>
                <div className="space-y-1">
                  {saverOptions.map((opt) => {
                    const selected = dataSaverMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setDataSaverMode(opt.value);
                          setSaverOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                          selected
                            ? 'border-[var(--editorial-primary)] bg-[var(--editorial-primary)]/10'
                            : 'border-transparent hover:bg-neutral-200/60 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-display text-xs font-bold uppercase tracking-wider">
                            {opt.label}
                          </span>
                          {selected && (
                            <span className="text-[10px] font-display font-bold uppercase text-[var(--editorial-primary)]">
                              En uso
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-neutral-500 px-1 pt-1 border-t border-neutral-200 dark:border-neutral-800">
                  Estado actual: {connectionLabel}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleNav('/buscar')}
            aria-label="Buscar en la revista"
            className="p-1.5 sm:p-2 rounded-full text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white cursor-pointer transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleDark}
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="p-1.5 sm:p-2 rounded-full text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white cursor-pointer transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="hidden sm:block">
            <PWAInstallButton compact />
          </div>

          {firebaseUser ? (
            <div className="hidden sm:flex items-center gap-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleNav('/admin')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer hover:opacity-90 shadow-sm transition-all"
                >
                  <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Admin</span>
                </button>
              )}
              {isCollaborator && (
                <button
                  type="button"
                  onClick={() => handleNav('/colaborador-panel')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--editorial-primary)] text-white text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer hover:opacity-90 shadow-sm transition-all"
                >
                  <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Mi panel</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleNav('/favoritos')}
                aria-label="Mis artículos guardados"
                className="p-2 rounded-full text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 hover:text-[var(--editorial-primary)] cursor-pointer transition-colors"
              >
                <Bookmark className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => logout()}
                aria-label={`Cerrar sesión (${userAccount?.displayName || firebaseUser.email})`}
                title="Cerrar sesión"
                className="p-2 rounded-full text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 hover:text-[var(--editorial-primary)] cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="hidden sm:inline-flex px-4 py-1.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-all shadow-sm cursor-pointer"
            >
              Ingresar
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            className="lg:hidden p-1.5 sm:p-2 rounded-full text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-neutral-200 dark:border-neutral-800 bg-[#F8F6F1] dark:bg-[#111111] px-4 py-4 max-h-[82vh] overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => (
              <a
                key={cat.id}
                href={`/categoria/${cat.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNav(`/categoria/${cat.slug}`);
                }}
                className="py-2 px-3 rounded-xl border border-neutral-200/70 dark:border-neutral-800 font-display text-sm font-semibold uppercase tracking-wide hover:border-[var(--editorial-primary)]"
              >
                {cat.name}
              </a>
            ))}
          </div>

          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-display font-bold uppercase tracking-wider">
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5" aria-hidden="true" />
                Modo ahorro de datos
              </span>
              <span className="text-neutral-500">{isDataSaverActive ? 'Activo' : 'Normal'}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {saverOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDataSaverMode(opt.value)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-display font-bold uppercase tracking-wider cursor-pointer ${
                    dataSaverMode === opt.value
                      ? 'bg-[var(--editorial-primary)] text-white'
                      : 'border border-neutral-300 dark:border-neutral-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleNav('/colaboradores')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-[var(--editorial-primary)]" aria-hidden="true" />
              <span>Colaboradores</span>
            </button>
            <button
              type="button"
              onClick={() => handleNav('/como-trabajamos')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
            >
              <span>Cómo trabajamos</span>
            </button>
            <button
              type="button"
              onClick={() => handleNav('/unete')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
            >
              <span>Únete como colaborador</span>
            </button>
            <PWAInstallButton />
            {firebaseUser ? (
              <>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleNav('/admin')}
                    className="px-4 py-2 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Panel Admin
                  </button>
                )}
                {isCollaborator && (
                  <button
                    type="button"
                    onClick={() => handleNav('/colaborador-panel')}
                    className="px-4 py-2 rounded-full bg-[var(--editorial-primary)] text-white text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Panel Colaborador
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleNav('/favoritos')}
                  className="px-3.5 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
                >
                  Guardados
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="px-3.5 py-2 rounded-full text-xs font-display font-bold uppercase tracking-wider text-red-600 cursor-pointer"
                >
                  Salir
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAuthModalOpen(true);
                }}
                className="px-4 py-2 rounded-full bg-[var(--editorial-primary)] text-white text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
              >
                Ingresar / Cuenta
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
