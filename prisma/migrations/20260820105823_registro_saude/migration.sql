-- CreateEnum
CREATE TYPE "LocalDor" AS ENUM ('JOELHO', 'LOMBAR', 'CERVICAL', 'OMBRO', 'QUADRIL', 'TORNOZELO', 'PUNHO', 'OUTRO');

-- CreateTable
CREATE TABLE "RegistroSaude" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "peso" DECIMAL(5,2),
    "nivelDor" INTEGER,
    "locaisDor" "LocalDor"[],
    "disposicao" INTEGER,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistroSaude_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistroSaude_usuarioId_data_idx" ON "RegistroSaude"("usuarioId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "RegistroSaude_usuarioId_data_key" ON "RegistroSaude"("usuarioId", "data");

-- AddForeignKey
ALTER TABLE "RegistroSaude" ADD CONSTRAINT "RegistroSaude_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

