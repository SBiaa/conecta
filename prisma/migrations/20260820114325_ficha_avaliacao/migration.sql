-- AlterTable
ALTER TABLE "RegistroSaude" ADD COLUMN     "gorduraVisceral" INTEGER,
ADD COLUMN     "massaMuscular" DECIMAL(5,2),
ADD COLUMN     "massaOssea" DECIMAL(4,2),
ADD COLUMN     "percentualAgua" DECIMAL(4,1),
ADD COLUMN     "percentualGordura" DECIMAL(4,1),
ADD COLUMN     "taxaMetabolica" INTEGER;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "alturaCm" INTEGER;

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "registradoPorId" TEXT NOT NULL,
    "cintura" DECIMAL(5,1),
    "quadril" DECIMAL(5,1),
    "braco" DECIMAL(5,1),
    "coxa" DECIMAL(5,1),
    "panturrilha" DECIMAL(5,1),
    "torax" DECIMAL(5,1),
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Avaliacao_usuarioId_data_idx" ON "Avaliacao"("usuarioId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Avaliacao_usuarioId_data_key" ON "Avaliacao"("usuarioId", "data");

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

