const prisma = require('../db')

const minhasTurmas = async (req, res) => {
  const professorId = req.usuario.id

  try {
    const turmas = await prisma.turma.findMany({
      where: { professorId },
      orderBy: { nome: 'asc' },
      include: {
        projeto: { select: { nome: true } },
        matriculas: { where: { ativa: true }, select: { id: true } }
      }
    })

    const resultado = turmas.map(({ matriculas, ...turma }) => ({
      ...turma,
      totalAlunas: matriculas.length
    }))

    res.json(resultado)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

async function turmaDoProfessor(turmaId, req) {
  const turma = await prisma.turma.findUnique({ where: { id: turmaId } })
  if (!turma) return { erro: 404 }
  if (req.usuario.papel === 'PROFESSOR' && turma.professorId !== req.usuario.id) {
    return { erro: 403 }
  }
  return { turma }
}

const obterChamada = async (req, res) => {
  const turmaId = Number(req.params.turmaId)
  const { data } = req.query

  if (!data) {
    return res.status(400).json({ erro: 'O parâmetro "data" é obrigatório' })
  }

  const { turma, erro } = await turmaDoProfessor(turmaId, req)
  if (erro === 404) return res.status(404).json({ erro: 'Turma não encontrada' })
  if (erro === 403) return res.status(403).json({ erro: 'Acesso negado' })

  try {
    const matriculas = await prisma.matricula.findMany({
      where: { turmaId, ativa: true },
      orderBy: { usuario: { nome: 'asc' } },
      select: { id: true, usuario: { select: { id: true, nome: true } } }
    })

    const presencas = await prisma.presenca.findMany({
      where: { turmaId, data: new Date(data) }
    })

    const presencaPorMatricula = new Map(presencas.map((p) => [p.matriculaId, p.presente]))

    res.json({
      turma: { id: turma.id, nome: turma.nome },
      data,
      alunas: matriculas.map((m) => ({
        matriculaId: m.id,
        nome: m.usuario.nome,
        presente: presencaPorMatricula.has(m.id) ? presencaPorMatricula.get(m.id) : null
      }))
    })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const registrarChamada = async (req, res) => {
  const turmaId = Number(req.params.turmaId)
  const { data, presencas } = req.body

  if (!data || !Array.isArray(presencas)) {
    return res.status(400).json({ erro: 'Informe "data" e a lista de "presencas"' })
  }

  const { erro } = await turmaDoProfessor(turmaId, req)
  if (erro === 404) return res.status(404).json({ erro: 'Turma não encontrada' })
  if (erro === 403) return res.status(403).json({ erro: 'Acesso negado' })

  try {
    const dataChamada = new Date(data)

    await prisma.$transaction(
      presencas.map(({ matriculaId, presente }) =>
        prisma.presenca.upsert({
          where: { matriculaId_data: { matriculaId: Number(matriculaId), data: dataChamada } },
          create: {
            matriculaId: Number(matriculaId),
            turmaId,
            data: dataChamada,
            presente: Boolean(presente),
            registradoPorId: req.usuario.id
          },
          update: {
            presente: Boolean(presente),
            registradoPorId: req.usuario.id
          }
        })
      )
    )

    res.json({ ok: true })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const frequenciaTurma = async (req, res) => {
  const turmaId = Number(req.params.turmaId)

  const { turma, erro } = await turmaDoProfessor(turmaId, req)
  if (erro === 404) return res.status(404).json({ erro: 'Turma não encontrada' })
  if (erro === 403) return res.status(403).json({ erro: 'Acesso negado' })

  try {
    const matriculas = await prisma.matricula.findMany({
      where: { turmaId, ativa: true },
      orderBy: { usuario: { nome: 'asc' } },
      select: { id: true, usuario: { select: { nome: true } } }
    })

    const presencas = await prisma.presenca.findMany({
      where: { turmaId },
      select: { matriculaId: true, data: true, presente: true }
    })

    const datas = [...new Set(presencas.map((p) => p.data.toISOString().slice(0, 10)))]
      .sort()
      .reverse()

    const alunas = matriculas.map((m) => {
      const registros = presencas.filter((p) => p.matriculaId === m.id)
      const faltas = registros.filter((p) => !p.presente).length
      const totalRegistros = registros.length

      return {
        matriculaId: m.id,
        nome: m.usuario.nome,
        totalRegistros,
        faltas,
        percentualPresenca:
          totalRegistros > 0 ? Math.round(((totalRegistros - faltas) / totalRegistros) * 100) : null
      }
    })

    res.json({ turma: { id: turma.id, nome: turma.nome }, datas, alunas })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { minhasTurmas, obterChamada, registrarChamada, frequenciaTurma }
