-- CreateTable
CREATE TABLE "MatriculaTurma" (
    "id" SERIAL NOT NULL,
    "matriculaId" INTEGER NOT NULL,
    "turmaId" INTEGER NOT NULL,
    "dias" "DiaSemana"[],

    CONSTRAINT "MatriculaTurma_pkey" PRIMARY KEY ("id")
);

-- Backfill: each existing Matricula<->Turma link becomes "attends every day
-- that turma runs" (same behavior as before this change).
INSERT INTO "MatriculaTurma" ("matriculaId", "turmaId", "dias")
SELECT jt."A", jt."B", t."dias"
FROM "_MatriculaToTurma" jt
JOIN "Turma" t ON t."id" = jt."B";

-- DropForeignKey
ALTER TABLE "_MatriculaToTurma" DROP CONSTRAINT "_MatriculaToTurma_A_fkey";

-- DropForeignKey
ALTER TABLE "_MatriculaToTurma" DROP CONSTRAINT "_MatriculaToTurma_B_fkey";

-- DropTable
DROP TABLE "_MatriculaToTurma";

-- CreateIndex
CREATE UNIQUE INDEX "MatriculaTurma_matriculaId_turmaId_key" ON "MatriculaTurma"("matriculaId", "turmaId");

-- AddForeignKey
ALTER TABLE "MatriculaTurma" ADD CONSTRAINT "MatriculaTurma_matriculaId_fkey" FOREIGN KEY ("matriculaId") REFERENCES "Matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatriculaTurma" ADD CONSTRAINT "MatriculaTurma_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
