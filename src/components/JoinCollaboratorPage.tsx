import React, { useState } from 'react';
import { KeyRound, Lock, ShieldCheck, Upload, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { calculateAdultAgeFromBirthYear } from '../lib/utils';
import { OutletType, PoliticalAffiliationChoice } from '../types/editorial';

export const JoinCollaboratorPage: React.FC = () => {
  const { registerCollaborator, sendPasswordReset } = useAuth();
  const { siteConfig, navigate, setAuthModalOpen } = useSite();

  const [outletName, setOutletName] = useState('');
  const [outletType, setOutletType] = useState<OutletType>('independiente');
  const [birthYearInput, setBirthYearInput] = useState('');
  const [profession, setProfession] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const [politicalAffiliation, setPoliticalAffiliation] = useState<PoliticalAffiliationChoice>('');
  const [politicalPartyName, setPoliticalPartyName] = useState('');
  const [politicalPartyRole, setPoliticalPartyRole] = useState('');
  const [partyLogoFile, setPartyLogoFile] = useState<File | null>(null);
  const [partyLogoPreview, setPartyLogoPreview] = useState('');
  const [politicalConsentAccepted, setPoliticalConsentAccepted] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [showReset, setShowReset] = useState(false);

  const currentYear = new Date().getFullYear();
  const maxBirthYear = currentYear - 18;
  const computedAge = calculateAdultAgeFromBirthYear(birthYearInput);
  const enteredYearNum = birthYearInput.trim() ? Number(birthYearInput.trim()) : null;
  const isUnderageEntered =
    enteredYearNum !== null &&
    Number.isInteger(enteredYearNum) &&
    enteredYearNum > maxBirthYear &&
    enteredYearNum <= currentYear;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (isUnderageEntered || computedAge === null) {
      setError(
        `El registro de colaboradores es exclusivo para mayores de 18 años (año de nacimiento entre 1900 y ${maxBirthYear}).`
      );
      return;
    }
    if (politicalAffiliation === 'yes') {
      if (!politicalPartyName.trim()) {
        setError('Ingresa el nombre del partido o movimiento político al que perteneces.');
        return;
      }
      if (!politicalConsentAccepted) {
        setError(
          'Por tratarse de un dato sensible (Ley 1581 de 2012), debes marcar tu autorización expresa antes de continuar.'
        );
        return;
      }
    }
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
        birthYear: Number(birthYearInput.trim()),
        profession,
        jobTitle,
        organization,
        city,
        country,
        politicalAffiliation,
        politicalPartyName,
        politicalPartyRole,
        politicalPartyLogoFile: partyLogoFile,
        politicalConsentAccepted,
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
          {siteConfig.siteName} articula periodistas independientes, colectivos gráficos, pódcasts y medios alternativos. El registro requiere ser mayor de 18 años y contar con un código de invitación vigente.
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

      <form onSubmit={handleSubmit} className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 sm:p-8 space-y-6 shadow-sm">
        {/* Identidad básica */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
                Nombre completo o del medio *
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={outletName}
                onChange={(e) => setOutletName(e.target.value)}
                placeholder="Nombre de firma, periodista o colectivo"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
              />
            </div>

            <div>
              <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
                Tipo de colaborador *
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
                Año de nacimiento (privado) *
              </label>
              <input
                type="number"
                required
                min={1900}
                max={maxBirthYear}
                value={birthYearInput}
                onChange={(e) => setBirthYearInput(e.target.value)}
                placeholder={`Ej. 1994 (máx. ${maxBirthYear})`}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
              />
              {isUnderageEntered ? (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Solo pueden registrarse personas mayores de 18 años.
                </p>
              ) : computedAge !== null ? (
                <p className="mt-1 text-[11px] text-neutral-500">
                  Edad verificada: {computedAge} años. Nunca se publica tu fecha ni año exacto.
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-neutral-500">
                  Requerido para verificar mayoría de edad (18+).
                </p>
              )}
            </div>

            <div>
              <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
                Ciudad (opcional)
              </label>
              <input
                type="text"
                maxLength={80}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ej. Bogotá"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
              />
            </div>

            <div>
              <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
                País (opcional)
              </label>
              <input
                type="text"
                maxLength={80}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Ej. Colombia"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
                ¿A qué te dedicas? (opcional)
              </label>
              <input
                type="text"
                maxLength={120}
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="Ej. Periodismo de investigación"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
              />
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
                Cargo actual (opcional)
              </label>
              <input
                type="text"
                maxLength={120}
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Ej. Cronista / Investigador/a"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
              />
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
                Organización o medio (opcional)
              </label>
              <input
                type="text"
                maxLength={140}
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Ej. Colectivo / Medio independiente"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm focus:outline-none focus:border-[var(--editorial-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Afiliación política (dato sensible opcional) */}
        <section className="rounded-xl border border-neutral-300 dark:border-neutral-800 bg-[#F8F6F1] dark:bg-[#1A1A1A] p-4 sm:p-5 space-y-4">
          <div className="space-y-1">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Afiliación política (opcional · Ley 1581 de 2012)</span>
            </p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              ¿Perteneces a algún partido o movimiento político? Esta respuesta es completamente voluntaria. Todo dato adicional que registres aquí inicia oculto al público y solo se publicará si lo autorizas en tu panel de privacidad.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(
              [
                ['no', 'No'],
                ['yes', 'Sí'],
                ['prefer_not_to_say', 'Prefiero no decirlo'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setPoliticalAffiliation(val);
                  if (val !== 'yes') {
                    setPoliticalConsentAccepted(false);
                  }
                }}
                className={`px-3 py-2 rounded-xl border text-xs font-display font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                  politicalAffiliation === val
                    ? 'border-[var(--editorial-primary)] bg-[var(--editorial-primary)] text-white'
                    : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#141414]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {politicalAffiliation === 'yes' && (
            <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-display text-xs font-bold uppercase mb-1">
                    Nombre del partido o movimiento *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={140}
                    value={politicalPartyName}
                    onChange={(e) => setPoliticalPartyName(e.target.value)}
                    placeholder="Nombre completo de la organización"
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#141414] border border-neutral-300 dark:border-neutral-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-display text-xs font-bold uppercase mb-1">
                    Cargo o rol dentro de él (opcional)
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={politicalPartyRole}
                    onChange={(e) => setPoliticalPartyRole(e.target.value)}
                    placeholder="Ej. Militante, vocería, coordinación"
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#141414] border border-neutral-300 dark:border-neutral-700 text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {partyLogoPreview && (
                  <img
                    src={partyLogoPreview}
                    alt="Vista previa logo del movimiento"
                    className="w-10 h-10 rounded-lg object-contain border border-neutral-300 bg-white p-0.5"
                  />
                )}
                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-neutral-400 dark:border-neutral-600 text-xs font-display font-bold uppercase cursor-pointer">
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{partyLogoFile ? 'Cambiar logo del partido' : 'Subir logo o imagen del partido (opcional)'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setPartyLogoFile(f);
                      if (f) {
                        const reader = new FileReader();
                        reader.onload = () => setPartyLogoPreview(String(reader.result || ''));
                        reader.readAsDataURL(f);
                      } else {
                        setPartyLogoPreview('');
                      }
                    }}
                  />
                </label>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 cursor-pointer text-xs leading-relaxed">
                <input
                  type="checkbox"
                  checked={politicalConsentAccepted}
                  onChange={(e) => setPoliticalConsentAccepted(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <strong>Consentimiento expreso (Ley 1581 de 2012):</strong> Entiendo que mi afiliación política es un dato personal sensible de entrega estrictamente voluntaria. Autorizo su almacenamiento protegido únicamente para consulta administrativa editorial y para mostrarse en mi ficha pública si yo activo esa opción en mi panel. Puedo modificarlo o eliminarlo en cualquier momento.
                </span>
              </label>
            </div>
          )}
        </section>

        {/* Acceso y credenciales */}
        <div className="space-y-4">
          <div>
            <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
              Correo electrónico *
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
                Contraseña *
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
                Confirmar contraseña *
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
              Código de invitación único *
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
              Todos tus datos personales y opcionales inician ocultos al público; luego podrás elegir uno a uno cuáles mostrar desde «Mi panel».
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || isUnderageEntered}
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
