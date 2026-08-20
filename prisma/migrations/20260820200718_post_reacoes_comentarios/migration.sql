-- CreateEnum
CREATE TYPE "TipoReacao" AS ENUM ('CURTIR', 'AMEI', 'FORCA', 'PARABENS');

-- CreateTable
CREATE TABLE "Reacao" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoReacao" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comentario" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "autorId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comentario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reacao_postId_idx" ON "Reacao"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Reacao_postId_usuarioId_key" ON "Reacao"("postId", "usuarioId");

-- CreateIndex
CREATE INDEX "Comentario_postId_criadoEm_idx" ON "Comentario"("postId", "criadoEm");

-- AddForeignKey
ALTER TABLE "Reacao" ADD CONSTRAINT "Reacao_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reacao" ADD CONSTRAINT "Reacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
