import { Resend } from "resend";

/**
 * Invio dell'email di riepilogo per il frontend pubblico "Finanza Agevolata
 * Match" (Fase 3): dopo che un'azienda cerca la propria Partita IVA e il
 * motore di matching trova misure compatibili, oltre a mostrarle subito in
 * pagina le mandiamo anche via email — utile all'azienda per ritrovarle, e
 * a MOLO come primo touchpoint del lead.
 *
 * Fail-open: se RESEND_API_KEY non è configurata o l'invio fallisce, non si
 * blocca mai la risposta all'utente (che ha comunque i risultati a video) —
 * si registra solo l'errore lato server.
 */

export interface MisuraPerEmail {
  id: string;
  titolo: string;
  ente: string;
  valoreFormattato: string;
  scadenzaFormattata: string;
}

const client = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function costruisciHtml(ragioneSociale: string, misure: MisuraPerEmail[]): string {
  const telefono = process.env.MOLO_PHONE_NUMBER;
  const bookingUrl = process.env.MOLO_BOOKING_URL;

  const righeMisure = misure
    .map(
      (m) => `
        <tr>
          <td style="padding:16px 0;border-bottom:1px solid #eceef2;">
            <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#2B2E34;">${escapeHtml(m.titolo)}</p>
            <p style="margin:0 0 6px;font-size:13px;color:#8a8f99;">${escapeHtml(m.ente)}</p>
            <p style="margin:0;font-size:13px;color:#2B2E34;">
              <strong>${escapeHtml(m.valoreFormattato)}</strong> · scadenza ${escapeHtml(m.scadenzaFormattata)}
            </p>
          </td>
        </tr>`,
    )
    .join("");

  const contatti = [
    telefono ? `<a href="tel:${escapeHtml(telefono)}" style="color:#E41F25;text-decoration:none;">${escapeHtml(telefono)}</a>` : null,
    bookingUrl
      ? `<a href="${escapeHtml(bookingUrl)}" style="color:#E41F25;text-decoration:none;">Prenota una consulenza gratuita</a>`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;max-width:560px;margin:0 auto;padding:32px 20px;color:#2B2E34;">
    <p style="margin:0 0 24px;font-size:20px;font-weight:800;color:#E41F25;">MOLO 4.0</p>
    <h1 style="margin:0 0 8px;font-size:20px;">Ciao ${escapeHtml(ragioneSociale)},</h1>
    <p style="margin:0 0 24px;font-size:14px;color:#5a5f6a;line-height:1.6;">
      abbiamo controllato la tua Partita IVA sui bandi e incentivi attivi monitorati da MOLO 4.0.
      Ecco ${misure.length === 1 ? "la misura che" : `le ${misure.length} misure che`} risultano compatibili in base ai dati disponibili:
    </p>
    <table role="presentation" width="100%" style="border-collapse:collapse;">
      ${righeMisure}
    </table>
    <p style="margin:24px 0 8px;font-size:13px;color:#8a8f99;line-height:1.6;">
      Questo elenco è indicativo: verifica sempre i requisiti completi sulla fonte ufficiale prima di presentare domanda.
    </p>
    ${contatti ? `<p style="margin:24px 0 0;font-size:14px;">Vuoi una mano a capire quali richiedere davvero? ${contatti}</p>` : ""}
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function inviaEmailMatch(params: {
  to: string;
  ragioneSociale: string;
  misure: MisuraPerEmail[];
}): Promise<{ inviata: boolean }> {
  if (!client) {
    console.warn("RESEND_API_KEY non configurata: email di match non inviata.");
    return { inviata: false };
  }
  if (params.misure.length === 0) {
    return { inviata: false };
  }

  try {
    await client.emails.send({
      from: process.env.EMAIL_FROM ?? "MOLO 4.0 <onboarding@resend.dev>",
      to: params.to,
      subject:
        params.misure.length === 1
          ? "Abbiamo trovato 1 incentivo compatibile con la tua azienda"
          : `Abbiamo trovato ${params.misure.length} incentivi compatibili con la tua azienda`,
      html: costruisciHtml(params.ragioneSociale, params.misure),
    });
    return { inviata: true };
  } catch (err) {
    console.error("Invio email di match fallito:", err);
    return { inviata: false };
  }
}
