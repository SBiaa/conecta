-- CreateEnum
CREATE TYPE "TipoPost" AS ENUM ('GERAL', 'PROJETO', 'TURMA');

-- CreateTable
CREATE TABLE "Post" (
    "id" SERIAL NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" "TipoPost" NOT NULL,
    "autorId" TEXT NOT NULL,
    "projetoId" INTEGER,
    "turmaId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_projetoId_fkey" FOREIGN KEY ("projetoId") REFERENCES "Projeto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_turmaId_fkey" FOREIGN KEY ("turmaId") REFERENCES "Turma"("id") ON DELETE SET NULL ON UPDATE CASCADE;
