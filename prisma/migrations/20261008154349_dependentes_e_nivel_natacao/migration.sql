-- CreateEnum
CREATE TYPE "NivelNatacao" AS ENUM ('ADAPTACAO', 'INICIANTE', 'INTERMEDIARIO', 'AVANCADO');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "responsavelId" TEXT,
ALTER COLUMN "senha" DROP NOT NULL,
ALTER COLUMN "cpf" DROP NOT NULL;

-- CreateTable
CREATE TABLE "NivelNatacaoRegistro" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "nivel" "NivelNatacao" NOT NULL,
    "observacao" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NivelNatacaoRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NivelNatacaoRegistro_usuarioId_data_idx" ON "NivelNatacaoRegistro"("usuarioId", "data");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NivelNatacaoRegistro" ADD CONSTRAINT "NivelNatacaoRegistro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NivelNatacaoRegistro" ADD CONSTRAINT "NivelNatacaoRegistro_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
