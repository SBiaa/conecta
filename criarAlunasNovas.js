require('dotenv').config()
const XLSX = require('xlsx')
const bcrypt = require('bcryptjs')
const prisma = require('./db')

const CSV_PATH = process.env.ALUNAS_CSV || 'D:/ALUNAS-ATIVAS.csv'
const APLICAR = process.argv.includes('--apply')
const SENHA_PADRAO = '123456'

function converterData(data) {
  if (!data) return null
  const partes = String(data).split('/')
  if (partes.length !== 3) return null
  const [dia, mes, ano] = partes
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia))
  return isNaN(d.getTime()) ? null : d
}

function limparDigitos(valor) {
  return valor ? String(valor).replace(/\D/g, '') : null
}

function paraBoolean(valor) {
  if (!valor) return false
  const v = String(valor).trim().toLowerCase()
  return v === 'sim' || v === 's' || v === 'true'
}

function vazio(valor) {
  const v = valor === undefined || valor === null ? '' : String(valor).trim()
  return v === '' ? null : v
}

async function main() {
  console.log(`🚀 ${APLICAR ? 'APLICANDO criação' : 'SIMULAÇÃO (dry-run)'} — lendo ${CSV_PATH}`)

  const workbook = XLSX.readFile(CSV_PATH)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const linhas = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  console.log(`📄 ${linhas.length} linhas encontradas.\n`)

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10)
  const cpfsVistos = new Set()

  let criados = 0
  let jaExistiam = 0
  let ignorados = 0
  let duplicadosNaPlanilha = 0
  let erros = 0

  for (const linha of linhas) {
    const nome = vazio(linha['Nome'])
    const cpfBruto = linha['CPF']
    const cpf = limparDigitos(cpfBruto)

    if (!nome || !cpf || cpf.length !== 11) {
      if (nome || cpfBruto) {
        console.log(`⚠️ Linha ignorada (Nome/CPF ausente ou CPF inválido): ${nome ?? '?'} / ${cpfBruto ?? '?'}`)
      }
      ignorados++
      continue
    }

    if (cpfsVistos.has(cpf)) {
      console.log(`⚠️ CPF duplicado dentro da própria planilha, pulando: ${nome} (${cpfBruto})`)
      duplicadosNaPlanilha++
      continue
    }
    cpfsVistos.add(cpf)

    try {
      const existente = await prisma.usuario.findUnique({ where: { cpf } })
      if (existente) {
        jaExistiam++
        continue
      }

      const dados = {
        nome,
        cpf,
        senha: senhaHash,
        email: null,
        telefone: limparDigitos(linha['Celular']),
        cep: null,
        logradouro: vazio(linha['Endereço']),
        numero: null,
        complemento: null,
        bairro: vazio(linha['Bairro']),
        cidade: vazio(linha['Cidade']),
        uf: 'SP',
        rg: vazio(linha['RG']),
        dataNascimento: converterData(linha['Nascimento']),
        tomaMedicamento: paraBoolean(linha['Medicamento controlado?']),
        qualMedicamento: vazio(linha['Med. controlado']),
      }

      if (APLICAR) {
        await prisma.usuario.create({ data: dados })
        console.log(`✅ ${nome} criada.`)
      } else {
        console.log(`🔎 ${nome} (CPF ${cpfBruto}) seria criada com:`, dados)
      }
      criados++
    } catch (erro) {
      console.error(`❌ Erro em ${nome} (CPF ${cpfBruto}): ${erro.message}`)
      erros++
    }
  }

  console.log('\n==========================')
  console.log(APLICAR ? '🎉 CRIAÇÃO FINALIZADA' : '🎉 SIMULAÇÃO FINALIZADA (nada foi gravado)')
  console.log('==========================')
  console.log(`✅ ${APLICAR ? 'Criados' : 'Seriam criados'}: ${criados}`)
  console.log(`ℹ️  Já existiam (achados agora, ignorados): ${jaExistiam}`)
  console.log(`⚠️  Ignorados (Nome/CPF ausente ou CPF inválido): ${ignorados}`)
  console.log(`⚠️  Duplicados dentro da planilha: ${duplicadosNaPlanilha}`)
  console.log(`❌ Erros: ${erros}`)
  if (APLICAR && criados > 0) {
    console.log(`\n🔑 Senha padrão definida para todas as novas contas: ${SENHA_PADRAO}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
