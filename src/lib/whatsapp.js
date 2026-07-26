import { WHATSAPP_NUMBER } from "../config";

// Arma el link de wa.me con el mensaje pre-cargado y lo abre en una pestaña
// nueva. En celular, esto abre directamente la app de WhatsApp.
export function openWhatsAppPaidPlanRequest({ name, email }) {
  const lines = [
    "Hola! Quiero el plan pago (Con Coach) de almenta.",
    name ? `Nombre: ${name}` : null,
    email ? `Email: ${email}` : null,
  ].filter(Boolean);

  const text = encodeURIComponent(lines.join("\n"));
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
  window.open(url, "_blank", "noopener,noreferrer");
  return url;
}
