/**
 * almenta — backend en Google Apps Script
 * ---------------------------------------------------------------
 * Qué hace:
 *  - Recibe el idToken que generó Google Identity Services en el navegador,
 *    lo valida contra los servidores de Google (no confía ciegamente en él).
 *  - Guarda/actualiza una fila por usuaria en la hoja "Sessions", con todo
 *    el estado de la app (onboarding + plan + registro de comidas) como JSON.
 *  - Guarda un registro aparte en "PaidRequests" cada vez que alguien pide
 *    el plan pago (para que quede buscable en Sheets, además del WhatsApp).
 *
 * CÓMO INSTALARLO:
 *  1) Creá un Google Sheet nuevo (o usá uno existente).
 *  2) Extensiones → Apps Script. Pegá este archivo reemplazando el contenido
 *     de Code.gs.
 *  3) Arriba a la derecha, reemplazá GOOGLE_CLIENT_ID por el mismo Client ID
 *     que pusiste en src/config.js (tiene que ser IDÉNTICO en los dos lados).
 *  4) Deploy → New deployment → tipo "Web app".
 *       - Execute as: Me
 *       - Who has access: Anyone
 *  5) Copiá la URL que termina en /exec y pegala en APPS_SCRIPT_URL
 *     en src/config.js.
 *  6) La primera vez que se guarde algo, este script crea solo las hojas
 *     "Sessions" y "PaidRequests" con sus encabezados.
 */

const GOOGLE_CLIENT_ID = "TU_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

const SESSIONS_SHEET = "Sessions";
const PAID_REQUESTS_SHEET = "PaidRequests";

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === "loadSession") {
      const profile = verifyIdToken_(e.parameter.idToken);
      const row = findSessionRow_(profile.email);
      if (!row) {
        return jsonResponse_({ found: false });
      }
      return jsonResponse_({ found: true, data: JSON.parse(row.dataJson) });
    }
    return jsonResponse_({ error: "Acción GET desconocida" });
  } catch (err) {
    return jsonResponse_({ error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.action === "saveSession") {
      const profile = verifyIdToken_(body.idToken);
      upsertSession_(profile, body.plan, body.data);
      return jsonResponse_({ ok: true });
    }

    if (body.action === "logPaidRequest") {
      const profile = verifyIdToken_(body.idToken);
      appendPaidRequest_(profile);
      return jsonResponse_({ ok: true });
    }

    return jsonResponse_({ error: "Acción POST desconocida" });
  } catch (err) {
    return jsonResponse_({ error: String(err) });
  }
}

// ---------------------------------------------------------------
// Verificación del idToken contra Google (evita que cualquiera mande
// un email inventado directamente al endpoint).
// ---------------------------------------------------------------
function verifyIdToken_(idToken) {
  if (!idToken) throw new Error("Falta idToken");
  const res = UrlFetchApp.fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  const payload = JSON.parse(res.getContentText());
  if (payload.error) throw new Error("Token inválido: " + payload.error);
  if (payload.aud !== GOOGLE_CLIENT_ID) throw new Error("Token de otra app (aud no coincide)");
  return {
    email: payload.email,
    name: payload.name || payload.email,
    picture: payload.picture || "",
  };
}

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function findSessionRow_(email) {
  const sheet = getSheet_(SESSIONS_SHEET, ["email", "name", "plan", "updatedAt", "dataJson"]);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === email) {
      return { rowIndex: i + 1, email: values[i][0], name: values[i][1], plan: values[i][2], dataJson: values[i][4] };
    }
  }
  return null;
}

function upsertSession_(profile, plan, data) {
  const sheet = getSheet_(SESSIONS_SHEET, ["email", "name", "plan", "updatedAt", "dataJson"]);
  const existing = findSessionRow_(profile.email);
  const now = new Date();
  const dataJson = JSON.stringify(data || {});

  if (existing) {
    sheet.getRange(existing.rowIndex, 1, 1, 5).setValues([[profile.email, profile.name, plan || existing.plan, now, dataJson]]);
  } else {
    sheet.appendRow([profile.email, profile.name, plan || "", now, dataJson]);
  }
}

function appendPaidRequest_(profile) {
  const sheet = getSheet_(PAID_REQUESTS_SHEET, ["email", "name", "requestedAt"]);
  sheet.appendRow([profile.email, profile.name, new Date()]);
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
