-- CreateEnum
CREATE TYPE "TipoMidia" AS ENUM ('FOTO', 'VIDEO');

-- CreateTable
CREATE TABLE "Viagem" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "destino" TEXT,
    "dataSaida" TIMESTAMP(3),
    "dataRetorno" TIMESTAMP(3),
    "localSaida" TEXT,
    "descricao" TEXT,
    "premio" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Viagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViagemParticipante" (
    "id" SERIAL NOT NULL,
    "viagemId" INTEGER NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "ViagemParticipante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViagemEvento" (
    "id" SERIAL NOT NULL,
    "viagemId" INTEGER NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "titulo" TEXT NOT NULL,
    "local" TEXT,
    "observacao" TEXT,

    CONSTRAINT "ViagemEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViagemAviso" (
    "id" SERIAL NOT NULL,
    "viagemId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "importante" BOOLEAN NOT NULL DEFAULT false,
    "autorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViagemAviso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViagemChecklistItem" (
    "id" SERIAL NOT NULL,
    "viagemId" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ViagemChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViagemChecklistMarcado" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "ViagemChecklistMarcado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViagemMidia" (
    "id" SERIAL NOT NULL,
    "viagemId" INTEGER NOT NULL,
    "autorId" TEXT NOT NULL,
    "tipo" "TipoMidia" NOT NULL,
    "url" TEXT NOT NULL,
    "legenda" TEXT,
    "nota" INTEGER,
    "avaliadaPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViagemMidia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ViagemParticipante_usuarioId_idx" ON "ViagemParticipante"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ViagemParticipante_viagemId_usuarioId_key" ON "ViagemParticipante"("viagemId", "usuarioId");

-- CreateIndex
CREATE INDEX "ViagemEvento_viagemId_inicio_idx" ON "ViagemEvento"("viagemId", "inicio");

-- CreateIndex
CREATE INDEX "ViagemAviso_viagemId_criadoEm_idx" ON "ViagemAviso"("viagemId", "criadoEm");

-- CreateIndex
CREATE INDEX "ViagemChecklistItem_viagemId_ordem_idx" ON "ViagemChecklistItem"("viagemId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "ViagemChecklistMarcado_itemId_usuarioId_key" ON "ViagemChecklistMarcado"("itemId", "usuarioId");

-- CreateIndex
CREATE INDEX "ViagemMidia_viagemId_criadoEm_idx" ON "ViagemMidia"("viagemId", "criadoEm");

-- CreateIndex
CREATE INDEX "ViagemMidia_viagemId_autorId_idx" ON "ViagemMidia"("viagemId", "autorId");

-- AddForeignKey
ALTER TABLE "ViagemParticipante" ADD CONSTRAINT "ViagemParticipante_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "Viagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViagemParticipante" ADD CONSTRAINT "ViagemParticipante_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViagemEvento" ADD CONSTRAINT "ViagemEvento_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "Viagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViagemAviso" ADD CONSTRAINT "ViagemAviso_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "Viagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViagemAviso" ADD CONSTRAINT "ViagemAviso_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViagemChecklistItem" ADD CONSTRAINT "ViagemChecklistItem_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "Viagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViagemChecklistMarcado" ADD CONSTRAINT "ViagemChecklistMarcado_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ViagemChecklistItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViagemChecklistMarcado" ADD CONSTRAINT "ViagemChecklistMarcado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViagemMidia" ADD CONSTRAINT "ViagemMidia_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "Viagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViagemMidia" ADD CONSTRAINT "ViagemMidia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViagemMidia" ADD CONSTRAINT "ViagemMidia_avaliadaPorId_fkey" FOREIGN KEY ("avaliadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

