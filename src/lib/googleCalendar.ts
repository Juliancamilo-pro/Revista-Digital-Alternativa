import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const calendarProvider = new GoogleAuthProvider();
for (const scope of CALENDAR_SCOPES) {
  calendarProvider.addScope(scope);
}
calendarProvider.setCustomParameters({
  prompt: 'consent',
});

// Strict in-memory token store (never persisted to localStorage/sessionStorage)
let inMemoryAccessToken: string | null = null;
let connectedEmail: string | null = null;

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
}

export function getCalendarAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function getConnectedCalendarEmail(): string | null {
  return connectedEmail;
}

export function clearCalendarAccessToken(): void {
  inMemoryAccessToken = null;
  connectedEmail = null;
}

export async function connectGoogleCalendar(): Promise<{ token: string; email: string | null }> {
  const result = await signInWithPopup(auth, calendarProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;
  if (!token) {
    throw new Error('Google no devolvió un token de acceso de Calendar. Intenta autorizar nuevamente.');
  }
  inMemoryAccessToken = token;
  connectedEmail = result.user?.email || null;
  return { token, email: connectedEmail };
}

async function calendarFetch<T>(url: string, init?: RequestInit): Promise<T> {
  if (!inMemoryAccessToken) {
    throw new Error('Primero conecta tu cuenta de Google Calendar.');
  }
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${inMemoryAccessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (response.status === 401 || response.status === 403) {
    clearCalendarAccessToken();
    throw new Error('La sesión de Google Calendar expiró o no tiene permisos suficientes. Vuelve a conectarte.');
  }

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMessage = (data as { error?: { message?: string } })?.error?.message;
    throw new Error(apiMessage || 'Error al comunicarse con Google Calendar.');
  }
  return data as T;
}

export async function listUpcomingCalendarEvents(maxResults = 15): Promise<GoogleCalendarEvent[]> {
  const timeMin = encodeURIComponent(new Date().toISOString());
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`;
  const data = await calendarFetch<{ items?: GoogleCalendarEvent[] }>(url);
  return data.items || [];
}

export async function createCalendarEvent(params: {
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  location?: string;
}): Promise<GoogleCalendarEvent> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';
  const body = {
    summary: params.summary.trim(),
    description: (params.description || '').trim(),
    location: (params.location || '').trim() || undefined,
    start: { dateTime: params.startIso, timeZone },
    end: { dateTime: params.endIso, timeZone },
  };
  return calendarFetch<GoogleCalendarEvent>(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}

export async function updateCalendarEvent(
  eventId: string,
  params: {
    summary: string;
    description?: string;
    startIso: string;
    endIso: string;
  }
): Promise<GoogleCalendarEvent> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';
  const body = {
    summary: params.summary.trim(),
    description: (params.description || '').trim(),
    start: { dateTime: params.startIso, timeZone },
    end: { dateTime: params.endIso, timeZone },
  };
  return calendarFetch<GoogleCalendarEvent>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  );
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  await calendarFetch<Record<string, never>>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
    }
  );
}
