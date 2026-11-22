import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { BarChart3, Edit3, Eye, EyeOff, MessageSquare, Plus, Reply, Upload, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { db } from '../lib/firebase';
import { generateId, sanitizeExternalUrl, uploadMediaAsset } from '../lib/utils';
import {
  AnalyticsEvent,
  CollaboratorPrivacyFlags,
  CollaboratorSettings,
  CommentItem,
  OutletType,
  Post,
} from '../types/editorial';
import { BlockEditor } from './BlockEditor';
import { EditorialImage } from './EditorialImage';
import { VerifiedBadge } from './VerifiedBadge';

type CollabTab = 'posts' | 'comments' | 'profile' | 'stats';

const DEFAULT_PRIVACY_FLAGS: Required<CollaboratorPrivacyFlags> = {
  showInDirectory: false,
  showAvatar: false,
  showBio: false,
  showWebsite: false,
  showSocialTwitter: false,
  showSocialInstagram: false,
  showSocialYoutube: false,
  showPublicEmail: false,
  showLocation: false,
  showTopics: false,
  showJoinDate: false,
  showPostCount: false,
};

export const CollaboratorPanel: React.FC = () => {
  const { firebaseUser, userAccount, collaboratorProfile, isActiveCollaborator, isCollaborator, refreshUserDocs } =
    useAuth();
  const { myPosts, siteConfig, navigate, setAuthModalOpen } = useSite();

  const [tab, setTab] = useState<CollabTab>('posts');
  const [editingPost, setEditingPost] = useState<Post | null | undefined>(undefined);
  const [ownComments, setOwnComments] = useState<CommentItem[]>([]);
  const [ownAnalytics, setOwnAnalytics] = useState<AnalyticsEvent[]>([]);
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Profile & private privacy flags state (ALL privacy flags OFF by default)
  const [name, setName] = useState(collaboratorProfile?.name || '');
  const [outletType, setOutletType] = useState<OutletType>(collaboratorProfile?.outletType || 'independiente');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [socialTwitter, setSocialTwitter] = useState('');
  const [socialInstagram, setSocialInstagram] = useState('');
  const [socialYoutube, setSocialYoutube] = useState('');
  const [publicEmail, setPublicEmail] = useState('');
  const [location, setLocation] = useState('');
  const [topicsInput, setTopicsInput] = useState('');
  const [flags, setFlags] = useState<Required<CollaboratorPrivacyFlags>>({ ...DEFAULT_PRIVACY_FLAGS });

  const [avatarProgress, setAvatarProgress] = useState<number | null>(null);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [panelError, setPanelError] = useState('');

  // Load private collaborator_settings first, falling back to public profile defaults
  useEffect(() => {
    if (!firebaseUser) return;
    let cancelled = false;
    getDoc(doc(db, 'collaborator_settings', firebaseUser.uid))
      .then((snap) => {
        if (cancelled) return;
        const priv = snap.exists() ? (snap.data() as CollaboratorSettings) : null;
        const src = priv || collaboratorProfile;
        if (!src) return;
        setName(src.name || '');
        setOutletType(src.outletType || 'independiente');
        setBio(src.bio || '');
        setAvatarUrl(src.avatarUrl || '');
        setWebsiteUrl(src.websiteUrl || '');
        setSocialTwitter(src.socialTwitter || '');
        setSocialInstagram(src.socialInstagram || '');
        setSocialYoutube(src.socialYoutube || '');
        setPublicEmail(src.publicEmail || '');
        setLocation(src.location || '');
        setTopicsInput(Array.isArray(src.topics) ? src.topics.join(', ') : '');
        setFlags({
          showInDirectory: Boolean(src.showInDirectory),
          showAvatar: Boolean(src.showAvatar),
          showBio: Boolean(src.showBio),
          showWebsite: Boolean(src.showWebsite),
          showSocialTwitter: Boolean(src.showSocialTwitter),
          showSocialInstagram: Boolean(src.showSocialInstagram),
          showSocialYoutube: Boolean(src.showSocialYoutube),
          showPublicEmail: Boolean(src.showPublicEmail),
          showLocation: Boolean(src.showLocation),
          showTopics: Boolean(src.showTopics),
          showJoinDate: Boolean(src.showJoinDate),
          showPostCount: Boolean(src.showPostCount),
        });
      })
      .catch(() => {
        if (!cancelled && collaboratorProfile) {
          setName(collaboratorProfile.name || '');
          setOutletType(collaboratorProfile.outletType || 'independiente');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseUser?.uid, collaboratorProfile]);

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
            className="px-5 py-2.5 rounded-full bg-[var(--editorial-primary)] text-white font-display font-bold uppercase text-xs cursor-pointer"
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => navigate('/unete')}
            className="px-5 py-2.5 rounded-full border border-neutral-400 font-display font-bold uppercase text-xs cursor-pointer"
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
          className="px-5 py-2.5 rounded-full bg-[var(--editorial-primary)] text-white font-display font-bold uppercase text-xs cursor-pointer"
        >
          Ir a registro de colaborador
        </button>
      </main>
    );
  }

  if (!isActiveCollaborator) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4 rounded-2xl border border-neutral-300 dark:border-neutral-800 my-10 p-8">
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
  const isVerifiedCollab = userAccount?.status === 'active' && collaboratorProfile?.status === 'active';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    const cleanName = name.trim().slice(0, 120);
    if (cleanName.length < 2) {
      setProfileErr('El nombre público debe tener al menos 2 caracteres.');
      return;
    }

    const parsedTopics = topicsInput
      .split(',')
      .map((t) => t.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 15);

    const cleanWebsite = websiteUrl.trim() ? sanitizeExternalUrl(websiteUrl.trim()).slice(0, 500) : '';
    const cleanAvatar = avatarUrl.trim().slice(0, 400000);
    const cleanBio = bio.trim().slice(0, 2000);
    const cleanTw = socialTwitter.trim().slice(0, 300);
    const cleanIg = socialInstagram.trim().slice(0, 300);
    const cleanYt = socialYoutube.trim().slice(0, 300);
    const cleanEmail = publicEmail.trim().slice(0, 200);
    const cleanLocation = location.trim().slice(0, 120);

    try {
      // 1. Save full draft + privacy switches into private /collaborator_settings/{uid}
      await setDoc(doc(db, 'collaborator_settings', firebaseUser.uid), {
        uid: firebaseUser.uid,
        name: cleanName,
        outletType,
        bio: cleanBio,
        avatarUrl: cleanAvatar,
        websiteUrl: cleanWebsite,
        socialTwitter: cleanTw,
        socialInstagram: cleanIg,
        socialYoutube: cleanYt,
        publicEmail: cleanEmail,
        location: cleanLocation,
        topics: parsedTopics,
        ...flags,
        updatedAt: serverTimestamp(),
      });

      // 2. Project strictly opted-in public fields to /collaborators_public/{uid}
      await updateDoc(doc(db, 'collaborators_public', firebaseUser.uid), {
        name: cleanName,
        outletType,
        bio: flags.showBio ? cleanBio : '',
        avatarUrl: flags.showAvatar ? cleanAvatar : '',
        websiteUrl: flags.showWebsite ? cleanWebsite : '',
        socialTwitter: flags.showSocialTwitter ? cleanTw : '',
        socialInstagram: flags.showSocialInstagram ? cleanIg : '',
        socialYoutube: flags.showSocialYoutube ? cleanYt : '',
        publicEmail: flags.showPublicEmail ? cleanEmail : '',
        location: flags.showLocation ? cleanLocation : '',
        topics: flags.showTopics ? parsedTopics : [],
        ...flags,
        updatedAt: serverTimestamp(),
      });

      await refreshUserDocs();
      setProfileMsg('Perfil y preferencias de privacidad guardados correctamente.');
    } catch {
      setProfileErr('No se pudo actualizar tu perfil. Verifica los datos e intenta nuevamente.');
    }
  };

  const handleReplyToComment = async (parent: CommentItem) => {
    const clean = replyText.trim().slice(0, 2000);
    if (!clean) return;
    setPanelError('');
    try {
      const id = generateId('cmt');
      const authorDisplay = (collaboratorProfile?.name || userAccount?.displayName || 'Colaborador')
        .trim()
        .slice(0, 80);
      await setDoc(doc(db, 'comments', id), {
        id,
        postId: parent.postId,
        postTitle: parent.postTitle.slice(0, 220),
        postAuthorId: parent.postAuthorId,
        parentId: parent.id,
        authorId: firebaseUser.uid,
        authorName: authorDisplay || 'Colaborador',
        authorIsAnonymous: false,
        authorIsAdmin: false,
        authorProfileId: firebaseUser.uid,
        ...(flags.showAvatar && avatarUrl ? { authorAvatar: avatarUrl.slice(0, 400000) } : {}),
        text: clean,
        status: siteConfig.commentModerationMode === 'pre' ? 'pending' : 'approved',
        likesCount: 0,
        reportCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setReplyTargetId(null);
      setReplyText('');
    } catch {
      setPanelError('No se pudo publicar tu respuesta.');
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

  const toggleFlag = (key: keyof CollaboratorPrivacyFlags) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="border-b-2 border-[#111111] dark:border-neutral-700 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
            Panel autónomo de colaborador
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight flex items-center gap-2">
            <span>{collaboratorProfile?.name || userAccount?.displayName}</span>
            {isVerifiedCollab && <VerifiedBadge size="md" />}
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
            ['comments', `Comentarios (${ownComments.length})`, MessageSquare],
            ['profile', 'Mi perfil y privacidad', User],
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
            <div className="overflow-x-auto rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414]">
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

      {tab === 'comments' && (
        <div className="space-y-3">
          {ownComments.length === 0 ? (
            <p className="text-sm text-neutral-500">No hay comentarios en tus publicaciones aún.</p>
          ) : (
            ownComments.map((c) => (
              <div key={c.id} className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-neutral-500">
                      En <strong>{c.postTitle}</strong> · {c.authorName} · Estado: {c.status}
                    </p>
                    <p className="text-sm mt-1">{c.text}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-display font-bold uppercase shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTargetId(replyTargetId === c.id ? null : c.id);
                        setReplyText('');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-neutral-300 dark:border-neutral-700 cursor-pointer"
                    >
                      <Reply className="w-3 h-3" /> Responder
                    </button>
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
                      className="px-2.5 py-1 rounded-full border border-emerald-600 text-emerald-600 cursor-pointer"
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
                      className="px-2.5 py-1 rounded-full border border-neutral-400 cursor-pointer"
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
                {replyTargetId === c.id && (
                  <div className="flex gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Escribe una respuesta pública..."
                      className="flex-1 px-3 py-1.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleReplyToComment(c)}
                      className="px-4 py-1.5 rounded-full bg-[var(--editorial-primary)] text-white text-xs font-display font-bold uppercase cursor-pointer"
                    >
                      Enviar
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="max-w-3xl rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-6">
          <div className="space-y-1 border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <h2 className="font-display text-2xl font-extrabold uppercase">Mi perfil y privacidad pública</h2>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              Por seguridad, toda tu información adicional permanece oculta por defecto. Activa únicamente los datos que autorizas mostrar en el directorio y en tu página pública.
            </p>
          </div>

          {/* Directory master opt-in */}
          <label className="flex items-start gap-3 p-4 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[#F8F6F1] dark:bg-[#1A1A1A] cursor-pointer">
            <input
              type="checkbox"
              checked={flags.showInDirectory}
              onChange={() => toggleFlag('showInDirectory')}
              className="mt-1"
            />
            <span className="text-sm">
              <strong className="font-display uppercase text-xs tracking-wider block">
                Aparecer en el directorio «Conozcan a nuestros colaboradores»
              </strong>
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                Si está desactivado, tu perfil no se listará en el directorio público ni en la portada.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Nombre público o firma</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              />
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Modalidad</label>
              <select
                value={outletType}
                onChange={(e) => setOutletType(e.target.value as OutletType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              >
                <option value="independiente">Periodista independiente</option>
                <option value="medio">Medio o revista aliada</option>
              </select>
            </div>
          </div>

          {/* Avatar + privacy switch */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-xs font-bold uppercase">Foto o logotipo (recorte 1:1)</span>
              <button
                type="button"
                onClick={() => toggleFlag('showAvatar')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-display font-bold uppercase cursor-pointer ${
                  flags.showAvatar
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {flags.showAvatar ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>{flags.showAvatar ? 'Visible públicamente' : 'Oculto'}</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {avatarUrl && (
                <div className="w-12 h-12 rounded-full overflow-hidden border border-neutral-300 dark:border-neutral-700 shrink-0">
                  <EditorialImage src={avatarUrl} alt={name} fallbackTitle={name} allowInDataSaver />
                </div>
              )}
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="URL de imagen o sube un archivo"
                className="flex-1 min-w-[200px] px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black text-xs font-display font-bold uppercase cursor-pointer">
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
                      setAvatarProgress(5);
                      try {
                        const res = await uploadMediaAsset(
                          f,
                          `avatars/${firebaseUser.uid}`,
                          (pct) => setAvatarProgress(pct),
                          'avatar'
                        );
                        setAvatarUrl(res.url);
                      } catch (err) {
                        setProfileErr(err instanceof Error ? err.message : 'No se pudo subir la imagen.');
                      } finally {
                        setTimeout(() => setAvatarProgress(null), 600);
                      }
                    }
                  }}
                />
              </label>
            </div>
            {avatarProgress !== null && (
              <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                <div className="h-1.5 bg-[var(--editorial-primary)]" style={{ width: `${avatarProgress}%` }} />
              </div>
            )}
          </div>

          {/* Bio + privacy switch */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="font-display text-xs font-bold uppercase">Biografía / Línea editorial</label>
              <button
                type="button"
                onClick={() => toggleFlag('showBio')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-display font-bold uppercase cursor-pointer ${
                  flags.showBio
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {flags.showBio ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>{flags.showBio ? 'Visible' : 'Oculto'}</span>
              </button>
            </div>
            <textarea
              rows={3}
              maxLength={2000}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Trayectoria, enfoque periodístico o medio..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
            />
          </div>

          {/* Optional fields with individual visibility switches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(
              [
                ['Sitio web', websiteUrl, setWebsiteUrl, 'showWebsite', 'https://...', 'url'],
                ['Correo público de contacto', publicEmail, setPublicEmail, 'showPublicEmail', 'contacto@ejemplo.org', 'email'],
                ['Ciudad o territorio', location, setLocation, 'showLocation', 'Ej. Bogotá, Colombia', 'text'],
                ['Temas (separados por coma)', topicsInput, setTopicsInput, 'showTopics', 'Derechos humanos, economía, territorio', 'text'],
                ['X / Twitter', socialTwitter, setSocialTwitter, 'showSocialTwitter', '@usuario o https://...', 'text'],
                ['Instagram', socialInstagram, setSocialInstagram, 'showSocialInstagram', '@usuario o https://...', 'text'],
                ['YouTube', socialYoutube, setSocialYoutube, 'showSocialYoutube', 'Canal o https://...', 'text'],
              ] as const
            ).map(([label, val, setter, flagKey, placeholder, inputType]) => {
              const active = flags[flagKey];
              return (
                <div key={flagKey} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-[11px] font-bold uppercase">{label}</span>
                    <button
                      type="button"
                      onClick={() => toggleFlag(flagKey)}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-display font-bold uppercase cursor-pointer ${
                        active
                          ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                          : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      <span>{active ? 'Visible' : 'Oculto'}</span>
                    </button>
                  </div>
                  <input
                    type={inputType}
                    value={val}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                  />
                </div>
              );
            })}
          </div>

          {/* Metadata toggles */}
          <div className="flex flex-wrap gap-5 pt-1 text-xs font-display font-bold uppercase">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={flags.showPostCount}
                onChange={() => toggleFlag('showPostCount')}
              />
              <span>Mostrar número de publicaciones</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={flags.showJoinDate}
                onChange={() => toggleFlag('showJoinDate')}
              />
              <span>Mostrar fecha de ingreso a la red</span>
            </label>
          </div>

          <button type="submit" className="px-6 py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase cursor-pointer">
            Guardar perfil y privacidad
          </button>
          {profileErr && <p role="alert" className="text-xs text-red-600">{profileErr}</p>}
          {profileMsg && <p className="text-xs text-emerald-600">{profileMsg}</p>}
        </form>
      )}

      {tab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5">
              <p className="font-display text-xs uppercase tracking-wider text-neutral-500">Visitas totales</p>
              <p className="font-tabular text-3xl font-bold mt-1">{totalViews.toLocaleString('es-ES')}</p>
            </div>
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5">
              <p className="font-display text-xs uppercase tracking-wider text-neutral-500">Publicaciones propias</p>
              <p className="font-tabular text-3xl font-bold mt-1">{myPosts.length}</p>
            </div>
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5">
              <p className="font-display text-xs uppercase tracking-wider text-neutral-500">Lectura promedio</p>
              <p className="font-tabular text-3xl font-bold mt-1">{avgReadSec} s</p>
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 space-y-3">
            <h3 className="font-display text-lg font-bold uppercase">Rendimiento por publicación</h3>
            {myPosts.map((p) => (
              <div key={p.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold truncate max-w-md">{p.title}</span>
                  <span className="font-tabular">{p.viewCount || 0} lecturas</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
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
