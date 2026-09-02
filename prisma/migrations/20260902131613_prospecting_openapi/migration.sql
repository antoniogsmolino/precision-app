-- CreateEnum
CREATE TYPE "TipoChiamataOpenApi" AS ENUM ('SEARCH', 'ADVANCED');

-- CreateEnum
CREATE TYPE "EsitoRicercaProspect" AS ENUM ('SUCCESSO', 'ERRORE', 'BUDGET_ESAURITO', 'IN_CORSO');

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "datiAcquisitiAt" TIMESTAMP(3),
ADD COLUMN     "openApiId" TEXT,
ADD COLUMN     "pec" TEXT;

-- CreateTable
CREATE TABLE "ApiUsageLog" (
    "id" TEXT NOT NULL,
    "tipo" "TipoChiamataOpenApi" NOT NULL,
    "unita" INTEGER NOT NULL,
    "costoStimato" DECIMAL(10,4) NOT NULL,
    "misuraId" TEXT,
    "creatoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RicercaProspectLog" (
    "id" TEXT NOT NULL,
    "misuraId" TEXT NOT NULL,
    "avviataAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completataAt" TIMESTAMP(3),
    "esito" "EsitoRicercaProspect" NOT NULL,
    "candidateTrovate" INTEGER NOT NULL DEFAULT 0,
    "aziendeNuove" INTEGER NOT NULL DEFAULT 0,
    "aziendeDaCache" INTEGER NOT NULL DEFAULT 0,
    "matchTrovati" INTEGER NOT NULL DEFAULT 0,
    "costoStimato" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "messaggioErrore" TEXT,

    CONSTRAINT "RicercaProspectLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiUsageLog_creatoAt_idx" ON "ApiUsageLog"("creatoAt");

-- CreateIndex
CREATE INDEX "ApiUsageLog_misuraId_idx" ON "ApiUsageLog"("misuraId");

-- CreateIndex
CREATE INDEX "RicercaProspectLog_misuraId_avviataAt_idx" ON "RicercaProspectLog"("misuraId", "avviataAt");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_openApiId_key" ON "Prospect"("openApiId");

-- AddForeignKey
ALTER TABLE "ApiUsageLog" ADD CONSTRAINT "ApiUsageLog_misuraId_fkey" FOREIGN KEY ("misuraId") REFERENCES "Misura"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RicercaProspectLog" ADD CONSTRAINT "RicercaProspectLog_misuraId_fkey" FOREIGN KEY ("misuraId") REFERENCES "Misura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

