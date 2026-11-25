import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
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
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  FileEdit,
  KeyRound,
  Lock,
  MessageSquare,
  Plus,
  Reply,
  Search,
  Send,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { checkActionCooldown, markActionCooldown } from '../lib/appCheck';
import { db } from '../lib/firebase';
import {
  buildCleanDuplicatePostPayload,
  calculateAdultAgeFromBirthYear,
  generateId,
  sanitizeExternalUrl,
  uploadMediaAsset,
} from '../lib/utils';
import {
  AnalyticsEvent,
  CollaboratorPrivacyFlags,
  CollaboratorSettings,
  CommentItem,
  OutletType,
  PoliticalAffiliationChoice,
  Post,
  PostStatus,
} from '../types/editorial';
import { EditorialImage } from './EditorialImage';
import {
  EditorialButton,
  EditorialNotice,
  EditorialStatCard,
  EmptyState,
  FilterChip,
  editorialInputClass,
} from './ui/EditorialPrimitives';
import { VerifiedBadge } from './VerifiedBadge';

const BlockEditor = lazy(() => import('./BlockEditor').then((m) => ({ default: m.BlockEditor })));

type CollabTab = 'posts' | 'comments' | 'profile' | 'stats' | 'permissions';

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
  showProfession: false,
  showJobTitle: false,
  showOrganization: false,
  showCityCountry: false,
  showAge: false,
  showPoliticalAffiliation: false,
  showPoliticalPartyLogo: false,
};

function renderPostStatusBadge(status: PostStatus) {
  const map: Record<PostStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
    published: {
      label: 'Publicada',
      cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-600/30',
      Icon: CheckCircle2,
    },
    in_review: {
      label: 'En revisión',
      cls: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/35',
      Icon: Clock,
    },
    draft: {
      label: 'Borrador',
      cls: 'bg-[var(--editorial-surface-subtle)] text-[var(--editorial-muted)] border-[var(--editorial-border)]',
      Icon: FileEdit,
    },
    scheduled: {
      label: 'Programada',
      cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
      Icon: Clock,
    },
    unpublished: {
      label: 'Retirada',
      cls: 'bg-neutral-500/15 text-[var(--editorial-muted)] border-[var(--editorial-border)]',
      Icon: EyeOff,
    },
  };
  const cfg = map[status] || map.draft;
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-display font-bold uppercase tracking-wider ${cfg.cls}`}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      <span>{cfg.label}</span>
    </span>
  );
}

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

  // Filters for posts list
  const [postQuery, setPostQuery] = useState('');
  const [postStatusFilter, setPostStatusFilter] = useState<'all' | PostStatus>('all');

  // Permission / revision request form (persists safely to reports_and_rectifications)
  const [permCategory, setPermCategory] = useState('Publicación directa sin pre-revisión');
  const [permDetails, setPermDetails] = useState('');
  const [permSending, setPermSending] = useState(false);
  const [permMsg, setPermMsg] = useState('');
  const [permErr, setPermErr] = useState('');

  // Private & public profile fields (all privacy toggles OFF by default)
  const [name, setName] = useState(collaboratorProfile?.name || '');
  const [outletType, setOutletType] = useState<OutletType>(collaboratorProfile?.outletType || 'independiente');
  const [profession, setProfession] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [birthYearInput, setBirthYearInput] = useState('');

  const [politicalAffiliation, setPoliticalAffiliation] = useState<PoliticalAffiliationChoice>('');
  const [politicalPartyName, setPoliticalPartyName] = useState('');
  const [politicalPartyRole, setPoliticalPartyRole] = useState('');
  const [politicalPartyLogoUrl, setPoliticalPartyLogoUrl] = useState('');
  const [politicalConsentAccepted, setPoliticalConsentAccepted] = useState(false);
  const [politicalConsentAcceptedAt, setPoliticalConsentAcceptedAt] = useState('');
  const [partyLogoProgress, setPartyLogoProgress] = useState<number | null>(null);

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
        setProfession(src.profession || '');
        setJobTitle(src.jobTitle || '');
        setOrganization(src.organization || '');
        setCity(src.city || '');
        setCountry(src.country || '');
        setBirthYearInput(priv?.birthYear ? String(priv.birthYear) : '');
        setPoliticalAffiliation(src.politicalAffiliation || '');
        setPoliticalPartyName(src.politicalPartyName || '');
        setPoliticalPartyRole(src.politicalPartyRole || '');
        setPoliticalPartyLogoUrl(src.politicalPartyLogoUrl || '');
        setPoliticalConsentAccepted(Boolean(priv?.politicalConsentAccepted));
        setPoliticalConsentAcceptedAt(priv?.politicalConsentAcceptedAt || '');
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
          showProfession: Boolean(src.showProfession),
          showJobTitle: Boolean(src.showJobTitle),
          showOrganization: Boolean(src.showOrganization),
          showCityCountry: Boolean(src.showCityCountry),
          showAge: Boolean(src.showAge),
          showPoliticalAffiliation: Boolean(src.showPoliticalAffiliation),
          showPoliticalPartyLogo: Boolean(src.showPoliticalPartyLogo),
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

  const filteredPosts = useMemo(() => {
    const q = postQuery.trim().toLowerCase();
    return myPosts.filter((p) => {
      if (postStatusFilter !== 'all' && p.status !== postStatusFilter) return false;
      if (!q) return true;
      return `${p.title} ${p.categoryName} ${p.type}`.toLowerCase().includes(q);
    });
  }, [myPosts, postQuery, postStatusFilter]);

  if (!firebaseUser) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState
          icon={<User className="w-6 h-6" />}
          kicker="Redacción colaborativa"
          title="Panel de Colaboradores"
          description="Inicia sesión con tu cuenta de colaborador o regístrate con tu código de invitación."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <EditorialButton onClick={() => setAuthModalOpen(true)}>Iniciar sesión</EditorialButton>
              <EditorialButton variant="secondary" onClick={() => navigate('/unete')}>
                Registrarme con código
              </EditorialButton>
            </div>
          }
        />
      </main>
    );
  }

  if (!isCollaborator) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState
          icon={<Lock className="w-6 h-6" />}
          kicker="Acceso restringido"
          title="Cuenta de lector"
          description="Tu cuenta actual tiene rol de lector. Para publicar contenidos necesitas registrarte mediante código de invitación."
          action={<EditorialButton onClick={() => navigate('/unete')}>Ir a registro de colaborador</EditorialButton>}
        />
      </main>
    );
  }

  if (!isActiveCollaborator) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <EmptyState
          icon={<Clock className="w-6 h-6" />}
          kicker="Estado de verificación"
          title={`Cuenta: ${userAccount?.status === 'suspended' ? 'Suspendida' : 'Pendiente de aprobación'}`}
          description={
            userAccount?.status === 'suspended'
              ? 'Tu acceso editorial se encuentra temporalmente suspendido por la administración.'
              : 'Tu solicitud fue verificada con el código de invitación y está en revisión por la administración del medio.'
          }
        />
      </main>
    );
  }

  const publishedCount = myPosts.filter((p) => p.status === 'published').length;
  const reviewCount = myPosts.filter((p) => p.status === 'in_review').length;
  const draftCount = myPosts.filter((p) => p.status === 'draft').length;
  const totalViews = myPosts.reduce((acc, p) => acc + (p.viewCount || 0), 0);
  const avgReadSec = ownAnalytics.length
    ? Math.round(ownAnalytics.reduce((a, e) => a + (e.readDurationSec || 0), 0) / ownAnalytics.length)
    : 0;
  const isVerifiedCollab = userAccount?.status === 'active' && collaboratorProfile?.status === 'active';
  const currentYear = new Date().getFullYear();
  const maxBirthYear = currentYear - 18;
  const computedAge = calculateAdultAgeFromBirthYear(birthYearInput);

  const persistProfileDocs = async (overridePolitical?: {
    choice: PoliticalAffiliationChoice;
    partyName: string;
    partyRole: string;
    partyLogoUrl: string;
    consentAccepted: boolean;
    consentAt: string;
    showPol: boolean;
    showLogo: boolean;
  }) => {
    const cleanName = name.trim().slice(0, 120);
    if (cleanName.length < 2) {
      throw new Error('El nombre público debe tener al menos 2 caracteres.');
    }

    const trimmedBirth = birthYearInput.trim();
    let validBirthYear: number | undefined;
    let publicAge: number | undefined;
    if (trimmedBirth) {
      const calc = calculateAdultAgeFromBirthYear(trimmedBirth);
      if (calc === null) {
        throw new Error(`El año de nacimiento debe corresponder a una persona mayor de 18 años (1900-${maxBirthYear}).`);
      }
      validBirthYear = Number(trimmedBirth);
      publicAge = calc;
    } else if (flags.showAge) {
      throw new Error('Ingresa tu año de nacimiento antes de activar la visibilidad de tu edad.');
    }

    const polChoice = overridePolitical ? overridePolitical.choice : politicalAffiliation;
    const cleanPartyName = (overridePolitical ? overridePolitical.partyName : politicalPartyName).trim().slice(0, 140);
    const cleanPartyRole = (overridePolitical ? overridePolitical.partyRole : politicalPartyRole).trim().slice(0, 120);
    const cleanPartyLogo = (overridePolitical ? overridePolitical.partyLogoUrl : politicalPartyLogoUrl).trim().slice(0, 400000);
    const consentOk = overridePolitical ? overridePolitical.consentAccepted : politicalConsentAccepted;
    const consentTime =
      polChoice === 'yes' && consentOk
        ? (overridePolitical ? overridePolitical.consentAt : politicalConsentAcceptedAt) || new Date().toISOString()
        : '';

    if (polChoice === 'yes') {
      if (!cleanPartyName) {
        throw new Error('Indica el nombre del partido o movimiento político.');
      }
      if (!consentOk) {
        throw new Error('Debes aceptar el consentimiento expreso (Ley 1581 de 2012) para guardar tu afiliación política.');
      }
    }

    const nextFlags: Required<CollaboratorPrivacyFlags> = {
      ...flags,
      ...(overridePolitical
        ? {
            showPoliticalAffiliation: overridePolitical.showPol,
            showPoliticalPartyLogo: overridePolitical.showLogo,
          }
        : {}),
    };

    const parsedTopics = topicsInput
      .split(',')
      .map((t) => t.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 15);

    const cleanProfession = profession.trim().slice(0, 120);
    const cleanJobTitle = jobTitle.trim().slice(0, 120);
    const cleanOrg = organization.trim().slice(0, 140);
    const cleanCity = city.trim().slice(0, 80);
    const cleanCountry = country.trim().slice(0, 80);
    const cleanWebsite = websiteUrl.trim() ? sanitizeExternalUrl(websiteUrl.trim()).slice(0, 500) : '';
    const cleanAvatar = avatarUrl.trim().slice(0, 400000);
    const cleanBio = bio.trim().slice(0, 2000);
    const cleanTw = socialTwitter.trim().slice(0, 300);
    const cleanIg = socialInstagram.trim().slice(0, 300);
    const cleanYt = socialYoutube.trim().slice(0, 300);
    const cleanEmail = publicEmail.trim().slice(0, 200);
    const cleanLocation = location.trim().slice(0, 120);

    const settingsDoc: Record<string, unknown> = {
      uid: firebaseUser.uid,
      name: cleanName,
      outletType,
      profession: cleanProfession,
      jobTitle: cleanJobTitle,
      organization: cleanOrg,
      city: cleanCity,
      country: cleanCountry,
      ...(validBirthYear !== undefined ? { birthYear: validBirthYear } : {}),
      politicalAffiliation: polChoice,
      politicalPartyName: polChoice === 'yes' ? cleanPartyName : '',
      politicalPartyRole: polChoice === 'yes' ? cleanPartyRole : '',
      politicalPartyLogoUrl: polChoice === 'yes' ? cleanPartyLogo : '',
      politicalConsentAccepted: polChoice === 'yes' ? Boolean(consentOk) : false,
      politicalConsentAcceptedAt: consentTime,
      bio: cleanBio,
      avatarUrl: cleanAvatar,
      websiteUrl: cleanWebsite,
      socialTwitter: cleanTw,
      socialInstagram: cleanIg,
      socialYoutube: cleanYt,
      publicEmail: cleanEmail,
      location: cleanLocation,
      topics: parsedTopics,
      ...nextFlags,
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'collaborator_settings', firebaseUser.uid), settingsDoc);

    const existingPublic = collaboratorProfile;
    const publicDoc: Record<string, unknown> = {
      uid: firebaseUser.uid,
      name: cleanName,
      outletType,
      status: existingPublic?.status || userAccount?.status || 'active',
      postCount: existingPublic?.postCount ?? 0,
      createdAt: existingPublic?.createdAt || serverTimestamp(),
      ...(existingPublic?.inviteHash ? { inviteHash: existingPublic.inviteHash } : {}),
      ...(existingPublic?.directoryHidden !== undefined ? { directoryHidden: existingPublic.directoryHidden } : {}),
      ...(existingPublic?.directoryFeatured !== undefined ? { directoryFeatured: existingPublic.directoryFeatured } : {}),
      ...(existingPublic?.directoryOrder !== undefined ? { directoryOrder: existingPublic.directoryOrder } : {}),
      ...(nextFlags.showProfession && cleanProfession ? { profession: cleanProfession } : {}),
      ...(nextFlags.showJobTitle && cleanJobTitle ? { jobTitle: cleanJobTitle } : {}),
      ...(nextFlags.showOrganization && cleanOrg ? { organization: cleanOrg } : {}),
      ...(nextFlags.showCityCountry && cleanCity ? { city: cleanCity } : {}),
      ...(nextFlags.showCityCountry && cleanCountry ? { country: cleanCountry } : {}),
      ...(nextFlags.showAge && publicAge !== undefined ? { publicAge } : {}),
      ...(nextFlags.showPoliticalAffiliation && polChoice
        ? {
            politicalAffiliation: polChoice,
            ...(polChoice === 'yes' && cleanPartyName ? { politicalPartyName: cleanPartyName } : {}),
            ...(polChoice === 'yes' && cleanPartyRole ? { politicalPartyRole: cleanPartyRole } : {}),
            ...(polChoice === 'yes' && nextFlags.showPoliticalPartyLogo && cleanPartyLogo
              ? { politicalPartyLogoUrl: cleanPartyLogo }
              : {}),
          }
        : {}),
      ...(nextFlags.showBio && cleanBio ? { bio: cleanBio } : {}),
      ...(nextFlags.showAvatar && cleanAvatar ? { avatarUrl: cleanAvatar } : {}),
      ...(nextFlags.showWebsite && cleanWebsite ? { websiteUrl: cleanWebsite } : {}),
      ...(nextFlags.showSocialTwitter && cleanTw ? { socialTwitter: cleanTw } : {}),
      ...(nextFlags.showSocialInstagram && cleanIg ? { socialInstagram: cleanIg } : {}),
      ...(nextFlags.showSocialYoutube && cleanYt ? { socialYoutube: cleanYt } : {}),
      ...(nextFlags.showPublicEmail && cleanEmail ? { publicEmail: cleanEmail } : {}),
      ...(nextFlags.showLocation && cleanLocation ? { location: cleanLocation } : {}),
      ...(nextFlags.showTopics && parsedTopics.length ? { topics: parsedTopics } : {}),
      ...nextFlags,
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'collaborators_public', firebaseUser.uid), publicDoc);
    setPoliticalConsentAcceptedAt(consentTime);
    await refreshUserDocs();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');
    try {
      await persistProfileDocs();
      setProfileMsg('Perfil y preferencias de privacidad guardados correctamente.');
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'No se pudo actualizar tu perfil. Verifica los datos.');
    }
  };

  const handleClearPoliticalData = async () => {
    setProfileMsg('');
    setProfileErr('');
    setPoliticalAffiliation('');
    setPoliticalPartyName('');
    setPoliticalPartyRole('');
    setPoliticalPartyLogoUrl('');
    setPoliticalConsentAccepted(false);
    setPoliticalConsentAcceptedAt('');
    setFlags((prev) => ({
      ...prev,
      showPoliticalAffiliation: false,
      showPoliticalPartyLogo: false,
    }));
    try {
      await persistProfileDocs({
        choice: '',
        partyName: '',
        partyRole: '',
        partyLogoUrl: '',
        consentAccepted: false,
        consentAt: '',
        showPol: false,
        showLogo: false,
      });
      setProfileMsg('Información política eliminada y consentimiento revocado correctamente.');
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : 'No se pudo eliminar la información política.');
    }
  };

  const handleDuplicatePost = async (source: Post) => {
    setPanelError('');
    try {
      const newId = generateId('post');
      const payload = buildCleanDuplicatePostPayload(
        source,
        newId,
        {
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        {
          authorId: firebaseUser.uid,
          authorProfileId: firebaseUser.uid,
          authorIdentityType: 'collaborator',
          authorVerified: true,
        }
      );
      await setDoc(doc(db, 'posts', newId), payload);
    } catch {
      setPanelError('No se pudo duplicar la publicación.');
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

  const handlePermissionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setPermMsg('');
    setPermErr('');
    const cd = checkActionCooldown(`perm_req_${firebaseUser.uid}`, 30000);
    if (!cd.allowed) {
      setPermErr(`Espera ${cd.remainingSec} segundos antes de enviar otra solicitud.`);
      return;
    }
    const cleanDetails = permDetails.trim().slice(0, 2800);
    if (cleanDetails.length < 10) {
      setPermErr('Explica brevemente tu solicitud (mínimo 10 caracteres).');
      return;
    }
    const reporterName = (collaboratorProfile?.name || userAccount?.displayName || 'Colaborador')
      .trim()
      .slice(0, 120);
    const reporterEmail = (firebaseUser.email || userAccount?.email || 'colaborador@revista.local')
      .trim()
      .slice(0, 200);

    setPermSending(true);
    try {
      const id = generateId('req');
      await setDoc(doc(db, 'reports_and_rectifications', id), {
        id,
        type: 'rectificacion',
        reporterName: reporterName.length >= 2 ? reporterName : 'Colaborador',
        reporterEmail: reporterEmail.includes('@') ? reporterEmail : 'colaborador@revista.local',
        reason: `Solicitud de permisos: ${permCategory}`.slice(0, 200),
        details: `[UID: ${firebaseUser.uid}] ${cleanDetails}`.slice(0, 3000),
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      markActionCooldown(`perm_req_${firebaseUser.uid}`);
      setPermDetails('');
      setPermMsg('Solicitud enviada al equipo de administración. Recibirás respuesta en tu bandeja editorial.');
    } catch {
      setPermErr('No se pudo registrar la solicitud en este momento.');
    } finally {
      setPermSending(false);
    }
  };

  if (editingPost !== undefined) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Suspense
          fallback={
            <div className="py-12 text-center text-sm text-[var(--editorial-muted)]">
              Cargando editor editorial...
            </div>
          }
        >
          <BlockEditor
            initialPost={editingPost}
            onSaved={() => setEditingPost(undefined)}
            onCancel={() => setEditingPost(undefined)}
          />
        </Suspense>
      </main>
    );
  }

  const toggleFlag = (key: keyof CollaboratorPrivacyFlags) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderTogglePill = (key: keyof CollaboratorPrivacyFlags, labelVisible = 'Visible', labelHidden = 'Oculto') => {
    const active = flags[key];
    return (
      <button
        type="button"
        onClick={() => toggleFlag(key)}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-display font-bold uppercase cursor-pointer transition-colors ${
          active
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
            : 'bg-[var(--editorial-surface-subtle)] text-[var(--editorial-muted)]'
        }`}
      >
        {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        <span>{active ? labelVisible : labelHidden}</span>
      </button>
    );
  };

  return (
    <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-up">
      <header className="border-b-2 border-[var(--editorial-ink)]/85 pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-[0.14em] text-[var(--editorial-primary)]">
            Panel autónomo de colaborador
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold uppercase tracking-tight flex items-center gap-2 text-[var(--editorial-ink)]">
            <span>{collaboratorProfile?.name || userAccount?.displayName}</span>
            {isVerifiedCollab && <VerifiedBadge size="md" />}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EditorialButton variant="secondary" size="md" onClick={() => navigate(`/colaborador/${firebaseUser.uid}`)}>
            Ver perfil público
          </EditorialButton>
          <EditorialButton size="md" onClick={() => setEditingPost(null)}>
            <Plus className="w-4 h-4" />
            <span>Nueva publicación</span>
          </EditorialButton>
        </div>
      </header>

      {/* Resumen KPI */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Resumen editorial">
        <EditorialStatCard label="Publicadas" value={publishedCount} accent icon={<CheckCircle2 className="w-4 h-4" />} />
        <EditorialStatCard label="En revisión" value={reviewCount} icon={<Clock className="w-4 h-4" />} />
        <EditorialStatCard label="Borradores" value={draftCount} icon={<FileEdit className="w-4 h-4" />} />
        <EditorialStatCard
          label="Lecturas totales"
          value={totalViews.toLocaleString('es-CO')}
          hint={`Promedio ${avgReadSec} s por visita`}
          icon={<BarChart3 className="w-4 h-4" />}
        />
      </section>

      {/* Pestañas */}
      <nav aria-label="Secciones del panel" className="flex flex-wrap gap-2 border-b border-[var(--editorial-border)] pb-3">
        {(
          [
            ['posts', `Publicaciones (${myPosts.length})`, Edit3],
            ['comments', `Comentarios (${ownComments.length})`, MessageSquare],
            ['profile', 'Mi perfil y privacidad', User],
            ['stats', 'Estadísticas', BarChart3],
            ['permissions', 'Solicitar permisos', KeyRound],
          ] as const
        ).map(([key, label, Icon]) => (
          <FilterChip key={key} active={tab === key} onClick={() => setTab(key)}>
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{label}</span>
          </FilterChip>
        ))}
      </nav>

      {panelError && <EditorialNotice tone="error">{panelError}</EditorialNotice>}

      {tab === 'posts' && (
        <div className="space-y-4">
          {myPosts.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[var(--editorial-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="search"
                  value={postQuery}
                  onChange={(e) => setPostQuery(e.target.value)}
                  placeholder="Filtrar tus publicaciones por título, categoría o formato..."
                  className={`${editorialInputClass} !pl-10`}
                />
              </div>
              <select
                aria-label="Filtrar por estado"
                value={postStatusFilter}
                onChange={(e) => setPostStatusFilter(e.target.value as 'all' | PostStatus)}
                className={`${editorialInputClass} sm:w-56`}
              >
                <option value="all">Todos los estados</option>
                <option value="published">Publicadas</option>
                <option value="in_review">En revisión</option>
                <option value="draft">Borradores</option>
                <option value="needs_correction">Requieren corrección</option>
                <option value="scheduled">Programadas</option>
                <option value="unpublished">Retiradas</option>
              </select>
            </div>
          )}

          {myPosts.length === 0 ? (
            <EmptyState
              icon={<Edit3 className="w-6 h-6" />}
              kicker="Tu escritorio editorial"
              title="Todavía no tienes publicaciones"
              description="Redacta crónicas, reportajes, columnas o entregas multimedia con el editor por bloques."
              action={<EditorialButton onClick={() => setEditingPost(null)}>Crear primera publicación</EditorialButton>}
            />
          ) : filteredPosts.length === 0 ? (
            <EmptyState
              icon={<Search className="w-6 h-6" />}
              title="Sin coincidencias"
              description="No hay entregas que coincidan con el filtro aplicado."
              action={
                <EditorialButton
                  variant="secondary"
                  onClick={() => {
                    setPostQuery('');
                    setPostStatusFilter('all');
                  }}
                >
                  Limpiar filtros
                </EditorialButton>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--editorial-border)] bg-[var(--editorial-surface-subtle)] font-display text-xs uppercase tracking-wider text-[var(--editorial-muted)]">
                  <tr>
                    <th className="px-4 py-3">Titular</th>
                    <th className="px-4 py-3">Formato</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Lecturas</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--editorial-border)]">
                  {filteredPosts.map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--editorial-surface-subtle)]/60 transition-colors">
                      <td className="px-4 py-3 font-semibold max-w-sm">
                        <button
                          type="button"
                          onClick={() => navigate(`/articulo/${p.slug}`)}
                          className="text-left hover:text-[var(--editorial-primary)] cursor-pointer text-[var(--editorial-ink)]"
                        >
                          {p.title}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs uppercase font-display text-[var(--editorial-muted)]">{p.type}</td>
                      <td className="px-4 py-3">{renderPostStatusBadge(p.status)}</td>
                      <td className="px-4 py-3 text-right font-tabular">{(p.viewCount || 0).toLocaleString('es-CO')}</td>
                      <td className="px-4 py-3 text-right space-x-2.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setEditingPost(p)}
                          className="text-xs font-display font-bold uppercase hover:text-[var(--editorial-primary)] cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicatePost(p)}
                          className="inline-flex items-center gap-1 text-xs font-display font-bold uppercase text-[var(--editorial-muted)] hover:text-[var(--editorial-primary)] cursor-pointer"
                        >
                          <Copy className="w-3 h-3" aria-hidden="true" />
                          <span>Duplicar</span>
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
            <EmptyState
              icon={<MessageSquare className="w-6 h-6" />}
              title="Sin comentarios recibidos"
              description="Cuando los lectores comenten tus publicaciones aparecerán aquí para moderación y respuesta."
            />
          ) : (
            ownComments.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-[var(--editorial-muted)]">
                      En <strong className="text-[var(--editorial-ink)]">{c.postTitle}</strong> · {c.authorName} · Estado: {c.status}
                    </p>
                    <p className="text-sm mt-1 text-[var(--editorial-ink)]">{c.text}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-display font-bold uppercase shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTargetId(replyTargetId === c.id ? null : c.id);
                        setReplyText('');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-[var(--editorial-border)] cursor-pointer hover:border-[var(--editorial-primary)]"
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
                      className="px-2.5 py-1 rounded-full border border-emerald-600/50 text-emerald-700 dark:text-emerald-400 cursor-pointer"
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
                      className="px-2.5 py-1 rounded-full border border-[var(--editorial-border)] cursor-pointer"
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
                  <div className="flex gap-2 pt-2 border-t border-[var(--editorial-border)]">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Escribe una respuesta pública..."
                      className={editorialInputClass}
                    />
                    <EditorialButton size="sm" onClick={() => handleReplyToComment(c)}>
                      Enviar
                    </EditorialButton>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="max-w-4xl rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-6 space-y-6"
        >
          <div className="space-y-1 border-b border-[var(--editorial-border)] pb-4">
            <h2 className="font-display text-2xl font-extrabold uppercase text-[var(--editorial-ink)]">
              Mi perfil y privacidad pública
            </h2>
            <p className="text-xs text-[var(--editorial-muted)] leading-relaxed">
              Toda información personal, laboral y política permanece oculta al público por defecto. Solo los campos cuyo interruptor marques como «Visible» aparecerán en tu ficha pública de autor.
            </p>
          </div>

          <label className="flex items-start gap-3 p-4 rounded-xl border border-[var(--editorial-border)] bg-[var(--editorial-surface-subtle)] cursor-pointer">
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
              <span className="text-xs text-[var(--editorial-muted)]">
                Si está desactivado, tu perfil no se listará en el directorio público ni en la portada.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Nombre público o del medio *</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={editorialInputClass}
              />
            </div>
            <div>
              <label className="block font-display text-xs font-bold uppercase mb-1">Modalidad</label>
              <select
                value={outletType}
                onChange={(e) => setOutletType(e.target.value as OutletType)}
                className={editorialInputClass}
              >
                <option value="independiente">Periodista independiente</option>
                <option value="medio">Medio o revista aliada</option>
              </select>
            </div>
            <div className="rounded-xl border border-[var(--editorial-border)] p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[11px] font-bold uppercase">Año nac. (solo edad)</span>
                {renderTogglePill('showAge')}
              </div>
              <input
                type="number"
                min={1900}
                max={maxBirthYear}
                value={birthYearInput}
                onChange={(e) => setBirthYearInput(e.target.value)}
                placeholder={`1900 - ${maxBirthYear}`}
                className={editorialInputClass}
              />
              {computedAge !== null && (
                <p className="text-[10px] text-[var(--editorial-muted)]">
                  Edad calculada: <strong>{computedAge} años</strong>
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--editorial-border)] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-xs font-bold uppercase">Foto de perfil o logotipo (1:1)</span>
              {renderTogglePill('showAvatar', 'Visible públicamente', 'Oculto')}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {avatarUrl && (
                <div className="w-12 h-12 rounded-full overflow-hidden border border-[var(--editorial-border)] shrink-0">
                  <EditorialImage src={avatarUrl} alt={name} fallbackTitle={name} allowInDataSaver />
                </div>
              )}
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="URL de imagen o sube un archivo"
                className={`${editorialInputClass} flex-1 min-w-[200px]`}
              />
              <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--editorial-ink)] text-[var(--editorial-paper)] text-xs font-display font-bold uppercase cursor-pointer">
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
              <div className="h-1.5 rounded-full bg-[var(--editorial-surface-subtle)] overflow-hidden">
                <div className="h-1.5 bg-[var(--editorial-primary)]" style={{ width: `${avatarProgress}%` }} />
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--editorial-border)] p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="font-display text-xs font-bold uppercase">Biografía corta / Línea editorial</label>
              {renderTogglePill('showBio')}
            </div>
            <textarea
              rows={3}
              maxLength={2000}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Trayectoria, enfoque periodístico o medio..."
              className={editorialInputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--editorial-border)] p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[11px] font-bold uppercase">¿A qué te dedicas?</span>
                {renderTogglePill('showProfession')}
              </div>
              <input
                type="text"
                maxLength={120}
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                placeholder="Ej. Periodismo de investigación y docente"
                className={editorialInputClass}
              />
            </div>

            <div className="rounded-xl border border-[var(--editorial-border)] p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[11px] font-bold uppercase">Cargo o trabajo actual</span>
                {renderTogglePill('showJobTitle')}
              </div>
              <input
                type="text"
                maxLength={120}
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Ej. Reportero/a de derechos humanos"
                className={editorialInputClass}
              />
            </div>

            <div className="rounded-xl border border-[var(--editorial-border)] p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[11px] font-bold uppercase">Organización o medio</span>
                {renderTogglePill('showOrganization')}
              </div>
              <input
                type="text"
                maxLength={140}
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Ej. Colectivo Prensa Libre"
                className={editorialInputClass}
              />
            </div>

            <div className="rounded-xl border border-[var(--editorial-border)] p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[11px] font-bold uppercase">Ciudad y país</span>
                {renderTogglePill('showCityCountry')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  maxLength={80}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ciudad"
                  className={editorialInputClass}
                />
                <input
                  type="text"
                  maxLength={80}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="País"
                  className={editorialInputClass}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--editorial-border)] bg-[var(--editorial-surface-subtle)] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Afiliación política (Dato sensible · Ley 1581 de 2012)</span>
                </h3>
                <p className="text-[11px] text-[var(--editorial-muted)] mt-0.5">
                  ¿Perteneces a algún partido o movimiento político? Esta respuesta es voluntaria.
                </p>
              </div>
              {renderTogglePill('showPoliticalAffiliation', 'Visible al público', 'Privado')}
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
                    if (val !== 'yes') setPoliticalConsentAccepted(false);
                  }}
                  className={`px-3 py-2 rounded-xl border text-xs font-display font-bold uppercase cursor-pointer transition-colors ${
                    politicalAffiliation === val
                      ? 'border-[var(--editorial-primary)] bg-[var(--editorial-primary)] text-white'
                      : 'border-[var(--editorial-border)] bg-[var(--editorial-surface)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {politicalAffiliation === 'yes' && (
              <div className="space-y-3 pt-2 border-t border-[var(--editorial-border)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-display text-[11px] font-bold uppercase mb-1">
                      Partido o movimiento político *
                    </label>
                    <input
                      type="text"
                      maxLength={140}
                      value={politicalPartyName}
                      onChange={(e) => setPoliticalPartyName(e.target.value)}
                      placeholder="Nombre de la organización"
                      className={editorialInputClass}
                    />
                  </div>
                  <div>
                    <label className="block font-display text-[11px] font-bold uppercase mb-1">
                      Cargo o rol dentro de él
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={politicalPartyRole}
                      onChange={(e) => setPoliticalPartyRole(e.target.value)}
                      placeholder="Ej. Militante, vocería..."
                      className={editorialInputClass}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-[11px] font-bold uppercase">Logo o foto del partido</span>
                    {renderTogglePill('showPoliticalPartyLogo', 'Logo visible', 'Logo oculto')}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {politicalPartyLogoUrl && (
                      <img
                        src={sanitizeExternalUrl(politicalPartyLogoUrl)}
                        alt="Logo del partido"
                        className="w-10 h-10 rounded-lg object-contain border border-[var(--editorial-border)] bg-white p-0.5"
                      />
                    )}
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--editorial-ink)] text-[var(--editorial-paper)] text-[11px] font-display font-bold uppercase cursor-pointer">
                      <Upload className="w-3 h-3" />
                      <span>Subir logo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setProfileErr('');
                          setPartyLogoProgress(5);
                          try {
                            const res = await uploadMediaAsset(
                              f,
                              `party_logos/${firebaseUser.uid}`,
                              (pct) => setPartyLogoProgress(pct),
                              'party_logo'
                            );
                            setPoliticalPartyLogoUrl(res.url);
                          } catch (err) {
                            setProfileErr(err instanceof Error ? err.message : 'No se pudo subir el logo político.');
                          } finally {
                            setTimeout(() => setPartyLogoProgress(null), 600);
                          }
                        }}
                      />
                    </label>
                    {politicalPartyLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setPoliticalPartyLogoUrl('')}
                        className="text-[11px] font-display font-bold uppercase text-red-600 cursor-pointer"
                      >
                        Quitar logo
                      </button>
                    )}
                  </div>
                  {partyLogoProgress !== null && (
                    <div className="h-1.5 rounded-full bg-[var(--editorial-surface-subtle)] overflow-hidden">
                      <div className="h-1.5 bg-[var(--editorial-primary)]" style={{ width: `${partyLogoProgress}%` }} />
                    </div>
                  )}
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 cursor-pointer text-xs leading-relaxed">
                  <input
                    type="checkbox"
                    checked={politicalConsentAccepted}
                    onChange={(e) => setPoliticalConsentAccepted(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <strong>Autorización expresa (Ley 1581 de 2012):</strong> Consiento el tratamiento de mi afiliación política como dato sensible para archivo administrativo de transparencia editorial.
                    {politicalConsentAcceptedAt && (
                      <span className="block text-[10px] text-[var(--editorial-muted)] mt-0.5">
                        Registrado: {new Date(politicalConsentAcceptedAt).toLocaleDateString('es-CO')}
                      </span>
                    )}
                  </span>
                </label>
              </div>
            )}

            {politicalAffiliation && (
              <button
                type="button"
                onClick={handleClearPoliticalData}
                className="inline-flex items-center gap-1.5 text-[11px] font-display font-bold uppercase text-red-600 hover:underline cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Eliminar mi afiliación política y revocar consentimiento</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(
              [
                ['Sitio web', websiteUrl, setWebsiteUrl, 'showWebsite', 'https://...', 'url'],
                ['Correo público de contacto', publicEmail, setPublicEmail, 'showPublicEmail', 'contacto@ejemplo.org', 'email'],
                ['Región / Territorio libre', location, setLocation, 'showLocation', 'Ej. Tolima y centro andino', 'text'],
                ['Temas de especialización (coma)', topicsInput, setTopicsInput, 'showTopics', 'Derechos humanos, economía, territorio', 'text'],
                ['X / Twitter', socialTwitter, setSocialTwitter, 'showSocialTwitter', '@usuario o https://...', 'text'],
                ['Instagram', socialInstagram, setSocialInstagram, 'showSocialInstagram', '@usuario o https://...', 'text'],
                ['YouTube', socialYoutube, setSocialYoutube, 'showSocialYoutube', 'Canal o https://...', 'text'],
              ] as const
            ).map(([label, val, setter, flagKey, placeholder, inputType]) => (
              <div key={flagKey} className="rounded-xl border border-[var(--editorial-border)] p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[11px] font-bold uppercase">{label}</span>
                  {renderTogglePill(flagKey)}
                </div>
                <input
                  type={inputType}
                  value={val}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                  className={editorialInputClass}
                />
              </div>
            ))}
          </div>

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

          <EditorialButton type="submit" size="md">
            Guardar perfil y privacidad
          </EditorialButton>
          {profileErr && <EditorialNotice tone="error">{profileErr}</EditorialNotice>}
          {profileMsg && <EditorialNotice tone="success">{profileMsg}</EditorialNotice>}
        </form>
      )}

      {tab === 'stats' && (
        <div className="rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-5 sm:p-6 space-y-4">
          <h3 className="font-display text-lg font-extrabold uppercase text-[var(--editorial-ink)]">
            Rendimiento por publicación
          </h3>
          {myPosts.length === 0 ? (
            <p className="text-sm text-[var(--editorial-muted)]">Aún no hay métricas de lecturas registradas.</p>
          ) : (
            myPosts.map((p) => (
              <div key={p.id} className="space-y-1">
                <div className="flex justify-between text-xs gap-2">
                  <span className="font-semibold truncate max-w-md text-[var(--editorial-ink)]">{p.title}</span>
                  <span className="font-tabular text-[var(--editorial-muted)] shrink-0">
                    {(p.viewCount || 0).toLocaleString('es-CO')} lecturas
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-[var(--editorial-surface-subtle)]">
                  <div
                    className="h-2 bg-[var(--editorial-primary)] transition-all"
                    style={{
                      width: `${Math.min(100, Math.round(((p.viewCount || 0) / Math.max(1, totalViews)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'permissions' && (
        <form
          onSubmit={handlePermissionRequest}
          className="max-w-2xl rounded-2xl border border-[var(--editorial-border)] bg-[var(--editorial-surface)] p-6 space-y-5"
        >
          <div className="space-y-1 border-b border-[var(--editorial-border)] pb-4">
            <p className="font-display text-xs font-bold uppercase tracking-widest text-[var(--editorial-primary)]">
              Canal directo con administración
            </p>
            <h2 className="font-display text-2xl font-extrabold uppercase text-[var(--editorial-ink)]">
              Solicitar permisos o revisión editorial
            </h2>
            <p className="text-xs text-[var(--editorial-muted)] leading-relaxed">
              Solicita habilitación para publicación directa, asignación a series especiales o revisión prioritaria de tus entregas. Ningún colaborador puede auto-asignarse permisos sin aprobación del administrador.
            </p>
          </div>

          <div>
            <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
              Tipo de solicitud
            </label>
            <select
              value={permCategory}
              onChange={(e) => setPermCategory(e.target.value)}
              className={editorialInputClass}
            >
              <option>Publicación directa sin pre-revisión</option>
              <option>Destacar firma en el directorio principal</option>
              <option>Crear o participar en serie especial / dossier</option>
              <option>Revisión prioritaria de artículo en cola</option>
              <option>Actualización o rectificación editorial</option>
            </select>
          </div>

          <div>
            <label className="block font-display text-xs font-bold uppercase tracking-wider mb-1">
              Justificación y detalles *
            </label>
            <textarea
              required
              rows={4}
              minLength={10}
              maxLength={2800}
              value={permDetails}
              onChange={(e) => setPermDetails(e.target.value)}
              placeholder="Explica tu solicitud, trayectoria o el enlace de la entrega que requiere revisión..."
              className={editorialInputClass}
            />
          </div>

          <EditorialButton type="submit" disabled={permSending}>
            <Send className="w-3.5 h-3.5" />
            <span>{permSending ? 'Enviando solicitud...' : 'Enviar solicitud a administración'}</span>
          </EditorialButton>

          {permErr && <EditorialNotice tone="error">{permErr}</EditorialNotice>}
          {permMsg && <EditorialNotice tone="success">{permMsg}</EditorialNotice>}
        </form>
      )}
    </main>
  );
};
