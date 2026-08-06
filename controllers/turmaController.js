const prisma = require('../db')

const listar = async (req, res) => {
  const { projetoId, professorId } = req.query

  try {
    const turmas = await prisma.turma.findMany({
      where: {
        ...(projetoId ? { projetoId: Number(projetoId) } : {}),
        ...(professorId ? { professorId } : {})
      },
      orderBy: { nome: 'asc' },
      include: {
        projeto: { select: { nome: true } },
        professor: { select: { id: true, nome: true } },
        matriculaTurmas: { select: { matricula: { select: { ativa: true } } } }
      }
    })

    const resultado = turmas.map(({ matriculaTurmas, ...turma }) => ({
      ...turma,
      ativas: matriculaTurmas.filter((mt) => mt.matricula.ativa).length,
      inativas: matriculaTurmas.filter((mt) => !mt.matricula.ativa).length
    }))

    res.json(resultado)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const buscarPorId = async (req, res) => {
  const { id } = req.params

  try {
    const turma = await prisma.turma.findUnique({
      where: { id: Number(id) },
      include: {
        projeto: { select: { id: true, nome: true } },
        professor: { select: { id: true, nome: true } }
      }
    })

    if (!turma) {
      return res.status(404).json({ erro: 'Turma não encontrada' })
    }

    res.json(turma)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const criar = async (req, res) => {
  const { nome, projetoId, dias, horario, professorId } = req.body

  if (!nome || nome.trim() === '') {
    return res.status(400).json({ erro: 'O campo "nome" é obrigatório' })
  }

  if (!projetoId) {
    return res.status(400).json({ erro: 'O campo "projetoId" é obrigatório' })
  }

  try {
    const turma = await prisma.turma.create({
      data: {
        nome: nome.trim(),
        projetoId: Number(projetoId),
        dias: dias || [],
        horario,
        professorId: professorId || undefined
      }
    })
    res.status(201).json(turma)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const atualizar = async (req, res) => {
  const { id } = req.params
  const { nome, dias, horario, professorId, projetoId } = req.body

  try {
    const turma = await prisma.turma.update({
      where: { id: Number(id) },
      data: {
        nome,
        dias,
        horario,
        ...(projetoId !== undefined ? { projetoId: Number(projetoId) } : {}),
        ...(professorId !== undefined ? { professorId: professorId || null } : {})
      }
    })
    res.json(turma)
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Turma não encontrada' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const apagar = async (req, res) => {
  const { id } = req.params

  try {
    const turma = await prisma.turma.findUnique({
      where: { id: Number(id) },
      include: {
        matriculaTurmas: { select: { id: true } },
        presencas: { select: { id: true } }
      }
    })

    if (!turma) {
      return res.status(404).json({ erro: 'Turma não encontrada' })
    }

    if (turma.matriculaTurmas.length > 0 || turma.presencas.length > 0) {
      return res.status(409).json({
        erro: 'Não é possível excluir a turma pois há matrículas ou presenças vinculadas a ela'
      })
    }

    await prisma.turma.delete({ where: { id: Number(id) } })
    res.status(200).json({ ok: true })
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Turma não encontrada' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const matriculasDaTurma = async (req, res) => {
  const { id } = req.params
  const { mes, ativa } = req.query

  const where = {
    turmasVinculadas: { some: { turmaId: Number(id) } },
    ...(ativa === 'true' ? { ativa: true } : {})
  }

  try {
    const matriculas = await prisma.matricula.findMany({
      where,
      orderBy: { usuario: { nome: 'asc' } },
      select: {
        id: true,
        ativa: true,
        usuario: { select: { id: true, nome: true } },
        ...(mes
          ? {
              pagamentos: {
                where: { mesReferencia: mes },
                select: {
                  id: true,
                  valor: true,
                  status: true,
                  vencimento: true,
                  dataPagamento: true,
                  formaPagamento: true
                }
              }
            }
          : {})
      }
    })

    const resultado = matriculas.map((matricula) => ({
      id: matricula.id,
      ativa: matricula.ativa,
      usuario: matricula.usuario,
      ...(mes ? { pagamento: matricula.pagamentos[0] || null } : {})
    }))

    res.json(resultado)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, apagar, matriculasDaTurma }
