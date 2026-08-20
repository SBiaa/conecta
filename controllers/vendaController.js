const prisma = require('../db')
const { intervaloDoMes } = require('../utils/mes')

const FORMAS_PAGAMENTO_VALIDAS = ['DINHEIRO', 'PIX', 'CARTAO']

const listar = async (req, res) => {
  const { mes, usuarioId } = req.query

  const intervalo = mes ? intervaloDoMes(mes) : null
  if (mes && !intervalo) {
    return res.status(400).json({ erro: 'O parâmetro "mes" deve estar no formato AAAA-MM' })
  }

  try {
    const vendas = await prisma.venda.findMany({
      where: {
        ...(intervalo ? { data: { gte: intervalo.inicio, lt: intervalo.fim } } : {}),
        ...(usuarioId ? { usuarioId } : {})
      },
      orderBy: { data: 'desc' },
      select: {
        id: true,
        quantidade: true,
        valorUnitario: true,
        valorTotal: true,
        data: true,
        formaPagamento: true,
        produto: { select: { id: true, nome: true } },
        usuario: { select: { id: true, nome: true } }
      }
    })
    res.json(vendas)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const criar = async (req, res) => {
  const { produtoId, quantidade, valorUnitario, usuarioId, data, formaPagamento } = req.body

  if (!produtoId) {
    return res.status(400).json({ erro: 'O campo "produtoId" é obrigatório' })
  }

  const quantidadeNumero = Number(quantidade)
  if (!Number.isInteger(quantidadeNumero) || quantidadeNumero < 1) {
    return res.status(400).json({ erro: 'O campo "quantidade" deve ser um número inteiro maior que zero' })
  }

  if (!formaPagamento || !FORMAS_PAGAMENTO_VALIDAS.includes(formaPagamento)) {
    return res.status(400).json({ erro: 'formaPagamento inválida. Use DINHEIRO, PIX ou CARTAO' })
  }

  if (!data) {
    return res.status(400).json({ erro: 'O campo "data" é obrigatório' })
  }

  const dataVenda = new Date(data)
  if (isNaN(dataVenda.getTime())) {
    return res.status(400).json({ erro: 'data inválida. Use o formato AAAA-MM-DD' })
  }

  try {
    const produto = await prisma.produto.findUnique({ where: { id: Number(produtoId) } })

    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' })
    }

    // O preço do produto pode mudar depois, então a venda guarda o valor praticado.
    const unitario = valorUnitario !== undefined && valorUnitario !== null && valorUnitario !== ''
      ? Number(valorUnitario)
      : Number(produto.preco)

    if (isNaN(unitario) || unitario < 0) {
      return res.status(400).json({ erro: 'O campo "valorUnitario" não pode ser negativo' })
    }

    const venda = await prisma.venda.create({
      data: {
        produtoId: Number(produtoId),
        quantidade: quantidadeNumero,
        valorUnitario: unitario,
        valorTotal: unitario * quantidadeNumero,
        usuarioId: usuarioId || null,
        data: dataVenda,
        formaPagamento
      },
      select: {
        id: true,
        quantidade: true,
        valorUnitario: true,
        valorTotal: true,
        data: true,
        formaPagamento: true,
        produto: { select: { id: true, nome: true } },
        usuario: { select: { id: true, nome: true } }
      }
    })
    res.status(201).json(venda)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const apagar = async (req, res) => {
  const { id } = req.params

  try {
    await prisma.venda.delete({ where: { id: Number(id) } })
    res.status(200).json({ ok: true })
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Venda não encontrada' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { listar, criar, apagar }
