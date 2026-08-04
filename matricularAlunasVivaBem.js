require('dotenv').config()
const XLSX = require('xlsx')
const prisma = require('./db')

const CSV_PATH = process.env.ALUNAS_CSV || 'D:/ALUNAS-ATIVAS.csv'
const APLICAR = process.argv.includes('--apply')
const PROJETO_ID = 1 // Viva Bem com Hidro
const TURMA_PLACEHOLDER_NOME = 'A definir'

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

function paraExameMedico(valor) {
  const v = String(valor || '').trim().toLowerCase()
  if (v === 'apto') return 'APTO'
  if (v === 'nao apto' || v === 'não apto') return 'NAO_APTO'
  return 'AGUARDANDO'
}

async function obterOuCriarTurmaPlaceholder() {
  const existente = await prisma.turma.findFirst({
    where: { projetoId: PROJETO_ID, nome: TURMA_PLACEHOLDER_NOME }
  })
  if (existente) return existente

  if (!APLICAR) {
    return { id: -1, nome: TURMA_PLACEHOLDER_NOME }
  }

  return prisma.turma.create({
    data: { nome: TURMA_PLACEHOLDER_NOME, projetoId: PROJETO_ID }
  })
}

async function main() {
  console.log(`🚀 ${APLICAR ? 'APLICANDO matrículas' : 'SIMULAÇÃO (dry-run)'} — lendo ${CSV_PATH}`)

  const workbook = XLSX.readFile(CSV_PATH)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const linhas = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  console.log(`📄 ${linhas.length} linhas encontradas.`)

  const turma = await obterOuCriarTurmaPlaceholder()
  console.log(`🏷️  Turma placeholder: "${turma.nome}" (id ${turma.id})\n`)

  let matriculados = 0
  let jaMatriculados = 0
  let naoEncontrados = 0
  let ignorados = 0
  let erros = 0

  for (const linha of linhas) {
    const nome = String(linha['Nome'] || '').trim()
    const cpfBruto = linha['CPF']
    const cpf = limparDigitos(cpfBruto)

    if (!nome || !cpf) {
      ignorados++
      continue
    }

    try {
      const usuario = await prisma.usuario.findUnique({ where: { cpf } })

      if (!usuario) {
        naoEncontrados++
        console.log(`⚠️ Não encontrada no banco (não foi importada): ${nome} (CPF ${cpfBruto})`)
        continue
      }

      const jaTemMatriculaNoProjeto = await prisma.matricula.findFirst({
        where: { usuarioId: usuario.id, turma: { projetoId: PROJETO_ID } }
      })

      if (jaTemMatriculaNoProjeto) {
        jaMatriculados++
        continue
      }

      const dados = {
        usuarioId: usuario.id,
        turmaId: turma.id,
        exameMedico: paraExameMedico(linha['Exame médico']),
        dataInicio: converterData(linha['data de inscrição']) || undefined,
      }

      if (APLICAR) {
        await prisma.matricula.create({ data: dados })
        console.log(`✅ ${nome} matriculada.`)
      } else {
        console.log(`🔎 ${nome} seria matriculada com:`, dados)
      }
      matriculados++
    } catch (erro) {
      console.error(`❌ Erro em ${nome} (CPF ${cpfBruto}): ${erro.message}`)
      erros++
    }
  }

  console.log('\n==========================')
  console.log(APLICAR ? '🎉 MATRÍCULA FINALIZADA' : '🎉 SIMULAÇÃO FINALIZADA (nada foi gravado)')
  console.log('==========================')
  console.log(`✅ ${APLICAR ? 'Matriculadas' : 'Seriam matriculadas'}: ${matriculados}`)
  console.log(`ℹ️  Já tinham matrícula neste projeto: ${jaMatriculados}`)
  console.log(`⚠️  Não encontradas no banco: ${naoEncontrados}`)
  console.log(`⚠️  Ignoradas (sem Nome ou CPF): ${ignorados}`)
  console.log(`❌ Erros: ${erros}`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
