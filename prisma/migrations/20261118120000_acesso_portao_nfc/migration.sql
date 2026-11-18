-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "tagNfc" TEXT;

-- CreateTable
CREATE TABLE "Dispositivo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoContato" TIMESTAMP(3),

    CONSTRAINT "Dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcessoPortao" (
    "id" SERIAL NOT NULL,
    "dispositivoId" INTEGER NOT NULL,
    "tagNfc" TEXT NOT NULL,
    "usuarioId" TEXT,
    "liberado" BOOLEAN NOT NULL,
    "motivo" TEXT NOT NULL,
    "offline" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcessoPortao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dispositivo_tokenHash_key" ON "Dispositivo"("tokenHash");

-- CreateIndex
CREATE INDEX "AcessoPortao_criadoEm_idx" ON "AcessoPortao"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_tagNfc_key" ON "Usuario"("tagNfc");

-- AddForeignKey
ALTER TABLE "AcessoPortao" ADD CONSTRAINT "AcessoPortao_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "Dispositivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcessoPortao" ADD CONSTRAINT "AcessoPortao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

