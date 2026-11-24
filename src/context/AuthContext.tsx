import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { clearCalendarAccessToken } from '../lib/googleCalendar';
import { runIdempotentPostsMigration } from '../lib/postMigration';
import { runOneTimeAdminSampleCleanup } from '../lib/seedData';
import { calculateAdultAgeFromBirthYear, hashInviteCode, toDate, uploadMediaAsset } from '../lib/utils';
import {
  BookmarkItem,
  CollaboratorPublic,
  OutletType,
  PoliticalAffiliationChoice,
  Post,
  UserAccount,
} from '../types/editorial';

export const ADMIN_OWNER_EMAIL = 'trujillogordillooo@gmail.com';

export interface AdminDiagnostics {
  uid: string | null;
  email: string | null;
  emailMatchesOwner: boolean;
  emailVerified: boolean;
  hasAdminDoc: boolean;
  userRole: string | null;
  userStatus: string | null;
  bootstrapClaimed: boolean;
  bootstrapAdminUid: string | null;
  bootstrapError: string | null;
  reason: string;
}

export interface RegisterCollaboratorInput {
  outletName: string;
  outletType: OutletType;
  email: string;
  password: string;
  inviteCode: string;
  birthYear: number;
  profession?: string;
  jobTitle?: string;
  organization?: string;
  city?: string;
  country?: string;
  politicalAffiliation?: PoliticalAffiliationChoice;
  politicalPartyName?: string;
  politicalPartyRole?: string;
  politicalPartyLogoFile?: File | null;
  politicalConsentAccepted?: boolean;
}

interface AuthContextValue {
  firebaseUser: User | null;
  userAccount: UserAccount | null;
  collaboratorProfile: CollaboratorPublic | null;
  isAdmin: boolean;
  isCollaborator: boolean;
  isActiveCollaborator: boolean;
  authReady: boolean;
  bookmarks: BookmarkItem[];
  adminDiagnostics: AdminDiagnostics;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  registerReader: (name: string, email: string, password: string) => Promise<void>;
  registerCollaborator: (params: RegisterCollaboratorInput) => Promise<{ status: 'active' | 'pending' }>;
  sendPasswordReset: (email: string) => Promise<void>;
  sendCurrentUserVerificationEmail: () => Promise<void>;
  logout: () => Promise<void>;
  toggleBookmark: (post: Post) => Promise<boolean>;
  refreshUserDocs: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function mapFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const msg = err instanceof Error ? err.message : String(err);
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos.';
    case 'auth/email-already-in-use':
      return 'Este correo electrónico ya está registrado.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/invalid-email':
      return 'El formato del correo electrónico no es válido.';
    case 'auth/operation-not-allowed':
      return 'El acceso con correo y contraseña aún no está activado en Firebase Console (Authentication → Sign-in method → Email/Password). También puedes ingresar con Google.';
    case 'auth/popup-closed-by-user':
      return 'Se cerró la ventana de inicio de sesión antes de completar el acceso.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos seguidos. Espera unos minutos antes de volver a intentarlo.';
    default:
      return msg || 'Ocurrió un error de autenticación.';
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [collaboratorProfile, setCollaboratorProfile] = useState<CollaboratorPublic | null>(null);
  const [isAdminDoc, setIsAdminDoc] = useState(false);
  const [bootstrapMeta, setBootstrapMeta] = useState<{ adminClaimed?: boolean; adminUid?: string } | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const cleanupTriggeredRef = useRef(false);

  const ensureAdminBootstrap = async (
    user: User,
    initialAdminExists: boolean,
    initialBootstrapData: { adminClaimed?: boolean; adminUid?: string } | null,
    initialUserData: UserAccount | null
  ): Promise<{ adminExists: boolean; bootstrapData: { adminClaimed?: boolean; adminUid?: string } | null; userData: UserAccount | null }> => {
    const emailNormalized = (user.email || '').trim().toLowerCase();
    if (emailNormalized !== ADMIN_OWNER_EMAIL) {
      return { adminExists: initialAdminExists, bootstrapData: initialBootstrapData, userData: initialUserData };
    }

    const needAdminDoc = !initialAdminExists;
    const needBootstrapDoc = !initialBootstrapData?.adminClaimed;
    const needUserDoc =
      !initialUserData || initialUserData.role !== 'admin' || initialUserData.status !== 'active';

    if (!needAdminDoc && !needBootstrapDoc && !needUserDoc) {
      setBootstrapError(null);
      return { adminExists: true, bootstrapData: initialBootstrapData, userData: initialUserData };
    }

    const safeEmail = (user.email || ADMIN_OWNER_EMAIL).trim().slice(0, 200);
    const rawName = (user.displayName || 'Dirección Editorial').trim().slice(0, 120);
    const safeName = rawName.length >= 2 ? rawName : 'Dirección Editorial';

    try {
      const batch = writeBatch(db);
      if (needAdminDoc) {
        batch.set(doc(db, 'admins', user.uid), {
          uid: user.uid,
          email: safeEmail,
          displayName: safeName,
          role: 'admin',
          createdAt: serverTimestamp(),
        });
      }
      if (needBootstrapDoc) {
        batch.set(doc(db, 'site_meta', 'bootstrap'), {
          adminClaimed: true,
          adminUid: user.uid,
          claimedAt: serverTimestamp(),
        });
      }
      if (!initialUserData) {
        batch.set(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: safeEmail,
          displayName: safeName,
          role: 'admin',
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (needUserDoc) {
        batch.set(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: initialUserData.email || safeEmail,
          displayName: initialUserData.displayName || safeName,
          role: 'admin',
          status: 'active',
          createdAt: initialUserData.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setBootstrapError(null);

      const [nextAdminSnap, nextBootstrapSnap, nextUserSnap] = await Promise.all([
        getDoc(doc(db, 'admins', user.uid)).catch(() => null),
        getDoc(doc(db, 'site_meta', 'bootstrap')).catch(() => null),
        getDoc(doc(db, 'users', user.uid)).catch(() => null),
      ]);

      return {
        adminExists: Boolean(nextAdminSnap?.exists()),
        bootstrapData: nextBootstrapSnap?.exists()
          ? (nextBootstrapSnap.data() as { adminClaimed?: boolean; adminUid?: string })
          : initialBootstrapData,
        userData: nextUserSnap?.exists() ? (nextUserSnap.data() as UserAccount) : initialUserData,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('No se pudo completar el bootstrap automático de administrador:', err);
      setBootstrapError(msg);
      return { adminExists: initialAdminExists, bootstrapData: initialBootstrapData, userData: initialUserData };
    }
  };

  const loadUserDocs = async (user: User | null) => {
    if (!user) {
      setUserAccount(null);
      setCollaboratorProfile(null);
      setIsAdminDoc(false);
      setBootstrapMeta(null);
      setBootstrapError(null);
      return;
    }
    try {
      const [adminSnap, bootstrapSnap, userSnap, collabSnap] = await Promise.all([
        getDoc(doc(db, 'admins', user.uid)).catch(() => null),
        getDoc(doc(db, 'site_meta', 'bootstrap')).catch(() => null),
        getDoc(doc(db, 'users', user.uid)).catch(() => null),
        getDoc(doc(db, 'collaborators_public', user.uid)).catch(() => null),
      ]);

      const initialAdminExists = Boolean(adminSnap?.exists());
      const initialBootstrapData = bootstrapSnap?.exists()
        ? (bootstrapSnap.data() as { adminClaimed?: boolean; adminUid?: string })
        : null;
      const initialUserData = userSnap && userSnap.exists() ? (userSnap.data() as UserAccount) : null;

      const resolved = await ensureAdminBootstrap(
        user,
        initialAdminExists,
        initialBootstrapData,
        initialUserData
      );

      setIsAdminDoc(resolved.adminExists);
      setBootstrapMeta(resolved.bootstrapData);
      setUserAccount(resolved.userData);
      setCollaboratorProfile(collabSnap && collabSnap.exists() ? (collabSnap.data() as CollaboratorPublic) : null);
    } catch (err) {
      console.error('Error cargando perfil de usuario:', err);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        clearCalendarAccessToken();
        cleanupTriggeredRef.current = false;
      }
      setFirebaseUser(user);
      await loadUserDocs(user);
      if (user) {
        user
          .getIdToken()
          .then((token) =>
            fetch('/api/users/sync', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            })
          )
          .catch(() => {
            // Sincronización silenciosa con Cloud SQL
          });
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!firebaseUser) {
      setBookmarks([]);
      return;
    }
    const q = collection(db, 'users', firebaseUser.uid, 'bookmarks');
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBookmarks(snap.docs.map((d) => d.data() as BookmarkItem));
      },
      (err) => {
        console.warn('Bookmarks snapshot warning:', err);
      }
    );
    return () => unsub();
  }, [firebaseUser]);

  const ownerEmailMatches =
    (firebaseUser?.email || '').trim().toLowerCase() === ADMIN_OWNER_EMAIL;
  const isBootstrappedEmailAdmin = Boolean(ownerEmailMatches && firebaseUser?.emailVerified);
  const isActiveAdminAccount =
    userAccount?.role === 'admin' && userAccount?.status === 'active';
  const isBootstrappedUidMatch = Boolean(
    firebaseUser && bootstrapMeta?.adminUid && bootstrapMeta.adminUid === firebaseUser.uid
  );
  const isAdmin =
    isAdminDoc || isActiveAdminAccount || isBootstrappedUidMatch || isBootstrappedEmailAdmin;
  const isCollaborator = userAccount?.role === 'collaborator';
  const isActiveCollaborator = isCollaborator && userAccount?.status === 'active';

  const adminDiagnostics: AdminDiagnostics = (() => {
    if (!firebaseUser) {
      return {
        uid: null,
        email: null,
        emailMatchesOwner: false,
        emailVerified: false,
        hasAdminDoc: false,
        userRole: null,
        userStatus: null,
        bootstrapClaimed: Boolean(bootstrapMeta?.adminClaimed),
        bootstrapAdminUid: bootstrapMeta?.adminUid || null,
        bootstrapError: null,
        reason: 'No hay ninguna sesión iniciada.',
      };
    }

    let reason = 'Acceso de administrador verificado.';
    if (!isAdmin) {
      if (!ownerEmailMatches) {
        reason = `La sesión actual (${firebaseUser.email || 'sin correo'}) no corresponde a ${ADMIN_OWNER_EMAIL} ni figura en /admins/${firebaseUser.uid}.`;
      } else if (userAccount?.role === 'admin' && userAccount?.status !== 'active') {
        reason = `La cuenta de administrador existe en users/${firebaseUser.uid}, pero su estado es "${userAccount.status}" (se requiere "active").`;
      } else if (bootstrapMeta?.adminClaimed && bootstrapMeta.adminUid !== firebaseUser.uid && !firebaseUser.emailVerified) {
        reason =
          'El correo coincide con la cuenta administradora, pero el correo no está verificado y el bloqueo /site_meta/bootstrap ya fue reclamado por otro UID. Verifica tu correo o inicia sesión con Google.';
      } else if (bootstrapError) {
        reason = `Falló la creación automática de /admins/${firebaseUser.uid}: ${bootstrapError}`;
      } else {
        reason = 'Faltan los documentos /admins/{uid} o /users/{uid} con rol "admin" activo en la base nombrada.';
      }
    }

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || null,
      emailMatchesOwner: ownerEmailMatches,
      emailVerified: Boolean(firebaseUser.emailVerified),
      hasAdminDoc: isAdminDoc,
      userRole: userAccount?.role || null,
      userStatus: userAccount?.status || null,
      bootstrapClaimed: Boolean(bootstrapMeta?.adminClaimed),
      bootstrapAdminUid: bootstrapMeta?.adminUid || null,
      bootstrapError,
      reason,
    };
  })();

  // Limpieza automática única y migración idempotente de posts al ingresar el administrador
  useEffect(() => {
    if (!authReady || !firebaseUser || !isAdmin || cleanupTriggeredRef.current) return;
    cleanupTriggeredRef.current = true;
    const adminName = userAccount?.displayName || firebaseUser.displayName || 'Administrador';
    runOneTimeAdminSampleCleanup(firebaseUser.uid, adminName).then(() => {
      runIdempotentPostsMigration(firebaseUser.uid, adminName).catch((err) =>
        console.warn('Aviso en migración automática de publicaciones:', err)
      );
    });
  }, [authReady, firebaseUser, isAdmin, userAccount?.displayName]);

  const loginWithEmail = async (email: string, password: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await loadUserDocs(cred.user);
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    }
  };

  const loginWithGoogle = async () => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const emailNormalized = (cred.user.email || '').trim().toLowerCase();
      if (emailNormalized !== ADMIN_OWNER_EMAIL) {
        const userSnap = await getDoc(doc(db, 'users', cred.user.uid));
        if (!userSnap.exists()) {
          const rawEmail = (cred.user.email || 'lector@alternativa.local').trim().slice(0, 200);
          const safeEmail = rawEmail.length >= 3 ? rawEmail : 'lector@alternativa.local';
          const rawName = (cred.user.displayName || 'Lector').trim().slice(0, 120);
          const safeName = rawName.length >= 2 ? rawName : 'Lector';
          await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            email: safeEmail,
            displayName: safeName,
            role: 'reader',
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      await loadUserDocs(cred.user);
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    }
  };

  const registerReader = async (name: string, email: string, password: string) => {
    const cleanName = name.trim().slice(0, 120);
    const cleanEmail = email.trim().slice(0, 200);
    if (cleanName.length < 2) {
      throw new Error('Ingresa un nombre de al menos 2 caracteres.');
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await updateProfile(cred.user, { displayName: cleanName });
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: cleanEmail,
        displayName: cleanName,
        role: 'reader',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      sendEmailVerification(cred.user).catch(() => undefined);
      await loadUserDocs(cred.user);
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    }
  };

  const registerCollaborator = async (
    params: RegisterCollaboratorInput
  ): Promise<{ status: 'active' | 'pending' }> => {
    const cleanOutletName = params.outletName.trim().slice(0, 120);
    const cleanEmail = params.email.trim().slice(0, 200);
    if (cleanOutletName.length < 2) {
      throw new Error('El nombre del medio o periodista debe tener al menos 2 caracteres.');
    }
    const adultAge = calculateAdultAgeFromBirthYear(params.birthYear);
    if (adultAge === null) {
      throw new Error('Debes ser mayor de 18 años e ingresar un año de nacimiento válido.');
    }

    const politicalChoice: PoliticalAffiliationChoice = params.politicalAffiliation || '';
    const cleanPartyName = (params.politicalPartyName || '').trim().slice(0, 140);
    const cleanPartyRole = (params.politicalPartyRole || '').trim().slice(0, 120);
    if (politicalChoice === 'yes') {
      if (!cleanPartyName) {
        throw new Error('Indica el nombre del partido o movimiento político.');
      }
      if (params.politicalConsentAccepted !== true) {
        throw new Error(
          'Debes aceptar el consentimiento expreso (Ley 1581 de 2012) para guardar tu afiliación política.'
        );
      }
    }

    const cleanCode = params.inviteCode.trim();
    if (!cleanCode) {
      throw new Error('Debes ingresar el código de invitación único.');
    }

    const inviteHash = await hashInviteCode(cleanCode);
    const tokenSnap = await getDoc(doc(db, 'invite_tokens', inviteHash));
    const tokenData = tokenSnap.data();
    if (!tokenSnap.exists() || tokenData?.active !== true) {
      throw new Error('El código de invitación es inválido o fue desactivado por la administración.');
    }
    if (tokenData?.expiresAt && toDate(tokenData.expiresAt).getTime() <= Date.now()) {
      throw new Error('El código de invitación ha expirado. Solicita uno nuevo a la administración.');
    }

    const cfgSnap = await getDoc(doc(db, 'site_config', 'main')).catch(() => null);
    const autoApprove = cfgSnap && cfgSnap.exists() ? Boolean(cfgSnap.data()?.autoApproveCollaborators) : false;
    const targetStatus: 'active' | 'pending' = autoApprove ? 'active' : 'pending';

    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
      await updateProfile(cred.user, { displayName: cleanOutletName });
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    }

    const uid = cred.user.uid;
    let uploadedPartyLogoUrl = '';
    if (politicalChoice === 'yes' && params.politicalPartyLogoFile) {
      try {
        const res = await uploadMediaAsset(params.politicalPartyLogoFile, `party_logos/${uid}`, undefined, 'party_logo');
        uploadedPartyLogoUrl = res.url.slice(0, 400000);
      } catch (uploadErr) {
        console.warn('No se pudo subir el logotipo político en el registro:', uploadErr);
      }
    }

    const cleanProfession = (params.profession || '').trim().slice(0, 120);
    const cleanJobTitle = (params.jobTitle || '').trim().slice(0, 120);
    const cleanOrganization = (params.organization || '').trim().slice(0, 140);
    const cleanCity = (params.city || '').trim().slice(0, 80);
    const cleanCountry = (params.country || '').trim().slice(0, 80);
    const consentIso = politicalChoice === 'yes' && params.politicalConsentAccepted ? new Date().toISOString() : '';

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), {
        uid,
        email: cleanEmail,
        displayName: cleanOutletName,
        role: 'collaborator',
        status: targetStatus,
        inviteHash,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Public collaborator profile: strict defaults — NO birthYear, NO consent logs, optional data hidden by default
      batch.set(doc(db, 'collaborators_public', uid), {
        uid,
        name: cleanOutletName,
        outletType: params.outletType,
        status: targetStatus,
        inviteHash,
        postCount: 0,
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Private collaborator draft & sensitive profile: only owner + admin can read
      const settingsPayload: Record<string, unknown> = {
        uid,
        name: cleanOutletName,
        outletType: params.outletType,
        birthYear: Number(params.birthYear),
        profession: cleanProfession,
        jobTitle: cleanJobTitle,
        organization: cleanOrganization,
        city: cleanCity,
        country: cleanCountry,
        politicalAffiliation: politicalChoice,
        politicalPartyName: politicalChoice === 'yes' ? cleanPartyName : '',
        politicalPartyRole: politicalChoice === 'yes' ? cleanPartyRole : '',
        politicalPartyLogoUrl: politicalChoice === 'yes' ? uploadedPartyLogoUrl : '',
        politicalConsentAccepted: politicalChoice === 'yes' ? true : false,
        politicalConsentAcceptedAt: consentIso,
        bio: '',
        avatarUrl: '',
        websiteUrl: '',
        socialTwitter: '',
        socialInstagram: '',
        socialYoutube: '',
        publicEmail: '',
        location: '',
        topics: [],
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
        updatedAt: serverTimestamp(),
      };
      batch.set(doc(db, 'collaborator_settings', uid), settingsPayload);
      await batch.commit();
      sendEmailVerification(cred.user).catch(() => undefined);
      await loadUserDocs(cred.user);
      return { status: targetStatus };
    } catch (err) {
      console.error('Error guardando perfil de colaborador:', err);
      throw new Error('No se pudo completar el registro del perfil en la base de datos. Intenta nuevamente.');
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    }
  };

  const sendCurrentUserVerificationEmail = async () => {
    if (!auth.currentUser) {
      throw new Error('Debes iniciar sesión primero.');
    }
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    }
  };

  const logout = async () => {
    clearCalendarAccessToken();
    await signOut(auth);
    setUserAccount(null);
    setCollaboratorProfile(null);
    setIsAdminDoc(false);
    setBootstrapMeta(null);
    setBootstrapError(null);
    setBookmarks([]);
  };

  const toggleBookmark = async (post: Post): Promise<boolean> => {
    if (!firebaseUser) {
      throw new Error('Inicia sesión para guardar artículos en tus favoritos.');
    }
    const refDoc = doc(db, 'users', firebaseUser.uid, 'bookmarks', post.id);
    const exists = bookmarks.some((b) => b.postId === post.id);
    try {
      if (exists) {
        await deleteDoc(refDoc);
        return false;
      } else {
        await setDoc(refDoc, {
          postId: post.id,
          title: post.title.slice(0, 220),
          slug: post.slug.slice(0, 240),
          coverImage: (post.coverImage || '').slice(0, 400000),
          categoryName: (post.categoryName || '').slice(0, 80),
          createdAt: serverTimestamp(),
        });
        return true;
      }
    } catch (err) {
      console.error('Error actualizando marcador:', err);
      throw new Error('No se pudo actualizar tu lista de artículos guardados.');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userAccount,
        collaboratorProfile,
        isAdmin,
        isCollaborator,
        isActiveCollaborator,
        authReady,
        bookmarks,
        adminDiagnostics,
        loginWithEmail,
        loginWithGoogle,
        registerReader,
        registerCollaborator,
        sendPasswordReset,
        sendCurrentUserVerificationEmail,
        logout,
        toggleBookmark,
        refreshUserDocs: () => loadUserDocs(auth.currentUser),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
