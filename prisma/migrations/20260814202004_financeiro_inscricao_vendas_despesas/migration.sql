-- CreateEnum
CREATE TYPE "TipoPagamento" AS ENUM ('MENSALIDADE', 'INSCRICAO');

-- AlterTable: todo pagamento que existe hoje é mensalidade, então o DEFAULT
-- já serve de backfill — nenhum UPDATE extra é necessário.
ALTER TABLE "Pagamento" ADD COLUMN     "tipo" "TipoPagamento" NOT NULL DEFAULT 'MENSALIDADE';

-- AlterTable: quando a matrícula foi encerrada. Fica NULL nas matrículas antigas
-- porque essa informação nunca foi registrada (desativar era só um flip de "ativa",
-- sem data) — não há como reconstruir o histórico.
ALTER TABLE "Matricula" ADD COLUMN     "encerradaEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Produto" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venda" (
    "id" SERIAL NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valorUnitario" DECIMAL(10,2) NOT NULL,
    "valorTotal" DECIMAL(10,2) NOT NULL,
    "usuarioId" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaDespesa" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoriaDespesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Despesa" (
    "id" SERIAL NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Despesa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaDespesa_nome_key" ON "CategoriaDespesa"("nome");

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venda" ADD CONSTRAINT "Venda_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaDespesa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Categorias iniciais só pra tela não nascer vazia — a ONG edita/apaga como quiser.
INSERT INTO "CategoriaDespesa" ("nome") VALUES
  ('Aluguel'),
  ('Material'),
  ('Salário'),
  ('Manutenção'),
  ('Contas'),
  ('Outros');
