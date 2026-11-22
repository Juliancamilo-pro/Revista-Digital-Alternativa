# Instrucciones de Configuración — Revista Digital Alternativa

Este proyecto utiliza **Firebase (Authentication, Firestore y Storage)** con reglas de seguridad estrictas por rol, perfiles públicos independientes, bitácora de actividad administrativa, modo ahorro de datos e integración de **Google Calendar**.

---

## ⚠️ Paso Obligatorio Tras Esta Actualización: Publicar Reglas en Firebase Console

Cada vez que se agregan nuevas colecciones, campos de publicación o controles de privacidad, **debes publicar las reglas actualizadas en Firebase Console**:

1. Entra a [Firebase Console](https://console.firebase.google.com/) y abre tu proyecto (`pro-pod-1bcxw`).
2. Ve a **Firestore Database → Reglas (Rules)**.
3. Copia todo el contenido del archivo `firestore.rules` del repositorio y pégalo en el editor de la consola, luego pulsa **Publicar (Publish)**.
4. Ve también a **Storage → Reglas (Rules)** y actualiza las reglas de almacenamiento con la versión segura de la sección 6 de este documento, luego pulsa **Publicar**.

---

## 1. Configuración de Firebase Authentication
El archivo `firebase-applet-config.json` ya contiene las credenciales públicas del proyecto provisionado. Para que funcionen todos los flujos de inicio de sesión y recuperación de contraseña:

1. En Firebase Console, ve a **Authentication → Sign-in method**.
2. Activa los proveedores necesarios:
   - **Google** (para lectores y conexión opcional con Google Calendar).
   - **Correo electrónico/contraseña** (requerido para administración, registro de colaboradores con código de invitación y recuperación de contraseña).
3. En **Authentication → Settings → Authorized domains**, verifica que tu dominio esté autorizado.

---

## 2. Cuenta de Administrador e Identidades Públicas
1. Tu cuenta de administrador ya se encuentra protegida en `/admins/{uid}` y `/site_meta/bootstrap`.
2. Desde **Panel de Administración → Perfiles del administrador**, puedes configurar dos identidades editoriales públicas sin exponer jamás tu UID ni tu correo privado:
   - **Perfil personal (Fundador/a / Dirección)** (`/admin_identities/owner`): para firmar columnas, investigaciones y aparecer con la insignia dorada de verificación.
   - **Perfil institucional de la revista** (`/admin_identities/magazine`): para publicar editoriales, comunicados o informes colectivos bajo el nombre oficial del medio.
3. En el editor de artículos, el administrador cuenta con el selector **«Publicar como»** para elegir cuál de las dos identidades firma cada nota.
4. La insignia dorada circular con la **«R»** aparece automáticamente en el administrador y en los colaboradores con estado **Activo**. Si un colaborador es suspendido, la insignia desaparece de inmediato en todo el sitio.

---

## 3. Directorio de Colaboradores y Privacidad
1. Existe una sección pública en `/colaboradores` («Conozcan a nuestros colaboradores»).
2. Por defecto, los datos opcionales de los colaboradores (biografía, foto, web, redes sociales, correo público, ubicación, temas y aparición en el directorio) permanecen **ocultos**.
3. Cada colaborador controla exactamente qué campos hacer públicos desde **Mi Panel → Mi Perfil**. Sus borradores y preferencias se resguardan de forma privada en `/collaborator_settings/{uid}`, mientras `/collaborators_public/{uid}` solo recibe los campos habilitados.
4. Desde **Panel de Administración → Colaboradores**, el administrador puede aprobar, suspender, ocultar del directorio, destacar o ajustar el orden de aparición.

---

## 4. Código de Invitación y Google Calendar («Agenda»)
1. El código de invitación se gestiona en **Panel de Administración → Código de invitación** (con expiración opcional).
2. La integración de **Google Calendar** ahora vive en **Panel de Administración → Agenda**, pensada para organizar coberturas periodísticas, entrevistas, cierres de edición y fechas clave.

---

## 5. Protección Antispam y Firebase App Check
1. Todos los formularios públicos (comentarios de invitados, boletín, contacto/rectificaciones y reportes) incluyen campo honeypot oculto, reto matemático de verificación y control de frecuencia.
2. Opcionalmente puedes activar **Firebase App Check** con reCAPTCHA v3 definiendo `VITE_RECAPTCHA_SITE_KEY` en tus variables de entorno.

---

## 6. Reglas Recomendadas para Firebase Storage y Validación Local
- Antes de publicar reglas manualmente en Firebase Console, puedes validar `firestore.rules` localmente con:
  ```bash
  npx eslint firestore.rules && node --test firestore.rules.test.ts
  ```
- En **Firebase Console → Storage → Rules**, publica estas reglas para restringir escrituras a usuarios autenticados según su propia carpeta (`uploads/{uid}/...` o archivos del sitio por el administrador) y limitar el tamaño a 50 MB:
  ```
  rules_version = '2';
  service firebase.storage {
    match /b/{bucket}/o {
      match /{allPaths=**} {
        allow read: if true;
      }
      match /media/{uid}/{allPaths=**} {
        allow write: if request.auth != null
          && (request.auth.uid == uid || request.auth.token.email == 'trujillogordillooo@gmail.com')
          && request.resource.size < 50 * 1024 * 1024;
      }
      match /documents/{uid}/{allPaths=**} {
        allow write: if request.auth != null
          && (request.auth.uid == uid || request.auth.token.email == 'trujillogordillooo@gmail.com')
          && request.resource.size < 50 * 1024 * 1024;
      }
      match /site/{allPaths=**} {
        allow write: if request.auth != null
          && request.auth.token.email == 'trujillogordillooo@gmail.com'
          && request.resource.size < 25 * 1024 * 1024;
      }
    }
  }
  ```
- Si tienes algún problema de CORS al subir multimedia desde el navegador hacia Storage, configura el bucket en Google Cloud SDK (`gsutil cors set cors.json gs://<TU_BUCKET>`) permitiendo el origen de tu dominio.
