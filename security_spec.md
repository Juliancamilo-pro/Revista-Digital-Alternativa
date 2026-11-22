# Especificación de Seguridad Firestore — Revista Digital Alternativa

## 1. Invariantes de Datos
1. **Aislamiento y expiración del código de invitación**: El código en texto plano (`/site_secrets/invite`) solo puede ser leído o escrito por `isAdmin()`. Los aspirantes a colaborador validan su código mediante `/invite_tokens/{sha256Hash}` que tiene `allow list: if false`, no contiene el código original y valida `!('expiresAt' in data) || data.expiresAt > request.time`.
2. **Protección del administrador único e identidades públicas**: `/site_meta/bootstrap` y `/admins/{userId}` conservan al administrador único (`trujillogordillooo@gmail.com`) sin permitir sobrescritura ni segundo reclamo. Las identidades editoriales públicas (`/admin_identities/owner` y `/admin_identities/magazine`) son legibles públicamente pero solo modificables por `isAdmin()`, sin exponer nunca el UID ni el correo privado del administrador.
3. **Aislamiento de PII y privacidad de colaboradores**: Los correos privados de usuarios (`/users/{userId}`), suscriptores (`/newsletter_subscribers/{id}`), denuncias (`/reports_and_rectifications/{id}`) y borradores/interruptores de privacidad (`/collaborator_settings/{userId}`) solo son legibles por el propietario o por `isAdmin()`. `/collaborators_public/{userId}` solo almacena campos habilitados explícitamente por el colaborador; los controles de directorio (`directoryHidden`, `directoryFeatured`, `directoryOrder`) solo pueden ser modificados por `isAdmin()`.
4. **Propiedad estricta en publicaciones y comentarios**: Un colaborador activo solo puede crear, editar o eliminar documentos donde `authorId == request.auth.uid`, nunca los de otros autores; no puede asignar `featured`, `breaking`, `authorIdentityType: 'owner' | 'magazine'` ni moderar comentarios ajenos o configuración global. Tampoco puede marcar `authorIsAdmin: true` en comentarios ni falsificar `authorVerified: true`.
5. **Auditoría administrativa inmutable**: `/admin_activity_logs/{logId}` solo puede ser creado y leído por `isAdmin()`, nunca editado ni borrado.
6. **Integridad temporal y límites de tamaño**: Todas las escrituras validan tipos, longitudes máximas (`size() <= max`) y marcas de tiempo del servidor (`request.time`) en campos `createdAt`/`updatedAt`.

## 2. Vectores de Ataque Bloqueados ("Dirty Dozen+")
1. **Shadow Field Injection en `/users/{uid}`**: Enviar `{ role: "admin", isSuperAdmin: true }` al registrarse -> `PERMISSION_DENIED`.
2. **Auto-promoción de rol en `/users/{uid}`**: Un colaborador intenta `update` cambiando `role: "admin"` o `status: "active"` cuando está `pending` -> `PERMISSION_DENIED`.
3. **Registro de colaborador sin token activo o vencido**: Crear `/users/{uid}` con `role: "collaborator"` usando un `inviteHash` inexistente, `active: false` o `expiresAt <= request.time` -> `PERMISSION_DENIED`.
4. **Lectura del código secreto de invitación**: Un usuario normal o colaborador intenta `get` o `list` sobre `/site_secrets/invite` -> `PERMISSION_DENIED`.
5. **Enumeración de tokens de invitación**: Intentar `list` sobre `/invite_tokens` -> `PERMISSION_DENIED`.
6. **Segundo reclamo de administrador**: Un usuario intenta sobrescribir `/site_meta/bootstrap` cuando ya existe -> `PERMISSION_DENIED`.
7. **Suplantación de autor o identidad del administrador en `/posts/{id}`**: Colaborador A intenta crear/editar con `authorId: "colaborador_B"`, `authorIdentityType: "owner"`, `authorIdentityType: "magazine"` o `authorProfileId != request.auth.uid` -> `PERMISSION_DENIED`.
8. **Salto de cola de revisión**: Colaborador intenta publicar (`status: "published"`) cuando `site_config/main.autoPublishCollaborators == false` -> `PERMISSION_DENIED`.
9. **Lectura masiva de PII**: Un colaborador o lector intenta `list` sobre `/newsletter_subscribers` o `/collaborator_settings` -> `PERMISSION_DENIED`.
10. **Inyección de ID malicioso (Resource Poisoning)**: Crear documento con ID de 500 caracteres o caracteres inválidos `../admin` -> `PERMISSION_DENIED` (`isValidId()`).
11. **Manipulación de timestamps**: Enviar `createdAt` manipulado en el pasado/futuro en lugar de `serverTimestamp()` (`request.time`) -> `PERMISSION_DENIED`.
12. **Alteración del registro de auditoría**: Intentar modificar, borrar o falsificar `actorUid` en `/admin_activity_logs/{logId}` -> `PERMISSION_DENIED`.
13. **Falsificación de insignia administrativa en comentarios**: Usuario no administrador intenta crear comentario con `authorIsAdmin: true` -> `PERMISSION_DENIED`.
14. **Escalada en directorio público**: Colaborador intenta alterar `directoryHidden`, `directoryFeatured` o `directoryOrder` en `/collaborators_public/{uid}` o editar `/admin_identities/{id}` -> `PERMISSION_DENIED`.
