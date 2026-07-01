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
  const { ativa } = req.body

  try {
    const matricula = await prisma.matricula.update({
      where: { id: Number(id) },
      data: { ativa }
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
