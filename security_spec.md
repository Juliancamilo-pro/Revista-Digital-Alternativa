# Especificación de Seguridad Firestore — Revista Digital Alternativa

## 1. Invariantes de Datos
1. **Aislamiento y expiración del código de invitación**: El código en texto plano (`/site_secrets/invite`) solo puede ser leído o escrito por `isAdmin()`. Los aspirantes a colaborador validan su código mediante `/invite_tokens/{sha256Hash}` que tiene `allow list: if false`, no contiene el código original y valida `!('expiresAt' in data) || data.expiresAt > request.time`.
2. **Protección del administrador único**: `/site_meta/bootstrap` y `/admins/{userId}` conservan al administrador único (`trujillogordillooo@gmail.com`) sin permitir sobrescritura ni segundo reclamo.
3. **Aislamiento de PII**: Los correos electrónicos de usuarios (`/users/{userId}`), suscriptores (`/newsletter_subscribers/{id}`) y denuncias (`/reports_and_rectifications/{id}`) solo son legibles por el propietario o por `isAdmin()`. Los perfiles públicos (`/collaborators_public/{userId}`) nunca almacenan correo electrónico.
4. **Propiedad estricta en publicaciones y transmisiones**: Un colaborador activo solo puede crear, editar o eliminar documentos donde `authorId == request.auth.uid` (o `hostId == request.auth.uid`), nunca los de otros autores, y no puede alterar campos de moderación global ni configuración del sitio.
5. **Auditoría administrativa inmutable**: `/admin_activity_logs/{logId}` solo puede ser creado y leído por `isAdmin()`, nunca editado ni borrado.
6. **Integridad temporal y límites de tamaño**: Todas las escrituras validan tipos, longitudes máximas (`size() <= max`) y marcas de tiempo del servidor (`request.time`) en campos `createdAt`/`updatedAt`.

## 2. "Dirty Dozen" Payloads (Vectores de Ataque Bloqueados)
1. **Shadow Field Injection en `/users/{uid}`**: Enviar `{ role: "admin", isSuperAdmin: true }` al registrarse -> `PERMISSION_DENIED`.
2. **Auto-promoción de rol en `/users/{uid}`**: Un colaborador intenta `update` cambiando `role: "admin"` o `status: "active"` cuando está `pending` -> `PERMISSION_DENIED`.
3. **Registro de colaborador sin token activo o vencido**: Crear `/users/{uid}` con `role: "collaborator"` usando un `inviteHash` inexistente, `active: false` o `expiresAt <= request.time` -> `PERMISSION_DENIED`.
4. **Lectura del código secreto de invitación**: Un usuario normal o colaborador intenta `get` o `list` sobre `/site_secrets/invite` -> `PERMISSION_DENIED`.
5. **Enumeración de tokens de invitación**: Intentar `list` sobre `/invite_tokens` -> `PERMISSION_DENIED`.
6. **Segundo reclamo de administrador**: Un usuario intenta sobrescribir `/site_meta/bootstrap` cuando ya existe -> `PERMISSION_DENIED`.
7. **Suplantación de autor en `/posts/{id}`**: Colaborador A intenta crear o editar un artículo con `authorId: "colaborador_B"` -> `PERMISSION_DENIED`.
8. **Salto de cola de revisión**: Colaborador intenta publicar (`status: "published"`) cuando `site_config/main.autoPublishCollaborators == false` -> `PERMISSION_DENIED`.
9. **Lectura masiva de PII de suscriptores**: Un colaborador o lector intenta `list` sobre `/newsletter_subscribers` -> `PERMISSION_DENIED`.
10. **Inyección de ID malicioso (Resource Poisoning)**: Crear documento con ID de 500 caracteres o caracteres inválidos `../admin` -> `PERMISSION_DENIED` (`isValidId()`).
11. **Manipulación de timestamps**: Enviar `createdAt` manipulado en el pasado/futuro en lugar de `serverTimestamp()` (`request.time`) -> `PERMISSION_DENIED`.
12. **Alteración del registro de auditoría**: Intentar modificar, borrar o falsificar `actorUid` en `/admin_activity_logs/{logId}` -> `PERMISSION_DENIED`.
