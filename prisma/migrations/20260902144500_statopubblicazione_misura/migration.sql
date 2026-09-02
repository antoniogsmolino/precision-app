-- CreateEnum
CREATE TYPE "StatoPubblicazioneMisura" AS ENUM ('DRAFT', 'AUTO_VERIFICATA', 'DA_VERIFICARE', 'PUBBLICATA', 'ARCHIVIATA');

-- AlterTable
ALTER TABLE "Misura" ADD COLUMN     "statoPubblicazione" "StatoPubblicazioneMisura" NOT NULL DEFAULT 'PUBBLICATA';

