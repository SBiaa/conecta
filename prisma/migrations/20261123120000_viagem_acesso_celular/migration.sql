-- AlterEnum
ALTER TYPE "Papel" ADD VALUE 'CONVIDADO';

-- AlterTable
ALTER TABLE "Viagem" ADD COLUMN "codigoAcesso" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Viagem_codigoAcesso_key" ON "Viagem"("codigoAcesso");

-- AlterTable
ALTER TABLE "ViagemParticipante" ADD COLUMN "celular" TEXT;
