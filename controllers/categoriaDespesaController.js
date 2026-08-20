const prisma = require('../db')

const listar = async (req, res) => {
  const { ativa } = req.query

  try {
    const categorias = await prisma.categoriaDespesa.findMany({
      where: {
        ...(ativa === 'true' ? { ativa: true } : {}),
        ...(ativa === 'false' ? { ativa: false } : {})
      },
      orderBy: { nome: 'asc' }
    })
    res.json(categorias)
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
    const categoria = await prisma.categoriaDespesa.create({
      data: { nome: nome.trim() }
    })
    res.status(201).json(categoria)
  } catch (erro) {
    if (erro.code === 'P2002') {
      return res.status(400).json({ erro: 'Já existe uma categoria com esse nome' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const atualizar = async (req, res) => {
  const { id } = req.params
  const { nome, ativa } = req.body

  if (nome !== undefined && nome.trim() === '') {
    return res.status(400).json({ erro: 'O campo "nome" não pode ficar vazio' })
  }

  try {
    const categoria = await prisma.categoriaDespesa.update({
      where: { id: Number(id) },
      data: {
        ...(nome !== undefined ? { nome: nome.trim() } : {}),
        ...(ativa !== undefined ? { ativa } : {})
      }
    })
    res.json(categoria)
  } catch (erro) {
    if (erro.code === 'P2002') {
      return res.status(400).json({ erro: 'Já existe uma categoria com esse nome' })
    }
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Categoria não encontrada' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const apagar = async (req, res) => {
  const { id } = req.params

  try {
    const categoria = await prisma.categoriaDespesa.findUnique({
      where: { id: Number(id) },
      include: { despesas: { select: { id: true } } }
    })

    if (!categoria) {
      return res.status(404).json({ erro: 'Categoria não encontrada' })
    }

    if (categoria.despesas.length > 0) {
      return res.status(409).json({
        erro: 'Não é possível excluir a categoria pois há gastos vinculados a ela. Desative-a.'
      })
    }

    await prisma.categoriaDespesa.delete({ where: { id: Number(id) } })
    res.status(200).json({ ok: true })
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Categoria não encontrada' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { listar, criar, atualizar, apagar }
