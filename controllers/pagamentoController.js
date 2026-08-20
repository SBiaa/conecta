const prisma = require('../db')
const { PLANOS } = require('../config/planos')

const SELECT_TURMAS_MATRICULA = {
  usuario: { select: { nome: true } },
  turmasVinculadas: {
    select: {
      dias: true,
      turma: { select: { nome: true, projeto: { select: { nome: true } } } }
    }
  }
}

function reshapeMatricula(matricula) {
  const { turmasVinculadas, ...resto } = matricula
  return {
    ...resto,
    turmas: turmasVinculadas.map((vinculo) => ({ ...vinculo.turma, diasContratados: vinculo.dias }))
  }
}

const listar = async (req, res) => {
  const { mes, status, tipo, projetoId, usuarioId } = req.query

  if (!mes && !usuarioId) {
    return res.status(400).json({ erro: 'O parâmetro "mes" é obrigatório' })
  }

  try {
    const pagamentos = await prisma.pagamento.findMany({
      where: {
        ...(mes ? { mesReferencia: mes } : {}),
        ...(status ? { status } : {}),
        ...(tipo ? { tipo } : {}),
        ...(projetoId ? { matricula: { turmasVinculadas: { some: { turma: { projetoId: Number(projetoId) } } } } } : {}),
        ...(usuarioId ? { matricula: { usuarioId } } : {})
      },
      orderBy: usuarioId
        ? [{ mesReferencia: 'desc' }]
        : [{ matricula: { usuario: { nome: 'asc' } } }],
      select: {
        id: true,
        tipo: true,
        valor: true,
        status: true,
        mesReferencia: true,
        vencimento: true,
        dataPagamento: true,
        formaPagamento: true,
        matricula: { select: SELECT_TURMAS_MATRICULA }
      }
    })
    res.json(pagamentos.map((p) => ({ ...p, matricula: reshapeMatricula(p.matricula) })))
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

  // 4. validação: valor obrigatório (0 é aceito — isenção)
  if (valor === undefined || valor === null || valor === '' || isNaN(Number(valor)) || Number(valor) < 0) {
    return res.status(400).json({ erro: 'O campo "valor" é obrigatório e não pode ser negativo' })
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
        turmasVinculadas: { some: { turma: { projetoId: Number(projetoId) } } }
      },
      select: { id: true, frequenciaSemanal: true, usuario: { select: { nome: true } } }
    })

    // Só mensalidades contam como "já gerado": uma inscrição no mesmo mês não pode
    // fazer a mensalidade daquela matrícula ser pulada.
    const existentes = await prisma.pagamento.findMany({
      where: {
        mesReferencia,
        tipo: 'MENSALIDADE',
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
            tipo: 'MENSALIDADE',
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

// Gera a mensalidade de uma matrícula só — usado quando a aluna entra depois
// que o "gerar mensalidades" do mês já rodou.
const gerarParaMatricula = async (req, res) => {
  const { matriculaId, mesReferencia, vencimento } = req.body

  if (!matriculaId) {
    return res.status(400).json({ erro: 'O campo "matriculaId" é obrigatório' })
  }

  if (!mesReferencia || mesReferencia.trim() === '') {
    return res.status(400).json({ erro: 'O campo "mesReferencia" é obrigatório' })
  }

  if (!vencimento) {
    return res.status(400).json({ erro: 'O campo "vencimento" é obrigatório' })
  }

  const dataVencimento = new Date(vencimento)
  if (isNaN(dataVencimento.getTime())) {
    return res.status(400).json({ erro: 'vencimento inválido. Use o formato AAAA-MM-DD' })
  }

  try {
    const matricula = await prisma.matricula.findUnique({
      where: { id: Number(matriculaId) },
      select: { id: true, ativa: true, frequenciaSemanal: true }
    })

    if (!matricula) {
      return res.status(404).json({ erro: 'Matrícula não encontrada' })
    }

    const valor = PLANOS[matricula.frequenciaSemanal]
    if (!valor) {
      return res.status(400).json({
        erro: 'Esta matrícula não tem um plano válido. Ajuste o plano antes de gerar a mensalidade.'
      })
    }

    const jaExiste = await prisma.pagamento.findFirst({
      where: { matriculaId: matricula.id, mesReferencia, tipo: 'MENSALIDADE' },
      select: { id: true }
    })

    if (jaExiste) {
      return res.status(409).json({
        erro: 'Já existe uma mensalidade desta matrícula para o mês escolhido'
      })
    }

    const pagamento = await prisma.pagamento.create({
      data: {
        tipo: 'MENSALIDADE',
        valor,
        mesReferencia,
        vencimento: dataVencimento,
        status: 'PENDENTE',
        matriculaId: matricula.id
      }
    })

    res.status(201).json(pagamento)
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
        ...(projetoId ? { matricula: { turmasVinculadas: { some: { turma: { projetoId: Number(projetoId) } } } } } : {})
      },
      orderBy: { vencimento: 'asc' },
      select: {
        id: true,
        tipo: true,
        valor: true,
        vencimento: true,
        mesReferencia: true,
        matricula: { select: SELECT_TURMAS_MATRICULA }
      }
    })
    res.json(pagamentos.map((p) => ({ ...p, matricula: reshapeMatricula(p.matricula) })))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { listar, marcarComoPaga, gerarMes, gerarParaMatricula, atrasados }
