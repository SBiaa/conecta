-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO', 'DOMINGO');

-- AlterTable
ALTER TABLE "Turma" ADD COLUMN     "dias" "DiaSemana"[],
ADD COLUMN     "horario" TEXT;
