import { Post } from '../types/editorial';

const NOTIF_OPTIN_KEY = 'revista_article_alerts_enabled';
const LAST_NOTIFIED_POST_KEY = 'revista_last_notified_post_id';

export function isArticleAlertsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getArticleAlertsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(NOTIF_OPTIN_KEY) === 'true' && Notification.permission === 'granted';
}

export async function requestArticleAlertsPermission(): Promise<{
  ok: boolean;
  message: string;
}> {
  if (!isArticleAlertsSupported()) {
    return {
      ok: false,
      message: 'Tu navegador no admite notificaciones locales en este dispositivo.',
    };
  }
  if (Notification.permission === 'denied') {
    return {
      ok: false,
      message: 'Las notificaciones fueron bloqueadas en tu navegador. Habilítalas desde la configuración del sitio.',
    };
  }
  try {
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem(NOTIF_OPTIN_KEY, 'true');
      return {
        ok: true,
        message: 'Alertas activadas. Te avisaremos cuando haya nuevas publicaciones disponibles en la revista.',
      };
    }
    return {
      ok: false,
      message: 'No se concedió permiso para mostrar alertas de nuevas notas.',
    };
  } catch {
    return {
      ok: false,
      message: 'No se pudo solicitar el permiso de notificaciones en este entorno.',
    };
  }
}

export function disableArticleAlerts(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(NOTIF_OPTIN_KEY, 'false');
}

export async function maybeNotifyNewPost(latestPost?: Post, siteName = 'Revista Digital Alternativa'): Promise<void> {
  if (!latestPost || typeof window === 'undefined' || !getArticleAlertsEnabled()) return;
  const lastSeen = localStorage.getItem(LAST_NOTIFIED_POST_KEY);
  if (!lastSeen) {
    localStorage.setItem(LAST_NOTIFIED_POST_KEY, latestPost.id);
    return;
  }
  if (lastSeen === latestPost.id) return;
  localStorage.setItem(LAST_NOTIFIED_POST_KEY, latestPost.id);

  const title = `Nueva nota en ${siteName}`;
  const body = `${latestPost.categoryName}: ${latestPost.title}`;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: `post-${latestPost.id}`,
          data: { url: `/articulo/${latestPost.slug}` },
        });
        return;
      }
    }
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
    });
  } catch {
    // Ignore restricted notification environments (e.g., iframe previews)
  }
}
