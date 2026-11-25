import React, { useState } from 'react';
import { KeyRound, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import {
  EditorialButton,
  EditorialModal,
  EditorialNotice,
  FilterChip,
  editorialInputClass,
} from './ui/EditorialPrimitives';

type AuthTab = 'login' | 'register' | 'reset';

export const AuthModal: React.FC = () => {
  const { authModalOpen, setAuthModalOpen, navigate, siteConfig } = useSite();
  const {
    loginWithEmail,
    loginWithGoogle,
    registerReader,
    sendPasswordReset,
  } = useAuth();

  const [tab, setTab] = useState<AuthTab>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const resetMessages = () => {
    setError('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setBusy(true);
    try {
      if (tab === 'login') {
        await loginWithEmail(email, password);
        setAuthModalOpen(false);
      } else if (tab === 'register') {
        if (password !== confirmPassword) {
          throw new Error('Las contraseñas no coinciden.');
        }
        await registerReader(name, email, password);
        setSuccessMsg('Cuenta creada. Revisa tu correo para verificar tu dirección.');
        setTimeout(() => setAuthModalOpen(false), 1200);
      } else if (tab === 'reset') {
        await sendPasswordReset(email);
        setSuccessMsg('Hemos enviado un enlace de recuperación a tu correo electrónico.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la solicitud.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    resetMessages();
    setBusy(true);
    try {
      await loginWithGoogle();
      setAuthModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google.');
    } finally {
      setBusy(false);
    }
  };

  const modalTitle =
    tab === 'login'
      ? 'Iniciar sesión'
      : tab === 'register'
      ? 'Cuenta de lector'
      : 'Recuperar contraseña';

  return (
    <EditorialModal
      open={authModalOpen}
      onClose={() => setAuthModalOpen(false)}
      kicker={siteConfig.siteName}
      title={modalTitle}
      maxWidthClass="max-w-md"
    >
      <div className="flex flex-wrap gap-1.5 border-b border-[var(--editorial-border)] pb-3">
        <FilterChip
          active={tab === 'login'}
          onClick={() => {
            setTab('login');
            resetMessages();
          }}
        >
          Ingresar
        </FilterChip>
        <FilterChip
          active={tab === 'register'}
          onClick={() => {
            setTab('register');
            resetMessages();
          }}
        >
          Registrarme
        </FilterChip>
        <FilterChip
          active={tab === 'reset'}
          onClick={() => {
            setTab('reset');
            resetMessages();
          }}
        >
          Recuperar clave
        </FilterChip>
      </div>

      {error && <EditorialNotice tone="error">{error}</EditorialNotice>}
      {successMsg && <EditorialNotice tone="success">{successMsg}</EditorialNotice>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {tab === 'register' && (
          <div>
            <label className="block font-display text-xs uppercase tracking-wider font-semibold mb-1.5">
              Nombre visible
            </label>
            <div className="relative">
              <User
                className="w-4 h-4 text-[var(--editorial-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className={`${editorialInputClass} pl-10`}
              />
            </div>
          </div>
        )}

        <div>
          <label className="block font-display text-xs uppercase tracking-wider font-semibold mb-1.5">
            Correo electrónico
          </label>
          <div className="relative">
            <Mail
              className="w-4 h-4 text-[var(--editorial-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@correo.org"
              className={`${editorialInputClass} pl-10`}
            />
          </div>
        </div>

        {tab !== 'reset' && (
          <div>
            <label className="block font-display text-xs uppercase tracking-wider font-semibold mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock
                className="w-4 h-4 text-[var(--editorial-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className={`${editorialInputClass} pl-10`}
              />
            </div>
          </div>
        )}

        {tab === 'register' && (
          <div>
            <label className="block font-display text-xs uppercase tracking-wider font-semibold mb-1.5">
              Confirmar contraseña
            </label>
            <div className="relative">
              <Lock
                className="w-4 h-4 text-[var(--editorial-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                className={`${editorialInputClass} pl-10`}
              />
            </div>
          </div>
        )}

        <EditorialButton type="submit" disabled={busy} size="lg" className="w-full">
          <Mail className="w-4 h-4" aria-hidden="true" />
          <span>
            {busy
              ? 'Procesando...'
              : tab === 'login'
              ? 'Entrar con correo'
              : tab === 'register'
              ? 'Crear cuenta de lector'
              : 'Enviar correo de recuperación'}
          </span>
        </EditorialButton>
      </form>

      {(tab === 'login' || tab === 'register') && (
        <div className="pt-4 border-t border-[var(--editorial-border)] space-y-3">
          <EditorialButton
            variant="secondary"
            size="lg"
            disabled={busy}
            onClick={handleGoogle}
            className="w-full"
          >
            <span>Continuar con Google</span>
          </EditorialButton>

          <button
            type="button"
            onClick={() => {
              setAuthModalOpen(false);
              navigate('/unete');
            }}
            className="w-full py-2 text-xs font-display uppercase tracking-wider text-[var(--editorial-muted)] hover:text-[var(--editorial-primary)] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
            <span>¿Eres medio o periodista? Únete con código de invitación</span>
          </button>
        </div>
      )}
    </EditorialModal>
  );
};
