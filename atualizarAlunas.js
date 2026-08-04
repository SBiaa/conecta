require('dotenv').config()
const path = require('path')
const XLSX = require('xlsx')
const prisma = require('./db')

const CSV_PATH = process.env.ALUNAS_CSV || 'D:/ALUNAS-ATIVAS.csv'
const APLICAR = process.argv.includes('--apply')

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
  console.log(`🚀 ${APLICAR ? 'APLICANDO alterações' : 'SIMULAÇÃO (dry-run)'} — lendo ${CSV_PATH}`)

  const workbook = XLSX.readFile(CSV_PATH)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const linhas = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  console.log(`📄 ${linhas.length} linhas encontradas.\n`)

  let atualizados = 0
  let naoEncontrados = 0
  let ignorados = 0
  let erros = 0
  const naoEncontradosDetalhe = []

  for (const linha of linhas) {
    const nome = vazio(linha['Nome'])
    const cpfBruto = linha['CPF']
    const cpf = limparDigitos(cpfBruto)

    if (!nome || !cpf) {
      ignorados++
      continue
    }

    try {
      const existente = await prisma.usuario.findUnique({ where: { cpf } })

      if (!existente) {
        naoEncontrados++
        naoEncontradosDetalhe.push(`${nome} (CPF ${cpfBruto})`)
        continue
      }

      const dados = {
        nome,
        rg: vazio(linha['RG']),
        dataNascimento: converterData(linha['Nascimento']),
        cidade: vazio(linha['Cidade']),
        bairro: vazio(linha['Bairro']),
        telefone: limparDigitos(linha['Celular']),
        logradouro: vazio(linha['Endereço']),
        qualMedicamento: vazio(linha['Med. controlado']),
        tomaMedicamento: paraBoolean(linha['Medicamento controlado?']),
      }

      if (APLICAR) {
        await prisma.usuario.update({ where: { cpf }, data: dados })
        console.log(`✅ ${nome} atualizado.`)
      } else {
        console.log(`🔎 ${nome} (CPF ${cpfBruto}) seria atualizado com:`, dados)
      }
      atualizados++
    } catch (erro) {
      console.error(`❌ Erro em ${nome} (CPF ${cpfBruto}): ${erro.message}`)
      erros++
    }
  }

  console.log('\n==========================')
  console.log(APLICAR ? '🎉 ATUALIZAÇÃO FINALIZADA' : '🎉 SIMULAÇÃO FINALIZADA (nada foi gravado)')
  console.log('==========================')
  console.log(`✅ ${APLICAR ? 'Atualizados' : 'Seriam atualizados'}: ${atualizados}`)
  console.log(`⚠️  Não encontrados no banco (CPF não bate com nenhuma cadastrada): ${naoEncontrados}`)
  console.log(`⚠️  Ignorados (sem Nome ou CPF na planilha): ${ignorados}`)
  console.log(`❌ Erros: ${erros}`)

  if (naoEncontradosDetalhe.length) {
    console.log('\nAlunas da planilha que NÃO foram encontradas no banco pelo CPF:')
    naoEncontradosDetalhe.forEach((l) => console.log(`  - ${l}`))
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
