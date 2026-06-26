-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'PIX', 'CARTAO');

-- AlterTable
ALTER TABLE "Pagamento" ADD COLUMN     "formaPagamento" "FormaPagamento";
