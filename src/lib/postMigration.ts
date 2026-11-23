import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { logAdminActivity } from './activityLog';
import { db } from './firebase';
import {
  normalizeLegacyPostForRules,
  validatePostDocumentAgainstRules,
} from './postValidation';
import { DEFAULT_CATEGORIES } from './seedData';
import { stripUndefinedDeep, toDate } from './utils';

export interface PostMigrationReport {
  checkedCount: number;
  migratedCount: number;
  skippedCount: number;
  failedIds: string[];
}

let autoMigrationRanForUid: string | null = null;
let migrationInFlight: Promise<PostMigrationReport> | null = null;

/**
 * Migración idempotente de publicaciones heredadas o de muestra.
 * Solo reescribe documentos que no cumplen 100% con isValidPost() en firestore.rules
 * (faltan campos hasAll, sobran campos heredados fuera de hasOnly o tienen fechas no Timestamp).
 */
export async function runIdempotentPostsMigration(
  adminUid: string,
  adminName: string,
  options?: { force?: boolean; fallbackCategory?: { id: string; name: string; slug: string } }
): Promise<PostMigrationReport> {
  if (!adminUid) {
    return { checkedCount: 0, migratedCount: 0, skippedCount: 0, failedIds: [] };
  }
  if (migrationInFlight) {
    return migrationInFlight;
  }
  if (!options?.force && autoMigrationRanForUid === adminUid) {
    return { checkedCount: 0, migratedCount: 0, skippedCount: 0, failedIds: [] };
  }
  autoMigrationRanForUid = adminUid;

  const fallbackCat = options?.fallbackCategory || {
    id: DEFAULT_CATEGORIES[0].id,
    name: DEFAULT_CATEGORIES[0].name,
    slug: DEFAULT_CATEGORIES[0].slug,
  };

  const task = (async (): Promise<PostMigrationReport> => {
    const snap = await getDocs(collection(db, 'posts'));
    let migratedCount = 0;
    let skippedCount = 0;
    const failedIds: string[] = [];

    for (const postDoc of snap.docs) {
      const raw = postDoc.data() as Record<string, unknown>;
      const issues = validatePostDocumentAgainstRules(raw);
      const hasNonTimestampPublishedAt =
        'publishedAt' in raw &&
        raw.publishedAt !== undefined &&
        !(raw.publishedAt instanceof Timestamp);
      const hasNonTimestampScheduledFor =
        'scheduledFor' in raw &&
        raw.scheduledFor !== undefined &&
        !(raw.scheduledFor instanceof Timestamp);
      const hasNonTimestampCreatedAt = !(raw.createdAt instanceof Timestamp);

      if (
        issues.length === 0 &&
        !hasNonTimestampPublishedAt &&
        !hasNonTimestampScheduledFor &&
        !hasNonTimestampCreatedAt
      ) {
        skippedCount += 1;
        continue;
      }

      const normalized = stripUndefinedDeep(
        normalizeLegacyPostForRules(raw, postDoc.id, {
          fallbackCategory: fallbackCat,
          fallbackAuthorId: adminUid,
          fallbackAuthorName: adminName || 'Redacción',
          toTimestamp: (val) => Timestamp.fromDate(toDate(val)),
          nowTimestamp: () => serverTimestamp(),
          isNativeTimestamp: (val) => val instanceof Timestamp,
        })
      );

      try {
        await setDoc(doc(db, 'posts', postDoc.id), normalized);
        migratedCount += 1;
      } catch (err) {
        failedIds.push(postDoc.id);
        if (options?.force) {
          console.warn(`No se pudo normalizar publicación ${postDoc.id}:`, err);
        }
      }
    }

    if (migratedCount > 0) {
      await logAdminActivity(
        adminUid,
        adminName || 'Administrador',
        'Migración de publicaciones',
        `Se normalizaron ${migratedCount} publicaciones heredadas (${skippedCount} ya conformes).`
      );
    }

    return {
      checkedCount: snap.size,
      migratedCount,
      skippedCount,
      failedIds,
    };
  })();

  migrationInFlight = task;
  try {
    return await task;
  } finally {
    migrationInFlight = null;
  }
}
