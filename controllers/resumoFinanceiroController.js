const prisma = require('../db')
const { intervaloDoMes } = require('../utils/mes')

function somar(valores) {
  return valores.reduce((total, valor) => total + Number(valor), 0)
}

// Caixa do mês: o que entrou e saiu de fato, por data de movimento
// (dataPagamento do pagamento, data da venda/despesa) — não por mês de referência.
const resumoDoMes = async (req, res) => {
  const { mes } = req.query

  const intervalo = intervaloDoMes(mes)
  if (!intervalo) {
    return res.status(400).json({ erro: 'O parâmetro "mes" é obrigatório no formato AAAA-MM' })
  }

  const noMes = { gte: intervalo.inicio, lt: intervalo.fim }

  try {
    const [pagamentosPagos, vendas, despesas] = await Promise.all([
      prisma.pagamento.findMany({
        where: { status: 'PAGA', dataPagamento: noMes },
        select: { tipo: true, valor: true }
      }),
      prisma.venda.findMany({
        where: { data: noMes },
        select: { valorTotal: true }
      }),
      prisma.despesa.findMany({
        where: { data: noMes },
        select: { valor: true, categoria: { select: { id: true, nome: true } } }
      })
    ])

    const mensalidades = somar(
      pagamentosPagos.filter((p) => p.tipo === 'MENSALIDADE').map((p) => p.valor)
    )
    const inscricoes = somar(
      pagamentosPagos.filter((p) => p.tipo === 'INSCRICAO').map((p) => p.valor)
    )
    const totalVendas = somar(vendas.map((v) => v.valorTotal))
    const totalEntradas = mensalidades + inscricoes + totalVendas

    const porCategoria = new Map()
    despesas.forEach((despesa) => {
      const atual = porCategoria.get(despesa.categoria.id)
      porCategoria.set(despesa.categoria.id, {
        categoriaId: despesa.categoria.id,
        nome: despesa.categoria.nome,
        total: (atual?.total ?? 0) + Number(despesa.valor)
      })
    })

    const totalSaidas = somar(despesas.map((d) => d.valor))

    res.json({
      mes,
      entradas: { mensalidades, inscricoes, vendas: totalVendas, total: totalEntradas },
      saidas: {
        total: totalSaidas,
        porCategoria: Array.from(porCategoria.values()).sort((a, b) => b.total - a.total)
      },
      saldo: totalEntradas - totalSaidas
    })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { resumoDoMes }
