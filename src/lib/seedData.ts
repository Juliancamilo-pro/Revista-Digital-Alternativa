import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { logAdminActivity } from './activityLog';
import { db } from './firebase';
import { Category, HomepageSectionConfig, SiteConfig } from '../types/editorial';

export const DEFAULT_HOMEPAGE_SECTIONS: HomepageSectionConfig[] = [
  { id: 'sec_live', type: 'live', title: 'En vivo y agenda', enabled: true, order: 0 },
  { id: 'sec_hero', type: 'hero', title: 'Apertura principal', enabled: true, order: 1 },
  { id: 'sec_featured', type: 'featured', title: 'Notas destacadas', enabled: true, order: 2 },
  { id: 'sec_breaking', type: 'breaking', title: 'Última hora', enabled: true, order: 3 },
  { id: 'sec_most_read', type: 'most_read', title: 'Lo más leído', enabled: true, order: 4 },
  { id: 'sec_opinion', type: 'opinion', title: 'Opinión y columnas', enabled: true, order: 5 },
  { id: 'sec_series', type: 'series', title: 'Series y especiales', enabled: true, order: 6 },
  { id: 'sec_galleries', type: 'galleries', title: 'Fotografía documental', enabled: true, order: 7 },
  { id: 'sec_videos', type: 'videos', title: 'Video y crónicas', enabled: true, order: 8 },
  { id: 'sec_audio', type: 'audio', title: 'Audio y pódcast', enabled: true, order: 9 },
  { id: 'sec_feed', type: 'categories_feed', title: 'Todas las publicaciones', enabled: true, order: 10 },
];

export const DEFAULT_SITE_CONFIG: Omit<SiteConfig, 'updatedAt'> = {
  siteName: 'Revista Digital Alternativa',
  tagline: 'Periodismo independiente de izquierda, investigación y crónica sin filtros corporativos.',
  logoUrl: '',
  primaryColor: '#B91C1C',
  accentColor: '#991B1B',
  autoApproveCollaborators: false,
  autoPublishCollaborators: true,
  allowAnonymousComments: true,
  commentModerationMode: 'post',
  blockedWords: ['spam', 'publicidad', 'apuestas'],
  contactEmail: '',
  aboutText: '',
  howWeWorkText: '',
  sourcesPolicyText: '',
  correctionsPolicyText: '',
  termsText:
    'El acceso y lectura de los contenidos publicados en este medio digital es libre y gratuito. Queda permitida la reproducción parcial citando explícitamente la autoría, el medio colaborador y el enlace original.\n\nLos comentarios de lectores y las colaboraciones externas deben respetar la dignidad humana y abstenerse de discursos de odio o difamación infundada.',
  privacyText:
    'Respetamos la privacidad de nuestras lectoras y lectores. Las métricas de lectura se registran de forma agregada sin almacenar direcciones IP ni rastreadores publicitarios de terceros. Los correos registrados para el boletín o cuentas de lector se usan exclusivamente para los fines autorizados.',
  authorLiabilityNotice:
    'Aviso de responsabilidad editorial: Cada columna de opinión, investigación o pieza multimedia firmada por un medio colaborador o periodista independiente refleja el criterio y la responsabilidad de su autora o autor, garantizando la pluralidad crítica sin censura previa corporativa.',
  socialLinks: {},
  heroPostId: '',
  featuredPostIds: [],
  homepageSections: DEFAULT_HOMEPAGE_SECTIONS,
};

export const DEFAULT_CATEGORIES: Array<Omit<Category, 'createdAt' | 'updatedAt'>> = [
  { id: 'cat_politica', name: 'Política', slug: 'politica', description: 'Poder público, reformas y movilización social.', order: 1 },
  { id: 'cat_ddhh', name: 'Derechos Humanos', slug: 'derechos-humanos', description: 'Memoria, justicia y defensa de liderazgos sociales.', order: 2 },
  { id: 'cat_territorio', name: 'Territorio y Paz', slug: 'territorio-y-paz', description: 'Crónicas rurales, reforma agraria y acuerdos de paz.', order: 3 },
  { id: 'cat_economia', name: 'Economía y Trabajo', slug: 'economia-y-trabajo', description: 'Sindicatos, informalidad, salarios y bienes comunes.', order: 4 },
  { id: 'cat_ambiente', name: 'Medio Ambiente', slug: 'medio-ambiente', description: 'Transición energética, agua y conflictos socioambientales.', order: 5 },
  { id: 'cat_feminismos', name: 'Feminismos y Género', slug: 'feminismos-y-genero', description: 'Economía del cuidado, disidencias y luchas feministas.', order: 6 },
  { id: 'cat_cultura', name: 'Cultura', slug: 'cultura', description: 'Arte, cine, literatura y memorias populares.', order: 7 },
  { id: 'cat_internacional', name: 'Internacional', slug: 'internacional', description: 'América Latina, geopolítica y luchas globales.', order: 8 },
  { id: 'cat_opinion', name: 'Opinión', slug: 'opinion', description: 'Columnas, ensayos y debate programático.', order: 9 },
  { id: 'cat_investigacion', name: 'Investigación', slug: 'investigacion', description: 'Periodismo de datos, contratos y seguimiento de poder.', order: 10 },
  { id: 'cat_fotografia', name: 'Fotografía', slug: 'fotografia', description: 'Fotorreportajes y ensayos visuales documentales.', order: 11 },
  { id: 'cat_video', name: 'Video', slug: 'video', description: 'Documentales cortos, entrevistas y coberturas.', order: 12 },
  { id: 'cat_audio', name: 'Audio y Podcast', slug: 'audio-y-podcast', description: 'Pódcasts semanales y crónicas sonoras.', order: 13 },
  { id: 'cat_envivo', name: 'En Vivo', slug: 'en-vivo', description: 'Foros, asambleas y transmisiones especiales.', order: 14 },
];

const LEGACY_SAMPLE_POST_IDS = [
  'sample_post_plaza',
  'sample_post_territorio',
  'sample_post_trabajo',
  'sample_post_opinion',
  'sample_post_podcast',
];
const LEGACY_SAMPLE_STREAM_IDS = ['sample_stream_foro'];
const LEGACY_SAMPLE_SERIES_IDS = ['ser_venas_territorio', 'ser_trabajo_dignidad'];
const LEGACY_SOCIAL_DEFAULTS: Record<string, string> = {
  twitter: 'https://x.com',
  instagram: 'https://instagram.com',
  youtube: 'https://youtube.com',
  facebook: 'https://facebook.com',
  telegram: 'https://t.me',
};

let cleanupPromise: Promise<void> | null = null;

function buildCleanSiteConfigPayload(source: Partial<SiteConfig>): Record<string, unknown> {
  const rawName = (source.siteName || DEFAULT_SITE_CONFIG.siteName).trim().slice(0, 100);
  const safeName = rawName.length >= 2 ? rawName : DEFAULT_SITE_CONFIG.siteName;
  const rawColor = (source.primaryColor || DEFAULT_SITE_CONFIG.primaryColor).trim().slice(0, 20);
  const safeColor = rawColor.length >= 4 ? rawColor : DEFAULT_SITE_CONFIG.primaryColor;

  return {
    siteName: safeName,
    tagline: (source.tagline ?? DEFAULT_SITE_CONFIG.tagline).slice(0, 240),
    logoUrl: (source.logoUrl || '').slice(0, 400000),
    primaryColor: safeColor,
    accentColor: (source.accentColor || DEFAULT_SITE_CONFIG.accentColor).slice(0, 20),
    autoApproveCollaborators: Boolean(source.autoApproveCollaborators),
    autoPublishCollaborators:
      source.autoPublishCollaborators !== undefined ? Boolean(source.autoPublishCollaborators) : true,
    allowAnonymousComments:
      source.allowAnonymousComments !== undefined ? Boolean(source.allowAnonymousComments) : true,
    commentModerationMode: source.commentModerationMode === 'pre' ? 'pre' : 'post',
    blockedWords: Array.isArray(source.blockedWords) ? source.blockedWords.slice(0, 100) : DEFAULT_SITE_CONFIG.blockedWords,
    contactEmail: (source.contactEmail || '').slice(0, 200),
    aboutText: (source.aboutText || '').slice(0, 15000),
    howWeWorkText: (source.howWeWorkText || '').slice(0, 15000),
    sourcesPolicyText: (source.sourcesPolicyText || '').slice(0, 15000),
    correctionsPolicyText: (source.correctionsPolicyText || '').slice(0, 15000),
    termsText: (source.termsText ?? DEFAULT_SITE_CONFIG.termsText).slice(0, 15000),
    privacyText: (source.privacyText ?? DEFAULT_SITE_CONFIG.privacyText).slice(0, 15000),
    authorLiabilityNotice: (source.authorLiabilityNotice ?? DEFAULT_SITE_CONFIG.authorLiabilityNotice).slice(0, 3000),
    socialLinks: source.socialLinks && typeof source.socialLinks === 'object' ? source.socialLinks : {},
    heroPostId: (source.heroPostId || '').slice(0, 128),
    featuredPostIds: Array.isArray(source.featuredPostIds) ? source.featuredPostIds.slice(0, 12) : [],
    homepageSections:
      Array.isArray(source.homepageSections) && source.homepageSections.length > 0
        ? source.homepageSections.slice(0, 20)
        : DEFAULT_HOMEPAGE_SECTIONS,
    updatedAt: serverTimestamp(),
  };
}

/**
 * Limpieza segura y única cuando el administrador inicia sesión.
 * También garantiza que site_config/main y las categorías iniciales existan si la base de datos es nueva,
 * sin tocar cuenta admin, usuarios, colaboradores, código de invitación ni contenido real.
 */
export async function runOneTimeAdminSampleCleanup(adminUid: string, adminName: string): Promise<void> {
  if (!adminUid) return;
  if (cleanupPromise) return cleanupPromise;

  cleanupPromise = (async () => {
    try {
      const cleanupRef = doc(db, 'site_meta', 'cleanup');
      const [cleanupSnap, configSnap, catsSnap] = await Promise.all([
        getDoc(cleanupRef).catch(() => null),
        getDoc(doc(db, 'site_config', 'main')).catch(() => null),
        getDocs(collection(db, 'categories')).catch(() => null),
      ]);

      const cleanupAlreadyDone = Boolean(cleanupSnap?.exists() && cleanupSnap.data()?.done === true);

      // Si la base de datos es nueva y aún no existe site_config/main o categories, inicializarlos con valores limpios
      if (cleanupAlreadyDone) {
        if ((configSnap && !configSnap.exists()) || (catsSnap && catsSnap.empty)) {
          const initBatch = writeBatch(db);
          if (configSnap && !configSnap.exists()) {
            initBatch.set(doc(db, 'site_config', 'main'), buildCleanSiteConfigPayload(DEFAULT_SITE_CONFIG));
          }
          if (catsSnap && catsSnap.empty) {
            for (const cat of DEFAULT_CATEGORIES) {
              initBatch.set(doc(db, 'categories', cat.id), {
                ...cat,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          }
          await initBatch.commit();
        }
        return;
      }

      const [samplePostsQuery, sampleStreamsQuery] = await Promise.all([
        getDocs(query(collection(db, 'posts'), where('isSample', '==', true))).catch(() => null),
        getDocs(query(collection(db, 'livestreams'), where('isSample', '==', true))).catch(() => null),
      ]);

      const postIdsToDelete = new Set<string>();
      const streamIdsToDelete = new Set<string>();
      const seriesIdsToDelete = new Set<string>();

      if (samplePostsQuery) {
        samplePostsQuery.docs.forEach((d) => postIdsToDelete.add(d.id));
      }
      if (sampleStreamsQuery) {
        sampleStreamsQuery.docs.forEach((d) => streamIdsToDelete.add(d.id));
      }

      // Verificar explícitamente los IDs legados de muestra
      await Promise.all([
        ...LEGACY_SAMPLE_POST_IDS.map(async (id) => {
          const snap = await getDoc(doc(db, 'posts', id)).catch(() => null);
          if (snap?.exists()) postIdsToDelete.add(id);
        }),
        ...LEGACY_SAMPLE_STREAM_IDS.map(async (id) => {
          const snap = await getDoc(doc(db, 'livestreams', id)).catch(() => null);
          if (snap?.exists()) streamIdsToDelete.add(id);
        }),
        ...LEGACY_SAMPLE_SERIES_IDS.map(async (id) => {
          const snap = await getDoc(doc(db, 'series', id)).catch(() => null);
          if (snap?.exists()) seriesIdsToDelete.add(id);
        }),
      ]);

      const batch = writeBatch(db);
      let deletedCount = 0;

      postIdsToDelete.forEach((id) => {
        batch.delete(doc(db, 'posts', id));
        deletedCount += 1;
      });
      streamIdsToDelete.forEach((id) => {
        batch.delete(doc(db, 'livestreams', id));
        deletedCount += 1;
      });
      seriesIdsToDelete.forEach((id) => {
        batch.delete(doc(db, 'series', id));
        deletedCount += 1;
      });

      let configCleaned = false;
      if (configSnap && !configSnap.exists()) {
        batch.set(doc(db, 'site_config', 'main'), buildCleanSiteConfigPayload(DEFAULT_SITE_CONFIG));
      } else if (configSnap?.exists()) {
        const current = configSnap.data() as Partial<SiteConfig>;
        const patched: Partial<SiteConfig> = { ...current };

        if (current.contactEmail === 'redaccion@revistalternativa.org') {
          patched.contactEmail = '';
          configCleaned = true;
        }
        if (
          typeof current.aboutText === 'string' &&
          current.aboutText.startsWith('Revista Digital Alternativa es un medio independiente dedicado al periodismo de investigación')
        ) {
          patched.aboutText = '';
          configCleaned = true;
        }
        if (current.socialLinks && typeof current.socialLinks === 'object') {
          const cleanedSocials: Record<string, string> = {};
          for (const [key, val] of Object.entries(current.socialLinks)) {
            const normalizedVal = typeof val === 'string' ? val.trim().replace(/\/+$/, '') : '';
            if (typeof val === 'string' && val.trim() && LEGACY_SOCIAL_DEFAULTS[key] !== normalizedVal) {
              cleanedSocials[key] = val.trim();
            } else if (typeof val === 'string' && LEGACY_SOCIAL_DEFAULTS[key] === normalizedVal) {
              configCleaned = true;
            }
          }
          patched.socialLinks = cleanedSocials;
        }
        if (current.heroPostId && (postIdsToDelete.has(current.heroPostId) || LEGACY_SAMPLE_POST_IDS.includes(current.heroPostId))) {
          patched.heroPostId = '';
          configCleaned = true;
        }
        if (Array.isArray(current.featuredPostIds)) {
          const filteredFeatured = current.featuredPostIds.filter(
            (id) => !postIdsToDelete.has(id) && !LEGACY_SAMPLE_POST_IDS.includes(id)
          );
          if (filteredFeatured.length !== current.featuredPostIds.length) {
            patched.featuredPostIds = filteredFeatured;
            configCleaned = true;
          }
        }

        if (configCleaned) {
          batch.set(doc(db, 'site_config', 'main'), buildCleanSiteConfigPayload(patched));
        }
      }

      if (catsSnap && catsSnap.empty) {
        for (const cat of DEFAULT_CATEGORIES) {
          batch.set(doc(db, 'categories', cat.id), {
            ...cat,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      batch.set(cleanupRef, {
        done: true,
        cleanedBy: adminUid,
        deletedCount,
        cleanedAt: serverTimestamp(),
      });

      await batch.commit();

      if (deletedCount > 0 || configCleaned) {
        await logAdminActivity(
          adminUid,
          adminName,
          'Limpieza inicial automática',
          `Se eliminaron ${deletedCount} elementos de muestra y se limpiaron los campos ficticios de configuración.`
        );
      }
    } catch (err) {
      cleanupPromise = null;
      console.warn('Aviso en limpieza única de administrador:', err);
    }
  })();

  return cleanupPromise;
}
