-- AlterTable
ALTER TABLE "Projeto" ADD COLUMN     "taxaInscricao" DECIMAL(10,2) NOT NULL DEFAULT 15;

-- CreateTable
CREATE TABLE "PlanoProjeto" (
    "id" SERIAL NOT NULL,
    "projetoId" INTEGER NOT NULL,
    "aulasPorSemana" INTEGER NOT NULL,
    "valorMensal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "PlanoProjeto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanoProjeto_projetoId_aulasPorSemana_key" ON "PlanoProjeto"("projetoId", "aulasPorSemana");

-- AddForeignKey
ALTER TABLE "PlanoProjeto" ADD CONSTRAINT "PlanoProjeto_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Carrega os planos que antes eram fixos no código (2, 3 e 4 aulas por semana)
-- para todos os projetos existentes, exceto a Natação: ela tem uma aula por
-- semana e valor próprio, que a coordenação define na tela de valores.
INSERT INTO "PlanoProjeto" ("projetoId", "aulasPorSemana", "valorMensal")
SELECT p."id", v."aulas", v."valor"
FROM "Projeto" p
CROSS JOIN (VALUES (2, 85.00), (3, 120.00), (4, 160.00)) AS v("aulas", "valor")
WHERE p."nome" NOT ILIKE 'nata%';
