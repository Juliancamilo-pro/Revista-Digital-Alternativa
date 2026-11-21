import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Check,
  EyeOff,
  FolderTree,
  GripVertical,
  History,
  KeyRound,
  LayoutGrid,
  Mail,
  MessageSquare,
  Plus,
  Radio,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { logAdminActivity } from '../lib/activityLog';
import { isAppCheckConfigured } from '../lib/appCheck';
import { db } from '../lib/firebase';
import {
  downloadTextFile,
  formatDateEs,
  generateId,
  generateRandomInviteCode,
  hashInviteCode,
  sanitizeExternalUrl,
  slugify,
  toDate,
  uploadMediaAsset,
} from '../lib/utils';
import {
  AdminActivityLog,
  AnalyticsEvent,
  BlockedCommenter,
  CollaboratorPublic,
  CommentItem,
  HomepageSectionConfig,
  InviteSecret,
  NewsletterSubscriber,
  Post,
  PostStatus,
  ReportRectification,
  SiteConfig,
  StreamSourceType,
} from '../types/editorial';
import { BlockEditor } from './BlockEditor';
import { GoogleCalendarPanel } from './GoogleCalendarPanel';

type AdminTab =
  | 'posts'
  | 'frontpage'
  | 'invite'
  | 'collaborators'
  | 'taxonomy'
  | 'comments'
  | 'streams'
  | 'stats'
  | 'inbox'
  | 'activity'
  | 'settings';

export const AdminPanel: React.FC = () => {
  const { firebaseUser, isAdmin } = useAuth();
  const {
    siteConfig,
    allPostsForAdmin,
    categories,
    seriesList,
    livestreams,
    navigate,
    setAuthModalOpen,
  } = useSite();

  const [tab, setTab] = useState<AdminTab>('posts');
  const [editingPost, setEditingPost] = useState<Post | null | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<'all' | PostStatus>('all');
  const [feedback, setFeedback] = useState('');

  // Admin-only collections state
  const [inviteSecret, setInviteSecret] = useState<InviteSecret | null>(null);
  const [newInviteInput, setNewInviteInput] = useState('');
  const [inviteExpiresInput, setInviteExpiresInput] = useState('');
  const [allCollaborators, setAllCollaborators] = useState<CollaboratorPublic[]>([]);
  const [allComments, setAllComments] = useState<CommentItem[]>([]);
  const [blockedList, setBlockedList] = useState<BlockedCommenter[]>([]);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [tickets, setTickets] = useState<ReportRectification[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsEvent[]>([]);
  const [activityLogs, setActivityLogs] = useState<AdminActivityLog[]>([]);

  // Local editable site config
  const [cfgDraft, setCfgDraft] = useState<SiteConfig>(siteConfig);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Taxonomy creation forms
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catParent, setCatParent] = useState('');
  const [serTitle, setSerTitle] = useState('');
  const [serDesc, setSerDesc] = useState('');

  // Stream form
  const [streamTitle, setStreamTitle] = useState('');
  const [streamDesc, setStreamDesc] = useState('');
  const [streamType, setStreamType] = useState<StreamSourceType>('youtube');
  const [streamUrl, setStreamUrl] = useState('');
  const [streamDate, setStreamDate] = useState('');

  // Stats period filter
  const [statsPeriod, setStatsPeriod] = useState<'today' | '7d' | '30d' | 'all'>('30d');

  // Moderation blocked words input
  const [blockedWordsInput, setBlockedWordsInput] = useState((siteConfig.blockedWords || []).join(', '));

  useEffect(() => {
    setCfgDraft(siteConfig);
    setBlockedWordsInput((siteConfig.blockedWords || []).join(', '));
  }, [siteConfig]);

  useEffect(() => {
    if (!isAdmin) return;

    const u1 = onSnapshot(
      doc(db, 'site_secrets', 'invite'),
      (snap) => {
        setInviteSecret(snap.exists() ? (snap.data() as InviteSecret) : null);
      },
      (err) => console.warn('invite listener:', err)
    );
    const u2 = onSnapshot(
      collection(db, 'collaborators_public'),
      (snap) => {
        setAllCollaborators(snap.docs.map((d) => d.data() as CollaboratorPublic));
      },
      (err) => console.warn('collaborators_public listener:', err)
    );
    const u3 = onSnapshot(
      collection(db, 'comments'),
      (snap) => {
        setAllComments(
          snap.docs
            .map((d) => d.data() as CommentItem)
            .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
        );
      },
      (err) => console.warn('comments listener:', err)
    );
    const u4 = onSnapshot(
      collection(db, 'blocked_commenters'),
      (snap) => {
        setBlockedList(snap.docs.map((d) => d.data() as BlockedCommenter));
      },
      (err) => console.warn('blocked_commenters listener:', err)
    );
    const u5 = onSnapshot(
      collection(db, 'newsletter_subscribers'),
      (snap) => {
        setSubscribers(snap.docs.map((d) => d.data() as NewsletterSubscriber));
      },
      (err) => console.warn('newsletter_subscribers listener:', err)
    );
    const u6 = onSnapshot(
      collection(db, 'reports_and_rectifications'),
      (snap) => {
        setTickets(
          snap.docs
            .map((d) => d.data() as ReportRectification)
            .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
        );
      },
      (err) => console.warn('reports_and_rectifications listener:', err)
    );
    const u7 = onSnapshot(
      collection(db, 'analytics_events'),
      (snap) => {
        setAnalytics(snap.docs.map((d) => d.data() as AnalyticsEvent));
      },
      (err) => console.warn('analytics_events listener:', err)
    );
    const u8 = onSnapshot(
      collection(db, 'admin_activity_logs'),
      (snap) => {
        setActivityLogs(
          snap.docs
            .map((d) => d.data() as AdminActivityLog)
            .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime())
        );
      },
      (err) => console.warn('admin_activity_logs listener:', err)
    );

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
      u8();
    };
  }, [isAdmin]);

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3500);
  };

  const pendingCommentsCount = allComments.filter((c) => c.status === 'pending').length;
  const pendingTicketsCount = tickets.filter((t) => t.status === 'pending').length;

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const dayMs = 86400000;
    return analytics.filter((ev) => {
      const t = toDate(ev.createdAt).getTime();
      if (statsPeriod === 'today') return now - t <= dayMs;
      if (statsPeriod === '7d') return now - t <= 7 * dayMs;
      if (statsPeriod === '30d') return now - t <= 30 * dayMs;
      return true;
    });
  }, [analytics, statsPeriod]);

  const totalSiteViews = useMemo(
    () => allPostsForAdmin.reduce((acc, p) => acc + (p.viewCount || 0), 0),
    [allPostsForAdmin]
  );

  const viewsByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allPostsForAdmin) {
      map.set(p.categoryName, (map.get(p.categoryName) || 0) + (p.viewCount || 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [allPostsForAdmin]);

  const viewsByAuthor = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allPostsForAdmin) {
      map.set(p.authorName, (map.get(p.authorName) || 0) + (p.viewCount || 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [allPostsForAdmin]);

  const viewsByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allPostsForAdmin) {
      map.set(p.type, (map.get(p.type) || 0) + (p.viewCount || 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [allPostsForAdmin]);

  const trafficSources = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of filteredEvents) {
      map.set(ev.referrerSource || 'directo', (map.get(ev.referrerSource || 'directo') || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredEvents]);

  if (!firebaseUser || !isAdmin) {
    return (
      <main className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-3xl font-extrabold uppercase">Acceso exclusivo de administración</h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Inicia sesión con la cuenta de administrador para gestionar la revista.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="px-6 py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display font-bold uppercase text-xs cursor-pointer"
        >
          Iniciar sesión
        </button>
      </main>
    );
  }

  const adminActorName = firebaseUser.displayName || 'Administrador';

  const cleanSocialLinks = (raw: SiteConfig['socialLinks'] | undefined): SiteConfig['socialLinks'] => {
    const out: SiteConfig['socialLinks'] = {};
    const fields: Array<keyof SiteConfig['socialLinks']> = [
      'instagram',
      'twitter',
      'facebook',
      'youtube',
      'telegram',
    ];
    for (const key of fields) {
      const sanitized = sanitizeExternalUrl(raw?.[key] || '');
      if (sanitized) {
        out[key] = sanitized;
      }
    }
    return out;
  };

  // Save SiteConfig helper (explicitly matching isValidSiteConfig keys)
  const saveSiteConfig = async (next: SiteConfig, msg = 'Configuración guardada.', logAction?: string) => {
    const cleanSiteName = (next.siteName || '').trim().slice(0, 100);
    if (cleanSiteName.length < 2) {
      notify('El nombre de la revista debe tener al menos 2 caracteres.');
      return;
    }
    try {
      await setDoc(doc(db, 'site_config', 'main'), {
        siteName: cleanSiteName,
        tagline: (next.tagline || '').slice(0, 240),
        logoUrl: (next.logoUrl || '').slice(0, 400000),
        primaryColor: (next.primaryColor || '#B91C1C').slice(0, 20),
        accentColor: (next.accentColor || '#991B1B').slice(0, 20),
        autoApproveCollaborators: Boolean(next.autoApproveCollaborators),
        autoPublishCollaborators: Boolean(next.autoPublishCollaborators),
        allowAnonymousComments: Boolean(next.allowAnonymousComments),
        commentModerationMode: next.commentModerationMode === 'pre' ? 'pre' : 'post',
        blockedWords: (next.blockedWords || []).slice(0, 100),
        contactEmail: (next.contactEmail || '').slice(0, 200),
        aboutText: (next.aboutText || '').slice(0, 15000),
        howWeWorkText: (next.howWeWorkText || '').slice(0, 15000),
        sourcesPolicyText: (next.sourcesPolicyText || '').slice(0, 15000),
        correctionsPolicyText: (next.correctionsPolicyText || '').slice(0, 15000),
        termsText: (next.termsText || '').slice(0, 15000),
        privacyText: (next.privacyText || '').slice(0, 15000),
        authorLiabilityNotice: (next.authorLiabilityNotice || '').slice(0, 3000),
        socialLinks: cleanSocialLinks(next.socialLinks),
        heroPostId: (next.heroPostId || '').slice(0, 128),
        featuredPostIds: (next.featuredPostIds || []).slice(0, 12),
        homepageSections: (next.homepageSections || []).slice(0, 20),
        updatedAt: serverTimestamp(),
      });
      if (logAction) {
        await logAdminActivity(firebaseUser.uid, adminActorName, logAction, msg);
      }
      notify(msg);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'No se pudo guardar la configuración.');
    }
  };

  // Update Invite Code atomically (with optional expiration date)
  const handleSaveInviteCode = async (rawCode: string, active: boolean) => {
    const clean = rawCode.trim();
    if (clean.length < 4) {
      notify('El código debe tener al menos 4 caracteres.');
      return;
    }

    let expiresTimestamp: Timestamp | undefined;
    if (inviteExpiresInput.trim()) {
      const parsed = new Date(inviteExpiresInput);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        notify('La fecha de expiración debe ser futura.');
        return;
      }
      expiresTimestamp = Timestamp.fromDate(parsed);
    }

    try {
      const newHash = await hashInviteCode(clean);
      const batch = writeBatch(db);
      if (inviteSecret?.codeHash && inviteSecret.codeHash !== newHash) {
        batch.delete(doc(db, 'invite_tokens', inviteSecret.codeHash));
      }
      batch.set(doc(db, 'invite_tokens', newHash), {
        active,
        ...(expiresTimestamp ? { expiresAt: expiresTimestamp } : {}),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'site_secrets', 'invite'), {
        plaintextCode: clean,
        codeHash: newHash,
        active,
        ...(expiresTimestamp ? { expiresAt: expiresTimestamp } : {}),
        updatedAt: serverTimestamp(),
        updatedBy: firebaseUser.uid,
      });
      await batch.commit();
      await logAdminActivity(
        firebaseUser.uid,
        adminActorName,
        'Código de invitación actualizado',
        expiresTimestamp
          ? `Nuevo código activado con vigencia hasta ${formatDateEs(expiresTimestamp, true)}.`
          : 'Nuevo código activado sin fecha de expiración.'
      );
      setNewInviteInput('');
      setInviteExpiresInput('');
      notify('Código de invitación actualizado. El código anterior dejó de funcionar de inmediato.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al actualizar el código de invitación.');
    }
  };

  const handleToggleInviteActive = async () => {
    if (!inviteSecret || !inviteSecret.codeHash || inviteSecret.codeHash.length !== 64) {
      notify('Configura y guarda un código de invitación válido primero.');
      return;
    }
    try {
      const nextActive = !inviteSecret.active;
      const batch = writeBatch(db);
      batch.update(doc(db, 'invite_tokens', inviteSecret.codeHash), {
        active: nextActive,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'site_secrets', 'invite'), {
        active: nextActive,
        updatedAt: serverTimestamp(),
        updatedBy: firebaseUser.uid,
      });
      await batch.commit();
      await logAdminActivity(
        firebaseUser.uid,
        adminActorName,
        nextActive ? 'Código de invitación reactivado' : 'Código de invitación desactivado',
        `Estado cambiado a ${nextActive ? 'activo' : 'desactivado'}.`
      );
      notify(nextActive ? 'Código de invitación activado.' : 'Código de invitación desactivado.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'No se pudo cambiar el estado del código.');
    }
  };

  const handleMoveSection = (index: number, targetIndex: number) => {
    const list = [...cfgDraft.homepageSections].sort((a, b) => a.order - b.order);
    if (targetIndex < 0 || targetIndex >= list.length) return;
    const [item] = list.splice(index, 1);
    list.splice(targetIndex, 0, item);
    const reordered = list.map((s, idx) => ({ ...s, order: idx }));
    setCfgDraft({ ...cfgDraft, homepageSections: reordered });
  };

  const handleExportSubscribersCsv = () => {
    const rows = ['email,nombre,fecha', ...subscribers.map((s) => `"${s.email}","${s.name || ''}","${formatDateEs(s.createdAt)}"`)];
    downloadTextFile('suscriptores-boletin.csv', rows.join('\n'), 'text/csv;charset=utf-8');
  };

  if (editingPost !== undefined) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <BlockEditor
          initialPost={editingPost}
          onSaved={() => {
            logAdminActivity(
              firebaseUser.uid,
              adminActorName,
              editingPost ? 'Publicación editada' : 'Publicación creada',
              editingPost ? `Editada la nota "${editingPost.title}".` : 'Nueva publicación guardada desde el editor.'
            );
            setEditingPost(undefined);
            notify('Publicación guardada correctamente.');
          }}
          onCancel={() => setEditingPost(undefined)}
        />
      </main>
    );
  }

  const filteredAdminPosts = allPostsForAdmin.filter(
    (p) => statusFilter === 'all' || p.status === statusFilter
  );

  const inviteIsExpired = Boolean(
    inviteSecret?.expiresAt && toDate(inviteSecret.expiresAt).getTime() <= Date.now()
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="border-b-2 border-[#111111] dark:border-neutral-700 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
            Panel de administración total
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight">
            {siteConfig.siteName}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditingPost(null)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva publicación</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div role="status" className="rounded-2xl p-3.5 border border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 text-sm">
          {feedback}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-neutral-300 dark:border-neutral-800 pb-3 text-xs font-display font-bold uppercase tracking-wider">
        {(
          [
            ['posts', `Publicaciones (${allPostsForAdmin.length})`, LayoutGrid],
            ['frontpage', 'Portada (Arrastrar)', LayoutGrid],
            ['invite', 'Código de invitación', KeyRound],
            ['collaborators', `Colaboradores (${allCollaborators.length})`, Users],
            ['taxonomy', 'Categorías y Series', FolderTree],
            ['comments', `Comentarios${pendingCommentsCount > 0 ? ` (${pendingCommentsCount} pend.)` : ''}`, MessageSquare],
            ['streams', 'En vivo', Radio],
            ['stats', 'Estadísticas', BarChart3],
            ['inbox', `Boletín y Denuncias${pendingTicketsCount > 0 ? ` (${pendingTicketsCount})` : ''}`, Mail],
            ['activity', `Actividad (${activityLogs.length})`, History],
            ['settings', 'Configuración', Settings],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full cursor-pointer whitespace-nowrap transition-colors ${
              tab === key
                ? 'bg-[#111111] text-white dark:bg-white dark:text-black'
                : 'border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-black dark:hover:border-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: POSTS */}
      {tab === 'posts' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-display font-bold uppercase">
            {(['all', 'published', 'in_review', 'scheduled', 'draft', 'unpublished'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-full border cursor-pointer transition-colors ${
                  statusFilter === st ? 'bg-[var(--editorial-primary)] text-white border-[var(--editorial-primary)]' : 'border-neutral-300 dark:border-neutral-700'
                }`}
              >
                {st === 'all' ? 'Todas' : st === 'in_review' ? 'Cola revisión' : st}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-300 dark:border-neutral-800 font-display text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Titular</th>
                  <th className="px-4 py-3">Autor / Medio</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Lecturas</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredAdminPosts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-neutral-500">
                      No hay publicaciones registradas en esta vista.
                    </td>
                  </tr>
                ) : (
                  filteredAdminPosts.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-semibold max-w-xs">
                        <button
                          type="button"
                          onClick={() => navigate(`/articulo/${p.slug}`)}
                          className="text-left hover:text-[var(--editorial-primary)] cursor-pointer"
                        >
                          {p.title}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs">{p.authorName}</td>
                      <td className="px-4 py-3 text-xs">{p.categoryName}</td>
                      <td className="px-4 py-3 text-xs font-display uppercase">{p.status}</td>
                      <td className="px-4 py-3 text-right font-tabular">{p.viewCount || 0}</td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap text-xs font-display font-bold uppercase">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const nextStatus = p.status === 'published' ? 'unpublished' : 'published';
                              await updateDoc(doc(db, 'posts', p.id), {
                                status: nextStatus,
                                ...(nextStatus === 'published'
                                  ? { publishedAt: p.publishedAt || serverTimestamp() }
                                  : {}),
                                updatedAt: serverTimestamp(),
                              });
                              await logAdminActivity(
                                firebaseUser.uid,
                                adminActorName,
                                nextStatus === 'published' ? 'Publicación aprobada/publicada' : 'Publicación despublicada',
                                `Nota: "${p.title}"`
                              );
                              notify(nextStatus === 'published' ? 'Publicación publicada.' : 'Publicación despublicada.');
                            } catch {
                              notify('No se pudo actualizar el estado de la publicación.');
                            }
                          }}
                          className="text-[var(--editorial-primary)] hover:underline cursor-pointer"
                        >
                          {p.status === 'published' ? 'Despublicar' : 'Publicar'}
                        </button>
                        <button type="button" onClick={() => setEditingPost(p)} className="hover:underline cursor-pointer">
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await deleteDoc(doc(db, 'posts', p.id));
                              await logAdminActivity(
                                firebaseUser.uid,
                                adminActorName,
                                'Publicación eliminada',
                                `Eliminada: "${p.title}"`
                              );
                              notify('Publicación eliminada.');
                            } catch {
                              notify('No se pudo eliminar la publicación.');
                            }
                          }}
                          className="text-red-600 hover:underline cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: FRONTPAGE DRAG & DROP */}
      {tab === 'frontpage' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-4">
            <h2 className="font-display text-2xl font-extrabold uppercase">
              Orden y visibilidad de bloques (arrastrar y soltar)
            </h2>
            <p className="text-xs text-neutral-500">
              Arrastra las filas o usa las flechas para reorganizar la portada principal.
            </p>
            <div className="space-y-2">
              {[...cfgDraft.homepageSections]
                .sort((a, b) => a.order - b.order)
                .map((sec: HomepageSectionConfig, idx: number) => (
                  <div
                    key={sec.id}
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIdx !== null && dragIdx !== idx) {
                        handleMoveSection(dragIdx, idx);
                      }
                      setDragIdx(null);
                    }}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[#F8F6F1] dark:bg-[#1A1A1A] cursor-move"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-neutral-400" aria-hidden="true" />
                      <input
                        type="checkbox"
                        checked={sec.enabled}
                        onChange={(e) =>
                          setCfgDraft({
                            ...cfgDraft,
                            homepageSections: cfgDraft.homepageSections.map((s) =>
                              s.id === sec.id ? { ...s, enabled: e.target.checked } : s
                            ),
                          })
                        }
                      />
                      <span className="font-display font-bold uppercase text-sm">{sec.title}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => handleMoveSection(idx, idx - 1)} className="p-1.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer">
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => handleMoveSection(idx, idx + 1)} className="p-1.5 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 cursor-pointer">
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
            <button
              type="button"
              onClick={() => saveSiteConfig(cfgDraft, 'Diseño de portada actualizado.', 'Orden de portada actualizado')}
              className="px-6 py-2.5 rounded-full bg-[var(--editorial-primary)] text-white font-display font-bold uppercase text-xs cursor-pointer"
            >
              Guardar orden de portada
            </button>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-5">
            <h2 className="font-display text-2xl font-extrabold uppercase">Nota principal y destacadas</h2>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Nota principal de apertura</label>
              <select
                value={cfgDraft.heroPostId || ''}
                onChange={(e) => setCfgDraft({ ...cfgDraft, heroPostId: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              >
                <option value="">Automática (última destacada)</option>
                {allPostsForAdmin
                  .filter((p) => p.status === 'published')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block font-display text-xs font-bold uppercase mb-2">
                Fijar hasta 3 notas destacadas
              </label>
              <div className="max-h-64 overflow-y-auto space-y-1.5 rounded-xl border border-neutral-300 dark:border-neutral-800 p-3">
                {allPostsForAdmin
                  .filter((p) => p.status === 'published')
                  .map((p) => {
                    const checked = (cfgDraft.featuredPostIds || []).includes(p.id);
                    return (
                      <label key={p.id} className="flex items-start gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const curr = cfgDraft.featuredPostIds || [];
                            const next = e.target.checked
                              ? [...curr, p.id].slice(0, 3)
                              : curr.filter((id) => id !== p.id);
                            setCfgDraft({ ...cfgDraft, featuredPostIds: next });
                          }}
                        />
                        <span>{p.title}</span>
                      </label>
                    );
                  })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => saveSiteConfig(cfgDraft, 'Portada principal y destacadas guardadas.', 'Portada destacada actualizada')}
              className="w-full py-2.5 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black font-display font-bold uppercase text-xs cursor-pointer"
            >
              Aplicar selección
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: INVITE CODE */}
      {tab === 'invite' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-5">
            <h2 className="font-display text-2xl font-extrabold uppercase">Código de invitación</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Este código se almacena de forma privada en la base de datos y nunca se expone en el código público. Al cambiarlo, el anterior deja de funcionar al instante para nuevos registros sin afectar a colaboradores ya registrados.
            </p>

            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-[#F8F6F1] dark:bg-[#1A1A1A] p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-display text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Código vigente:
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-display text-xs font-bold uppercase ${
                    !inviteSecret
                      ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600'
                      : inviteIsExpired
                      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                      : inviteSecret.active
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                  }`}
                >
                  {!inviteSecret
                    ? 'Sin configurar aún'
                    : inviteIsExpired
                    ? 'Expirado'
                    : inviteSecret.active
                    ? 'Activo'
                    : 'Desactivado'}
                </span>
              </div>
              <p className="font-tabular text-2xl font-bold tracking-wider">
                {inviteSecret?.plaintextCode || '— Configura un código abajo —'}
              </p>
              {Boolean(inviteSecret?.expiresAt) && (
                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                  Vigencia hasta: <strong>{formatDateEs(inviteSecret?.expiresAt, true)}</strong>
                </p>
              )}
              {Boolean(inviteSecret?.updatedAt) && (
                <p className="text-xs text-neutral-500">
                  Última modificación: {formatDateEs(inviteSecret?.updatedAt, true)}
                </p>
              )}
              {inviteSecret && (
                <button
                  type="button"
                  onClick={handleToggleInviteActive}
                  className="mt-2 px-4 py-1.5 rounded-full border border-neutral-400 text-xs font-display font-bold uppercase cursor-pointer"
                >
                  {inviteSecret.active ? 'Desactivar código temporalmente' : 'Reactivar código'}
                </button>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <label className="block font-display text-xs font-bold uppercase">
                Escribir nuevo código manual o generar uno aleatorio
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newInviteInput}
                  onChange={(e) => setNewInviteInput(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 font-tabular text-sm"
                />
                <button
                  type="button"
                  onClick={() => setNewInviteInput(generateRandomInviteCode())}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-neutral-400 font-display text-xs font-bold uppercase cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Generar aleatorio</span>
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[220px]">
                  <label className="block font-display text-[11px] font-bold uppercase text-neutral-500 mb-1">
                    Fecha de expiración opcional (deja vacío si no expira)
                  </label>
                  <input
                    type="datetime-local"
                    value={inviteExpiresInput}
                    onChange={(e) => setInviteExpiresInput(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveInviteCode(newInviteInput, true)}
                  className="px-5 py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase cursor-pointer"
                >
                  Guardar y activar
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-5">
            <h2 className="font-display text-2xl font-extrabold uppercase">Política editorial de colaboradores</h2>
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={cfgDraft.autoApproveCollaborators}
                onChange={(e) => setCfgDraft({ ...cfgDraft, autoApproveCollaborators: e.target.checked })}
                className="mt-1"
              />
              <span>
                <strong>Aprobación inmediata de colaboradores:</strong> Si está activado, quienes usen el código válido quedan activos de inmediato. Si está desactivado, requieren aprobación manual del administrador.
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={cfgDraft.autoPublishCollaborators}
                onChange={(e) => setCfgDraft({ ...cfgDraft, autoPublishCollaborators: e.target.checked })}
                className="mt-1"
              />
              <span>
                <strong>Publicación directa sin filtros editoriales (por defecto):</strong> Si está activado, los colaboradores publican al instante. Si se desactiva, sus notas pasan por cola de revisión previa.
              </span>
            </label>
            <button
              type="button"
              onClick={() => saveSiteConfig(cfgDraft, 'Política de colaboradores actualizada.', 'Política editorial de colaboradores actualizada')}
              className="w-full py-2.5 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black font-display font-bold uppercase text-xs cursor-pointer"
            >
              Guardar política editorial
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: COLLABORATORS */}
      {tab === 'collaborators' && (
        <div className="overflow-x-auto rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-300 dark:border-neutral-800 font-display text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Medio / Periodista</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Publicaciones</th>
                <th className="px-4 py-3 text-right">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {allCollaborators.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-neutral-500">
                    Aún no hay colaboradores registrados.
                  </td>
                </tr>
              ) : (
                allCollaborators.map((col) => {
                  const count = allPostsForAdmin.filter((p) => p.authorId === col.uid).length;
                  return (
                    <tr key={col.uid}>
                      <td className="px-4 py-3 font-semibold">{col.name}</td>
                      <td className="px-4 py-3 text-xs uppercase">{col.outletType}</td>
                      <td className="px-4 py-3 text-xs font-display font-bold uppercase">{col.status}</td>
                      <td className="px-4 py-3 text-right font-tabular">{count}</td>
                      <td className="px-4 py-3 text-right space-x-2 text-xs font-display font-bold uppercase">
                        {col.status !== 'active' && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const b = writeBatch(db);
                                b.update(doc(db, 'collaborators_public', col.uid), { status: 'active', updatedAt: serverTimestamp() });
                                b.update(doc(db, 'users', col.uid), { status: 'active', updatedAt: serverTimestamp() });
                                await b.commit();
                                await logAdminActivity(firebaseUser.uid, adminActorName, 'Colaborador aprobado', `Activado: ${col.name}`);
                                notify(`Colaborador "${col.name}" aprobado.`);
                              } catch {
                                notify('No se pudo aprobar al colaborador.');
                              }
                            }}
                            className="text-emerald-600 hover:underline cursor-pointer"
                          >
                            Aprobar / Reactivar
                          </button>
                        )}
                        {col.status === 'active' && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const b = writeBatch(db);
                                b.update(doc(db, 'collaborators_public', col.uid), { status: 'suspended', updatedAt: serverTimestamp() });
                                b.update(doc(db, 'users', col.uid), { status: 'suspended', updatedAt: serverTimestamp() });
                                await b.commit();
                                await logAdminActivity(firebaseUser.uid, adminActorName, 'Colaborador suspendido', `Suspendido: ${col.name}`);
                                notify(`Colaborador "${col.name}" suspendido.`);
                              } catch {
                                notify('No se pudo suspender al colaborador.');
                              }
                            }}
                            className="text-amber-600 hover:underline cursor-pointer"
                          >
                            Suspender
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await deleteDoc(doc(db, 'collaborators_public', col.uid));
                              await deleteDoc(doc(db, 'users', col.uid)).catch(() => undefined);
                              await logAdminActivity(firebaseUser.uid, adminActorName, 'Colaborador eliminado', `Eliminado: ${col.name}`);
                              notify(`Colaborador "${col.name}" eliminado.`);
                            } catch {
                              notify('No se pudo eliminar al colaborador.');
                            }
                          }}
                          className="text-red-600 hover:underline cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: TAXONOMY */}
      {tab === 'taxonomy' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-4">
            <h2 className="font-display text-2xl font-extrabold uppercase">Categorías jerárquicas</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const cleanCat = catName.trim().slice(0, 80);
                if (cleanCat.length < 2) {
                  notify('El nombre de la categoría debe tener al menos 2 caracteres.');
                  return;
                }
                try {
                  const id = generateId('cat');
                  await setDoc(doc(db, 'categories', id), {
                    id,
                    name: cleanCat,
                    slug: slugify(cleanCat).slice(0, 100),
                    description: catDesc.trim().slice(0, 400),
                    ...(catParent ? { parentId: catParent } : {}),
                    order: Math.min(1000, categories.length + 1),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                  await logAdminActivity(firebaseUser.uid, adminActorName, 'Categoría creada', `Categoría: ${cleanCat}`);
                  setCatName('');
                  setCatDesc('');
                  setCatParent('');
                  notify('Categoría creada.');
                } catch {
                  notify('No se pudo crear la categoría.');
                }
              }}
              className="space-y-3 border-b border-neutral-200 dark:border-neutral-800 pb-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input type="text" required minLength={2} maxLength={80} value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Nueva categoría" className="px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
                <select value={catParent} onChange={(e) => setCatParent(e.target.value)} className="px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm">
                  <option value="">Categoría principal (raíz)</option>
                  {categories.filter((c) => !c.parentId).map((c) => (
                    <option key={c.id} value={c.id}>Subcategoría de: {c.name}</option>
                  ))}
                </select>
              </div>
              <input type="text" maxLength={400} value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder="Descripción breve" className="w-full px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
              <button type="submit" className="px-5 py-2 rounded-full bg-[var(--editorial-primary)] text-white font-display text-xs font-bold uppercase cursor-pointer">
                Agregar categoría
              </button>
            </form>

            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {categories.map((c) => (
                <div key={c.id} className="py-2.5 flex items-center justify-between gap-2 text-sm">
                  <span>{c.parentId ? `↳ ${c.name}` : <strong>{c.name}</strong>}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await deleteDoc(doc(db, 'categories', c.id));
                        await logAdminActivity(firebaseUser.uid, adminActorName, 'Categoría eliminada', `Categoría: ${c.name}`);
                        notify('Categoría eliminada.');
                      } catch {
                        notify('No se pudo eliminar la categoría.');
                      }
                    }}
                    className="text-xs text-red-600 font-display font-bold uppercase cursor-pointer"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-4">
            <h2 className="font-display text-2xl font-extrabold uppercase">Series y especiales</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const cleanTitle = serTitle.trim().slice(0, 160);
                if (cleanTitle.length < 2) {
                  notify('El título de la serie debe tener al menos 2 caracteres.');
                  return;
                }
                try {
                  const id = generateId('ser');
                  await setDoc(doc(db, 'series', id), {
                    id,
                    title: cleanTitle,
                    slug: slugify(cleanTitle).slice(0, 160),
                    description: serDesc.trim().slice(0, 1200),
                    featured: true,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                  await logAdminActivity(firebaseUser.uid, adminActorName, 'Serie/Especial creado', `Serie: ${cleanTitle}`);
                  setSerTitle('');
                  setSerDesc('');
                  notify('Serie creada.');
                } catch {
                  notify('No se pudo crear la serie.');
                }
              }}
              className="space-y-3 border-b border-neutral-200 dark:border-neutral-800 pb-4"
            >
              <input type="text" required minLength={2} maxLength={160} value={serTitle} onChange={(e) => setSerTitle(e.target.value)} placeholder="Título del especial o dossier" className="w-full px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
              <textarea rows={2} required maxLength={1200} value={serDesc} onChange={(e) => setSerDesc(e.target.value)} placeholder="Descripción" className="w-full px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
              <button type="submit" className="px-5 py-2 rounded-full bg-[var(--editorial-primary)] text-white font-display text-xs font-bold uppercase cursor-pointer">
                Crear serie
              </button>
            </form>
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {seriesList.length === 0 ? (
                <p className="py-4 text-sm text-neutral-500">No hay series creadas todavía.</p>
              ) : (
                seriesList.map((s) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between gap-2 text-sm">
                    <span>{s.title}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await deleteDoc(doc(db, 'series', s.id));
                          await logAdminActivity(firebaseUser.uid, adminActorName, 'Serie eliminada', `Serie: ${s.title}`);
                          notify('Serie eliminada.');
                        } catch {
                          notify('No se pudo eliminar la serie.');
                        }
                      }}
                      className="text-xs text-red-600 font-display font-bold uppercase cursor-pointer"
                    >
                      Eliminar
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: COMMENTS & MODERATION */}
      {tab === 'comments' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Modo de moderación</label>
              <select
                value={cfgDraft.commentModerationMode}
                onChange={(e) => setCfgDraft({ ...cfgDraft, commentModerationMode: e.target.value as 'pre' | 'post' })}
                className="w-full px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              >
                <option value="post">Posterior (se publica y se revisa)</option>
                <option value="pre">Previa (espera aprobación)</option>
              </select>
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Palabras bloqueadas (separadas por coma)</label>
              <input
                type="text"
                value={blockedWordsInput}
                onChange={(e) => setBlockedWordsInput(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-display font-bold uppercase cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfgDraft.allowAnonymousComments}
                  onChange={(e) => setCfgDraft({ ...cfgDraft, allowAnonymousComments: e.target.checked })}
                />
                <span>Permitir anónimos</span>
              </label>
              <button
                type="button"
                onClick={() =>
                  saveSiteConfig(
                    {
                      ...cfgDraft,
                      blockedWords: blockedWordsInput.split(',').map((w) => w.trim()).filter(Boolean),
                    },
                    'Reglas de moderación guardadas.',
                    'Reglas de comentarios actualizadas'
                  )
                }
                className="px-5 py-2 rounded-full bg-[var(--editorial-primary)] text-white font-display text-xs font-bold uppercase cursor-pointer"
              >
                Guardar reglas
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {allComments.length === 0 ? (
              <p className="text-sm text-neutral-500 py-6 text-center">No hay comentarios registrados todavía.</p>
            ) : (
              allComments.map((c) => (
                <div key={c.id} className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-neutral-500">
                      <strong>{c.authorName}</strong> en <em>{c.postTitle}</em> · Estado: <strong>{c.status}</strong> · Reportes: {c.reportCount || 0}
                    </p>
                    <p className="text-sm mt-1">{c.text}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-display font-bold uppercase shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'comments', c.id), { status: 'approved', updatedAt: serverTimestamp() });
                        } catch {
                          notify('No se pudo aprobar el comentario.');
                        }
                      }}
                      className="px-3 py-1 rounded-full border border-emerald-600 text-emerald-600 cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'comments', c.id), { status: 'hidden', updatedAt: serverTimestamp() });
                        } catch {
                          notify('No se pudo ocultar el comentario.');
                        }
                      }}
                      className="px-3 py-1 rounded-full border border-neutral-400 cursor-pointer flex items-center gap-1"
                    >
                      <EyeOff className="w-3 h-3" /> Ocultar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const bid = generateId('blkuser');
                          await setDoc(doc(db, 'blocked_commenters', bid), {
                            id: bid,
                            ...(c.authorId ? { targetUid: c.authorId } : {}),
                            targetName: (c.authorName || 'Usuario').slice(0, 120),
                            reason: 'Bloqueado desde moderación',
                            createdAt: serverTimestamp(),
                          });
                          await updateDoc(doc(db, 'comments', c.id), { status: 'spam', updatedAt: serverTimestamp() });
                          await logAdminActivity(firebaseUser.uid, adminActorName, 'Usuario bloqueado en comentarios', `Usuario: ${c.authorName}`);
                          notify(`Usuario "${c.authorName}" bloqueado.`);
                        } catch {
                          notify('No se pudo bloquear al usuario.');
                        }
                      }}
                      className="px-3 py-1 rounded-full border border-amber-600 text-amber-600 cursor-pointer"
                    >
                      Bloquear usuario
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await deleteDoc(doc(db, 'comments', c.id));
                        } catch {
                          notify('No se pudo eliminar el comentario.');
                        }
                      }}
                      className="p-1.5 rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {blockedList.length > 0 && (
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 p-4 space-y-2">
              <h3 className="font-display text-sm font-bold uppercase">Usuarios bloqueados ({blockedList.length})</h3>
              <div className="flex flex-wrap gap-3 text-xs">
                {blockedList.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={async () => {
                      try {
                        await deleteDoc(doc(db, 'blocked_commenters', b.id));
                      } catch {
                        notify('No se pudo desbloquear al usuario.');
                      }
                    }}
                    className="underline hover:text-emerald-600 cursor-pointer"
                  >
                    {b.targetName} (Desbloquear)
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 7: LIVESTREAMS */}
      {tab === 'streams' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const cleanTitle = streamTitle.trim().slice(0, 200);
                if (cleanTitle.length < 3) {
                  notify('El título de la transmisión debe tener al menos 3 caracteres.');
                  return;
                }
                try {
                  const id = generateId('live');
                  await setDoc(doc(db, 'livestreams', id), {
                    id,
                    title: cleanTitle,
                    description: streamDesc.trim().slice(0, 2000),
                    status: 'scheduled',
                    sourceType: streamType,
                    sourceUrl: streamUrl.trim().slice(0, 2000),
                    scheduledFor: streamDate ? new Date(streamDate) : new Date(),
                    hostId: firebaseUser.uid,
                    hostName: 'Dirección Editorial',
                    viewerCount: 0,
                    peakViewers: 0,
                    isSample: false,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });
                  await logAdminActivity(firebaseUser.uid, adminActorName, 'Transmisión programada', `Sala: ${cleanTitle}`);
                  setStreamTitle('');
                  setStreamDesc('');
                  setStreamUrl('');
                  notify('Transmisión programada.');
                } catch {
                  notify('No se pudo programar la transmisión.');
                }
              }}
              className="lg:col-span-5 rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-4"
            >
              <h2 className="font-display text-2xl font-extrabold uppercase">Nueva transmisión en vivo</h2>
              <input type="text" required minLength={3} maxLength={200} value={streamTitle} onChange={(e) => setStreamTitle(e.target.value)} placeholder="Título de la transmisión" className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
              <textarea rows={2} maxLength={2000} value={streamDesc} onChange={(e) => setStreamDesc(e.target.value)} placeholder="Descripción" className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
              <select value={streamType} onChange={(e) => setStreamType(e.target.value as StreamSourceType)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm">
                <option value="youtube">YouTube Live</option>
                <option value="facebook">Facebook Live</option>
                <option value="twitch">Twitch</option>
                <option value="hls">URL HLS / MP4</option>
                <option value="webrtc">Cámara directa del navegador (WebRTC)</option>
              </select>
              {streamType !== 'webrtc' && (
                <input type="url" maxLength={2000} value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="URL del stream" className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
              )}
              <input type="datetime-local" value={streamDate} onChange={(e) => setStreamDate(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
              <button type="submit" className="w-full py-2.5 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display text-xs font-bold uppercase cursor-pointer">
                Programar transmisión
              </button>
            </form>

            <div className="lg:col-span-7 space-y-3">
              {livestreams.length === 0 ? (
                <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-8 text-center text-sm text-neutral-500">
                  No hay transmisiones programadas ni activas.
                </div>
              ) : (
                livestreams.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-display font-bold uppercase text-[var(--editorial-primary)]">
                        {s.status} · {s.sourceType}
                      </p>
                      <p className="font-display text-lg font-bold">{s.title}</p>
                      <p className="text-xs text-neutral-500">{formatDateEs(s.scheduledFor || s.createdAt, true)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-display font-bold uppercase">
                      <button type="button" onClick={() => navigate(`/en-vivo/${s.id}`)} className="px-4 py-1.5 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black cursor-pointer">
                        Abrir sala
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await deleteDoc(doc(db, 'livestreams', s.id));
                            await logAdminActivity(firebaseUser.uid, adminActorName, 'Transmisión eliminada', `Sala: ${s.title}`);
                            notify('Transmisión eliminada.');
                          } catch {
                            notify('No se pudo eliminar la transmisión.');
                          }
                        }}
                        className="px-4 py-1.5 rounded-full text-red-600 border border-red-200 dark:border-red-900 cursor-pointer"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <GoogleCalendarPanel
            defaultTitle={streamTitle}
            defaultDescription={streamDesc}
            defaultDateLocal={streamDate}
          />
        </div>
      )}

      {/* TAB 8: ANALYTICS */}
      {tab === 'stats' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-2xl font-extrabold uppercase">Estadísticas de audiencia</h2>
            <div className="inline-flex rounded-full overflow-hidden border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#141414] text-xs font-display font-bold uppercase">
              {(
                [
                  ['today', 'Hoy'],
                  ['7d', '7 días'],
                  ['30d', '30 días'],
                  ['all', 'Histórico'],
                ] as const
              ).map(([p, label]) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setStatsPeriod(p)}
                  className={`px-4 py-1.5 cursor-pointer ${statsPeriod === p ? 'bg-[var(--editorial-primary)] text-white' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4">
              <p className="text-xs font-display uppercase text-neutral-500">Visitas acumuladas</p>
              <p className="font-tabular text-2xl font-bold mt-1">{totalSiteViews.toLocaleString('es-ES')}</p>
            </div>
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4">
              <p className="text-xs font-display uppercase text-neutral-500">Sesiones período</p>
              <p className="font-tabular text-2xl font-bold mt-1">{filteredEvents.length}</p>
            </div>
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4">
              <p className="text-xs font-display uppercase text-neutral-500">Lectura promedio</p>
              <p className="font-tabular text-2xl font-bold mt-1">
                {filteredEvents.length
                  ? `${Math.round(filteredEvents.reduce((a, e) => a + e.readDurationSec, 0) / filteredEvents.length)}s`
                  : '0s'}
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4">
              <p className="text-xs font-display uppercase text-neutral-500">Pico en vivo</p>
              <p className="font-tabular text-2xl font-bold mt-1">
                {Math.max(0, ...livestreams.map((s) => s.peakViewers || 0))}
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4">
              <p className="text-xs font-display uppercase text-neutral-500">Comentarios</p>
              <p className="font-tabular text-2xl font-bold mt-1">{allComments.length}</p>
            </div>
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-4">
              <p className="text-xs font-display uppercase text-neutral-500">Suscriptores</p>
              <p className="font-tabular text-2xl font-bold mt-1">{subscribers.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 space-y-3">
              <h3 className="font-display text-lg font-bold uppercase">Visitas por categoría</h3>
              {viewsByCategory.map(([cat, count]) => (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{cat}</span>
                    <span className="font-tabular">{count.toLocaleString('es-ES')}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
                    <div className="h-2 bg-[var(--editorial-primary)]" style={{ width: `${Math.min(100, Math.round((count / Math.max(1, totalSiteViews)) * 100))}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-5 space-y-3">
              <h3 className="font-display text-lg font-bold uppercase">Visitas por colaborador y tipo</h3>
              {viewsByAuthor.slice(0, 6).map(([authName, count]) => (
                <div key={authName} className="flex justify-between text-xs py-1 border-b border-neutral-200 dark:border-neutral-800">
                  <span>{authName}</span>
                  <span className="font-tabular font-bold">{count.toLocaleString('es-ES')}</span>
                </div>
              ))}
              <div className="pt-2 flex flex-wrap gap-4 text-xs font-display uppercase">
                {viewsByType.map(([t, c]) => (
                  <span key={t}>
                    {t}: <strong className="font-tabular">{c}</strong>
                  </span>
                ))}
              </div>
              {trafficSources.length > 0 && (
                <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 text-xs">
                  <span className="font-display font-bold uppercase">Fuentes de tráfico: </span>
                  {trafficSources.map(([src, c]) => `${src} (${c})`).join(' · ')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: NEWSLETTER & REPORTS */}
      {tab === 'inbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-extrabold uppercase">Boletín ({subscribers.length})</h2>
              <button type="button" onClick={handleExportSubscribersCsv} className="px-4 py-1.5 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black font-display text-xs font-bold uppercase cursor-pointer">
                Exportar CSV
              </button>
            </div>
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 max-h-96 overflow-y-auto">
              {subscribers.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-semibold">{s.email}</p>
                    <p className="text-xs text-neutral-500">{s.name || 'Sin nombre'} · {formatDateEs(s.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await deleteDoc(doc(db, 'newsletter_subscribers', s.id));
                      } catch {
                        notify('No se pudo quitar al suscriptor.');
                      }
                    }}
                    className="text-xs text-red-600 cursor-pointer"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-4">
            <h2 className="font-display text-2xl font-extrabold uppercase flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[var(--editorial-primary)]" />
              <span>Denuncias y rectificaciones ({tickets.length})</span>
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {tickets.map((t) => (
                <div key={t.id} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-display font-bold uppercase">
                    <span className="text-[var(--editorial-primary)]">{t.type} · {t.status}</span>
                    <span>{formatDateEs(t.createdAt)}</span>
                  </div>
                  <p className="text-sm font-bold">{t.reason}</p>
                  {t.postTitle && <p className="text-xs text-neutral-500">Nota: {t.postTitle}</p>}
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">{t.details}</p>
                  <p className="text-xs text-neutral-500">De: {t.reporterName} ({t.reporterEmail})</p>
                  <div className="flex gap-2 pt-1 text-xs font-display font-bold uppercase">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'reports_and_rectifications', t.id), { status: 'resolved' });
                        } catch {
                          notify('No se pudo actualizar el estado del reporte.');
                        }
                      }}
                      className="text-emerald-600 cursor-pointer"
                    >
                      Marcar resuelto
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await deleteDoc(doc(db, 'reports_and_rectifications', t.id));
                        } catch {
                          notify('No se pudo eliminar el reporte.');
                        }
                      }}
                      className="text-red-600 cursor-pointer"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 10: ACTIVITY LOG */}
      {tab === 'activity' && (
        <div className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold uppercase">Registro de actividad administrativa</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Historial inmutable de acciones clave realizadas desde el panel de administración.
            </p>
          </div>
          {activityLogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              Aún no hay eventos registrados en la bitácora.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-300 dark:border-neutral-800 font-display text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5">Fecha y hora</th>
                    <th className="px-4 py-2.5">Responsable</th>
                    <th className="px-4 py-2.5">Acción</th>
                    <th className="px-4 py-2.5">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {activityLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-2.5 text-xs font-tabular whitespace-nowrap text-neutral-500">
                        {formatDateEs(log.createdAt, true)}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-semibold">{log.actorName}</td>
                      <td className="px-4 py-2.5 text-xs font-display font-bold uppercase text-[var(--editorial-primary)]">
                        {log.action}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-neutral-600 dark:text-neutral-300">{log.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 11: GENERAL SETTINGS */}
      {tab === 'settings' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveSiteConfig(cfgDraft, 'Identidad y textos del sitio guardados.', 'Configuración general del sitio actualizada');
          }}
          className="rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-6 max-w-4xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <h2 className="font-display text-2xl font-extrabold uppercase">Configuración general del medio</h2>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-bold uppercase bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700">
              <ShieldCheck className={`w-3.5 h-3.5 ${isAppCheckConfigured() ? 'text-emerald-600' : 'text-amber-600'}`} />
              <span>
                {isAppCheckConfigured() ? 'App Check activo + Antispam' : 'Antispam activo (App Check opcional)'}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Nombre de la revista</label>
              <input type="text" required minLength={2} maxLength={100} value={cfgDraft.siteName} onChange={(e) => setCfgDraft({ ...cfgDraft, siteName: e.target.value })} className="w-full px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Correo de contacto editorial (opcional)</label>
              <input type="email" value={cfgDraft.contactEmail} onChange={(e) => setCfgDraft({ ...cfgDraft, contactEmail: e.target.value })} placeholder="Deja vacío si aún no tienes correo" className="w-full px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
            </div>
          </div>

          <div>
            <label className="block font-display text-xs font-bold uppercase mb-1">Lema editorial</label>
            <input type="text" value={cfgDraft.tagline} onChange={(e) => setCfgDraft({ ...cfgDraft, tagline: e.target.value })} className="w-full px-3.5 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            <div className="sm:col-span-1 space-y-2">
              <label className="block font-display text-xs font-bold uppercase">Logo (URL o subir)</label>
              <div className="flex gap-2">
                <input type="text" value={cfgDraft.logoUrl} onChange={(e) => setCfgDraft({ ...cfgDraft, logoUrl: e.target.value })} className="flex-1 px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs" />
                <label className="px-3.5 py-2 rounded-full bg-[#111111] text-white text-xs font-display font-bold uppercase cursor-pointer flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        try {
                          const res = await uploadMediaAsset(f, 'site');
                          setCfgDraft({ ...cfgDraft, logoUrl: res.url });
                        } catch (err) {
                          notify(err instanceof Error ? err.message : 'No se pudo subir el logo.');
                        }
                      }
                    }}
                  />
                </label>
              </div>
              {sanitizeExternalUrl(cfgDraft.logoUrl) && (
                <div className="flex items-center gap-2 pt-1">
                  <img
                    src={sanitizeExternalUrl(cfgDraft.logoUrl)}
                    alt="Vista previa del logo"
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-xl object-cover border border-neutral-300 dark:border-neutral-700"
                  />
                  <span className="text-[11px] text-neutral-500">
                    Se sincroniza automáticamente como favicon e ícono de app PWA.
                  </span>
                </div>
              )}
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Color primario</label>
              <input type="color" value={cfgDraft.primaryColor} onChange={(e) => setCfgDraft({ ...cfgDraft, primaryColor: e.target.value })} className="w-full h-10 p-1 rounded-xl bg-white border border-neutral-300" />
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Color de acento</label>
              <input type="color" value={cfgDraft.accentColor} onChange={(e) => setCfgDraft({ ...cfgDraft, accentColor: e.target.value })} className="w-full h-10 p-1 rounded-xl bg-white border border-neutral-300" />
            </div>
          </div>

          {/* Optional Social Links */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-[#F8F6F1]/70 dark:bg-[#1A1A1A] p-4 space-y-3">
            <div>
              <h3 className="font-display text-sm font-bold uppercase">Redes sociales oficiales (opcionales)</h3>
              <p className="text-xs text-neutral-500">
                Cada enlace aparecerá en el pie de página únicamente cuando pegues su URL completa. Si el campo queda vacío, no se mostrará nada.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <input
                type="url"
                value={cfgDraft.socialLinks?.instagram || ''}
                onChange={(e) => setCfgDraft({ ...cfgDraft, socialLinks: { ...cfgDraft.socialLinks, instagram: e.target.value } })}
                placeholder="Instagram (https://...)"
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <input
                type="url"
                value={cfgDraft.socialLinks?.twitter || ''}
                onChange={(e) => setCfgDraft({ ...cfgDraft, socialLinks: { ...cfgDraft.socialLinks, twitter: e.target.value } })}
                placeholder="X / Twitter (https://...)"
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <input
                type="url"
                value={cfgDraft.socialLinks?.facebook || ''}
                onChange={(e) => setCfgDraft({ ...cfgDraft, socialLinks: { ...cfgDraft.socialLinks, facebook: e.target.value } })}
                placeholder="Facebook (https://...)"
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <input
                type="url"
                value={cfgDraft.socialLinks?.youtube || ''}
                onChange={(e) => setCfgDraft({ ...cfgDraft, socialLinks: { ...cfgDraft.socialLinks, youtube: e.target.value } })}
                placeholder="YouTube (https://...)"
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              <input
                type="url"
                value={cfgDraft.socialLinks?.telegram || ''}
                onChange={(e) => setCfgDraft({ ...cfgDraft, socialLinks: { ...cfgDraft.socialLinks, telegram: e.target.value } })}
                placeholder="Telegram (https://...)"
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-display text-xs font-bold uppercase mb-1">Texto institucional: Quiénes somos</label>
            <textarea rows={4} value={cfgDraft.aboutText} onChange={(e) => setCfgDraft({ ...cfgDraft, aboutText: e.target.value })} placeholder="Describe la misión editorial de la revista..." className="w-full p-3.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
          </div>

          {/* Editorial Transparency Page Texts (/como-trabajamos) */}
          <div className="space-y-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <h3 className="font-display text-sm font-bold uppercase">Página “Cómo trabajamos” (Transparencia editorial)</h3>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Metodología y cómo trabajamos</label>
              <textarea rows={3} value={cfgDraft.howWeWorkText} onChange={(e) => setCfgDraft({ ...cfgDraft, howWeWorkText: e.target.value })} className="w-full p-3.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-display text-xs font-bold uppercase mb-1">Política de fuentes y verificación</label>
                <textarea rows={3} value={cfgDraft.sourcesPolicyText} onChange={(e) => setCfgDraft({ ...cfgDraft, sourcesPolicyText: e.target.value })} className="w-full p-3.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
              </div>
              <div>
                <label className="block font-display text-xs font-bold uppercase mb-1">Política de fe de erratas y correcciones</label>
                <textarea rows={3} value={cfgDraft.correctionsPolicyText} onChange={(e) => setCfgDraft({ ...cfgDraft, correctionsPolicyText: e.target.value })} className="w-full p-3.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-display text-xs font-bold uppercase mb-1">Aviso de responsabilidad de autores</label>
            <textarea rows={2} value={cfgDraft.authorLiabilityNotice} onChange={(e) => setCfgDraft({ ...cfgDraft, authorLiabilityNotice: e.target.value })} className="w-full p-3.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Términos y condiciones</label>
              <textarea rows={3} value={cfgDraft.termsText} onChange={(e) => setCfgDraft({ ...cfgDraft, termsText: e.target.value })} className="w-full p-3.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Política de privacidad</label>
              <textarea rows={3} value={cfgDraft.privacyText} onChange={(e) => setCfgDraft({ ...cfgDraft, privacyText: e.target.value })} className="w-full p-3.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-sm" />
            </div>
          </div>

          <button type="submit" className="px-7 py-3 rounded-full bg-[var(--editorial-primary)] hover:bg-[var(--editorial-accent)] text-white font-display font-bold uppercase tracking-wider text-xs cursor-pointer transition-colors">
            Guardar toda la configuración
          </button>
        </form>
      )}
    </main>
  );
};
