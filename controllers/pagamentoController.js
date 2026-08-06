const prisma = require('../db')
const { PLANOS } = require('../config/planos')

const listar = async (req, res) => {
  const { mes, status, projetoId, usuarioId } = req.query

  if (!mes && !usuarioId) {
    return res.status(400).json({ erro: 'O parâmetro "mes" é obrigatório' })
  }

  try {
    const pagamentos = await prisma.pagamento.findMany({
      where: {
        ...(mes ? { mesReferencia: mes } : {}),
        ...(status ? { status } : {}),
        ...(projetoId ? { matricula: { turmas: { some: { projetoId: Number(projetoId) } } } } : {}),
        ...(usuarioId ? { matricula: { usuarioId } } : {})
      },
      orderBy: usuarioId
        ? [{ mesReferencia: 'desc' }]
        : [{ matricula: { usuario: { nome: 'asc' } } }],
      select: {
        id: true,
        valor: true,
        status: true,
        mesReferencia: true,
        vencimento: true,
        formaPagamento: true,
        matricula: {
          select: {
            usuario: { select: { nome: true } },
            turmas: {
              select: {
                nome: true,
                projeto: { select: { nome: true } }
              }
            }
          }
        }
      }
    })
    res.json(pagamentos)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const marcarComoPaga = async (req, res) => {
  const { id } = req.params
  const { dataPagamento, formaPagamento, valor } = req.body

  // 1. validação: a data tem que vir
  if (!dataPagamento) {
    return res.status(400).json({ erro: 'Informe a dataPagamento. Ex: "2026-06-05"' })
  }

  // 2. converte string -> Date e checa se é válida
  const data = new Date(dataPagamento)
  if (isNaN(data.getTime())) {
    return res.status(400).json({ erro: 'dataPagamento inválida. Use o formato AAAA-MM-DD' })
  }

  // 3. validação: formaPagamento obrigatória e dentro do enum
  if (!formaPagamento) {
    return res.status(400).json({ erro: 'O campo "formaPagamento" é obrigatório' })
  }

  if (!['DINHEIRO', 'PIX', 'CARTAO'].includes(formaPagamento)) {
    return res.status(400).json({ erro: 'formaPagamento inválida. Use DINHEIRO, PIX ou CARTAO' })
  }

  // 4. validação: valor obrigatório
  if (!valor) {
    return res.status(400).json({ erro: 'O campo "valor" é obrigatório' })
  }

  try {
    const pagamento = await prisma.pagamento.update({
      where: { id: Number(id) },
      data: {
        status: 'PAGA',
        dataPagamento: data,
        formaPagamento,
        valor
      }
    })
    res.json(pagamento)
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Pagamento não encontrado' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const gerarMes = async (req, res) => {
  const { projetoId, mesReferencia, vencimento } = req.body

  if (!projetoId) {
    return res.status(400).json({ erro: 'O campo "projetoId" é obrigatório' })
  }

  if (!mesReferencia || mesReferencia.trim() === '') {
    return res.status(400).json({ erro: 'O campo "mesReferencia" é obrigatório' })
  }

  if (!vencimento) {
    return res.status(400).json({ erro: 'O campo "vencimento" é obrigatório' })
  }

  try {
    const matriculas = await prisma.matricula.findMany({
      where: {
        ativa: true,
        turmas: { some: { projetoId: Number(projetoId) } }
      },
      select: { id: true, frequenciaSemanal: true, usuario: { select: { nome: true } } }
    })

    const existentes = await prisma.pagamento.findMany({
      where: {
        mesReferencia,
        matriculaId: { in: matriculas.map((matricula) => matricula.id) }
      },
      select: { matriculaId: true }
    })
    const matriculasComPagamento = new Set(existentes.map((pagamento) => pagamento.matriculaId))

    const matriculasParaGerar = matriculas.filter((matricula) => !matriculasComPagamento.has(matricula.id))

    const pendentes = matriculasParaGerar
      .filter((matricula) => !PLANOS[matricula.frequenciaSemanal])
      .map((matricula) => ({ matriculaId: matricula.id, nome: matricula.usuario.nome }))

    const matriculasComValor = matriculasParaGerar.filter((matricula) => PLANOS[matricula.frequenciaSemanal])

    const criados = await prisma.$transaction(
      matriculasComValor.map((matricula) =>
        prisma.pagamento.create({
          data: {
            valor: PLANOS[matricula.frequenciaSemanal],
            mesReferencia,
            vencimento: new Date(vencimento),
            status: 'PENDENTE',
            matriculaId: matricula.id
          }
        })
      )
    )

    res.status(201).json({ criados, pendentes })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const atrasados = async (req, res) => {
  const { projetoId } = req.query

  try {
    const pagamentos = await prisma.pagamento.findMany({
      where: {
        status: 'PENDENTE',
        vencimento: { lt: new Date() },
        ...(projetoId ? { matricula: { turmas: { some: { projetoId: Number(projetoId) } } } } : {})
      },
      orderBy: { vencimento: 'asc' },
      select: {
        id: true,
        valor: true,
        vencimento: true,
        mesReferencia: true,
        matricula: {
          select: {
            usuario: { select: { nome: true } },
            turmas: {
              select: {
                nome: true,
                projeto: { select: { nome: true } }
              }
            }
          }
        }
      }
    })
    res.json(pagamentos)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { listar, marcarComoPaga, gerarMes, atrasados }
