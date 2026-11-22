import React, { useEffect, useState } from 'react';
import { Calendar, Edit3, ExternalLink, LogOut, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import {
  clearCalendarAccessToken,
  connectGoogleCalendar,
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarAccessToken,
  getConnectedCalendarEmail,
  GoogleCalendarEvent,
  listUpcomingCalendarEvents,
  updateCalendarEvent,
} from '../lib/googleCalendar';
import { sanitizeExternalUrl } from '../lib/utils';

interface GoogleCalendarPanelProps {
  defaultTitle?: string;
  defaultDescription?: string;
  defaultDateLocal?: string;
  compact?: boolean;
}

function toLocalDateTimeInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const GoogleCalendarPanel: React.FC<GoogleCalendarPanelProps> = ({
  defaultTitle = '',
  defaultDescription = '',
  defaultDateLocal = '',
  compact = false,
}) => {
  const [connected, setConnected] = useState(() => Boolean(getCalendarAccessToken()));
  const [email, setEmail] = useState<string | null>(() => getConnectedCalendarEmail());
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [summary, setSummary] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [startLocal, setStartLocal] = useState(defaultDateLocal);
  const [durationMin, setDurationMin] = useState(60);

  const [pendingAction, setPendingAction] = useState<
    | {
        kind: 'edit';
        event: GoogleCalendarEvent;
        summary: string;
        description: string;
        startLocal: string;
      }
    | {
        kind: 'delete';
        event: GoogleCalendarEvent;
      }
    | null
  >(null);

  useEffect(() => {
    if (defaultTitle && !summary) setSummary(defaultTitle);
  }, [defaultTitle, summary]);

  useEffect(() => {
    if (defaultDescription && !description) setDescription(defaultDescription);
  }, [defaultDescription, description]);

  useEffect(() => {
    if (defaultDateLocal && !startLocal) setStartLocal(defaultDateLocal);
  }, [defaultDateLocal, startLocal]);

  const loadEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const items = await listUpcomingCalendarEvents(15);
      setEvents(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los eventos.');
      if (!getCalendarAccessToken()) {
        setConnected(false);
        setEmail(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connected) {
      loadEvents();
    }
  }, [connected]);

  const handleConnect = async () => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const res = await connectGoogleCalendar();
      setConnected(true);
      setEmail(res.email);
      setNotice('Google Calendar conectado únicamente para esta sesión.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar con Google Calendar.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = () => {
    clearCalendarAccessToken();
    setConnected(false);
    setEmail(null);
    setEvents([]);
    setNotice('Sesión de Google Calendar desconectada.');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!summary.trim() || !startLocal) {
      setError('Indica el título y la fecha/hora de inicio.');
      return;
    }
    const startDate = new Date(startLocal);
    if (Number.isNaN(startDate.getTime())) {
      setError('La fecha de inicio no es válida.');
      return;
    }
    const endDate = new Date(startDate.getTime() + durationMin * 60000);
    setBusy(true);
    try {
      await createCalendarEvent({
        summary: summary.trim(),
        description: description.trim(),
        startIso: startDate.toISOString(),
        endIso: endDate.toISOString(),
      });
      setSummary('');
      setDescription('');
      setNotice('Cobertura o fecha editorial agendada en Google Calendar.');
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el evento.');
    } finally {
      setBusy(false);
    }
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (pendingAction.kind === 'edit') {
        const startDate = new Date(pendingAction.startLocal);
        if (Number.isNaN(startDate.getTime())) {
          setError('La fecha de inicio no es válida.');
          setBusy(false);
          return;
        }
        const endDate = new Date(startDate.getTime() + 60 * 60000);
        await updateCalendarEvent(pendingAction.event.id, {
          summary: pendingAction.summary,
          description: pendingAction.description,
          startIso: startDate.toISOString(),
          endIso: endDate.toISOString(),
        });
        setNotice('Evento actualizado en Google Calendar.');
      } else {
        await deleteCalendarEvent(pendingAction.event.id);
        setNotice('Evento eliminado de Google Calendar.');
      }
      setPendingAction(null);
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la acción en Google Calendar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] ${compact ? 'p-4' : 'p-6'} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Agenda editorial con Google Calendar</span>
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            {connected
              ? `Conectado${email ? ` (${email})` : ''} · El token se mantiene solo en memoria de sesión.`
              : 'Conecta tu cuenta para organizar coberturas periodísticas, entrevistas, cierres de edición y fechas clave.'}
          </p>
        </div>

        {!connected ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleConnect}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black font-display text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{busy ? 'Conectando...' : 'Conectar Google Calendar'}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadEvents}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 font-display text-xs font-bold uppercase cursor-pointer hover:border-black dark:hover:border-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-300 dark:border-red-900 text-red-600 font-display text-xs font-bold uppercase cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Desconectar</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
          {notice}
        </p>
      )}

      {connected && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <form onSubmit={handleCreate} className="lg:col-span-5 space-y-3">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider">
              Agendar cobertura o fecha editorial
            </h3>
            <input
              type="text"
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Ej. Entrevista sindical / Cierre especial regional"
              className="w-full px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
            />
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas de cobertura, fuentes o lugar"
              className="w-full px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="datetime-local"
                required
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <select
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              >
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
                <option value={90}>1 hora 30 min</option>
                <option value={120}>2 horas</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-60"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{busy ? 'Guardando...' : 'Agendar en Calendar'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 space-y-2.5">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider">
              Próximas coberturas y fechas ({events.length})
            </h3>
            {loading ? (
              <p className="text-xs text-neutral-500">Cargando eventos...</p>
            ) : events.length === 0 ? (
              <p className="text-xs text-neutral-500 py-4">No hay próximos eventos agendados en tu calendario.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {events.map((ev) => {
                  const startRaw = ev.start?.dateTime || ev.start?.date || '';
                  const formatted = startRaw
                    ? new Intl.DateTimeFormat('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: ev.start?.dateTime ? '2-digit' : undefined,
                        minute: ev.start?.dateTime ? '2-digit' : undefined,
                      }).format(new Date(startRaw))
                    : 'Sin fecha';
                  const safeLink = sanitizeExternalUrl(ev.htmlLink || '');
                  return (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-[#F8F6F1] dark:bg-[#1A1A1A] p-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-display font-bold uppercase text-[var(--editorial-primary)]">
                          {formatted}
                        </p>
                        <p className="font-semibold text-sm truncate">{ev.summary || '(Sin título)'}</p>
                        {ev.description && (
                          <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">{ev.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {safeLink && (
                          <a
                            href={safeLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Abrir en Google Calendar"
                            className="p-1.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          aria-label="Editar evento"
                          onClick={() =>
                            setPendingAction({
                              kind: 'edit',
                              event: ev,
                              summary: ev.summary || '',
                              description: ev.description || '',
                              startLocal: toLocalDateTimeInput(ev.start?.dateTime || ev.start?.date),
                            })
                          }
                          className="p-1.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Eliminar evento"
                          onClick={() => setPendingAction({ kind: 'delete', event: ev })}
                          className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-950/40 text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {pendingAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#F8F6F1] dark:bg-[#161616] border border-neutral-300 dark:border-neutral-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-xl font-extrabold uppercase">
                {pendingAction.kind === 'edit' ? 'Confirmar edición en Calendar' : 'Confirmar eliminación en Calendar'}
              </h4>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="p-1.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pendingAction.kind === 'delete' ? (
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                ¿Confirmas que deseas eliminar permanentemente el evento{' '}
                <strong>“{pendingAction.event.summary}”</strong> de tu cuenta de Google Calendar?
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-neutral-500">
                  Revisa los cambios antes de modificar el evento en Google Calendar.
                </p>
                <input
                  type="text"
                  value={pendingAction.summary}
                  onChange={(e) =>
                    setPendingAction({ ...pendingAction, summary: e.target.value })
                  }
                  placeholder="Título"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                />
                <textarea
                  rows={2}
                  value={pendingAction.description}
                  onChange={(e) =>
                    setPendingAction({ ...pendingAction, description: e.target.value })
                  }
                  placeholder="Descripción"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                />
                <input
                  type="datetime-local"
                  value={pendingAction.startLocal}
                  onChange={(e) =>
                    setPendingAction({ ...pendingAction, startLocal: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="px-4 py-2 rounded-full border border-neutral-300 dark:border-neutral-700 font-display text-xs font-bold uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmPendingAction}
                className={`px-5 py-2 rounded-full text-white font-display text-xs font-bold uppercase cursor-pointer disabled:opacity-60 ${
                  pendingAction.kind === 'delete'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)]'
                }`}
              >
                {busy
                  ? 'Procesando...'
                  : pendingAction.kind === 'delete'
                  ? 'Sí, eliminar evento'
                  : 'Confirmar actualización'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
