import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { BarChart3, Edit3, MessageSquare, Plus, Radio, Trash2, Upload, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { db } from '../lib/firebase';
import { formatDateEs, generateId, uploadMediaAsset } from '../lib/utils';
import {
  AnalyticsEvent,
  CommentItem,
  OutletType,
  Post,
  StreamSourceType,
} from '../types/editorial';
import { BlockEditor } from './BlockEditor';
import { GoogleCalendarPanel } from './GoogleCalendarPanel';

type CollabTab = 'posts' | 'streams' | 'comments' | 'profile' | 'stats';

export const CollaboratorPanel: React.FC = () => {
  const { firebaseUser, userAccount, collaboratorProfile, isActiveCollaborator, isCollaborator, refreshUserDocs } =
    useAuth();
  const { myPosts, livestreams, navigate, setAuthModalOpen } = useSite();

  const [tab, setTab] = useState<CollabTab>('posts');
  const [editingPost, setEditingPost] = useState<Post | null | undefined>(undefined);
  const [ownComments, setOwnComments] = useState<CommentItem[]>([]);
  const [ownAnalytics, setOwnAnalytics] = useState<AnalyticsEvent[]>([]);

  // Profile state
  const [name, setName] = useState(collaboratorProfile?.name || '');
  const [outletType, setOutletType] = useState<OutletType>(collaboratorProfile?.outletType || 'independiente');
  const [bio, setBio] = useState(collaboratorProfile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(collaboratorProfile?.avatarUrl || '');
  const [websiteUrl, setWebsiteUrl] = useState(collaboratorProfile?.websiteUrl || '');
  const [socialTwitter, setSocialTwitter] = useState(collaboratorProfile?.socialTwitter || '');
  const [socialInstagram, setSocialInstagram] = useState(collaboratorProfile?.socialInstagram || '');
  const [socialYoutube, setSocialYoutube] = useState(collaboratorProfile?.socialYoutube || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [panelError, setPanelError] = useState('');

  // Stream creation state
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDesc, setStreamDesc] = useState('');
  const [streamSourceType, setStreamSourceType] = useState<StreamSourceType>('youtube');
  const [streamUrl, setStreamUrl] = useState('');
  const [streamDate, setStreamDate] = useState('');
  const [streamMsg, setStreamMsg] = useState('');
  const [streamErr, setStreamErr] = useState('');

  useEffect(() => {
    if (collaboratorProfile) {
      setName(collaboratorProfile.name);
      setOutletType(collaboratorProfile.outletType);
      setBio(collaboratorProfile.bio || '');
      setAvatarUrl(collaboratorProfile.avatarUrl || '');
      setWebsiteUrl(collaboratorProfile.websiteUrl || '');
      setSocialTwitter(collaboratorProfile.socialTwitter || '');
      setSocialInstagram(collaboratorProfile.socialInstagram || '');
      setSocialYoutube(collaboratorProfile.socialYoutube || '');
    }
  }, [collaboratorProfile]);

  useEffect(() => {
    if (!firebaseUser || !isActiveCollaborator) return;
    const unsubComments = onSnapshot(
      query(collection(db, 'comments'), where('postAuthorId', '==', firebaseUser.uid)),
      (snap) => setOwnComments(snap.docs.map((d) => d.data() as CommentItem)),
      (err) => console.warn('Collab comments:', err)
    );
    const unsubStats = onSnapshot(
      query(collection(db, 'analytics_events'), where('authorId', '==', firebaseUser.uid)),
      (snap) => setOwnAnalytics(snap.docs.map((d) => d.data() as AnalyticsEvent)),
      (err) => console.warn('Collab stats:', err)
    );
    return () => {
      unsubComments();
      unsubStats();
    };
  }, [firebaseUser, isActiveCollaborator]);

  const myStreams = useMemo(
    () => livestreams.filter((s) => firebaseUser && s.hostId === firebaseUser.uid),
    [livestreams, firebaseUser]
  );

  if (!firebaseUser) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-3xl font-extrabold uppercase">Panel de Colaboradores</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Inicia sesión con tu cuenta de colaborador o regístrate con tu código de invitación.
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="px-5 py-2.5 bg-[var(--editorial-primary)] text-white font-display font-bold uppercase text-xs cursor-pointer"
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => navigate('/unete')}
            className="px-5 py-2.5 border border-neutral-400 font-display font-bold uppercase text-xs cursor-pointer"
          >
            Registrarme con código
          </button>
        </div>
      </main>
    );
  }

  if (!isCollaborator) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-3xl font-extrabold uppercase">Acceso restringido a colaboradores</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Tu cuenta actual tiene rol de lector. Para publicar contenidos necesitas registrarte mediante código de invitación.
        </p>
        <button
          type="button"
          onClick={() => navigate('/unete')}
          className="px-5 py-2.5 bg-[var(--editorial-primary)] text-white font-display font-bold uppercase text-xs cursor-pointer"
        >
          Ir a registro de colaborador
        </button>
      </main>
    );
  }

  if (!isActiveCollaborator) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4 border border-neutral-300 dark:border-neutral-800 my-10 p-8">
        <h1 className="font-display text-3xl font-extrabold uppercase">
          Estado de cuenta: {userAccount?.status === 'suspended' ? 'Suspendida' : 'Pendiente de aprobación'}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          {userAccount?.status === 'suspended'
            ? 'Tu acceso editorial se encuentra temporalmente suspendido por la administración.'
            : 'Tu solicitud fue verificada con el código de invitación y está en revisión por la administración del medio.'}
        </p>
      </main>
    );
  }

  const totalViews = myPosts.reduce((acc, p) => acc + (p.viewCount || 0), 0);
  const avgReadSec = ownAnalytics.length
    ? Math.round(ownAnalytics.reduce((a, e) => a + (e.readDurationSec || 0), 0) / ownAnalytics.length)
    : 0;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    const cleanName = name.trim().slice(0, 120);
    if (cleanName.length < 2) {
      setProfileErr('El nombre público debe tener al menos 2 caracteres.');
      return;
    }
    try {
      await updateDoc(doc(db, 'collaborators_public', firebaseUser.uid), {
        name: cleanName,
        outletType,
        bio: bio.trim().slice(0, 2000),
        avatarUrl: avatarUrl.trim().slice(0, 400000),
        websiteUrl: websiteUrl.trim().slice(0, 500),
        socialTwitter: socialTwitter.trim().slice(0, 300),
        socialInstagram: socialInstagram.trim().slice(0, 300),
        socialYoutube: socialYoutube.trim().slice(0, 300),
        updatedAt: serverTimestamp(),
      });
      await refreshUserDocs();
      setProfileMsg('Perfil público actualizado correctamente.');
    } catch {
      setProfileErr('No se pudo actualizar tu perfil público. Verifica los datos e intenta nuevamente.');
    }
  };

  const handleCreateStream = async (e: React.FormEvent) => {
    e.preventDefault();
    setStreamMsg('');
    setStreamErr('');
    const cleanTitle = streamTitle.trim().slice(0, 200);
    if (cleanTitle.length < 3) {
      setStreamErr('El título de la transmisión debe tener al menos 3 caracteres.');
      return;
    }
    try {
      const id = generateId('live');
      const rawHost = (collaboratorProfile?.name || userAccount?.displayName || 'Colaborador').trim().slice(0, 120);
      await setDoc(doc(db, 'livestreams', id), {
        id,
        title: cleanTitle,
        description: streamDesc.trim().slice(0, 2000),
        status: 'scheduled',
        sourceType: streamSourceType,
        sourceUrl: streamUrl.trim().slice(0, 2000),
        scheduledFor: streamDate ? new Date(streamDate) : new Date(),
        hostId: firebaseUser.uid,
        hostName: rawHost.length >= 2 ? rawHost : 'Colaborador',
        viewerCount: 0,
        peakViewers: 0,
        isSample: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setStreamTitle('');
      setStreamDesc('');
      setStreamUrl('');
      setStreamMsg('Transmisión programada. Puedes iniciarla desde su sala en vivo.');
    } catch {
      setStreamErr('No se pudo programar la transmisión en este momento.');
    }
  };

  if (editingPost !== undefined) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <BlockEditor
          initialPost={editingPost}
          onSaved={() => setEditingPost(undefined)}
          onCancel={() => setEditingPost(undefined)}
        />
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="border-b-2 border-[#111111] dark:border-neutral-700 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
            Panel autónomo de colaborador
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight">
            {collaboratorProfile?.name || userAccount?.displayName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(`/colaborador/${firebaseUser.uid}`)}
            className="px-4 py-2 rounded-full border border-neutral-400 dark:border-neutral-700 font-display text-xs font-bold uppercase cursor-pointer"
          >
            Ver perfil público
          </button>
          <button
            type="button"
            onClick={() => setEditingPost(null)}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva publicación</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-neutral-300 dark:border-neutral-800 pb-3 text-xs font-display font-bold uppercase tracking-wider">
        {(
          [
            ['posts', 'Mis publicaciones', Edit3],
            ['streams', 'Mis transmisiones', Radio],
            ['comments', `Comentarios (${ownComments.length})`, MessageSquare],
            ['profile', 'Perfil público', User],
            ['stats', 'Estadísticas', BarChart3],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full cursor-pointer transition-colors ${
              tab === key
                ? 'bg-[#111111] text-white dark:bg-white dark:text-black'
                : 'border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {panelError && (
        <div role="alert" className="rounded-2xl p-3 border border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm">
          {panelError}
        </div>
      )}

      {tab === 'posts' && (
        <div className="space-y-4">
          {myPosts.length === 0 ? (
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-10 text-center space-y-3">
              <p className="text-neutral-600 dark:text-neutral-400">Todavía no tienes publicaciones propias.</p>
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="px-5 py-2.5 rounded-full bg-[var(--editorial-primary)] text-white font-display text-xs font-bold uppercase cursor-pointer"
              >
                Crear primera publicación
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-300 dark:border-neutral-800 font-display text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Titular</th>
                    <th className="px-4 py-3">Formato</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Lecturas</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {myPosts.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-semibold max-w-sm">
                        <button
                          type="button"
                          onClick={() => navigate(`/articulo/${p.slug}`)}
                          className="text-left hover:text-[var(--editorial-primary)] cursor-pointer"
                        >
                          {p.title}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs uppercase font-display">{p.type}</td>
                      <td className="px-4 py-3 text-xs font-display uppercase">{p.status}</td>
                      <td className="px-4 py-3 text-right font-tabular">{p.viewCount || 0}</td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setEditingPost(p)}
                          className="text-xs font-display font-bold uppercase hover:text-[var(--editorial-primary)] cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setPanelError('');
                            try {
                              await deleteDoc(doc(db, 'posts', p.id));
                            } catch {
                              setPanelError('No se pudo eliminar la publicación.');
                            }
                          }}
                          className="text-xs font-display font-bold uppercase text-red-600 hover:underline cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'streams' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <form onSubmit={handleCreateStream} className="lg:col-span-5 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-4">
              <h2 className="font-display text-xl font-bold uppercase">Programar transmisión propia</h2>
              <input
                type="text"
                required
                minLength={3}
                maxLength={200}
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="Título de la transmisión"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              />
              <textarea
                rows={2}
                value={streamDesc}
                onChange={(e) => setStreamDesc(e.target.value)}
                placeholder="Descripción breve"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              />
              <select
                value={streamSourceType}
                onChange={(e) => setStreamSourceType(e.target.value as StreamSourceType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              >
                <option value="youtube">YouTube Live</option>
                <option value="facebook">Facebook Live</option>
                <option value="twitch">Twitch</option>
                <option value="hls">URL HLS / MP4</option>
                <option value="webrtc">Cámara directa del navegador (WebRTC)</option>
              </select>
              {streamSourceType !== 'webrtc' && (
                <input
                  type="url"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  placeholder="URL de la transmisión"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                />
              )}
              <input
                type="datetime-local"
                value={streamDate}
                onChange={(e) => setStreamDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              />
              <button type="submit" className="w-full py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase cursor-pointer">
                Programar transmisión
              </button>
              {streamErr && <p role="alert" className="text-xs text-red-600">{streamErr}</p>}
              {streamMsg && <p className="text-xs text-emerald-600">{streamMsg}</p>}
            </form>

            <div className="lg:col-span-7 space-y-3">
              <h2 className="font-display text-xl font-bold uppercase">Mis transmisiones ({myStreams.length})</h2>
              {myStreams.map((s) => (
                <div key={s.id} className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-display font-bold uppercase text-[var(--editorial-primary)]">
                      {s.status} · {formatDateEs(s.scheduledFor || s.createdAt, true)}
                    </p>
                    <p className="font-display text-lg font-bold">{s.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/en-vivo/${s.id}`)}
                      className="px-4 py-1.5 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black font-display text-xs font-bold uppercase cursor-pointer"
                    >
                      Abrir sala
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setPanelError('');
                        try {
                          await deleteDoc(doc(db, 'livestreams', s.id));
                        } catch {
                          setPanelError('No se pudo eliminar la transmisión.');
                        }
                      }}
                      aria-label="Eliminar transmisión"
                      className="p-2 rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <GoogleCalendarPanel
            defaultTitle={streamTitle}
            defaultDescription={streamDesc}
            defaultDateLocal={streamDate}
          />
        </div>
      )}

      {tab === 'comments' && (
        <div className="space-y-3">
          {ownComments.length === 0 ? (
            <p className="text-sm text-neutral-500">No hay comentarios en tus publicaciones aún.</p>
          ) : (
            ownComments.map((c) => (
              <div key={c.id} className="border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-neutral-500">
                    En <strong>{c.postTitle}</strong> · {c.authorName} · Estado: {c.status}
                  </p>
                  <p className="text-sm mt-1">{c.text}</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-display font-bold uppercase shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      setPanelError('');
                      try {
                        await updateDoc(doc(db, 'comments', c.id), { status: 'approved', updatedAt: serverTimestamp() });
                      } catch {
                        setPanelError('No se pudo aprobar el comentario.');
                      }
                    }}
                    className="px-2.5 py-1 border border-emerald-600 text-emerald-600 cursor-pointer"
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setPanelError('');
                      try {
                        await updateDoc(doc(db, 'comments', c.id), { status: 'hidden', updatedAt: serverTimestamp() });
                      } catch {
                        setPanelError('No se pudo ocultar el comentario.');
                      }
                    }}
                    className="px-2.5 py-1 border border-neutral-400 cursor-pointer"
                  >
                    Ocultar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setPanelError('');
                      try {
                        await deleteDoc(doc(db, 'comments', c.id));
                      } catch {
                        setPanelError('No se pudo eliminar el comentario.');
                      }
                    }}
                    className="px-2.5 py-1 text-red-600 cursor-pointer"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="max-w-2xl rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-4">
          <h2 className="font-display text-2xl font-extrabold uppercase">Perfil público del medio o periodista</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Nombre público</label>
              <input type="text" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Modalidad</label>
              <select value={outletType} onChange={(e) => setOutletType(e.target.value as OutletType)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm">
                <option value="independiente">Periodista independiente</option>
                <option value="medio">Medio o revista aliada</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-display text-xs font-bold uppercase mb-1">Logo o retrato (URL o subir)</label>
            <div className="flex gap-2">
              <input type="text" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
              <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111111] text-white text-xs font-display font-bold uppercase cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Subir</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setProfileErr('');
                      try {
                        const res = await uploadMediaAsset(f, `avatars/${firebaseUser.uid}`);
                        setAvatarUrl(res.url);
                      } catch (err) {
                        setProfileErr(err instanceof Error ? err.message : 'No se pudo subir la imagen.');
                      }
                    }
                  }}
                />
              </label>
            </div>
          </div>
          <div>
            <label className="block font-display text-xs font-bold uppercase mb-1">Biografía / Línea editorial</label>
            <textarea rows={3} maxLength={2000} value={bio} onChange={(e) => setBio(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="Sitio web (https://...)" className="px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
            <input type="text" value={socialTwitter} onChange={(e) => setSocialTwitter(e.target.value)} placeholder="X / Twitter" className="px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
            <input type="text" value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} placeholder="Instagram" className="px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
            <input type="text" value={socialYoutube} onChange={(e) => setSocialYoutube(e.target.value)} placeholder="YouTube" className="px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
          </div>
          <button type="submit" className="px-6 py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase cursor-pointer">
            Guardar perfil
          </button>
          {profileErr && <p role="alert" className="text-xs text-red-600">{profileErr}</p>}
          {profileMsg && <p className="text-xs text-emerald-600">{profileMsg}</p>}
        </form>
      )}

      {tab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5">
              <p className="font-display text-xs uppercase tracking-wider text-neutral-500">Visitas totales</p>
              <p className="font-tabular text-3xl font-bold mt-1">{totalViews.toLocaleString('es-ES')}</p>
            </div>
            <div className="border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5">
              <p className="font-display text-xs uppercase tracking-wider text-neutral-500">Publicaciones propias</p>
              <p className="font-tabular text-3xl font-bold mt-1">{myPosts.length}</p>
            </div>
            <div className="border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5">
              <p className="font-display text-xs uppercase tracking-wider text-neutral-500">Lectura promedio</p>
              <p className="font-tabular text-3xl font-bold mt-1">{avgReadSec} s</p>
            </div>
          </div>
          <div className="border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 space-y-3">
            <h3 className="font-display text-lg font-bold uppercase">Rendimiento por publicación</h3>
            {myPosts.map((p) => (
              <div key={p.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold truncate max-w-md">{p.title}</span>
                  <span className="font-tabular">{p.viewCount || 0} lecturas</span>
                </div>
                <div className="h-2 bg-neutral-200 dark:bg-neutral-800">
                  <div
                    className="h-2 bg-[var(--editorial-primary)]"
                    style={{ width: `${Math.min(100, Math.round(((p.viewCount || 0) / Math.max(1, totalViews)) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
};
