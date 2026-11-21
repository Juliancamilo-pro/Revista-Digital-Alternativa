# Instrucciones de Configuración — Revista Digital Alternativa

Este proyecto utiliza **Firebase (Authentication, Firestore y Storage)** con reglas de seguridad estrictas por rol, bitácora de actividad administrativa, protección antispam e integración de **Google Calendar**.

---

## 1. Configuración de Firebase Authentication
El archivo `firebase-applet-config.json` ya contiene las credenciales públicas del proyecto provisionado (`pro-pod-1bcxw`). Para que funcionen todos los flujos de inicio de sesión y recuperación de contraseña:

1. Ingresa a [Firebase Console](https://console.firebase.google.com/) y selecciona tu proyecto.
2. Ve a **Authentication → Sign-in method**.
3. Activa los proveedores necesarios:
   - **Google** (para lectores y conexión de sesión de Google Calendar).
   - **Correo electrónico/contraseña** (requerido para la cuenta de administración, el registro de colaboradores con código de invitación y la recuperación de clave por correo).
4. En **Authentication → Settings → Authorized domains**, verifica que el dominio de publicación esté autorizado.

---

## 2. Cuenta Única de Administrador (Conservada)
1. La cuenta de administrador ya se encuentra registrada y protegida en `/admins/{uid}` y `/site_meta/bootstrap` (bloqueado permanentemente contra segundos reclamos en `firestore.rules`).
2. Para administrar la revista, inicia sesión con tu cuenta registrada mediante el botón **Ingresar** e ingresa a `/admin`.
3. Al ingresar por primera vez tras esta actualización, el sistema ejecuta automáticamente una limpieza única e idempotente (`/site_meta/cleanup`) para eliminar cualquier documento de ejemplo heredado sin tocar tus usuarios, colaboradores, código de invitación, categorías ni publicaciones reales.
4. Toda acción relevante del administrador (publicaciones, colaboradores, taxonomía, código de invitación y ajustes) queda registrada en la colección inmutable `/admin_activity_logs`, visible en la pestaña **Actividad** del panel.

---

## 3. Código de Invitación para Colaboradores (con Expiración Opcional)
1. Ingresa al **Panel de Administración** (`/admin`) → pestaña **Código de invitación**.
2. Escribe un código manualmente o pulsa **Generar aleatorio**. Opcionalmente define una **fecha y hora de expiración**.
3. El código en texto plano se guarda exclusivamente en `/site_secrets/invite` (legible solo por el administrador). Para validar nuevos registros en `/unete`, se utiliza un hash SHA-256 en `/invite_tokens/{hash}` con `allow list: if false` y validación de expiración (`expiresAt > request.time`) directamente en `firestore.rules`.
4. Al cambiar o desactivar el código, el anterior deja de funcionar de inmediato para nuevas cuentas sin afectar a los colaboradores ya registrados.

---

## 4. Protección Antispam y Firebase App Check
1. Todos los formularios públicos (comentarios de invitados, suscripción al boletín, contacto/rectificaciones y reportes de contenido) incluyen campo honeypot oculto, reto matemático de verificación y límites de tiempo entre envíos.
2. De manera opcional puedes activar **Firebase App Check** con reCAPTCHA v3 definiendo la variable de entorno `VITE_RECAPTCHA_SITE_KEY` (documentada en `.env.example`) y habilitando App Check en la consola de Firebase.

---

## 5. Integración con Google Calendar
1. Desde **Panel de Administración → En vivo**, **Panel de Colaborador → Mis transmisiones** o directamente en `/en-vivo` (si eres anfitrión o administrador), puedes conectar tu cuenta de Google mediante OAuth para ver próximos eventos y agendar transmisiones en vivo.
2. El token de acceso de Google Calendar se conserva únicamente en memoria durante la sesión activa (se limpia automáticamente al cerrar sesión o desconectar) y cualquier edición o eliminación requiere confirmación explícita dentro de la aplicación.

---

## 6. Base de Datos Firestore y Almacenamiento Multimedia (Storage)
- El esquema completo está documentado en `firebase-blueprint.json` y las reglas desplegadas en `firestore.rules`.
- Si realizas cambios en `firestore.rules`, valida y ejecuta pruebas antes de desplegar:
  ```bash
  npx eslint firestore.rules && node --test firestore.rules.test.ts
  ```
- En **Firebase Console → Storage → Rules**, asegúrate de tener reglas autenticadas para permitir subida directa de archivos multimedia de gran tamaño:
  ```
  rules_version = '2';
  service firebase.storage {
    match /b/{bucket}/o {
      match /{allPaths=**} {
        allow read: if true;
        allow write: if request.auth != null && request.resource.size < 50 * 1024 * 1024;
      }
    }
  }
  ```
- Cuando el administrador sube un logotipo personalizado en **Configuración**, la aplicación genera y sincroniza automáticamente el favicon y el manifiesto PWA con dicho logotipo.
