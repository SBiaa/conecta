const prisma = require('../db')
const { intervaloDoMes } = require('../utils/mes')

const listar = async (req, res) => {
  const { mes, categoriaId } = req.query

  const intervalo = mes ? intervaloDoMes(mes) : null
  if (mes && !intervalo) {
    return res.status(400).json({ erro: 'O parâmetro "mes" deve estar no formato AAAA-MM' })
  }

  try {
    const despesas = await prisma.despesa.findMany({
      where: {
        ...(intervalo ? { data: { gte: intervalo.inicio, lt: intervalo.fim } } : {}),
        ...(categoriaId ? { categoriaId: Number(categoriaId) } : {})
      },
      orderBy: { data: 'desc' },
      select: {
        id: true,
        descricao: true,
        valor: true,
        data: true,
        categoria: { select: { id: true, nome: true } }
      }
    })
    res.json(despesas)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const criar = async (req, res) => {
  const { descricao, categoriaId, valor, data } = req.body

  if (!descricao || descricao.trim() === '') {
    return res.status(400).json({ erro: 'O campo "descricao" é obrigatório' })
  }

  if (!categoriaId) {
    return res.status(400).json({ erro: 'O campo "categoriaId" é obrigatório' })
  }

  if (valor === undefined || valor === null || isNaN(Number(valor)) || Number(valor) < 0) {
    return res.status(400).json({ erro: 'O campo "valor" é obrigatório e não pode ser negativo' })
  }

  if (!data) {
    return res.status(400).json({ erro: 'O campo "data" é obrigatório' })
  }

  const dataDespesa = new Date(data)
  if (isNaN(dataDespesa.getTime())) {
    return res.status(400).json({ erro: 'data inválida. Use o formato AAAA-MM-DD' })
  }

  try {
    const categoria = await prisma.categoriaDespesa.findUnique({ where: { id: Number(categoriaId) } })
    if (!categoria) {
      return res.status(404).json({ erro: 'Categoria não encontrada' })
    }

    const despesa = await prisma.despesa.create({
      data: {
        descricao: descricao.trim(),
        categoriaId: Number(categoriaId),
        valor: Number(valor),
        data: dataDespesa
      },
      select: {
        id: true,
        descricao: true,
        valor: true,
        data: true,
        categoria: { select: { id: true, nome: true } }
      }
    })
    res.status(201).json(despesa)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const atualizar = async (req, res) => {
  const { id } = req.params
  const { descricao, categoriaId, valor, data } = req.body

  if (descricao !== undefined && descricao.trim() === '') {
    return res.status(400).json({ erro: 'O campo "descricao" não pode ficar vazio' })
  }

  if (valor !== undefined && (isNaN(Number(valor)) || Number(valor) < 0)) {
    return res.status(400).json({ erro: 'O campo "valor" não pode ser negativo' })
  }

  let dataDespesa
  if (data !== undefined) {
    dataDespesa = new Date(data)
    if (isNaN(dataDespesa.getTime())) {
      return res.status(400).json({ erro: 'data inválida. Use o formato AAAA-MM-DD' })
    }
  }

  try {
    const despesa = await prisma.despesa.update({
      where: { id: Number(id) },
      data: {
        ...(descricao !== undefined ? { descricao: descricao.trim() } : {}),
        ...(categoriaId !== undefined ? { categoriaId: Number(categoriaId) } : {}),
        ...(valor !== undefined ? { valor: Number(valor) } : {}),
        ...(dataDespesa ? { data: dataDespesa } : {})
      },
      select: {
        id: true,
        descricao: true,
        valor: true,
        data: true,
        categoria: { select: { id: true, nome: true } }
      }
    })
    res.json(despesa)
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Gasto não encontrado' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const apagar = async (req, res) => {
  const { id } = req.params

  try {
    await prisma.despesa.delete({ where: { id: Number(id) } })
    res.status(200).json({ ok: true })
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Gasto não encontrado' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { listar, criar, atualizar, apagar }
