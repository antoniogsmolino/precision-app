import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * Guardrail economici (§12 delle specifiche): budget giornaliero/mensile
 * configurabili, prenotazione del costo PRIMA di ogni chiamata a
 * pagamento, pausa quando il budget non basta. I prezzi di riferimento
 * (€0,01 Search, €0,028 Advanced) sono quelli indicati dal team per le
 * simulazioni — le specifiche stesse avvertono che la tariffa reale
 * dell'account va verificata sui consumi effettivi, non assunta da qui:
 * per questo sono tutti configurabili via env, mai hardcoded altrove.
 *
 * Limite onesto rispetto alle specifiche: qui non c'è un lock distribuito
 * con scadenza (§8 "Evitare chiamate simultanee duplicate") — per un
 * team piccolo su un'unica istanza, la prenotazione atomica dentro una
 * transazione DB (vedi prenotaSpesa) copre lo stesso rischio pratico
 * (due run che partono nello stesso istante) senza l'infrastruttura di
 * un lock distribuito vero (Redis o simile, non presente in questo
 * progetto). Se in futuro il prodotto girerà su più istanze concorrenti,
 * questo punto va rivisto.
 */

export const PREZZO_SEARCH_EUR = Number(process.env.OPENAPI_PREZZO_SEARCH_EUR ?? "0.01");
export const PREZZO_ADVANCED_EUR = Number(process.env.OPENAPI_PREZZO_ADVANCED_EUR ?? "0.028");

const BUDGET_GIORNALIERO_EUR = Number(process.env.OPENAPI_BUDGET_GIORNALIERO_EUR ?? "5");
const BUDGET_MENSILE_EUR = Number(process.env.OPENAPI_BUDGET_MENSILE_EUR ?? "50");

export const MAX_CANDIDATE_PER_RUN = Number(process.env.OPENAPI_MAX_CANDIDATE_PER_RUN ?? "100");
export const MAX_ADVANCED_PER_RUN = Number(process.env.OPENAPI_MAX_ADVANCED_PER_RUN ?? "50");

function inizioGiorno(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function inizioMese(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export interface StatoBudget {
  speseOggiEur: number;
  speseMeseEur: number;
  residuoOggiEur: number;
  residuoMeseEur: number;
  budgetGiornalieroEur: number;
  budgetMensileEur: number;
}

export async function leggiStatoBudget(ora = new Date()): Promise<StatoBudget> {
  const [oggi, mese] = await Promise.all([
    prisma.apiUsageLog.aggregate({ where: { creatoAt: { gte: inizioGiorno(ora) } }, _sum: { costoStimato: true } }),
    prisma.apiUsageLog.aggregate({ where: { creatoAt: { gte: inizioMese(ora) } }, _sum: { costoStimato: true } }),
  ]);

  const speseOggiEur = Number(oggi._sum.costoStimato ?? 0);
  const speseMeseEur = Number(mese._sum.costoStimato ?? 0);

  return {
    speseOggiEur,
    speseMeseEur,
    residuoOggiEur: Math.max(0, BUDGET_GIORNALIERO_EUR - speseOggiEur),
    residuoMeseEur: Math.max(0, BUDGET_MENSILE_EUR - speseMeseEur),
    budgetGiornalieroEur: BUDGET_GIORNALIERO_EUR,
    budgetMensileEur: BUDGET_MENSILE_EUR,
  };
}

/**
 * Prenota (scrive) il costo di UNA chiamata PRIMA di eseguirla — la
 * chiamata va fatta solo se questa funzione ritorna true. Scritto prima
 * della chiamata di rete, non dopo: se il processo muore a metà, il costo
 * resta comunque contabilizzato (più sicuro sottostimare il budget
 * residuo che rischiare di sforarlo per una spesa mai registrata — vedi
 * §15, "un timeout può avvenire dopo l'addebito").
 *
 * Transazione con ricontrollo del totale DENTRO la stessa transazione:
 * copre il caso di due run avviati nello stesso istante (vedi il limite
 * onesto nel commento in cima al file).
 */
export async function prenotaSpesa(params: {
  tipo: "SEARCH" | "ADVANCED";
  unita: number;
  misuraId?: string;
}): Promise<{ concesso: boolean; motivo?: string; costoEur: number }> {
  const prezzoUnitario = params.tipo === "SEARCH" ? PREZZO_SEARCH_EUR : PREZZO_ADVANCED_EUR;
  const costoEur = prezzoUnitario * params.unita;
  const ora = new Date();

  return prisma.$transaction(async (tx) => {
    const [oggi, mese] = await Promise.all([
      tx.apiUsageLog.aggregate({ where: { creatoAt: { gte: inizioGiorno(ora) } }, _sum: { costoStimato: true } }),
      tx.apiUsageLog.aggregate({ where: { creatoAt: { gte: inizioMese(ora) } }, _sum: { costoStimato: true } }),
    ]);

    const speseOggi = Number(oggi._sum.costoStimato ?? 0);
    const speseMese = Number(mese._sum.costoStimato ?? 0);

    if (speseOggi + costoEur > BUDGET_GIORNALIERO_EUR) {
      return { concesso: false, motivo: "Budget giornaliero OpenAPI esaurito", costoEur };
    }
    if (speseMese + costoEur > BUDGET_MENSILE_EUR) {
      return { concesso: false, motivo: "Budget mensile OpenAPI esaurito", costoEur };
    }

    await tx.apiUsageLog.create({
      data: {
        tipo: params.tipo,
        unita: params.unita,
        costoStimato: new Prisma.Decimal(costoEur),
        misuraId: params.misuraId,
      },
    });

    return { concesso: true, costoEur };
  });
}
