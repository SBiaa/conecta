-- AlterTable
ALTER TABLE "Pagamento" ADD COLUMN     "editadoEm" TIMESTAMP(3),
ADD COLUMN     "editadoPorId" TEXT;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_editadoPorId_fkey" FOREIGN KEY ("editadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
