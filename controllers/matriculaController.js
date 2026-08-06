const prisma = require('../db')
const { PLANOS } = require('../config/planos')

const EXAMES_MEDICOS_VALIDOS = ['APTO', 'NAO_APTO', 'AGUARDANDO']
const FREQUENCIAS_VALIDAS = Object.keys(PLANOS).map(Number)

function validarTurmasEFrequencia(turmas, frequenciaSemanal) {
  if (!FREQUENCIAS_VALIDAS.includes(Number(frequenciaSemanal))) {
    return `O campo "frequenciaSemanal" deve ser um de: ${FREQUENCIAS_VALIDAS.join(', ')}`
  }

  if (turmas.length === 0) {
    return 'Nenhuma das turmas informadas foi encontrada'
  }

  const projetoIds = new Set(turmas.map((turma) => turma.projetoId))
  if (projetoIds.size > 1) {
    return 'Todas as turmas escolhidas devem ser do mesmo projeto'
  }

  const totalDias = turmas.reduce((soma, turma) => soma + turma.dias.length, 0)
  if (totalDias !== Number(frequenciaSemanal)) {
    return `A soma de dias das turmas escolhidas (${totalDias}) não bate com a frequência do plano (${frequenciaSemanal})`
  }

  return null
}

const criar = async (req, res) => {
  const { usuarioId, turmaIds, frequenciaSemanal, exameMedico } = req.body

  if (!usuarioId) {
    return res.status(400).json({ erro: 'O campo "usuarioId" é obrigatório' })
  }

  if (!Array.isArray(turmaIds) || turmaIds.length === 0) {
    return res.status(400).json({ erro: 'O campo "turmaIds" é obrigatório e deve ser uma lista com ao menos 1 turma' })
  }

  if (exameMedico && !EXAMES_MEDICOS_VALIDOS.includes(exameMedico)) {
    return res.status(400).json({
      erro: 'O campo "exameMedico" deve ser um de: APTO, NAO_APTO, AGUARDANDO'
    })
  }

  try {
    const turmas = await prisma.turma.findMany({
      where: { id: { in: turmaIds.map(Number) } },
      select: { id: true, projetoId: true, dias: true }
    })

    const erroValidacao = validarTurmasEFrequencia(turmas, frequenciaSemanal)
    if (erroValidacao) {
      return res.status(400).json({ erro: erroValidacao })
    }

    const matricula = await prisma.matricula.create({
      data: {
        usuarioId,
        frequenciaSemanal: Number(frequenciaSemanal),
        turmas: { connect: turmas.map((turma) => ({ id: turma.id })) },
        ...(exameMedico ? { exameMedico } : {})
      }
    })
    res.status(201).json(matricula)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const atualizar = async (req, res) => {
  const { id } = req.params
  const { ativa, exameMedico, turmaIds, frequenciaSemanal } = req.body

  if (exameMedico && !EXAMES_MEDICOS_VALIDOS.includes(exameMedico)) {
    return res.status(400).json({
      erro: 'O campo "exameMedico" deve ser um de: APTO, NAO_APTO, AGUARDANDO'
    })
  }

  const mudandoTurmas = turmaIds !== undefined || frequenciaSemanal !== undefined

  try {
    let turmas = null

    if (mudandoTurmas) {
      if (!Array.isArray(turmaIds) || turmaIds.length === 0) {
        return res.status(400).json({ erro: 'O campo "turmaIds" deve ser uma lista com ao menos 1 turma' })
      }

      const matriculaAtual = await prisma.matricula.findUnique({
        where: { id: Number(id) }
      })

      if (!matriculaAtual) {
        return res.status(404).json({ erro: 'Matrícula não encontrada' })
      }

      turmas = await prisma.turma.findMany({
        where: { id: { in: turmaIds.map(Number) } },
        select: { id: true, projetoId: true, dias: true }
      })

      const frequenciaFinal = frequenciaSemanal !== undefined
        ? frequenciaSemanal
        : matriculaAtual.frequenciaSemanal

      const erroValidacao = validarTurmasEFrequencia(turmas, frequenciaFinal)
      if (erroValidacao) {
        return res.status(400).json({ erro: erroValidacao })
      }
    }

    const matricula = await prisma.matricula.update({
      where: { id: Number(id) },
      data: {
        ...(ativa !== undefined ? { ativa } : {}),
        ...(exameMedico ? { exameMedico } : {}),
        ...(frequenciaSemanal !== undefined ? { frequenciaSemanal: Number(frequenciaSemanal) } : {}),
        ...(turmas ? { turmas: { set: turmas.map((turma) => ({ id: turma.id })) } } : {})
      }
    })
    res.json(matricula)
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Matrícula não encontrada' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { criar, atualizar }
