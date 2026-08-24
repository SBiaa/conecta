-- AlterTable
ALTER TABLE "RegistroSaude" ADD COLUMN     "registradoPorId" TEXT;

-- AddForeignKey
ALTER TABLE "RegistroSaude" ADD CONSTRAINT "RegistroSaude_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
