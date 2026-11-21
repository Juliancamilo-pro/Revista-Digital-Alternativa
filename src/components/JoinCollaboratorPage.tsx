import React, { useState } from 'react';
import { KeyRound, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { OutletType } from '../types/editorial';

export const JoinCollaboratorPage: React.FC = () => {
  const { registerCollaborator, sendPasswordReset } = useAuth();
  const { siteConfig, navigate, setAuthModalOpen } = useSite();

  const [outletName, setOutletName] = useState('');
  const [outletType, setOutletType] = useState<OutletType>('independiente');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [showReset, setShowReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (password !== confirmPassword) {
      setError('Las contraseñas ingresadas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setBusy(true);
    try {
      const res = await registerCollaborator({
        outletName,
        outletType,
        email,
        password,
        inviteCode,
      });
      setSuccessMsg(
        res.status === 'active'
          ? '¡Registro completado! Tu cuenta de colaborador ya está activa.'
          : '¡Registro recibido! Tu cuenta quedó pendiente de aprobación por el administrador.'
      );
      setTimeout(() => navigate('/colaborador-panel'), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar el registro.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      await sendPasswordReset(resetEmail);
      setSuccessMsg('Enviamos un enlace de recuperación de contraseña a tu correo.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el correo de recuperación.');
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="border-b-2 border-[#111111] dark:border-neutral-700 pb-5">
        <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
          Red de periodismo sin filtros corporativos
        </p>
        <h1 className="font-display text-3xl sm:text-5xl font-extrabold uppercase tracking-tight mt-1">
          Únete como colaborador
        </h1>
        <p className="mt-3 text-base text-neutral-700 dark:text-neutral-300 leading-relaxed">
          {siteConfig.siteName} articula periodistas independientes, colectivos gráficos, pódcasts y medios alternativos. El registro requiere un código de invitación único emitido por la administración.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl p-4 border border-red-500 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}
      {successMsg && (
        <div role="status" className="rounded-2xl p-4 border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 text-sm">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 sm:p-8 space-y-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
              Nombre del medio o periodista
            </label>
            <input
              type="text"
              required
              minLength={2}
              value={outletName}
              onChange={(e) => setOutletName(e.target.value)}
              placeholder="Nombre público de firma o colectivo"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
            />
          </div>

          <div>
            <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
              Tipo de colaborador
            </label>
            <select
              value={outletType}
              onChange={(e) => setOutletType(e.target.value as OutletType)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
            >
              <option value="independiente">Periodista / Columnista independiente</option>
              <option value="medio">Medio o revista aliada</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
            Correo electrónico
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
            />
          </div>
          <div>
            <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
              Confirmar contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contraseña"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
            />
          </div>
        </div>

        <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4">
          <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1 text-[var(--editorial-primary)]">
            Código de invitación único
          </label>
          <div className="flex items-center rounded-xl border border-neutral-400 dark:border-neutral-700 bg-[#F8F6F1] dark:bg-[#1E1E1E]">
            <KeyRound className="w-4 h-4 text-[var(--editorial-primary)] ml-3 shrink-0" aria-hidden="true" />
            <input
              type="text"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Ingresa el código entregado por la administración"
              className="w-full px-3 py-2.5 bg-transparent font-tabular text-sm focus:outline-none"
            />
          </div>
          <p className="mt-1.5 text-xs text-neutral-500">
            El código se valida de forma criptográfica en la base de datos. Si cambió recientemente, solicita el código vigente.
          </p>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          <span>{busy ? 'Verificando código y registrando...' : 'Completar registro de colaborador'}</span>
        </button>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-neutral-600 dark:text-neutral-400">
          <button type="button" onClick={() => setAuthModalOpen(true)} className="hover:underline cursor-pointer">
            ¿Ya tienes cuenta? Inicia sesión aquí
          </button>
          <button type="button" onClick={() => setShowReset((s) => !s)} className="hover:underline cursor-pointer">
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </form>

      {showReset && (
        <form onSubmit={handleReset} className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 space-y-3">
          <h2 className="font-display text-lg font-bold uppercase">Recuperar contraseña por correo</h2>
          <div className="flex gap-2">
            <input
              type="email"
              required
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="Tu correo registrado"
              className="flex-1 px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
            />
            <button
              type="submit"
              className="px-5 py-2 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black font-display text-xs font-bold uppercase cursor-pointer"
            >
              Enviar enlace
            </button>
          </div>
        </form>
      )}

      {siteConfig.authorLiabilityNotice && (
        <div className="flex items-start gap-3 text-xs text-neutral-600 dark:text-neutral-400 rounded-2xl border border-neutral-300 dark:border-neutral-800 p-4">
          <ShieldCheck className="w-5 h-5 text-[var(--editorial-primary)] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            {siteConfig.authorLiabilityNotice}
          </p>
        </div>
      )}
    </main>
  );
};
