-- CreateEnum
CREATE TYPE "ExameMedico" AS ENUM ('APTO', 'NAO_APTO', 'AGUARDANDO');

-- AlterTable
ALTER TABLE "Matricula" ADD COLUMN     "exameMedico" "ExameMedico" NOT NULL DEFAULT 'AGUARDANDO';

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "dataNascimento" TIMESTAMP(3),
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "qualMedicamento" TEXT,
ADD COLUMN     "rg" TEXT,
ADD COLUMN     "tomaMedicamento" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "uf" TEXT;
