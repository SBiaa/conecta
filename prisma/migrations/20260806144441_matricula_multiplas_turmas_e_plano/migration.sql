-- CreateTable (join table for Matricula <-> Turma)
CREATE TABLE "_MatriculaToTurma" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- Backfill: link each matricula's current single turma into the join table
INSERT INTO "_MatriculaToTurma" ("A", "B")
SELECT "id", "turmaId" FROM "Matricula" WHERE "turmaId" IS NOT NULL;

-- AlterTable: add the plan field
ALTER TABLE "Matricula" ADD COLUMN     "frequenciaSemanal" INTEGER;

-- Backfill: derive frequenciaSemanal from the turma's number of dias, only
-- when it matches one of the known plans (2, 3 or 4). Matriculas whose turma
-- doesn't cleanly map (e.g. 1 or 5+ dias) are left NULL for manual review.
UPDATE "Matricula" m
SET "frequenciaSemanal" = sub.dias_count
FROM (
  SELECT "id", array_length("dias", 1) AS dias_count
  FROM "Turma"
) sub
WHERE m."turmaId" = sub."id"
  AND sub.dias_count IN (2, 3, 4);

-- DropForeignKey
ALTER TABLE "Matricula" DROP CONSTRAINT "Matricula_turmaId_fkey";

-- AlterTable: drop the old single-turma column now that data is preserved above
ALTER TABLE "Matricula" DROP COLUMN "turmaId";

-- CreateIndex
CREATE UNIQUE INDEX "_MatriculaToTurma_AB_unique" ON "_MatriculaToTurma"("A", "B");

-- CreateIndex
CREATE INDEX "_MatriculaToTurma_B_index" ON "_MatriculaToTurma"("B");

-- AddForeignKey
ALTER TABLE "_MatriculaToTurma" ADD CONSTRAINT "_MatriculaToTurma_A_fkey" FOREIGN KEY ("A") REFERENCES "Matricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MatriculaToTurma" ADD CONSTRAINT "_MatriculaToTurma_B_fkey" FOREIGN KEY ("B") REFERENCES "Turma"("id") ON DELETE CASCADE ON UPDATE CASCADE;
