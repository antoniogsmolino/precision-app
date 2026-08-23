-- CreateEnum
CREATE TYPE "LivelloFonte" AS ENUM ('L1_NAZIONALE', 'L2_REGIONALE', 'L3_CAMERALE');

-- CreateEnum
CREATE TYPE "EsitoScan" AS ENUM ('SUCCESSO', 'ERRORE', 'BLOCCATO_ROBOTS');

-- CreateEnum
CREATE TYPE "CategoriaMisura" AS ENUM ('NAZIONALE', 'REGIONALE', 'CAMERALE', 'FISCALE');

-- CreateEnum
CREATE TYPE "TipoAgevolazione" AS ENUM ('FONDO_PERDUTO', 'TASSO_ZERO', 'CREDITO_IMPOSTA', 'MISTO');

-- CreateEnum
CREATE TYPE "TipoValoreMisura" AS ENUM ('IMPORTO_FISSO', 'RANGE', 'PERCENTUALE');

-- CreateEnum
CREATE TYPE "StatoPratica" AS ENUM ('CANDIDATA', 'AMMESSA', 'RESPINTA', 'CONTRATTO_ATTIVO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fonte" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "livello" "LivelloFonte" NOT NULL,
    "regione" TEXT,
    "url" TEXT NOT NULL,
    "parserKey" TEXT NOT NULL,
    "attiva" BOOLEAN NOT NULL DEFAULT true,
    "frequenzaOreScan" INTEGER NOT NULL DEFAULT 24,
    "ultimaScansioneAt" TIMESTAMP(3),
    "ultimoEsitoScan" "EsitoScan",
    "ultimoHashContenuto" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fonte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanLog" (
    "id" TEXT NOT NULL,
    "fonteId" TEXT NOT NULL,
    "avviatoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completatoAt" TIMESTAMP(3),
    "esito" "EsitoScan" NOT NULL,
    "misureNuove" INTEGER NOT NULL DEFAULT 0,
    "misureAggiornate" INTEGER NOT NULL DEFAULT 0,
    "messaggioErrore" TEXT,

    CONSTRAINT "ScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Misura" (
    "id" TEXT NOT NULL,
    "titolo" TEXT NOT NULL,
    "ente" TEXT NOT NULL,
    "categoria" "CategoriaMisura" NOT NULL,
    "descrizioneBreve" TEXT NOT NULL,
    "descrizioneEstesa" TEXT NOT NULL,
    "tipoAgevolazione" "TipoAgevolazione" NOT NULL,
    "tipoValore" "TipoValoreMisura" NOT NULL,
    "importoFisso" DECIMAL(14,2),
    "importoMin" DECIMAL(14,2),
    "importoMax" DECIMAL(14,2),
    "percentuale" DECIMAL(5,2),
    "tettoMassimo" DECIMAL(14,2),
    "dataApertura" TIMESTAMP(3) NOT NULL,
    "dataScadenza" TIMESTAMP(3) NOT NULL,
    "atecoAmmessi" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "atecoEsclusi" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "regioniAmmesse" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fatturatoMin" DECIMAL(14,2),
    "fatturatoMax" DECIMAL(14,2),
    "dipendentiMin" INTEGER,
    "dipendentiMax" INTEGER,
    "altriRequisiti" TEXT,
    "documentiRichiesti" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linkFonteUfficiale" TEXT NOT NULL,
    "noteInterne" TEXT,
    "rilevataAutomaticamente" BOOLEAN NOT NULL DEFAULT false,
    "fonteId" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Misura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "ragioneSociale" TEXT NOT NULL,
    "piva" TEXT NOT NULL,
    "ateco" TEXT,
    "regione" TEXT,
    "provincia" TEXT,
    "fatturato" DECIMAL(14,2),
    "numeroDipendenti" INTEGER,
    "email" TEXT,
    "telefono" TEXT,
    "fonteImport" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectMisuraMatch" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "misuraId" TEXT NOT NULL,
    "calcolatoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criteriEsito" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "statoPratica" "StatoPratica" NOT NULL DEFAULT 'CANDIDATA',

    CONSTRAINT "ProspectMisuraMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Cumulabilita" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Fonte_parserKey_key" ON "Fonte"("parserKey");

-- CreateIndex
CREATE INDEX "ScanLog_fonteId_avviatoAt_idx" ON "ScanLog"("fonteId", "avviatoAt");

-- CreateIndex
CREATE INDEX "Misura_categoria_idx" ON "Misura"("categoria");

-- CreateIndex
CREATE INDEX "Misura_dataScadenza_idx" ON "Misura"("dataScadenza");

-- CreateIndex
CREATE INDEX "Misura_dataApertura_idx" ON "Misura"("dataApertura");

-- CreateIndex
CREATE UNIQUE INDEX "Misura_fonteId_externalId_key" ON "Misura"("fonteId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_piva_key" ON "Prospect"("piva");

-- CreateIndex
CREATE INDEX "Prospect_regione_idx" ON "Prospect"("regione");

-- CreateIndex
CREATE INDEX "Prospect_ateco_idx" ON "Prospect"("ateco");

-- CreateIndex
CREATE INDEX "ProspectMisuraMatch_misuraId_idx" ON "ProspectMisuraMatch"("misuraId");

-- CreateIndex
CREATE INDEX "ProspectMisuraMatch_prospectId_idx" ON "ProspectMisuraMatch"("prospectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectMisuraMatch_prospectId_misuraId_key" ON "ProspectMisuraMatch"("prospectId", "misuraId");

-- CreateIndex
CREATE UNIQUE INDEX "_Cumulabilita_AB_unique" ON "_Cumulabilita"("A", "B");

-- CreateIndex
CREATE INDEX "_Cumulabilita_B_index" ON "_Cumulabilita"("B");

-- AddForeignKey
ALTER TABLE "ScanLog" ADD CONSTRAINT "ScanLog_fonteId_fkey" FOREIGN KEY ("fonteId") REFERENCES "Fonte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Misura" ADD CONSTRAINT "Misura_fonteId_fkey" FOREIGN KEY ("fonteId") REFERENCES "Fonte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectMisuraMatch" ADD CONSTRAINT "ProspectMisuraMatch_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectMisuraMatch" ADD CONSTRAINT "ProspectMisuraMatch_misuraId_fkey" FOREIGN KEY ("misuraId") REFERENCES "Misura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Cumulabilita" ADD CONSTRAINT "_Cumulabilita_A_fkey" FOREIGN KEY ("A") REFERENCES "Misura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Cumulabilita" ADD CONSTRAINT "_Cumulabilita_B_fkey" FOREIGN KEY ("B") REFERENCES "Misura"("id") ON DELETE CASCADE ON UPDATE CASCADE;
