const prisma = require('../db')

const listar = async (req, res) => {
  try {
    const projetos = await prisma.projeto.findMany({
      orderBy: { nome: 'asc' },
      include: {
        _count: { select: { turmas: true } },
        turmas: { select: { matriculaTurmas: { select: { matricula: { select: { ativa: true } } } } } }
      }
    })

    const resultado = projetos.map(({ turmas, ...projeto }) => ({
      ...projeto,
      alunasAtivas: turmas.reduce(
        (acc, turma) => acc + turma.matriculaTurmas.filter((mt) => mt.matricula.ativa).length,
        0
      )
    }))

    res.json(resultado)
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

/* ---------- valores de cobrança (planos e taxa de inscrição) ---------- */

async function valoresDoProjeto(projeto) {
  const [planos, matriculas] = await Promise.all([
    prisma.planoProjeto.findMany({
      where: { projetoId: projeto.id },
      orderBy: { aulasPorSemana: 'asc' }
    }),
    prisma.matricula.groupBy({
      by: ['frequenciaSemanal'],
      where: { ativa: true, turmasVinculadas: { some: { turma: { projetoId: projeto.id } } } },
      _count: true
    })
  ])

  const ativasPorPlano = new Map(matriculas.map((m) => [m.frequenciaSemanal, m._count]))

  return {
    id: projeto.id,
    nome: projeto.nome,
    ativo: projeto.ativo,
    taxaInscricao: Number(projeto.taxaInscricao),
    planos: planos.map((p) => ({
      aulasPorSemana: p.aulasPorSemana,
      valorMensal: Number(p.valorMensal),
      matriculasAtivas: ativasPorPlano.get(p.aulasPorSemana) ?? 0
    })),
    // Matrículas ativas num plano que o projeto não tem (a coordenação precisa ajustar).
    matriculasSemPlano: matriculas
      .filter((m) => !planos.some((p) => p.aulasPorSemana === m.frequenciaSemanal))
      .reduce((soma, m) => soma + m._count, 0)
  }
}

const listarValores = async (req, res) => {
  try {
    const projetos = await prisma.projeto.findMany({ orderBy: { nome: 'asc' } })
    res.json(await Promise.all(projetos.map(valoresDoProjeto)))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const buscarValores = async (req, res) => {
  try {
    const projeto = await prisma.projeto.findUnique({ where: { id: Number(req.params.id) } })
    if (!projeto) return res.status(404).json({ erro: 'Projeto não encontrado' })
    res.json(await valoresDoProjeto(projeto))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// Substitui o conjunto de planos do projeto. Cobranças já geradas não mudam:
// o valor fica gravado em cada Pagamento.
const salvarValores = async (req, res) => {
  const id = Number(req.params.id)
  const { taxaInscricao, planos } = req.body ?? {}

  const taxa = Number(taxaInscricao)
  if (taxaInscricao === undefined || taxaInscricao === '' || isNaN(taxa) || taxa < 0) {
    return res.status(400).json({ erro: 'A taxa de inscrição deve ser um valor de zero em diante' })
  }

  if (!Array.isArray(planos)) {
    return res.status(400).json({ erro: 'Envie a lista de planos' })
  }

  const vistos = new Set()
  const normalizados = []
  for (const plano of planos) {
    const aulas = Number(plano?.aulasPorSemana)
    const valor = Number(plano?.valorMensal)
    if (!Number.isInteger(aulas) || aulas < 1 || aulas > 7) {
      return res.status(400).json({ erro: 'As aulas por semana devem ser de 1 a 7' })
    }
    if (plano?.valorMensal === '' || plano?.valorMensal === null || isNaN(valor) || valor < 0) {
      return res.status(400).json({ erro: `O valor do plano de ${aulas} aula(s) deve ser de zero em diante` })
    }
    if (vistos.has(aulas)) {
      return res.status(400).json({ erro: `O plano de ${aulas} aula(s) por semana está repetido` })
    }
    vistos.add(aulas)
    normalizados.push({ projetoId: id, aulasPorSemana: aulas, valorMensal: valor })
  }

  try {
    const existe = await prisma.projeto.findUnique({ where: { id }, select: { id: true } })
    if (!existe) return res.status(404).json({ erro: 'Projeto não encontrado' })

    await prisma.$transaction([
      prisma.projeto.update({ where: { id }, data: { taxaInscricao: taxa } }),
      prisma.planoProjeto.deleteMany({ where: { projetoId: id } }),
      prisma.planoProjeto.createMany({ data: normalizados })
    ])

    const projeto = await prisma.projeto.findUnique({ where: { id } })
    res.json(await valoresDoProjeto(projeto))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { listar, criar, atualizar, listarValores, buscarValores, salvarValores }
