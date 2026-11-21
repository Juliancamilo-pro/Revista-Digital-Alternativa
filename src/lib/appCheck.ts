import { FirebaseApp } from 'firebase/app';
import { AppCheck, ReCaptchaV3Provider, initializeAppCheck } from 'firebase/app-check';

let appCheckInstance: AppCheck | null = null;
const COOLDOWN_PREFIX = 'alt_antispam_cd_';

export function initOptionalAppCheck(app: FirebaseApp): AppCheck | null {
  if (typeof window === 'undefined') return null;
  if (appCheckInstance) return appCheckInstance;

  const siteKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined)?.trim();
  if (!siteKey) {
    return null;
  }

  try {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    return appCheckInstance;
  } catch (err) {
    console.warn('No se pudo inicializar Firebase App Check:', err);
    return null;
  }
}

export function isAppCheckConfigured(): boolean {
  const siteKey = (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined)?.trim();
  return Boolean(siteKey);
}

export interface SpamChallenge {
  question: string;
  expectedAnswer: number;
}

export function generateSpamChallenge(): SpamChallenge {
  const a = Math.floor(Math.random() * 7) + 2;
  const b = Math.floor(Math.random() * 8) + 1;
  return {
    question: `¿Cuánto es ${a} + ${b}?`,
    expectedAnswer: a + b,
  };
}

export function checkActionCooldown(key: string, cooldownMs: number): { allowed: boolean; remainingSec: number } {
  if (typeof window === 'undefined') return { allowed: true, remainingSec: 0 };
  try {
    const raw = localStorage.getItem(`${COOLDOWN_PREFIX}${key}`);
    const last = raw ? Number(raw) : 0;
    const now = Date.now();
    if (last && now - last < cooldownMs) {
      return {
        allowed: false,
        remainingSec: Math.ceil((cooldownMs - (now - last)) / 1000),
      };
    }
    return { allowed: true, remainingSec: 0 };
  } catch {
    return { allowed: true, remainingSec: 0 };
  }
}

export function markActionCooldown(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${COOLDOWN_PREFIX}${key}`, String(Date.now()));
  } catch {
    // Ignore storage quota errors
  }
}
