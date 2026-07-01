const prisma = require('../db')

const EXAMES_MEDICOS_VALIDOS = ['APTO', 'NAO_APTO', 'AGUARDANDO']

const criar = async (req, res) => {
  const { usuarioId, turmaId, exameMedico } = req.body

  if (!usuarioId) {
    return res.status(400).json({ erro: 'O campo "usuarioId" é obrigatório' })
  }

  if (!turmaId) {
    return res.status(400).json({ erro: 'O campo "turmaId" é obrigatório' })
  }

  if (exameMedico && !EXAMES_MEDICOS_VALIDOS.includes(exameMedico)) {
    return res.status(400).json({
      erro: 'O campo "exameMedico" deve ser um de: APTO, NAO_APTO, AGUARDANDO'
    })
  }

  try {
    const matricula = await prisma.matricula.create({
      data: {
        usuarioId,
        turmaId: Number(turmaId),
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
  const { ativa, exameMedico, turmaId } = req.body

  if (exameMedico && !EXAMES_MEDICOS_VALIDOS.includes(exameMedico)) {
    return res.status(400).json({
      erro: 'O campo "exameMedico" deve ser um de: APTO, NAO_APTO, AGUARDANDO'
    })
  }

  try {
    if (turmaId) {
      const matriculaAtual = await prisma.matricula.findUnique({
        where: { id: Number(id) },
        select: { turma: { select: { projetoId: true } } }
      })

      if (!matriculaAtual) {
        return res.status(404).json({ erro: 'Matrícula não encontrada' })
      }

      const turmaNova = await prisma.turma.findUnique({
        where: { id: Number(turmaId) },
        select: { projetoId: true }
      })

      if (!turmaNova) {
        return res.status(404).json({ erro: 'Turma não encontrada' })
      }

      if (turmaNova.projetoId !== matriculaAtual.turma.projetoId) {
        return res.status(400).json({ erro: 'A nova turma deve ser do mesmo projeto' })
      }
    }

    const matricula = await prisma.matricula.update({
      where: { id: Number(id) },
      data: {
        ...(ativa !== undefined ? { ativa } : {}),
        ...(exameMedico ? { exameMedico } : {}),
        ...(turmaId ? { turmaId: Number(turmaId) } : {})
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
