# Instrucciones de Configuración — Revista Digital Alternativa

Este proyecto utiliza **Firebase (Authentication, Firestore y Storage)** con reglas de seguridad estrictas por rol, perfiles editoriales con aislamiento de datos privados y sensibles (Ley 1581 de 2012), modo APA 7 académico, reproductores enriquecidos, bitácora de actividad administrativa e integración de **Google Calendar**.

---

## ⚠️ Paso Obligatorio Tras Esta Actualización: Publicar Reglas en Firebase Console

Cada vez que se agregan nuevas colecciones, controles de privacidad o subidas de archivos (como logos de partidos políticos o subtítulos WebVTT), **debes volver a publicar las reglas en Firebase Console**:

1. Entra a [Firebase Console](https://console.firebase.google.com/) y abre tu proyecto (`pro-pod-1bcxw`).
2. Ve a **Firestore Database → Reglas (Rules)**.
3. Copia todo el contenido del archivo `firestore.rules` del repositorio y pégalo en el editor de la consola, luego pulsa **Publicar (Publish)**.
4. Ve también a **Storage → Reglas (Rules)** y pega las reglas actualizadas de la sección 6 de este archivo (incluyen `/party_logos/{uid}` y `/subtitles/{uid}` además de `/media/{uid}`, `/documents/{uid}` y `/site/`), luego pulsa **Publicar (Publish)**.

---

## 1. Configuración de Firebase Authentication
El archivo `firebase-applet-config.json` ya contiene las credenciales públicas del proyecto provisionado. Para que funcionen todos los flujos de inicio de sesión y recuperación de contraseña:

1. En Firebase Console, ve a **Authentication → Sign-in method**.
2. Activa los proveedores necesarios:
   - **Google** (para lectores y conexión opcional con Google Calendar).
   - **Correo electrónico/contraseña** (requerido para administración, registro de colaboradores con código de invitación y recuperación de contraseña).
3. En **Authentication → Settings → Authorized domains**, verifica que tu dominio esté autorizado.

---

## 2. Cuenta de Administrador e Identidades Públicas y Privadas
1. Tu cuenta de administrador ya se encuentra protegida en `/admins/{uid}` y `/site_meta/bootstrap`.
2. Desde **Panel de Administración → Perfiles del administrador**, puedes configurar dos identidades editoriales completas sin exponer jamás tu UID ni tu correo privado:
   - **Perfil personal (Fundador/a / Dirección)** (`/admin_identities/owner` público + `/admin_private/owner` privado).
   - **Perfil institucional de la revista** (`/admin_identities/magazine` público + `/admin_private/magazine` privado).
3. Al igual que los colaboradores, el administrador decide campo por campo qué datos de su ficha son públicos y cuáles permanecen privados. El año de nacimiento (`birthYear`) y el registro de consentimiento (`politicalConsentAccepted`) nunca se envían a las colecciones públicas: solo se calcula la edad numérica (`publicAge`) si activas «Mostrar edad públicamente».
4. En el editor de artículos, el administrador cuenta con el selector **«Publicar como»** para elegir cuál de las dos identidades firma cada nota.
5. La insignia dorada circular con la **«R»** aparece automáticamente en el administrador y en los colaboradores con estado **Activo**. Si un colaborador es suspendido, la insignia desaparece de inmediato en todo el sitio.

---

## 3. Directorio de Colaboradores, Privacidad y Ley 1581 de 2012
1. Existe una sección pública en `/colaboradores` («Conozcan a nuestros colaboradores») y páginas individuales de ficha de autor en `/colaborador/:id`.
2. **Privacidad por defecto:** Al registrarse o editar su perfil, únicamente el nombre y el tipo de perfil (independiente o medio) son públicos. Todos los demás datos (foto, a qué se dedica, cargo, organización, ciudad y país, edad calculada, correo de contacto, sitio web, redes sociales, biografía, temas, afiliación política y logo del partido/movimiento) permanecen **ocultos por defecto** hasta que el titular active explícitamente su interruptor **«Mostrar públicamente»**.
3. **Aislamiento real de datos:** Los datos privados, el año de nacimiento (`birthYear`) y los registros de consentimiento se guardan exclusivamente en `/collaborator_settings/{uid}` (accesible solo para el titular y el administrador). En `/collaborators_public/{uid}` solo se proyectan los campos autorizados por cada interruptor (y la edad como número entero `publicAge`, jamás la fecha ni el año de nacimiento).
4. **Afiliación política (dato sensible — Ley 1581 de 2012):** Es completamente voluntaria, requiere una casilla de consentimiento explícito antes de guardarse si la respuesta es «Sí», y puede ocultarse o eliminarse por completo en cualquier momento desde **Mi Panel → Mi perfil y privacidad**.
5. **Restricción de edad:** El registro de colaboradores y el guardado de perfil rechazan cualquier año de nacimiento que corresponda a menores de 18 años tanto en la interfaz como en `firestore.rules`.
6. Desde **Panel de Administración → Colaboradores**, el administrador puede aprobar, suspender, ocultar del directorio, destacar, ajustar el orden de aparición o consultar de forma privada los datos suministrados por cada colaborador («Ver ficha privada»).

---

## 4. Código de Invitación y Google Calendar («Agenda»)
1. El código de invitación se gestiona en **Panel de Administración → Código de invitación** (con expiración opcional).
2. La integración de **Google Calendar** vive en **Panel de Administración → Agenda**, pensada para organizar coberturas periodísticas, entrevistas, cierres de edición y fechas clave.

---

## 5. Protección Antispam y Firebase App Check
1. Todos los formularios públicos (comentarios de invitados, boletín, contacto/rectificaciones y reportes) incluyen campo honeypot oculto, reto matemático de verificación y control de frecuencia.
2. Opcionalmente puedes activar **Firebase App Check** con reCAPTCHA v3 definiendo `VITE_RECAPTCHA_SITE_KEY` en tus variables de entorno.

---

## 6. Reglas Actualizadas para Firebase Storage y Validación Local
- Antes de publicar reglas manualmente en Firebase Console, valida `firestore.rules` localmente con:
  ```bash
  npx eslint firestore.rules && node --test firestore.rules.test.ts
  ```
- En **Firebase Console → Storage → Reglas (Rules)**, publica estas reglas completas:
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
      match /party_logos/{uid}/{allPaths=**} {
        allow write: if request.auth != null
          && (request.auth.uid == uid || request.auth.token.email == 'trujillogordillooo@gmail.com')
          && request.resource.size < 10 * 1024 * 1024;
      }
      match /subtitles/{uid}/{allPaths=**} {
        allow write: if request.auth != null
          && (request.auth.uid == uid || request.auth.token.email == 'trujillogordillooo@gmail.com')
          && request.resource.size < 5 * 1024 * 1024;
      }
      match /site/{allPaths=**} {
        allow write: if request.auth != null
          && request.auth.token.email == 'trujillogordillooo@gmail.com'
          && request.resource.size < 25 * 1024 * 1024;
      }
    }
  }
  ```
- Si tienes algún problema de CORS al subir multimedia o archivos `.vtt` desde el navegador hacia Storage, configura el bucket en Google Cloud SDK (`gsutil cors set cors.json gs://<TU_BUCKET>`) permitiendo el origen de tu dominio.
