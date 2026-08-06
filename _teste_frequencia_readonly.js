require('dotenv').config()
const prisma = require('./db')

async function main() {
  const matricula = await prisma.matricula.findFirst({
    where: { ativa: true, usuario: { papel: 'ASSOCIADO' } },
    select: { id: true, usuarioId: true }
  })

  if (!matricula) {
    console.log('Nenhuma matrícula ativa de ASSOCIADO encontrada.')
    return
  }

  const usuarioId = matricula.usuarioId
  console.log('Testando com usuarioId:', usuarioId)

  const matriculas = await prisma.matricula.findMany({
    where: { usuarioId, ativa: true },
    select: {
      id: true,
      turmasVinculadas: {
        select: {
          turma: { select: { id: true, nome: true, projeto: { select: { nome: true } } } }
        }
      }
    }
  })

  const matriculaIds = matriculas.map((m) => m.id)

  const presencas = await prisma.presenca.findMany({
    where: { matriculaId: { in: matriculaIds } },
    select: { matriculaId: true, turmaId: true, data: true, presente: true },
    orderBy: { data: 'desc' }
  })

  const turmas = matriculas.flatMap((matricula) =>
    matricula.turmasVinculadas.map(({ turma }) => {
      const registros = presencas
        .filter((p) => p.matriculaId === matricula.id && p.turmaId === turma.id)
        .map((p) => ({ data: p.data.toISOString().slice(0, 10), presente: p.presente }))

      const faltas = registros.filter((r) => !r.presente).length
      const totalRegistros = registros.length

      return {
        turmaId: turma.id,
        nome: turma.nome,
        projeto: turma.projeto.nome,
        totalRegistros,
        faltas,
        percentualPresenca:
          totalRegistros > 0 ? Math.round(((totalRegistros - faltas) / totalRegistros) * 100) : null,
        registros
      }
    })
  )

  console.log(JSON.stringify(turmas, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
