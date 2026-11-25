import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Calendar,
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
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useDataSaver } from '../context/DataSaverContext';
import { useSite } from '../context/SiteContext';
import { parseMediaUrlMeta, sanitizeExternalUrl } from '../lib/utils';
import { DataSaverMode } from '../types/editorial';
import { PWAInstallButton } from './PWAInstallButton';
import { TricolorHairline } from './TolimaAccents';
import { ThemeGarland } from './themes/ThemeGarland';
import { ThemeLogoAccent } from './themes/ThemeOrnaments';

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);

  const sectionsRef = useRef<HTMLDivElement | null>(null);
  const saverRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const formattedTodayEs = useMemo(() => {
    try {
      const formatted = new Intl.DateTimeFormat('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'America/Bogota',
      }).format(new Date());
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch {
      return 'Edición Colombia';
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 36;
      setScrolled((prev) => (prev === next ? prev : next));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!sectionsOpen && !saverOpen && !searchOpen && !mobileMenuOpen) return;
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
        setSearchOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [sectionsOpen, saverOpen, searchOpen, mobileMenuOpen]);

  if (readingMode) return null;

  const primaryCategories = categories.filter((c) => !c.parentId).slice(0, 4);
  const customLogo = parseMediaUrlMeta(sanitizeExternalUrl(siteConfig.logoUrl || '')).cleanUrl;
  const logoSrc = customLogo || '/brand-mark.png';

  const editionBadge = siteConfig.uiTexts?.headerEditionBadge || 'Edición del día';
  const editionNumber = siteConfig.uiTexts?.headerEditionNumber || 'N.º 042';
  const joinCtaLabel = siteConfig.uiTexts?.headerJoinCta || 'Colaborar';

  const handleNav = (path: string) => {
    setMobileMenuOpen(false);
    setSectionsOpen(false);
    setSaverOpen(false);
    setSearchOpen(false);
    navigate(path);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchQuery.trim();
    setSearchOpen(false);
    setMobileMenuOpen(false);
    navigate(clean ? `/buscar?q=${encodeURIComponent(clean)}` : '/buscar');
  };

  const saverOptions: Array<{ value: DataSaverMode; label: string; desc: string }> = [
    { value: 'auto', label: 'Automático', desc: 'Se activa si detecta red lenta o ahorro del navegador' },
    { value: 'on', label: 'Activado', desc: 'Difiere imágenes y multimedia para ahorrar datos' },
    { value: 'off', label: 'Desactivado', desc: 'Carga siempre todas las imágenes y medios' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--editorial-border)] bg-[var(--editorial-paper)]/95 text-[var(--editorial-ink)] backdrop-blur-md transition-all duration-200">
      <TricolorHairline />

      {/* Cintillo editorial superior: se compacta suavemente al hacer scroll */}
      {!scrolled && (
        <div className="hidden sm:block border-b border-[var(--editorial-border)] bg-[var(--editorial-surface-subtle)]">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-7 flex items-center justify-between gap-4 text-[11px] font-display tracking-wider uppercase text-[var(--editorial-muted)]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-bold text-[var(--editorial-primary)] shrink-0">
                {editionBadge}
              </span>
              <span aria-hidden="true" className="opacity-45">·</span>
              <span className="font-tabular font-semibold text-[var(--editorial-ink)] shrink-0">{editionNumber}</span>
              <span aria-hidden="true" className="opacity-45 hidden md:inline">·</span>
              <span className="hidden md:inline-flex items-center gap-1 truncate normal-case font-editorial text-[11px]">
                <Calendar className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>{formattedTodayEs}</span>
              </span>
            </div>

            <div className="flex items-center gap-3.5 shrink-0">
              <span className="hidden lg:inline truncate max-w-[40ch] normal-case font-editorial text-[11px]">
                {siteConfig.tagline}
              </span>
              <a
                href="/unete"
                onClick={(e) => {
                  e.preventDefault();
                  handleNav('/unete');
                }}
                className="font-bold text-[var(--editorial-ink)] hover:text-[var(--editorial-primary)] transition-colors"
              >
                {joinCtaLabel} →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Barra principal de cabecera y navegación */}
      <div
        className={`max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4 transition-[min-height] duration-200 ${
          scrolled ? 'min-h-12 sm:min-h-[54px] py-1 sm:py-0' : 'min-h-14 sm:min-h-[62px] py-1.5 sm:py-0'
        }`}
      >
        {/* Zona 1: Marca */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleNav('/');
          }}
          className="flex items-center gap-2 sm:gap-3 min-w-0 sm:shrink-0 group"
        >
          <span className="relative inline-flex shrink-0">
            <ThemeLogoAccent />
            <img
              src={logoSrc}
              alt={siteConfig.siteName}
              width={36}
              height={36}
              referrerPolicy="no-referrer"
              className={`shrink-0 rounded-lg object-contain bg-white p-0.5 border border-[var(--editorial-border)] shadow-xs transition-all duration-200 ${
                scrolled ? 'h-7 w-7 sm:h-8 sm:w-8' : 'h-8 w-8 sm:h-9 sm:w-9'
              }`}
            />
          </span>
          <div className="min-w-0">
            <span
              className={`block font-display font-extrabold uppercase tracking-tight leading-none text-[var(--editorial-ink)] group-hover:text-[var(--editorial-primary)] transition-all truncate ${
                scrolled ? 'text-[14px] sm:text-lg' : 'text-[15px] sm:text-xl'
              }`}
            >
              {siteConfig.siteName}
            </span>
            {!scrolled && (
              <span className="sm:hidden block text-[10px] font-display font-semibold uppercase tracking-wider text-[var(--editorial-muted)] mt-0.5 truncate">
                {editionBadge} · {editionNumber}
              </span>
            )}
          </div>
        </a>

        {/* Zona 2: Navegación principal */}
        <nav aria-label="Secciones principales" className="hidden lg:flex items-center gap-4 xl:gap-6 text-xs xl:text-sm font-display font-bold uppercase tracking-wide min-w-0">
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
                className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors ${
                  active
                    ? 'border-[var(--editorial-primary)] text-[var(--editorial-primary)]'
                    : 'border-transparent text-[var(--editorial-ink)]/85 hover:text-[var(--editorial-primary)] hover:border-[var(--editorial-border)]'
                }`}
              >
                {cat.name}
              </a>
            );
          })}

          <a
            href="/tolima"
            onClick={(e) => {
              e.preventDefault();
              handleNav('/tolima');
            }}
            className={`whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors ${
              currentPath === '/tolima'
                ? 'border-[var(--editorial-primary)] text-[var(--editorial-primary)]'
                : 'border-transparent text-[var(--editorial-ink)]/85 hover:text-[var(--editorial-primary)] hover:border-[var(--editorial-border)]'
            }`}
          >
            Tolima
          </a>

          {/* Mega-menú Secciones */}
          <div className="relative" ref={sectionsRef}>
            <button
              type="button"
              onClick={() => setSectionsOpen((s) => !s)}
              aria-expanded={sectionsOpen}
              className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 py-1.5 border-b-2 cursor-pointer transition-colors ${
                sectionsOpen
                  ? 'border-[var(--editorial-primary)] text-[var(--editorial-primary)]'
                  : 'border-transparent text-[var(--editorial-ink)]/85 hover:text-[var(--editorial-primary)]'
              }`}
            >
              <span>Secciones</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${sectionsOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            <AnimatePresence>
              {sectionsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.16 }}
                  className="absolute left-0 top-full mt-2 w-[460px] rounded-2xl bg-[var(--editorial-surface)] border border-[var(--editorial-border)] shadow-2xl p-4 grid grid-cols-12 gap-4 z-50"
                >
                  <div className="col-span-7 space-y-1 border-r border-[var(--editorial-border)] pr-3">
                    <p className="px-2.5 pb-1 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-[var(--editorial-primary)]">
                      Temáticas de la revista
                    </p>
                    <div className="grid grid-cols-1 gap-0.5 max-h-72 overflow-y-auto">
                      {categories.map((cat) => (
                        <a
                          key={cat.id}
                          href={`/categoria/${cat.slug}`}
                          onClick={(e) => {
                            e.preventDefault();
                            handleNav(`/categoria/${cat.slug}`);
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-sm font-display font-semibold tracking-wide text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface-subtle)] hover:text-[var(--editorial-primary)] flex items-center justify-between transition-colors"
                        >
                          <span>{cat.parentId ? `↳ ${cat.name}` : cat.name}</span>
                        </a>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-5 flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <p className="px-2 pb-1 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-[var(--editorial-muted)]">
                        Red y territorio
                      </p>
                      <a
                        href="/colaboradores"
                        onClick={(e) => {
                          e.preventDefault();
                          handleNav('/colaboradores');
                        }}
                        className="px-2.5 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wider text-[var(--editorial-primary)] hover:bg-[var(--editorial-surface-subtle)] flex items-center gap-2 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Colaboradores</span>
                      </a>
                      <a
                        href="/tolima"
                        onClick={(e) => {
                          e.preventDefault();
                          handleNav('/tolima');
                        }}
                        className="px-2.5 py-2 rounded-lg text-xs font-display font-semibold uppercase tracking-wider text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface-subtle)] block transition-colors"
                      >
                        Tolima, Capital Musical
                      </a>
                      <a
                        href="/como-trabajamos"
                        onClick={(e) => {
                          e.preventDefault();
                          handleNav('/como-trabajamos');
                        }}
                        className="px-2.5 py-2 rounded-lg text-xs font-display font-semibold uppercase tracking-wider text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface-subtle)] block transition-colors"
                      >
                        Cómo trabajamos
                      </a>
                      <a
                        href="/quienes-somos"
                        onClick={(e) => {
                          e.preventDefault();
                          handleNav('/quienes-somos');
                        }}
                        className="px-2.5 py-2 rounded-lg text-xs font-display font-semibold uppercase tracking-wider text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface-subtle)] block transition-colors"
                      >
                        Quiénes somos
                      </a>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleNav('/unete')}
                      className="w-full px-3 py-2 rounded-xl bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white text-[11px] font-display font-bold uppercase tracking-wider flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span>{joinCtaLabel}</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* Zona 3: Acciones agrupadas */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Búsqueda expandible */}
          <div className="hidden md:flex items-center">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-1 bg-[var(--editorial-surface)] border border-[var(--editorial-border)] rounded-full pl-3 pr-1 py-0.5 shadow-xs">
                <Search className="w-3.5 h-3.5 text-[var(--editorial-muted)] shrink-0" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar artículos..."
                  aria-label="Buscar en la revista"
                  className="w-36 xl:w-48 bg-transparent text-xs py-1 focus:outline-none text-[var(--editorial-ink)]"
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  aria-label="Cerrar búsqueda"
                  className="p-1 rounded-full text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Abrir buscador"
                title="Buscar en la revista"
                className="p-2 rounded-full text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface-subtle)] cursor-pointer transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleNav('/buscar')}
            aria-label="Buscar en la revista"
            className="md:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface-subtle)] cursor-pointer transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Ahorro de datos */}
          <div className="relative" ref={saverRef}>
            <button
              type="button"
              onClick={() => setSaverOpen((v) => !v)}
              aria-expanded={saverOpen}
              aria-label={`Modo ahorro de datos: ${
                dataSaverMode === 'auto' ? 'Automático' : dataSaverMode === 'on' ? 'Activado' : 'Desactivado'
              }`}
              title={`Ahorro de datos (${connectionLabel})`}
              className={`inline-flex items-center gap-1 min-h-[38px] px-2 sm:px-2.5 rounded-full text-xs font-display font-bold uppercase tracking-wider cursor-pointer transition-colors border ${
                isDataSaverActive
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-800 dark:text-amber-300'
                  : 'border-[var(--editorial-border)] text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface-subtle)]'
              }`}
            >
              <Gauge className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden xl:inline">
                {dataSaverMode === 'auto' ? 'Ahorro: Auto' : dataSaverMode === 'on' ? 'Ahorro: Sí' : 'Ahorro: No'}
              </span>
            </button>

            {saverOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-[var(--editorial-surface)] border border-[var(--editorial-border)] shadow-2xl p-3 z-50 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="font-display text-xs font-extrabold uppercase tracking-wider">
                    Modo ahorro de datos
                  </span>
                  <span className="text-[10px] font-tabular text-[var(--editorial-muted)]">
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
                            : 'border-transparent hover:bg-[var(--editorial-surface-subtle)]'
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
                        <p className="text-[11px] text-[var(--editorial-muted)] mt-0.5 leading-snug">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-[var(--editorial-muted)] px-1 pt-1 border-t border-[var(--editorial-border)]">
                  Estado actual: {connectionLabel}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleDark}
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface-subtle)] cursor-pointer transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="hidden sm:block">
            <PWAInstallButton compact />
          </div>

          {firebaseUser ? (
            <div className="hidden sm:flex items-center gap-1.5 pl-1 border-l border-[var(--editorial-border)]">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleNav('/admin')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--editorial-ink)] text-[var(--editorial-paper)] text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer hover:opacity-90 shadow-xs transition-all"
                >
                  <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Admin</span>
                </button>
              )}
              {isCollaborator && (
                <button
                  type="button"
                  onClick={() => handleNav('/colaborador-panel')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--editorial-primary)] text-white text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer hover:bg-[var(--editorial-accent)] shadow-xs transition-all"
                >
                  <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Mi panel</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleNav('/favoritos')}
                aria-label="Mis artículos guardados"
                title="Artículos guardados"
                className="p-2 rounded-full text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface-subtle)] hover:text-[var(--editorial-primary)] cursor-pointer transition-colors"
              >
                <Bookmark className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => logout()}
                aria-label={`Cerrar sesión (${userAccount?.displayName || firebaseUser.email})`}
                title="Cerrar sesión"
                className="p-2 rounded-full text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface-subtle)] hover:text-[var(--editorial-primary)] cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="hidden sm:inline-flex px-4 py-1.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white text-xs font-display font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors shadow-xs cursor-pointer"
            >
              Ingresar
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileMenuOpen}
            className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface-subtle)] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Cajón móvil con animación fluida */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden overflow-hidden border-t border-[var(--editorial-border)] bg-[var(--editorial-paper)]"
          >
            <div className="px-4 py-4 max-h-[80vh] overflow-y-auto space-y-4">
              <div className="flex items-center justify-between text-[11px] font-display uppercase tracking-wider text-[var(--editorial-muted)] border-b border-[var(--editorial-border)] pb-2">
                <span>{formattedTodayEs}</span>
                <span className="font-bold text-[var(--editorial-primary)]">{editionNumber}</span>
              </div>

              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--editorial-surface)] border border-[var(--editorial-border)]">
                  <Search className="w-4 h-4 text-[var(--editorial-muted)] shrink-0" aria-hidden="true" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar notas, temas o autores..."
                    className="w-full bg-transparent text-sm focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="min-h-[44px] px-4 rounded-xl bg-[var(--editorial-primary)] text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Ir
                </button>
              </form>

              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <a
                    key={cat.id}
                    href={`/categoria/${cat.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNav(`/categoria/${cat.slug}`);
                    }}
                    className="min-h-[44px] flex items-center px-3.5 rounded-xl bg-[var(--editorial-surface)] border border-[var(--editorial-border)] font-display text-sm font-semibold uppercase tracking-wide hover:border-[var(--editorial-primary)]"
                  >
                    {cat.name}
                  </a>
                ))}
              </div>

              <div className="rounded-xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-display font-bold uppercase tracking-wider">
                  <span className="inline-flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5" aria-hidden="true" />
                    Modo ahorro de datos
                  </span>
                  <span className="text-[var(--editorial-muted)]">{isDataSaverActive ? 'Activo' : 'Normal'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {saverOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDataSaverMode(opt.value)}
                      className={`min-h-[38px] px-2 rounded-lg text-[11px] font-display font-bold uppercase tracking-wider cursor-pointer ${
                        dataSaverMode === opt.value
                          ? 'bg-[var(--editorial-primary)] text-white'
                          : 'border border-[var(--editorial-border)]'
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
                  onClick={() => handleNav('/tolima')}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
                >
                  <span>Tolima</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNav('/colaboradores')}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-[var(--editorial-primary)]" aria-hidden="true" />
                  <span>Colaboradores</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNav('/como-trabajamos')}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
                >
                  <span>Cómo trabajamos</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleNav('/unete')}
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
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
                        className="min-h-[44px] px-4 py-2 rounded-full bg-[var(--editorial-ink)] text-[var(--editorial-paper)] text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Panel Admin
                      </button>
                    )}
                    {isCollaborator && (
                      <button
                        type="button"
                        onClick={() => handleNav('/colaborador-panel')}
                        className="min-h-[44px] px-4 py-2 rounded-full bg-[var(--editorial-primary)] text-white text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Panel Colaborador
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleNav('/favoritos')}
                      className="min-h-[44px] px-3.5 py-2 rounded-full border border-[var(--editorial-border)] text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
                    >
                      Guardados
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                      className="min-h-[44px] px-3.5 py-2 rounded-full text-xs font-display font-bold uppercase tracking-wider text-red-600 cursor-pointer"
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
                    className="min-h-[44px] px-5 py-2 rounded-full bg-[var(--editorial-primary)] text-white text-xs font-display font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Ingresar / Cuenta
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ThemeGarland />
    </header>
  );
};
