// ---------------------------------------------------------------------------
// CONFIGURACIÓN — esto es lo único que tenés que completar vos.
// ---------------------------------------------------------------------------

// 1) Google Cloud Console → APIs & Services → Credentials → OAuth Client ID
//    (tipo "Web application"). Agregá como "Authorized JavaScript origins"
//    el dominio donde vayas a publicar la app (ej: https://app.almenta.com.ar
//    y http://localhost:5173 para probar en tu compu).
export const GOOGLE_CLIENT_ID = "479655373916-rtvlmi74h8bssu4femogaljqcs5fvef3.apps.googleusercontent.com";

// 2) URL del Web App de Google Apps Script (ver /apps-script/Code.gs).
//    La obtenés al hacer "Deploy → New deployment → Web app" en el editor
//    de Apps Script. Termina en /exec
export const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxm4UJso933vSkgLH5zoJZ1s4tSCHWTLM9kMW5ctL8P88vKLwBLRJ7_iYTNLklH4Re7/exec";

// 3) Número de WhatsApp donde llegan los pedidos de plan pago.
//    Formato internacional sin "+", sin espacios: 549 + código de área sin 0 + número sin 15.
export const WHATSAPP_NUMBER = "5491137991082";

// 4) Precio mostrado en el paywall (solo texto, no cobra nada acá).
export const COACH_PLAN_PRICE = "$50.000/mes";
