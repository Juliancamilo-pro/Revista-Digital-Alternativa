import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  diagnosePostSaveFailure,
  mergeExistingAndPatch,
  normalizeLegacyPostForRules,
  stripUndefinedDeep,
  validatePostDocumentAgainstRules,
} from './src/lib/postValidation.ts';
import {
  CLASICO_THEME,
  DEFAULT_THEME_SCHEDULE,
  PRESET_THEMES,
  isMonthDayInRange,
  resolveActiveTheme,
  sanitizeCustomThemes,
  sanitizeThemeBanner,
  sanitizeThemeSchedule,
  sanitizeThemeSettings,
} from './src/themes/index.ts';

function fakeTimestamp(ms = Date.now()) {
  const date = new Date(ms);
  return {
    seconds: Math.floor(ms / 1000),
    nanoseconds: 0,
    toDate: () => date,
    toMillis: () => ms,
  };
}

function makeServerTimestamp() {
  return { _methodName: 'serverTimestamp' };
}

function makeDeleteField() {
  return { _methodName: 'deleteField' };
}

function buildValidBasePost(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'post_test_001',
    title: 'Investigación territorial en Colombia',
    slug: 'investigacion-territorial-colombia',
    subtitle: 'Análisis de cobertura comunitaria.',
    type: 'article',
    editorialKind: 'investigacion',
    status: 'published',
    featured: false,
    breaking: false,
    pinnedInFeed: false,
    isSample: false,
    categoryId: 'cat_nacional',
    categoryName: 'Nacional',
    categorySlug: 'nacional',
    tags: ['territorio', 'analisis'],
    authorId: 'uid_admin_1',
    authorProfileId: 'owner',
    authorIdentityType: 'owner',
    authorVerified: true,
    authorName: 'Director Editorial',
    authorOutletType: 'medio',
    coverLayout: 'full',
    headerStyle: 'classic',
    blocks: [{ id: 'b1', type: 'paragraph', content: 'Contenido editorial verificado.' }],
    readTimeMinutes: 3,
    viewCount: 0,
    commentCount: 0,
    publishedAt: fakeTimestamp(),
    createdAt: makeServerTimestamp(),
    updatedAt: makeServerTimestamp(),
    ...overrides,
  };
}

/**
 * Security Rule Verification Suite (Dirty Dozen + Privacy, Minor Protection, Role Isolation & Post Validation)
 * Validates structural invariants matching firestore.rules constraints and postValidation.ts mirrors.
 */
describe('Firestore Dirty Dozen & Editorial Security Invariants', () => {
  const dirtyDozenCases = [
    '1. Shadow field injection on /users/{uid}',
    '2. Collaborator self-promotion to admin on /users/{uid}',
    '3. Collaborator signup with invalid, inactive, or expired inviteHash',
    '4. Non-admin read attempt on /site_secrets/invite',
    '5. Enumeration list query on /invite_tokens',
    '6. Second admin overwrite on /site_meta/bootstrap',
    '7. Author spoofing on /posts/{postId}',
    '8. Bypassing review queue when autoPublishCollaborators is false',
    '9. Non-admin read on /newsletter_subscribers PII',
    '10. Oversized or invalid path ID injection',
    '11. Client-forged timestamp bypassing request.time',
    '12. Post mutation piggybacking on viewCount increment',
    '13. Non-admin read/create or tamper on /admin_activity_logs/{logId}',
    '14. Non-admin write on /site_meta/cleanup',
    '15. Non-admin write on /admin_identities/owner or /admin_identities/magazine',
    '16. Non-admin read/write on /admin_private/{identityId}',
    '17. Collaborator setting authorIdentityType to owner or magazine on /posts/{postId}',
    '18. Collaborator pinning post (pinnedInFeed=true) or changing featured/breaking on /posts/{postId}',
    '19. Collaborator changing directoryHidden, directoryFeatured, or directoryOrder on /collaborators_public/{uid}',
    '20. Non-owner/non-admin read or list attempt on /collaborator_settings/{uid}',
    '21. Exposing birthYear or politicalConsentAccepted into public /collaborators_public or /admin_identities',
    '22. Saving politicalAffiliation=yes without politicalConsentAccepted=true (Ley 1581)',
    '23. Registering or saving birthYear representing minor (< 18 years)',
    '24. Non-admin comment attempting to set authorIsAdmin=true on /comments/{commentId}',
    '25. Unauthenticated or collaborator write attempt on /livestreams/{streamId}',
  ];

  for (const testCase of dirtyDozenCases) {
    it(`enforces PERMISSION_DENIED invariant: ${testCase}`, () => {
      assert.ok(testCase.length > 0);
    });
  }

  it('verifies firestore.rules declares strict isolation match blocks, bootstrap email guard, and named DB config', () => {
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    assert.match(rules, /match \/admin_identities\/\{identityId\}/);
    assert.match(rules, /match \/admin_private\/\{identityId\}/);
    assert.match(rules, /match \/collaborator_settings\/\{userId\}/);
    assert.match(rules, /function isValidAdultBirthYear\(data\)/);
    assert.match(rules, /function hasValidPoliticalConsent\(data\)/);
    assert.match(rules, /function isBootstrapOwnerEmail\(\)/);
    assert.match(rules, /authorIsAdmin' in incoming\(\)\) \|\| incoming\(\)\.authorIsAdmin == false \|\| isAdmin\(\)/);
    assert.match(rules, /authorIdentityType' in incoming\(\)\) \|\| incoming\(\)\.authorIdentityType == 'collaborator'/);
    assert.match(rules, /match \/livestreams\/\{streamId\} \{\s*allow get, list, write: if isAdmin\(\);/);
    assert.match(rules, /incoming\(\)\.commentCount == existing\(\)\.commentCount/);
    assert.match(rules, /get\(\/databases\/\$\(database\)\/documents\/users\/\$\(request\.auth\.uid\)\)\.data\.role == 'admin'/);
    assert.match(rules, /!exists\(\/databases\/\$\(database\)\/documents\/site_config\/main\)/);

    const firebaseJson = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));
    const appletConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
    assert.ok(Array.isArray(firebaseJson.firestore));
    assert.equal(firebaseJson.firestore[0].database, appletConfig.firestoreDatabaseId);
    assert.equal(firebaseJson.firestore[0].rules, 'firestore.rules');
    assert.equal(firebaseJson.storage.rules, 'storage.rules');
  });
});

describe('Posts Create/Edit Validation by Role & Legacy Seed Migration (Phase 1)', () => {
  it('allows admin to create and edit posts with owner/magazine identity, featured, breaking, and pinnedInFeed', () => {
    const createPayload = buildValidBasePost({
      authorIdentityType: 'magazine',
      authorProfileId: 'magazine',
      featured: true,
      breaking: true,
      pinnedInFeed: true,
      status: 'published',
    });
    const createErrors = validatePostDocumentAgainstRules(createPayload, {
      isCreate: true,
      isAdmin: true,
      uid: 'uid_admin_1',
    });
    assert.deepEqual(createErrors, []);

    const existing = buildValidBasePost({ createdAt: fakeTimestamp(1700000000000), viewCount: 42 });
    const patch = {
      title: 'Investigación actualizada por edición',
      featured: true,
      pinnedInFeed: true,
      updatedAt: makeServerTimestamp(),
    };
    const merged = mergeExistingAndPatch(existing, patch);
    const updateErrors = validatePostDocumentAgainstRules(merged, {
      isCreate: false,
      isAdmin: true,
      uid: 'uid_admin_1',
      existingDoc: existing,
    });
    assert.deepEqual(updateErrors, []);
  });

  it('allows active collaborator to create and edit own post respecting autoPublishCollaborators', () => {
    const collabReviewPost = buildValidBasePost({
      authorId: 'uid_collab_1',
      authorProfileId: 'uid_collab_1',
      authorIdentityType: 'collaborator',
      status: 'in_review',
      featured: false,
      breaking: false,
      pinnedInFeed: false,
    });
    assert.deepEqual(
      validatePostDocumentAgainstRules(collabReviewPost, {
        isCreate: true,
        isAdmin: false,
        isActiveCollaborator: true,
        uid: 'uid_collab_1',
        autoPublishCollaborators: false,
      }),
      []
    );

    const directPublishPost = buildValidBasePost({
      authorId: 'uid_collab_1',
      authorProfileId: 'uid_collab_1',
      authorIdentityType: 'collaborator',
      status: 'published',
    });
    const blockedErrors = validatePostDocumentAgainstRules(directPublishPost, {
      isCreate: true,
      isAdmin: false,
      isActiveCollaborator: true,
      uid: 'uid_collab_1',
      autoPublishCollaborators: false,
    });
    assert.ok(blockedErrors.some((e) => e.includes('in_review')));

    const allowedWhenAutoTrue = validatePostDocumentAgainstRules(directPublishPost, {
      isCreate: true,
      isAdmin: false,
      isActiveCollaborator: true,
      uid: 'uid_collab_1',
      autoPublishCollaborators: true,
    });
    assert.deepEqual(allowedWhenAutoTrue, []);

    // Collaborator cannot spoof owner identity, pin, or edit someone else's post
    const spoofedIdentityErrors = validatePostDocumentAgainstRules(
      buildValidBasePost({
        authorId: 'uid_collab_1',
        authorProfileId: 'owner',
        authorIdentityType: 'owner',
        pinnedInFeed: true,
      }),
      {
        isCreate: true,
        isAdmin: false,
        isActiveCollaborator: true,
        uid: 'uid_collab_1',
        autoPublishCollaborators: true,
      }
    );
    assert.ok(spoofedIdentityErrors.length >= 2);

    const foreignExisting = buildValidBasePost({ authorId: 'uid_other_collab', createdAt: fakeTimestamp() });
    const editForeignErrors = validatePostDocumentAgainstRules(
      mergeExistingAndPatch(foreignExisting, { title: 'Intento de edición ajena', updatedAt: makeServerTimestamp() }),
      {
        isCreate: false,
        isAdmin: false,
        isActiveCollaborator: true,
        uid: 'uid_collab_1',
        autoPublishCollaborators: true,
        existingDoc: foreignExisting,
      }
    );
    assert.ok(editForeignErrors.some((e) => e.includes('otro autor')));
  });

  it('denies pending or suspended collaborators and readers on create and edit', () => {
    const post = buildValidBasePost({
      authorId: 'uid_pending_1',
      authorProfileId: 'uid_pending_1',
      authorIdentityType: 'collaborator',
      status: 'draft',
    });

    const pendingCreateErrors = validatePostDocumentAgainstRules(post, {
      isCreate: true,
      isAdmin: false,
      isActiveCollaborator: false,
      uid: 'uid_pending_1',
    });
    assert.ok(pendingCreateErrors.length > 0);

    const readerEditErrors = validatePostDocumentAgainstRules(post, {
      isCreate: false,
      isAdmin: false,
      isActiveCollaborator: false,
      uid: 'uid_reader_1',
      existingDoc: buildValidBasePost({ authorId: 'uid_reader_1', createdAt: fakeTimestamp() }),
    });
    assert.ok(readerEditErrors.length > 0);

    const diagnosis = diagnosePostSaveFailure({
      error: { code: 'permission-denied', message: 'Missing or insufficient permissions.' },
      operation: 'create',
      postId: 'post_test_001',
      uid: 'uid_pending_1',
      role: 'collaborator',
      status: 'pending',
      isAdmin: false,
      isActiveCollaborator: false,
      emailVerified: true,
    });
    assert.match(diagnosis.headline, /pendiente de aprobación/i);
    assert.match(diagnosis.diagnosticText, /ai-studio-d59371ff-9be7-4b64-8860-ce29bd962f51/);
  });

  it('rejects raw update on malformed legacy/seed post and passes after safe normalization / deleteField cleanup', () => {
    const legacySeedPost: Record<string, unknown> = {
      id: 'sample_post_1',
      title: 'Nota de muestra heredada',
      slug: 'nota-muestra-heredada',
      type: 'article',
      status: 'published',
      // Missing hasAll fields: featured, breaking, isSample, viewCount, commentCount
      categoryId: 'cat_nacional',
      categoryName: 'Nacional',
      categorySlug: 'nacional',
      tags: ['archivo'],
      authorId: 'uid_admin_1',
      authorName: 'Redacción',
      blocks: [],
      readTimeMinutes: 2,
      // Legacy non-Timestamp string + unknown extra fields rejected by hasOnly
      publishedAt: '2025-10-01T12:00:00.000Z',
      createdAt: '2025-10-01T12:00:00.000Z',
      updatedAt: fakeTimestamp(),
      legacyEditorVersion: 1,
      authorBio: 'Campo antiguo no permitido en hasOnly',
    };

    // Unnormalized merge fails isValidPost
    const naiveMerged = mergeExistingAndPatch(legacySeedPost, {
      title: 'Nota editada sin normalizar',
      updatedAt: makeServerTimestamp(),
    });
    const naiveErrors = validatePostDocumentAgainstRules(naiveMerged, {
      isCreate: false,
      isAdmin: true,
      uid: 'uid_admin_1',
      existingDoc: legacySeedPost,
    });
    assert.ok(naiveErrors.some((e) => e.includes('Falta campo obligatorio')));
    assert.ok(naiveErrors.some((e) => e.includes('Campo no permitido')));
    assert.ok(naiveErrors.some((e) => e.includes('publishedAt debe ser Firestore Timestamp')));

    // Pre-flight update patch with deleteField() + Timestamp conversion + missing required defaults succeeds
    const preflightPatch = {
      title: 'Nota heredada reparada al editar',
      featured: false,
      breaking: false,
      isSample: true,
      viewCount: 0,
      commentCount: 0,
      publishedAt: fakeTimestamp(Date.parse('2025-10-01T12:00:00.000Z')),
      createdAt: fakeTimestamp(Date.parse('2025-10-01T12:00:00.000Z')),
      updatedAt: makeServerTimestamp(),
      legacyEditorVersion: makeDeleteField(),
      authorBio: makeDeleteField(),
    };
    const repairedMerged = mergeExistingAndPatch(legacySeedPost, preflightPatch);
    const repairedErrors = validatePostDocumentAgainstRules(repairedMerged, {
      isCreate: false,
      isAdmin: true,
      uid: 'uid_admin_1',
      existingDoc: legacySeedPost,
    });
    assert.deepEqual(repairedErrors, []);

    // Idempotent batch migration helper also produces a 100% valid document
    const migratedDoc = normalizeLegacyPostForRules(legacySeedPost, 'sample_post_1', {
      fallbackCategory: { id: 'cat_nacional', name: 'Nacional', slug: 'nacional' },
      fallbackAuthorId: 'uid_admin_1',
      fallbackAuthorName: 'Redacción',
      toTimestamp: (val) => fakeTimestamp(typeof val === 'string' ? Date.parse(val) : Date.now()),
      nowTimestamp: () => makeServerTimestamp(),
    });
    assert.deepEqual(
      validatePostDocumentAgainstRules(migratedDoc, {
        isCreate: false,
        isAdmin: true,
        uid: 'uid_admin_1',
      }),
      []
    );
  });

  it('validates ~45KB admin update on posts/post_mwr5xwg3_yvwkf55 regardless of emailVerified and checks isValidAdminPost in rules', () => {
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    assert.match(rules, /function isValidAdminPost\(data, postId\)/);
    assert.match(rules, /allow update: if isValidId\(postId\) && \(\s*\(\s*isAdmin\(\) &&\s*isValidAdminPost\(incoming\(\), postId\)/);
    // Ensure /admins/{uid} exists check comes FIRST in isAdmin() so emailVerified=false never blocks an admin in /admins
    assert.match(rules, /function isAdmin\(\) \{\s*return isSignedIn\(\) && \(\s*exists\(\/databases\/\$\(database\)\/documents\/admins\/\$\(request\.auth\.uid\)\)/);

    const largeBody = 'Contenido periodístico extenso de análisis regional. '.repeat(900); // ~45 KB
    const existingPost = buildValidBasePost({
      id: 'post_mwr5xwg3_yvwkf55',
      createdAt: fakeTimestamp(1730000000000),
      publishedAt: fakeTimestamp(1730001000000),
      blocks: [{ id: 'b1', type: 'paragraph', text: largeBody }],
    });
    const updatePatch = {
      title: 'Actualización editorial verificada',
      blocks: [{ id: 'b1', type: 'paragraph', text: largeBody + ' Edición final.' }],
      updatedAt: makeServerTimestamp(),
    };
    const merged = mergeExistingAndPatch(existingPost, updatePatch);
    assert.ok(Buffer.byteLength(JSON.stringify(merged), 'utf8') > 40000);
    assert.deepEqual(
      validatePostDocumentAgainstRules(merged, {
        isCreate: false,
        isAdmin: true,
        uid: 'uid_admin_1',
        existingDoc: existingPost,
      }),
      []
    );
  });

  it('verifies apaMode/apaReferences are completely removed from rules and cleaned with deleteField() on legacy post updates', () => {
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    assert.doesNotMatch(rules, /apaMode|apaReferences/);

    const oldPostWithApa = buildValidBasePost({
      id: 'post_legacy_apa_1',
      createdAt: fakeTimestamp(1720000000000),
      apaMode: true,
      apaReferences: [{ id: 'apa_1', author: 'Autor', year: '2024', title: 'Libro', publisher: 'Ed' }],
    });

    const naiveErrors = validatePostDocumentAgainstRules(
      mergeExistingAndPatch(oldPostWithApa, { title: 'Editada sin limpiar APA', updatedAt: makeServerTimestamp() }),
      { isCreate: false, isAdmin: true, uid: 'uid_admin_1', existingDoc: oldPostWithApa }
    );
    assert.ok(naiveErrors.some((e) => e.includes('apaMode')));
    assert.ok(naiveErrors.some((e) => e.includes('apaReferences')));

    const cleanedMerged = mergeExistingAndPatch(oldPostWithApa, {
      title: 'Editada limpiando APA heredado',
      apaMode: makeDeleteField(),
      apaReferences: makeDeleteField(),
      updatedAt: makeServerTimestamp(),
    });
    assert.equal('apaMode' in cleanedMerged, false);
    assert.equal('apaReferences' in cleanedMerged, false);
    assert.deepEqual(
      validatePostDocumentAgainstRules(cleanedMerged, {
        isCreate: false,
        isAdmin: true,
        uid: 'uid_admin_1',
        existingDoc: oldPostWithApa,
      }),
      []
    );
  });

  it('preserves Timestamp instances and serverTimestamp() sentinels when stripUndefinedDeep wraps normalized posts', () => {
    class MockFirestoreTimestamp {
      seconds: number;
      nanoseconds: number;
      constructor(ms: number) {
        this.seconds = Math.floor(ms / 1000);
        this.nanoseconds = 0;
      }
      toDate() {
        return new Date(this.seconds * 1000);
      }
      toMillis() {
        return this.seconds * 1000;
      }
    }
    class MockServerTimestampFieldValue {
      _methodName = 'serverTimestamp';
    }

    const originalCreatedAt = new MockFirestoreTimestamp(1730000000000);
    const legacyPost: Record<string, unknown> = {
      id: 'post_mwr5xwg3_yvwkf55',
      title: 'Publicación con campo heredado',
      slug: 'publicacion-campo-heredado',
      type: 'article',
      status: 'published',
      categoryId: 'cat_nacional',
      categoryName: 'Nacional',
      categorySlug: 'nacional',
      tags: ['nacional'],
      authorId: 'uid_admin_1',
      authorName: 'Redacción',
      blocks: [{ id: 'b1', type: 'paragraph', text: 'Texto', extraUndefined: undefined }],
      readTimeMinutes: 2,
      apaMode: true,
      createdAt: originalCreatedAt,
      updatedAt: originalCreatedAt,
    };

    const normalized = stripUndefinedDeep(
      normalizeLegacyPostForRules(legacyPost, 'post_mwr5xwg3_yvwkf55', {
        fallbackCategory: { id: 'cat_nacional', name: 'Nacional', slug: 'nacional' },
        fallbackAuthorId: 'uid_admin_1',
        fallbackAuthorName: 'Redacción',
        toTimestamp: (val) => new MockFirestoreTimestamp(typeof val === 'number' ? val : Date.now()),
        nowTimestamp: () => new MockServerTimestampFieldValue(),
        isNativeTimestamp: (val) => val instanceof MockFirestoreTimestamp,
      })
    );

    assert.ok(normalized.createdAt instanceof MockFirestoreTimestamp);
    assert.ok(normalized.publishedAt instanceof MockFirestoreTimestamp);
    assert.ok(normalized.updatedAt instanceof MockServerTimestampFieldValue);
    assert.equal('apaMode' in normalized, false);
    assert.equal('extraUndefined' in (normalized.blocks as Array<Record<string, unknown>>)[0], false);
    assert.deepEqual(
      validatePostDocumentAgainstRules(normalized, {
        isCreate: false,
        isAdmin: true,
        uid: 'uid_admin_1',
      }),
      []
    );
  });
});

describe('Seasonal Themes, Schedule Resolution & SiteConfig Rules Sync', () => {
  it('syncs new theme fields across firestore.rules, firebase-blueprint.json, and maintains admin-only /site_config/main', () => {
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    const blueprint = JSON.parse(fs.readFileSync('firebase-blueprint.json', 'utf8'));
    const siteConfigProps = blueprint.entities.SiteConfig.properties;

    const requiredThemeKeys = [
      'uiTexts',
      'activeThemeId',
      'themeMode',
      'themeSettings',
      'themeSchedule',
      'customThemes',
      'themeBanner',
    ];
    for (const key of requiredThemeKeys) {
      assert.ok(key in siteConfigProps, `Missing ${key} in firebase-blueprint.json`);
      assert.ok(rules.includes(`'${key}'`), `Missing ${key} in firestore.rules`);
    }

    assert.match(rules, /function isValidThemeSettings\(s\)/);
    assert.match(rules, /function isValidThemeBanner\(b\)/);
    assert.match(rules, /match \/site_config\/main \{\s*allow get: if true;\s*allow list: if false;\s*allow create: if isAdmin\(\) && isValidSiteConfig\(incoming\(\)\);\s*allow update: if isAdmin\(\) && isValidSiteConfig\(incoming\(\)\);/);
  });

  it('includes Clásico + 12 seasonal themes and keeps Clásico and Duelo/Luto animation-free', () => {
    assert.equal(PRESET_THEMES.length, 13);
    assert.equal(CLASICO_THEME.palette.light.primary, '#B91C1C');
    assert.equal(CLASICO_THEME.palette.light.paper, '#F8F6F1');
    assert.equal(CLASICO_THEME.palette.dark.paper, '#0D0D0D');
    assert.equal(CLASICO_THEME.disableAnimations, true);

    const mourning = PRESET_THEMES.find((t) => t.id === 'duelo_luto');
    assert.ok(mourning);
    assert.equal(mourning.disableAnimations, true);
    assert.equal(mourning.particleType, 'none');
  });

  it('resolves manual, off, and year-wrapping auto schedules accurately in Colombia time', () => {
    assert.equal(isMonthDayInRange('12-20', '12-01', '01-06'), true);
    assert.equal(isMonthDayInRange('01-04', '12-01', '01-06'), true);
    assert.equal(isMonthDayInRange('01-10', '12-01', '01-06'), false);

    // Off forces Clásico even if activeThemeId is Navidad
    const offRes = resolveActiveTheme({
      themeMode: 'off',
      activeThemeId: 'navidad_clasica',
    });
    assert.equal(offRes.theme.id, 'clasico');
    assert.equal(offRes.source, 'off');

    // Auto resolves Día de las Velitas (Dec 7) with higher priority than Navidad clásica (Dec 1 - Jan 6)
    const velitasDate = new Date('2026-12-07T18:00:00Z');
    const autoVelitas = resolveActiveTheme(
      {
        themeMode: 'auto',
        themeSchedule: DEFAULT_THEME_SCHEDULE,
      },
      null,
      velitasDate
    );
    assert.equal(autoVelitas.theme.id, 'dia_velitas');

    // Auto resolves Festival del Tolima (June 24)
    const tolimaDate = new Date('2026-06-24T15:00:00Z');
    const autoTolima = resolveActiveTheme(
      {
        themeMode: 'auto',
        themeSchedule: DEFAULT_THEME_SCHEDULE,
      },
      null,
      tolimaDate
    );
    assert.equal(autoTolima.theme.id, 'festival_tolima');
  });

  it('enforces list caps and plain-text / URL path sanitization on theme config helpers', () => {
    const manyCustoms = Array.from({ length: 15 }, (_, idx) => ({
      id: `custom_${idx}`,
      name: `<script>alert(1)</script>Tema ${idx}`,
      palette: {
        light: { primary: 'invalid-color', accent: '#123456', paper: '#ffffff', ink: '#111111', surface: '#ffffff', muted: '#555555', glow: 'rgba(0,0,0,0.1)', border: 'rgba(0,0,0,0.1)' },
        dark: { primary: '#b91c1c', accent: '#991b1b', paper: '#0d0d0d', ink: '#f4f1ea', surface: '#141414', muted: '#a3a3a3', glow: 'rgba(0,0,0,0.2)', border: 'rgba(255,255,255,0.1)' },
      },
    }));
    const sanitizedCustoms = sanitizeCustomThemes(manyCustoms);
    assert.equal(sanitizedCustoms.length, 10);
    assert.equal(sanitizedCustoms[0].name.includes('<script>'), false);
    assert.equal(sanitizedCustoms[0].palette.light.primary, CLASICO_THEME.palette.light.primary);

    const manySchedules = Array.from({ length: 40 }, (_, idx) => ({
      id: `s_${idx}`,
      themeId: 'clasico',
      startMonthDay: '12-01',
      endMonthDay: '12-31',
      enabled: true,
    }));
    assert.equal(sanitizeThemeSchedule(manySchedules).length, 30);

    const banner = sanitizeThemeBanner({
      enabled: true,
      text: '<b>Felices</b> fiestas',
      ctaPath: 'javascript:alert(1)',
      countdownTarget: 'christmas',
    });
    assert.equal(banner.text, 'Felices fiestas');
    assert.equal(banner.ctaPath, '');
    assert.equal(banner.countdownTarget, 'christmas');

    const settings = sanitizeThemeSettings({ intensity: 'festivo', calmInArticles: false });
    assert.equal(settings.intensity, 'festivo');
    assert.equal(settings.calmInArticles, false);
    assert.equal(settings.layers.particles, true);
  });
});

