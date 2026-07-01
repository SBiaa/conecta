const prisma = require('../db')

const listar = async (req, res) => {
  try {
    const projetos = await prisma.projeto.findMany({
      orderBy: { nome: 'asc' },
      include: {
        _count: { select: { turmas: true } }
      }
    })
    res.json(projetos)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const criar = async (req, res) => {
  const { nome } = req.body

  if (!nome || nome.trim() === '') {
    return res.status(400).json({ erro: 'O campo "nome" é obrigatório' })
  }

  try {
    const projeto = await prisma.projeto.create({
      data: { nome: nome.trim() }
    })
    res.status(201).json(projeto)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const atualizar = async (req, res) => {
  const { id } = req.params
  const { nome, ativo } = req.body

  try {
    const projeto = await prisma.projeto.update({
      where: { id: Number(id) },
      data: { nome, ativo }
    })
    res.json(projeto)
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Projeto não encontrado' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { listar, criar, atualizar }
