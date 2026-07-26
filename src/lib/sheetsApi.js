import { APPS_SCRIPT_URL } from "../config";

// Usamos Content-Type: text/plain a propósito: si mandamos application/json,
// el navegador dispara un preflight OPTIONS que Apps Script no responde bien,
// y falla el CORS. Con text/plain no hay preflight, y en Code.gs igual
// parseamos el body como JSON.

// Guarda (o actualiza) la sesión completa de la persona en la hoja "Sessions".
export async function saveSession({ idToken, plan, data }) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "saveSession",
      idToken,
      plan,
      data,
    }),
  });
  if (!res.ok) throw new Error("No se pudo guardar la sesión en Sheets");
  return res.json();
}

// Trae la última sesión guardada de la persona (para retomar donde dejó).
export async function loadSession({ idToken }) {
  const url = `${APPS_SCRIPT_URL}?action=loadSession&idToken=${encodeURIComponent(idToken)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error("No se pudo leer la sesión de Sheets");
  const json = await res.json();
  return json.found ? json.data : null;
}

// Deja registrado en la hoja que la persona pidió el plan pago (además del
// mensaje de WhatsApp), para que quede un registro buscable en Sheets.
export async function logPaidPlanRequest({ idToken, email, name }) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "logPaidRequest",
      idToken,
      email,
      name,
    }),
  });
  if (!res.ok) throw new Error("No se pudo registrar el pedido de plan pago");
  return res.json();
}
