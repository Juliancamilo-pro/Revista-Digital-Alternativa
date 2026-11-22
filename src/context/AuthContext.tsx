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
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  registerReader: (name: string, email: string, password: string) => Promise<void>;
  registerCollaborator: (params: RegisterCollaboratorInput) => Promise<{ status: 'active' | 'pending' }>;
  sendPasswordReset: (email: string) => Promise<void>;
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
  const [authReady, setAuthReady] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const cleanupTriggeredRef = useRef(false);

  const loadUserDocs = async (user: User | null) => {
    if (!user) {
      setUserAccount(null);
      setCollaboratorProfile(null);
      setIsAdminDoc(false);
      return;
    }
    try {
      const [adminSnap, userSnap, collabSnap] = await Promise.all([
        getDoc(doc(db, 'admins', user.uid)).catch(() => null),
        getDoc(doc(db, 'users', user.uid)).catch(() => null),
        getDoc(doc(db, 'collaborators_public', user.uid)).catch(() => null),
      ]);
      setIsAdminDoc(Boolean(adminSnap?.exists()));
      setUserAccount(userSnap && userSnap.exists() ? (userSnap.data() as UserAccount) : null);
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

  const isBootstrappedEmailAdmin =
    Boolean(firebaseUser?.email === 'trujillogordillooo@gmail.com' && firebaseUser?.emailVerified);
  const isAdmin = isAdminDoc || isBootstrappedEmailAdmin || userAccount?.role === 'admin';
  const isCollaborator = userAccount?.role === 'collaborator';
  const isActiveCollaborator = isCollaborator && userAccount?.status === 'active';

  // Limpieza automática única y segura al ingresar el administrador
  useEffect(() => {
    if (!authReady || !firebaseUser || !isAdmin || cleanupTriggeredRef.current) return;
    cleanupTriggeredRef.current = true;
    const adminName = userAccount?.displayName || firebaseUser.displayName || 'Administrador';
    runOneTimeAdminSampleCleanup(firebaseUser.uid, adminName);
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

  const logout = async () => {
    clearCalendarAccessToken();
    await signOut(auth);
    setUserAccount(null);
    setCollaboratorProfile(null);
    setIsAdminDoc(false);
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
        loginWithEmail,
        loginWithGoogle,
        registerReader,
        registerCollaborator,
        sendPasswordReset,
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
