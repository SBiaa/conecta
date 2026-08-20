const prisma = require('../db')

const listar = async (req, res) => {
  const { ativo } = req.query

  try {
    const produtos = await prisma.produto.findMany({
      where: {
        ...(ativo === 'true' ? { ativo: true } : {}),
        ...(ativo === 'false' ? { ativo: false } : {})
      },
      orderBy: { nome: 'asc' }
    })
    res.json(produtos)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const criar = async (req, res) => {
  const { nome, preco, ativo } = req.body

  if (!nome || nome.trim() === '') {
    return res.status(400).json({ erro: 'O campo "nome" é obrigatório' })
  }

  if (preco === undefined || preco === null || Number(preco) < 0 || isNaN(Number(preco))) {
    return res.status(400).json({ erro: 'O campo "preco" é obrigatório e não pode ser negativo' })
  }

  try {
    const produto = await prisma.produto.create({
      data: {
        nome: nome.trim(),
        preco: Number(preco),
        ...(ativo !== undefined ? { ativo } : {})
      }
    })
    res.status(201).json(produto)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const atualizar = async (req, res) => {
  const { id } = req.params
  const { nome, preco, ativo } = req.body

  if (nome !== undefined && nome.trim() === '') {
    return res.status(400).json({ erro: 'O campo "nome" não pode ficar vazio' })
  }

  if (preco !== undefined && (Number(preco) < 0 || isNaN(Number(preco)))) {
    return res.status(400).json({ erro: 'O campo "preco" não pode ser negativo' })
  }

  try {
    const produto = await prisma.produto.update({
      where: { id: Number(id) },
      data: {
        ...(nome !== undefined ? { nome: nome.trim() } : {}),
        ...(preco !== undefined ? { preco: Number(preco) } : {}),
        ...(ativo !== undefined ? { ativo } : {})
      }
    })
    res.json(produto)
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Produto não encontrado' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const apagar = async (req, res) => {
  const { id } = req.params

  try {
    const produto = await prisma.produto.findUnique({
      where: { id: Number(id) },
      include: { vendas: { select: { id: true } } }
    })

    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' })
    }

    if (produto.vendas.length > 0) {
      return res.status(409).json({
        erro: 'Não é possível excluir o produto pois há vendas vinculadas a ele. Desative-o.'
      })
    }

    await prisma.produto.delete({ where: { id: Number(id) } })
    res.status(200).json({ ok: true })
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Produto não encontrado' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { listar, criar, atualizar, apagar }
