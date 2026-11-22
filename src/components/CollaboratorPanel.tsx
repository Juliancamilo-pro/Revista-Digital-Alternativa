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
import {
  BarChart3,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  Lock,
  MessageSquare,
  Plus,
  Reply,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
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
  showProfession: false,
  showJobTitle: false,
  showOrganization: false,
  showCityCountry: false,
  showAge: false,
  showPoliticalAffiliation: false,
  showPoliticalPartyLogo: false,
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

    // 1. Save full draft, sensitive birthYear & Ley 1581 consent into private /collaborator_settings/{uid}
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

    // 2. Reconstruct clean /collaborators_public/{uid} keeping admin-managed fields intact and stripping ALL hidden/private fields
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

  const renderTogglePill = (key: keyof CollaboratorPrivacyFlags, labelVisible = 'Visible', labelHidden = 'Oculto') => {
    const active = flags[key];
    return (
      <button
        type="button"
        onClick={() => toggleFlag(key)}
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-display font-bold uppercase cursor-pointer ${
          active
            ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
        }`}
      >
        {active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        <span>{active ? labelVisible : labelHidden}</span>
      </button>
    );
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
                          onClick={() => handleDuplicatePost(p)}
                          className="inline-flex items-center gap-1 text-xs font-display font-bold uppercase text-neutral-600 dark:text-neutral-300 hover:text-[var(--editorial-primary)] cursor-pointer"
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
        <form onSubmit={handleSaveProfile} className="max-w-4xl rounded-2xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#141414] p-6 space-y-6">
          <div className="space-y-1 border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <h2 className="font-display text-2xl font-extrabold uppercase">Mi perfil y privacidad pública</h2>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Toda información personal, laboral y política permanece oculta al público por defecto. Solo los campos cuyo interruptor marques como «Visible» aparecerán en tu ficha pública de autor. Tu año de nacimiento nunca se expone.
            </p>
          </div>

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

          {/* Identidad básica + edad calculada */}
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
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 space-y-1.5">
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
                className="w-full px-3 py-1.5 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
              {computedAge !== null && (
                <p className="text-[10px] text-neutral-500">
                  Edad calculada: <strong>{computedAge} años</strong> (nunca se muestra el año exacto)
                </p>
              )}
            </div>
          </div>

          {/* Avatar + privacy switch */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-display text-xs font-bold uppercase">Foto de perfil o logotipo (recorte 1:1)</span>
              {renderTogglePill('showAvatar', 'Visible públicamente', 'Oculto')}
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
              <label className="font-display text-xs font-bold uppercase">Biografía corta / Línea editorial</label>
              {renderTogglePill('showBio')}
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

          {/* Extended profession / workplace / city-country with individual visibility toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 space-y-1.5">
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
                className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 space-y-1.5">
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
                className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[11px] font-bold uppercase">Organización o medio donde trabaja</span>
                {renderTogglePill('showOrganization')}
              </div>
              <input
                type="text"
                maxLength={140}
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="Ej. Colectivo Prensa Libre"
                className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
              />
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 space-y-1.5">
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
                  className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
                <input
                  type="text"
                  maxLength={80}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="País"
                  className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Afiliación política (Dato sensible · Ley 1581 de 2012) */}
          <div className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[#F8F6F1] dark:bg-[#1A1A1A] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[var(--editorial-primary)] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Afiliación política (Dato sensible · Ley 1581 de 2012)</span>
                </h3>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-0.5">
                  ¿Perteneces a algún partido o movimiento político? Esta respuesta es voluntaria y puedes borrarla en cualquier momento.
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
                    <label className="block font-display text-[11px] font-bold uppercase mb-1">
                      Partido o movimiento político *
                    </label>
                    <input
                      type="text"
                      maxLength={140}
                      value={politicalPartyName}
                      onChange={(e) => setPoliticalPartyName(e.target.value)}
                      placeholder="Nombre de la organización"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#141414] border border-neutral-300 dark:border-neutral-700 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-display text-[11px] font-bold uppercase mb-1">
                      Cargo o rol dentro de él (opcional)
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={politicalPartyRole}
                      onChange={(e) => setPoliticalPartyRole(e.target.value)}
                      placeholder="Ej. Militante, vocería..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#141414] border border-neutral-300 dark:border-neutral-700 text-xs"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141414] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-[11px] font-bold uppercase">Logo o foto del partido (256px WebP)</span>
                    {renderTogglePill('showPoliticalPartyLogo', 'Logo visible', 'Logo oculto')}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {politicalPartyLogoUrl && (
                      <img
                        src={sanitizeExternalUrl(politicalPartyLogoUrl)}
                        alt="Logo del partido"
                        className="w-10 h-10 rounded-lg object-contain border border-neutral-300 bg-white p-0.5"
                      />
                    )}
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#111111] dark:bg-white text-white dark:text-black text-[11px] font-display font-bold uppercase cursor-pointer">
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
                    <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
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
                    <strong>Autorización expresa (Ley 1581 de 2012):</strong> Consiento el tratamiento de mi afiliación política como dato sensible para archivo administrativo de transparencia editorial y para su publicación únicamente si activo el interruptor «Visible al público».
                    {politicalConsentAcceptedAt && (
                      <span className="block text-[10px] text-neutral-500 mt-0.5">
                        Registrado: {new Date(politicalConsentAcceptedAt).toLocaleDateString('es-ES')}
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

          {/* Optional contact, location, topics & social fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(
              [
                ['Sitio web', websiteUrl, setWebsiteUrl, 'showWebsite', 'https://...', 'url'],
                ['Correo público de contacto', publicEmail, setPublicEmail, 'showPublicEmail', 'contacto@ejemplo.org', 'email'],
                ['Región / Territorio libre', location, setLocation, 'showLocation', 'Ej. Sur de Colombia', 'text'],
                ['Temas de especialización (coma)', topicsInput, setTopicsInput, 'showTopics', 'Derechos humanos, economía, territorio', 'text'],
                ['X / Twitter', socialTwitter, setSocialTwitter, 'showSocialTwitter', '@usuario o https://...', 'text'],
                ['Instagram', socialInstagram, setSocialInstagram, 'showSocialInstagram', '@usuario o https://...', 'text'],
                ['YouTube', socialYoutube, setSocialYoutube, 'showSocialYoutube', 'Canal o https://...', 'text'],
              ] as const
            ).map(([label, val, setter, flagKey, placeholder, inputType]) => (
              <div key={flagKey} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-[11px] font-bold uppercase">{label}</span>
                  {renderTogglePill(flagKey)}
                </div>
                <input
                  type={inputType}
                  value={val}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8F6F1] dark:bg-[#1E1E1E] border border-neutral-300 dark:border-neutral-700 text-xs"
                />
              </div>
            ))}
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
