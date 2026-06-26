/*
  Warnings:

  - You are about to drop the column `alunaId` on the `Pagamento` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Pagamento` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Turma` table. All the data in the column will be lost.
  - You are about to drop the `Aluna` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `matriculaId` to the `Pagamento` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projetoId` to the `Turma` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "Papel" ADD VALUE 'PROFESSOR';

-- DropForeignKey
ALTER TABLE "Aluna" DROP CONSTRAINT "Aluna_turmaId_fkey";

-- DropForeignKey
ALTER TABLE "Pagamento" DROP CONSTRAINT "Pagamento_alunaId_fkey";

-- AlterTable
ALTER TABLE "Pagamento" DROP COLUMN "alunaId",
DROP COLUMN "createdAt",
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "matriculaId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Turma" DROP COLUMN "createdAt",
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "projetoId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "email" DROP NOT NULL;

-- DropTable
DROP TABLE "Aluna";

-- CreateTable
CREATE TABLE "Projeto" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Projeto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matricula" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "dataInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Matricula_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Turma" ADD CONSTRAINT "Turma_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
