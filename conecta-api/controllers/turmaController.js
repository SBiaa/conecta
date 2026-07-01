const prisma = require('../db')

const listar = async (req, res) => {
  const { projetoId } = req.query

  try {
    const turmas = await prisma.turma.findMany({
      where: projetoId ? { projetoId: Number(projetoId) } : undefined,
      orderBy: { nome: 'asc' },
      include: {
        projeto: { select: { nome: true } },
        _count: { select: { matriculas: true } }
      }
    })
    res.json(turmas)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const criar = async (req, res) => {
  const { nome, projetoId } = req.body

  if (!nome || nome.trim() === '') {
    return res.status(400).json({ erro: 'O campo "nome" é obrigatório' })
  }

  if (!projetoId) {
    return res.status(400).json({ erro: 'O campo "projetoId" é obrigatório' })
  }

  try {
    const turma = await prisma.turma.create({
      data: { nome: nome.trim(), projetoId: Number(projetoId) }
    })
    res.status(201).json(turma)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const atualizar = async (req, res) => {
  const { id } = req.params
  const { nome } = req.body

  try {
    const turma = await prisma.turma.update({
      where: { id: Number(id) },
      data: { nome }
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

const matriculasDaTurma = async (req, res) => {
  const { id } = req.params
  const { mes } = req.query

  if (!mes) {
    return res.status(400).json({ erro: 'Informe o mês. Ex: ?mes=2026-06' })
  }

  try {
    const matriculas = await prisma.matricula.findMany({
      where: {
        turmaId: Number(id),
        ativa: true
      },
      orderBy: { usuario: { nome: 'asc' } },
      select: {
        id: true,
        usuario: { select: { nome: true } },
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
    })

    const resultado = matriculas.map((matricula) => ({
      id: matricula.id,
      usuario: matricula.usuario,
      pagamento: matricula.pagamentos[0] || null
    }))

    res.json(resultado)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { listar, criar, atualizar, matriculasDaTurma }
