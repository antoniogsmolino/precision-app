-- CreateEnum
CREATE TYPE "SourceTier" AS ENUM ('TIER_0_CATALOGO_NAZIONALE', 'TIER_1_RICONCILIAZIONE', 'TIER_2_FONTE_DIRETTA');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('OPEN_DATA_JSON', 'OPEN_DATA_CSV', 'REST_API', 'RSS', 'SITEMAP', 'HTML_LIST', 'HTML_SEARCH', 'JS_RENDERED', 'PDF_ARCHIVE', 'BUR', 'ALTRO');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'FAILING', 'BLOCKED', 'UNKNOWN', 'DISABLED');

-- CreateEnum
CREATE TYPE "StatoDichiaratoBando" AS ENUM ('PRENOTICE', 'UPCOMING', 'OPEN', 'PAUSED', 'FUNDS_EXHAUSTED', 'CLOSED', 'CANCELLED', 'REOPENED');

-- CreateEnum
CREATE TYPE "TipoChiusuraFinestra" AS ENUM ('DATA_FISSA', 'ESAURIMENTO_FONDI', 'FINO_A_REVOCA', 'FINESTRE_MULTIPLE', 'CLICK_DAY', 'SCONOSCIUTO');

-- CreateEnum
CREATE TYPE "RuoloDocumento" AS ENUM ('BANDO', 'DECRETO_ATTUATIVO', 'RETTIFICA', 'PROROGA', 'ALLEGATO', 'FAQ', 'MODULISTICA', 'GRADUATORIA', 'PORTALE_DOMANDA', 'ALTRO');

-- CreateEnum
CREATE TYPE "StatoVerificaEvidence" AS ENUM ('SUPPORTATA', 'PARZIALMENTE_SUPPORTATA', 'NON_SUPPORTATA', 'CONTRADDETTA');

-- CreateEnum
CREATE TYPE "MetodoEstrazione" AS ENUM ('OPEN_DATA', 'REGEX', 'TABELLA', 'LLM', 'MANUALE', 'DERIVATO');

-- CreateEnum
CREATE TYPE "TipoEventoBando" AS ENUM ('SCOPERTO', 'DOCUMENTO_AGGIUNTO', 'DOCUMENTO_CAMBIATO', 'ESTRATTO', 'VERIFICATO', 'PUBBLICATO', 'AGGIORNATO', 'SCADENZA_PROROGATA', 'APERTO', 'CHIUSO', 'SOSPESO', 'FONDI_ESAURITI', 'ANNULLATO', 'RIAPERTO', 'CONFLITTO_FONTI', 'ERRORE_FONTE', 'OVERRIDE_MANUALE');

-- AlterTable
ALTER TABLE "Fonte" ADD COLUMN     "adapterKey" TEXT,
ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "healthStatus" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "sourceTier" "SourceTier",
ADD COLUMN     "sourceType" "SourceType",
ADD COLUMN     "ultimoCambiamentoAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Misura" ADD COLUMN     "incentiviGovId" TEXT,
ADD COLUMN     "programmaId" TEXT,
ADD COLUMN     "rnaCar" TEXT,
ADD COLUMN     "sianCar" TEXT,
ADD COLUMN     "statoDichiarato" "StatoDichiaratoBando";

-- CreateTable
CREATE TABLE "Programma" (
    "id" TEXT NOT NULL,
    "titolo" TEXT NOT NULL,
    "ente" TEXT NOT NULL,
    "baseGiuridica" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinestraTemporale" (
    "id" TEXT NOT NULL,
    "misuraId" TEXT NOT NULL,
    "etichetta" TEXT,
    "apreIl" TIMESTAMP(3),
    "chiudeIl" TIMESTAMP(3),
    "tipoChiusura" "TipoChiusuraFinestra" NOT NULL DEFAULT 'SCONOSCIUTO',
    "note" TEXT,
    "corrente" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinestraTemporale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoUfficiale" (
    "id" TEXT NOT NULL,
    "misuraId" TEXT,
    "urlCanonico" TEXT NOT NULL,
    "ruolo" "RuoloDocumento" NOT NULL,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoUfficiale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoVersione" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pubblicatoIl" TIMESTAMP(3),
    "rawSnapshotId" TEXT,
    "testoEstratto" TEXT,
    "numeroPagine" INTEGER,
    "versioneParser" TEXT,

    CONSTRAINT "DocumentoVersione_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawSnapshot" (
    "id" TEXT NOT NULL,
    "fonteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusCode" INTEGER,
    "contentType" TEXT,
    "sha256" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "misuraId" TEXT NOT NULL,
    "campo" TEXT NOT NULL,
    "documentoId" TEXT,
    "documentoVersioneId" TEXT,
    "pagina" INTEGER,
    "sezione" TEXT,
    "estrattoTesto" TEXT,
    "confidence" DECIMAL(5,4) NOT NULL,
    "statoVerifica" "StatoVerificaEvidence" NOT NULL,
    "metodoEstrazione" "MetodoEstrazione" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoBando" (
    "id" TEXT NOT NULL,
    "misuraId" TEXT NOT NULL,
    "tipo" "TipoEventoBando" NOT NULL,
    "dettaglio" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoBando_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinestraTemporale_misuraId_idx" ON "FinestraTemporale"("misuraId");

-- CreateIndex
CREATE INDEX "DocumentoUfficiale_misuraId_idx" ON "DocumentoUfficiale"("misuraId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoVersione_rawSnapshotId_key" ON "DocumentoVersione"("rawSnapshotId");

-- CreateIndex
CREATE INDEX "DocumentoVersione_documentoId_fetchedAt_idx" ON "DocumentoVersione"("documentoId", "fetchedAt");

-- CreateIndex
CREATE INDEX "RawSnapshot_fonteId_sha256_idx" ON "RawSnapshot"("fonteId", "sha256");

-- CreateIndex
CREATE INDEX "RawSnapshot_fonteId_fetchedAt_idx" ON "RawSnapshot"("fonteId", "fetchedAt");

-- CreateIndex
CREATE INDEX "Evidence_misuraId_campo_idx" ON "Evidence"("misuraId", "campo");

-- CreateIndex
CREATE INDEX "EventoBando_misuraId_createdAt_idx" ON "EventoBando"("misuraId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Misura_incentiviGovId_key" ON "Misura"("incentiviGovId");

-- AddForeignKey
ALTER TABLE "Misura" ADD CONSTRAINT "Misura_programmaId_fkey" FOREIGN KEY ("programmaId") REFERENCES "Programma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinestraTemporale" ADD CONSTRAINT "FinestraTemporale_misuraId_fkey" FOREIGN KEY ("misuraId") REFERENCES "Misura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoUfficiale" ADD CONSTRAINT "DocumentoUfficiale_misuraId_fkey" FOREIGN KEY ("misuraId") REFERENCES "Misura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoVersione" ADD CONSTRAINT "DocumentoVersione_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoUfficiale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoVersione" ADD CONSTRAINT "DocumentoVersione_rawSnapshotId_fkey" FOREIGN KEY ("rawSnapshotId") REFERENCES "RawSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawSnapshot" ADD CONSTRAINT "RawSnapshot_fonteId_fkey" FOREIGN KEY ("fonteId") REFERENCES "Fonte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_misuraId_fkey" FOREIGN KEY ("misuraId") REFERENCES "Misura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoUfficiale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_documentoVersioneId_fkey" FOREIGN KEY ("documentoVersioneId") REFERENCES "DocumentoVersione"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoBando" ADD CONSTRAINT "EventoBando_misuraId_fkey" FOREIGN KEY ("misuraId") REFERENCES "Misura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

