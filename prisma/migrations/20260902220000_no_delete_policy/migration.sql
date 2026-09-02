-- AlterEnum
ALTER TYPE "TipoEventoBando" ADD VALUE 'ASSENTE_DA_FONTE';

-- AlterTable
ALTER TABLE "Misura" ADD COLUMN     "assenzeConsecutive" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultimoVistoInFonteAt" TIMESTAMP(3);

