const prisma = require('../db')
const { intervaloDoMes, intervaloDoDia } = require('../utils/mes')

const FORMAS_PAGAMENTO = ['DINHEIRO', 'PIX', 'CARTAO']

function somar(valores) {
  return valores.reduce((total, valor) => total + Number(valor), 0)
}

function totalizarPorCategoria(despesas) {
  const porCategoria = new Map()
  despesas.forEach((despesa) => {
    const atual = porCategoria.get(despesa.categoria.id)
    porCategoria.set(despesa.categoria.id, {
      categoriaId: despesa.categoria.id,
      nome: despesa.categoria.nome,
      total: (atual?.total ?? 0) + Number(despesa.valor)
    })
  })
  return Array.from(porCategoria.values()).sort((a, b) => b.total - a.total)
}

// Soma por forma de pagamento, sempre devolvendo as três chaves — assim a tela
// mostra "R$ 0,00" no que não entrou em vez de omitir a linha.
function totalizarPorForma(lancamentos) {
  const porForma = Object.fromEntries(FORMAS_PAGAMENTO.map((forma) => [forma, 0]))
  lancamentos.forEach(({ formaPagamento, valor }) => {
    const chave = FORMAS_PAGAMENTO.includes(formaPagamento) ? formaPagamento : 'DINHEIRO'
    porForma[chave] += Number(valor)
  })
  return porForma
}

const SELECT_NOME_DA_MATRICULA = {
  matricula: { select: { usuario: { select: { nome: true } } } }
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
    const totalSaidas = somar(despesas.map((d) => d.valor))

    res.json({
      mes,
      entradas: { mensalidades, inscricoes, vendas: totalVendas, total: totalEntradas },
      saidas: { total: totalSaidas, porCategoria: totalizarPorCategoria(despesas) },
      saldo: totalEntradas - totalSaidas
    })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// Fechamento do caixa do dia: entradas separadas por forma de pagamento (pra
// bater com o dinheiro em mãos), gastos lançados no dia e o que sobrou.
const caixaDoDia = async (req, res) => {
  const { data } = req.query

  const intervalo = intervaloDoDia(data)
  if (!intervalo) {
    return res.status(400).json({ erro: 'O parâmetro "data" é obrigatório no formato AAAA-MM-DD' })
  }

  const noDia = { gte: intervalo.inicio, lt: intervalo.fim }

  try {
    const [pagamentos, vendas, despesas] = await Promise.all([
      prisma.pagamento.findMany({
        where: { status: 'PAGA', dataPagamento: noDia },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          tipo: true,
          valor: true,
          mesReferencia: true,
          formaPagamento: true,
          ...SELECT_NOME_DA_MATRICULA
        }
      }),
      prisma.venda.findMany({
        where: { data: noDia },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          quantidade: true,
          valorTotal: true,
          formaPagamento: true,
          produto: { select: { nome: true } },
          usuario: { select: { nome: true } }
        }
      }),
      prisma.despesa.findMany({
        where: { data: noDia },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          descricao: true,
          valor: true,
          categoria: { select: { id: true, nome: true } }
        }
      })
    ])

    const entradas = [
      ...pagamentos.map((pagamento) => ({
        id: `pagamento-${pagamento.id}`,
        origem: pagamento.tipo === 'INSCRICAO' ? 'Inscrição' : 'Mensalidade',
        descricao: pagamento.matricula.usuario.nome,
        detalhe: pagamento.mesReferencia,
        valor: Number(pagamento.valor),
        formaPagamento: pagamento.formaPagamento
      })),
      ...vendas.map((venda) => ({
        id: `venda-${venda.id}`,
        origem: 'Venda',
        descricao: `${venda.quantidade}x ${venda.produto.nome}`,
        detalhe: venda.usuario?.nome ?? 'Venda avulsa',
        valor: Number(venda.valorTotal),
        formaPagamento: venda.formaPagamento
      }))
    ]

    const totalEntradas = somar(entradas.map((e) => e.valor))
    const totalSaidas = somar(despesas.map((d) => d.valor))

    res.json({
      data,
      entradas: {
        total: totalEntradas,
        porForma: totalizarPorForma(entradas),
        itens: entradas
      },
      saidas: {
        total: totalSaidas,
        porCategoria: totalizarPorCategoria(despesas),
        itens: despesas.map((despesa) => ({
          id: despesa.id,
          descricao: despesa.descricao,
          categoria: despesa.categoria.nome,
          valor: Number(despesa.valor)
        }))
      },
      saldo: totalEntradas - totalSaidas
    })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// Fechamento do mês. Mostra duas leituras diferentes de propósito:
// - caixa: o que entrou/saiu no mês (por data de movimento)
// - cobrancas: como ficaram as cobranças daquele mês de referência (competência),
//   que é o que responde "quem ainda está devendo este mês".
const fechamentoDoMes = async (req, res) => {
  const { mes } = req.query

  const intervalo = intervaloDoMes(mes)
  if (!intervalo) {
    return res.status(400).json({ erro: 'O parâmetro "mes" é obrigatório no formato AAAA-MM' })
  }

  const noMes = { gte: intervalo.inicio, lt: intervalo.fim }

  try {
    const [pagamentosPagos, vendas, despesas, cobrancasDoMes] = await Promise.all([
      prisma.pagamento.findMany({
        where: { status: 'PAGA', dataPagamento: noMes },
        select: { tipo: true, valor: true, formaPagamento: true }
      }),
      prisma.venda.findMany({
        where: { data: noMes },
        select: { valorTotal: true, formaPagamento: true }
      }),
      prisma.despesa.findMany({
        where: { data: noMes },
        select: { valor: true, categoria: { select: { id: true, nome: true } } }
      }),
      prisma.pagamento.findMany({
        where: { mesReferencia: mes },
        select: { tipo: true, valor: true, status: true }
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
    const totalSaidas = somar(despesas.map((d) => d.valor))

    const porForma = totalizarPorForma([
      ...pagamentosPagos.map((p) => ({ formaPagamento: p.formaPagamento, valor: p.valor })),
      ...vendas.map((v) => ({ formaPagamento: v.formaPagamento, valor: v.valorTotal }))
    ])

    const pagas = cobrancasDoMes.filter((c) => c.status === 'PAGA')
    const emAberto = cobrancasDoMes.filter((c) => c.status !== 'PAGA')

    res.json({
      mes,
      caixa: {
        entradas: {
          mensalidades,
          inscricoes,
          vendas: totalVendas,
          total: totalEntradas,
          porForma
        },
        saidas: { total: totalSaidas, porCategoria: totalizarPorCategoria(despesas) },
        saldo: totalEntradas - totalSaidas
      },
      cobrancas: {
        cobrado: somar(cobrancasDoMes.map((c) => c.valor)),
        recebido: somar(pagas.map((c) => c.valor)),
        emAberto: somar(emAberto.map((c) => c.valor)),
        quantidadeTotal: cobrancasDoMes.length,
        quantidadePagas: pagas.length,
        quantidadeEmAberto: emAberto.length
      }
    })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { resumoDoMes, caixaDoDia, fechamentoDoMes }
