import React, { useState } from 'react';
import { KeyRound, Lock, Mail, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';

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

  if (!authModalOpen) return null;

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-[#F8F6F1] dark:bg-[#141414] border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 shadow-2xl animate-fade-up">
        <button
          type="button"
          onClick={() => setAuthModalOpen(false)}
          aria-label="Cerrar ventana de acceso"
          className="absolute right-4 top-4 p-2 rounded-full text-neutral-500 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 hover:text-black dark:hover:text-white cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
          {siteConfig.siteName}
        </p>
        <h2 id="auth-modal-title" className="font-display text-3xl font-extrabold uppercase tracking-tight mt-1">
          {tab === 'login' && 'Iniciar sesión'}
          {tab === 'register' && 'Cuenta de lector'}
          {tab === 'reset' && 'Recuperar contraseña'}
        </h2>

        <div className="flex flex-wrap gap-2 mt-4 border-b border-neutral-200 dark:border-neutral-800 pb-3 text-xs font-display uppercase tracking-wider font-semibold">
          <button
            type="button"
            onClick={() => { setTab('login'); resetMessages(); }}
            className={`px-3.5 py-1.5 rounded-full cursor-pointer transition-colors ${tab === 'login' ? 'bg-[#111111] text-white dark:bg-white dark:text-black' : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'}`}
          >
            Ingresar
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); resetMessages(); }}
            className={`px-3.5 py-1.5 rounded-full cursor-pointer transition-colors ${tab === 'register' ? 'bg-[#111111] text-white dark:bg-white dark:text-black' : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'}`}
          >
            Registrarme
          </button>
          <button
            type="button"
            onClick={() => { setTab('reset'); resetMessages(); }}
            className={`px-3.5 py-1.5 rounded-full cursor-pointer transition-colors ${tab === 'reset' ? 'bg-[#111111] text-white dark:bg-white dark:text-black' : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'}`}
          >
            Recuperar clave
          </button>
        </div>

        {error && (
          <div role="alert" className="mt-4 p-3 rounded-xl border border-red-400 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 text-sm">
            {error}
          </div>
        )}
        {successMsg && (
          <div role="status" className="mt-4 p-3 rounded-xl border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 text-sm">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {tab === 'register' && (
            <div>
              <label className="block font-display text-xs uppercase tracking-wider font-semibold mb-1">
                Nombre visible
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-display text-xs uppercase tracking-wider font-semibold mb-1">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@correo.org"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
              />
            </div>
          </div>

          {tab !== 'reset' && (
            <div>
              <label className="block font-display text-xs uppercase tracking-wider font-semibold mb-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
                />
              </div>
            </div>
          )}

          {tab === 'register' && (
            <div>
              <label className="block font-display text-xs uppercase tracking-wider font-semibold mb-1">
                Confirmar contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 px-4 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display font-bold uppercase tracking-wider text-sm transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
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
          </button>
        </form>

        {(tab === 'login' || tab === 'register') && (
          <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogle}
              className="w-full py-2.5 px-4 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1C1C1C] hover:bg-neutral-100 dark:hover:bg-neutral-800 font-display font-semibold uppercase tracking-wider text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Continuar con Google</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthModalOpen(false);
                navigate('/unete');
              }}
              className="w-full py-2 text-xs font-display uppercase tracking-wider text-neutral-600 dark:text-neutral-400 hover:text-[var(--editorial-primary)] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
              <span>¿Eres medio o periodista? Únete con código de invitación</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
