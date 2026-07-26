# almenta — app funcional

Este proyecto toma tu prototipo (`almenta-app-prototipo.jsx`) y le agrega lo que
pediste:

1. **Login real con Google** (OAuth, sin contraseñas).
2. **Google Sheets como base de datos**, vía un backend en Google Apps Script.
3. **Plan pago → WhatsApp**: al elegir "Con Coach", se abre `wa.me` con el
   número que diste (**1137991082**) y un mensaje pre-cargado. El cobro en sí
   lo hacés vos por Mercado Pago, a mano, cuando te escriban.
4. **PWA instalable en Android** (y iOS): se puede "agregar a la pantalla de
   inicio" y queda con ícono, splash y funciona sin conexión para el shell de
   la app.

No inventé nada de esto como humo: es un proyecto real de Vite + React que
podés correr, buildear y publicar. Lo único que **te falta completar vos**
son 3 datos de configuración (Google Client ID, URL de Apps Script, y ya
está el número de WhatsApp cargado). Todo vive en `src/config.js`.

---

## 1) Google OAuth — conseguir el Client ID

1. Andá a [Google Cloud Console](https://console.cloud.google.com/) → creá
   un proyecto (o usá uno existente).
2. **APIs & Services → OAuth consent screen**: configuralo como "External",
   completá nombre de la app ("almenta"), logo si querés, y agregá tu email
   de soporte.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Tipo de aplicación: **Web application**.
   - En "Authorized JavaScript origins" agregá:
     - `http://localhost:5173` (para probar en tu compu)
     - el dominio real donde vayas a publicar, ej: `https://app.almenta.com.ar`
4. Copiá el **Client ID** que te da (termina en `.apps.googleusercontent.com`)
   y pegalo en `src/config.js` en `GOOGLE_CLIENT_ID`.

No hace falta "Client secret": el login es 100% del lado del navegador
(Google Identity Services), por eso no hay contraseñas que manejar vos.

---

## 2) Google Sheets + Apps Script — el backend

1. Creá un Google Sheet nuevo (puede estar vacío).
2. **Extensiones → Apps Script**.
3. Borrá el contenido de `Code.gs` que viene por defecto y pegá el archivo
   `apps-script/Code.gs` de esta carpeta.
4. Arriba, reemplazá `GOOGLE_CLIENT_ID` por el **mismo** Client ID del paso 1
   (tiene que ser idéntico en los dos lugares, si no el token no valida).
5. **Deploy → New deployment**:
   - Selecciona tipo **Web app**.
   - "Execute as": **Me**.
   - "Who has access": **Anyone**.
   - Deploy, y autorizá los permisos que te pida (son para leer/escribir en
     esta misma planilla).
6. Copiá la URL que termina en `/exec` y pegala en `src/config.js` en
   `APPS_SCRIPT_URL`.

Con eso, la primera vez que alguien complete el onboarding, el script crea
solo dos hojas dentro de tu Sheet:
- **Sessions**: una fila por usuaria, con su email, nombre, plan elegido, y
  todo el estado de la app (respuestas del onboarding, registro de comidas,
  etc.) como JSON en la última columna.
- **PaidRequests**: un registro (email, nombre, fecha) cada vez que alguien
  toca "Empezar con Coach", además del mensaje de WhatsApp — para que puedas
  buscarlo/filtrarlo en Sheets sin depender solo del chat.

Cada vez que alguien registra una comida o avanza en la app, el estado se
vuelve a guardar automáticamente (con un pequeño retraso para no saturar).
Si esa misma persona vuelve a entrar (mismo Google, otro día u otro
celular), la app la reconoce y la lleva directo a su Home con sus datos,
sin repetir el onboarding.

---

## 3) WhatsApp + Mercado Pago

Ya está cargado el número en `src/config.js`:

```js
export const WHATSAPP_NUMBER = "5491137991082";
```

Cuando alguien elige el plan **Con Coach**:
1. Se guarda su sesión en Sheets con `plan: "coach"`.
2. Se agrega un registro en la hoja `PaidRequests`.
3. Se abre automáticamente `https://wa.me/5491137991082` con un mensaje que
   ya dice "Hola! Quiero el plan pago (Con Coach) de almenta" + su nombre y
   email, para que no tengas que preguntar de nuevo quién es.
4. Vos le contestás por WhatsApp y le mandás el link de pago de Mercado Pago
   a mano (esto queda fuera de la app a propósito, tal como lo pediste — el
   cobro real lo generás vos).

Si en algún momento querés automatizar la generación del link de Mercado
Pago (por ejemplo con la API de Preferencias de MP), avisame y lo sumamos
como un paso más: ahí sí necesitarías un backend con tu Access Token de MP
(no se puede hacer de forma segura solo con Apps Script + frontend, porque
requiere guardar una credencial secreta).

---

## 4) Instalarlo como app en Android (PWA)

Ya está todo configurado (`vite-plugin-pwa` + `manifest.webmanifest` +
íconos generados a partir de tu logo, en `public/icons/`). Para que la gente
lo pueda "bajar":

1. Publicás el sitio en HTTPS (ver sección 5).
2. En Android, cuando entran con Chrome, el navegador va a ofrecer solo
   "Agregar a pantalla de inicio" o incluso un banner de instalación
   automático — con eso queda como un ícono más, abre en pantalla completa
   (sin barra del navegador) y funciona offline para las pantallas ya
   visitadas.
3. En iPhone (Safari) el proceso es manual: Compartir → "Agregar a pantalla
   de inicio". Funciona igual de bien, pero Apple no muestra el banner
   automático.

No hace falta subir nada a Google Play para esto — es justamente lo que
resuelve una PWA. Si más adelante querés estar en la Play Store igual (por
ejemplo por confianza de marca), se puede empaquetar esta misma PWA con
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) sin reescribir
nada.

---

## 5) Correr y publicar

```bash
npm install
npm run dev       # http://localhost:5173, para probar
npm run build     # genera /dist, listo para publicar
npm run preview   # sirve /dist localmente para probar el build final
```

`/dist` es una carpeta 100% estática: la podés subir tal cual a Vercel,
Netlify, GitHub Pages, o el hosting que uses. Recordá agregar ese dominio a
"Authorized JavaScript origins" en el paso 1 (Google Cloud), o el login va a
fallar en producción aunque funcione en localhost.

---

## Estructura del proyecto

```
src/
  App.jsx            ← tu prototipo, con el login/Sheets/WhatsApp conectados
  config.js          ← ACÁ completás Client ID + URL de Apps Script
  lib/
    googleAuth.js     ← login con Google + guardar sesión en el celular
    sheetsApi.js       ← hablar con el backend de Apps Script
    whatsapp.js         ← armar y abrir el link de wa.me
apps-script/
  Code.gs             ← pegar esto en el editor de Apps Script de tu Sheet
public/
  icons/               ← íconos ya generados a partir de tu logo
  manifest generado automáticamente por vite-plugin-pwa en el build
```

## Qué falta si querés seguir más allá del MVP

- **Restaurar el progreso exacto donde lo dejó** (hoy vuelve directo a Home
  con sus datos, no a la pantalla puntual en la que estaba).
- **Automatizar el cobro de Mercado Pago** (hoy es manual por WhatsApp, tal
  como lo pediste).
- **Panel para vos** para ver todas las usuarias sin abrir el Sheet a mano
  (se podría armar como otra vista de esta misma app, protegida con tu
  propio login de Google).
