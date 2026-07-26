import { GOOGLE_CLIENT_ID } from "../config";

// Google Identity Services (GIS) carga un script global `window.google`.
// Como el botón real de Google tiene su propio estilo (no lo podemos pintar
// con los colores de almenta), lo montamos escondido y lo "clickeamos" desde
// nuestro propio botón lindo. Así el flujo de OAuth sigue siendo 100% el
// oficial de Google (más confiable, sin popups bloqueados).

let initialized = false;
let pendingResolve = null;
let pendingReject = null;

function decodeJwt(token) {
  const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
  );
  return JSON.parse(json);
}

function ensureInitialized() {
  if (initialized) return;
  if (!window.google?.accounts?.id) {
    throw new Error(
      "Google Identity Services todavía no cargó. Revisá que el script esté en index.html y que haya conexión a internet."
    );
  }

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      try {
        const profile = decodeJwt(response.credential);
        pendingResolve?.({
          idToken: response.credential,
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
        });
      } catch (err) {
        pendingReject?.(err);
      }
    },
    auto_select: false,
  });

  // Botón invisible que dispara el popup nativo de Google.
  const container = document.createElement("div");
  container.id = "google-signin-hidden";
  container.style.position = "fixed";
  container.style.top = "-9999px";
  document.body.appendChild(container);
  window.google.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
  });

  initialized = true;
}

// Devuelve una promesa que resuelve con { idToken, email, name, picture }
// cuando la persona termina de elegir su cuenta de Google.
export function signInWithGoogle() {
  return new Promise((resolve, reject) => {
    try {
      ensureInitialized();
    } catch (err) {
      reject(err);
      return;
    }
    pendingResolve = resolve;
    pendingReject = reject;

    // Clickeamos el botón invisible de Google en nombre del botón visible de almenta.
    const btn = document.querySelector("#google-signin-hidden div[role=button]");
    if (btn) {
      btn.click();
    } else {
      // Fallback: el One Tap / prompt estándar de Google.
      window.google.accounts.id.prompt();
    }
  });
}

// Para saber si ya hay una sesión guardada (ver src/lib/session.js).
export function getStoredSession() {
  try {
    const raw = localStorage.getItem("almenta_session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeSession(session) {
  localStorage.setItem("almenta_session", JSON.stringify(session));
}

export function clearStoredSession() {
  localStorage.removeItem("almenta_session");
}
