import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

function converterData(data: string | undefined) {
  if (!data) return null;

  const [dia, mes, ano] = data.split("/");

  return new Date(Number(ano), Number(mes) - 1, Number(dia));
}

async function importar() {
  console.log("🚀 Script iniciado");

  const workbook = XLSX.readFile("usuarios.csv");

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const usuarios = XLSX.utils.sheet_to_json<any>(sheet);

  console.log(`📄 ${usuarios.length} usuários encontrados.`);

  let importados = 0;
  let ignorados = 0;
  let erros = 0;

  for (const u of usuarios) {
    try {
      // Ignora linhas sem nome ou CPF
      if (!u.Nome || !u.CPF) {
        console.log("⚠️ Linha ignorada por falta de Nome ou CPF.");
        ignorados++;
        continue;
      }

      const cpf = String(u.CPF).replace(/\D/g, "");
      const telefone = u.Celular
        ? String(u.Celular).replace(/\D/g, "")
        : null;

      // Verifica se já existe
      const existe = await prisma.usuario.findUnique({
        where: { cpf },
      });

      if (existe) {
        console.log(`⚠️ ${u.Nome} já existe.`);
        ignorados++;
        continue;
      }

      // Senha padrão: 123456
      const senhaHash = await bcrypt.hash("123456", 10);

      await prisma.usuario.create({
        data: {
          nome: u.Nome,
          cpf,
          senha: senhaHash,

          email: null,
          telefone,

          cep: null,
          logradouro: u["Endereço"] ?? null,
          numero: null,
          complemento: null,
          bairro: null,
          cidade: u.Cidade ?? null,
          uf: "SP",

          rg: u.RG ?? null,

          dataNascimento: converterData(u.Nascimento),

          tomaMedicamento: false,
          qualMedicamento: null,
        },
      });

      console.log(`✅ ${u.Nome} importado.`);
      importados++;
    } catch (erro: any) {
      console.error(`❌ Erro ao importar ${u.Nome}:`);
      console.error(erro.message);
      erros++;
    }
  }

  console.log("\n==========================");
  console.log("🎉 IMPORTAÇÃO FINALIZADA");
  console.log("==========================");
  console.log(`✅ Importados: ${importados}`);
  console.log(`⚠️ Ignorados: ${ignorados}`);
  console.log(`❌ Erros: ${erros}`);

  await prisma.$disconnect();
}

importar().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});