const prisma = require('../db')

const DIA_SEMANA_POR_INDICE = ['DOMINGO', 'SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA', 'SABADO']

function dataHojeISO() {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

const minhasTurmas = async (req, res) => {
  const professorId = req.usuario.id

  try {
    const hoje = new Date(dataHojeISO())
    const diaHoje = DIA_SEMANA_POR_INDICE[new Date().getDay()]

    const turmas = await prisma.turma.findMany({
      where: { professorId },
      orderBy: { nome: 'asc' },
      include: {
        projeto: { select: { nome: true } },
        matriculaTurmas: { where: { matricula: { ativa: true } }, select: { id: true } },
        presencas: { where: { data: hoje }, select: { id: true }, take: 1 }
      }
    })

    const resultado = turmas.map(({ matriculaTurmas, presencas, ...turma }) => ({
      ...turma,
      totalAlunas: matriculaTurmas.length,
      temAulaHoje: turma.dias.includes(diaHoje),
      chamadaFeitaHoje: presencas.length > 0
    }))

    res.json(resultado)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

async function turmaDoProfessor(turmaId, req) {
  const turma = await prisma.turma.findUnique({ where: { id: turmaId } })
  if (!turma) return { erro: 404 }
  if (req.usuario.papel === 'PROFESSOR' && turma.professorId !== req.usuario.id) {
    return { erro: 403 }
  }
  return { turma }
}

const obterChamada = async (req, res) => {
  const turmaId = Number(req.params.turmaId)
  const { data } = req.query

  if (!data) {
    return res.status(400).json({ erro: 'O parâmetro "data" é obrigatório' })
  }

  const { turma, erro } = await turmaDoProfessor(turmaId, req)
  if (erro === 404) return res.status(404).json({ erro: 'Turma não encontrada' })
  if (erro === 403) return res.status(403).json({ erro: 'Acesso negado' })

  try {
    const matriculas = await prisma.matricula.findMany({
      where: { turmasVinculadas: { some: { turmaId } }, ativa: true },
      orderBy: { usuario: { nome: 'asc' } },
      select: { id: true, usuario: { select: { id: true, nome: true } } }
    })

    const presencas = await prisma.presenca.findMany({
      where: { turmaId, data: new Date(data) }
    })

    const presencaPorMatricula = new Map(presencas.map((p) => [p.matriculaId, p.presente]))

    res.json({
      turma: { id: turma.id, nome: turma.nome },
      data,
      alunas: matriculas.map((m) => ({
        matriculaId: m.id,
        nome: m.usuario.nome,
        presente: presencaPorMatricula.has(m.id) ? presencaPorMatricula.get(m.id) : null
      }))
    })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const registrarChamada = async (req, res) => {
  const turmaId = Number(req.params.turmaId)
  const { data, presencas } = req.body

  if (!data || !Array.isArray(presencas)) {
    return res.status(400).json({ erro: 'Informe "data" e a lista de "presencas"' })
  }

  const { erro } = await turmaDoProfessor(turmaId, req)
  if (erro === 404) return res.status(404).json({ erro: 'Turma não encontrada' })
  if (erro === 403) return res.status(403).json({ erro: 'Acesso negado' })

  try {
    const dataChamada = new Date(data)

    await prisma.$transaction(
      presencas.map(({ matriculaId, presente }) =>
        prisma.presenca.upsert({
          where: { matriculaId_data: { matriculaId: Number(matriculaId), data: dataChamada } },
          create: {
            matriculaId: Number(matriculaId),
            turmaId,
            data: dataChamada,
            presente: Boolean(presente),
            registradoPorId: req.usuario.id
          },
          update: {
            presente: Boolean(presente),
            registradoPorId: req.usuario.id
          }
        })
      )
    )

    res.json({ ok: true })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const frequenciaTurma = async (req, res) => {
  const turmaId = Number(req.params.turmaId)

  const { turma, erro } = await turmaDoProfessor(turmaId, req)
  if (erro === 404) return res.status(404).json({ erro: 'Turma não encontrada' })
  if (erro === 403) return res.status(403).json({ erro: 'Acesso negado' })

  try {
    const matriculas = await prisma.matricula.findMany({
      where: { turmasVinculadas: { some: { turmaId } }, ativa: true },
      orderBy: { usuario: { nome: 'asc' } },
      select: { id: true, usuario: { select: { nome: true } } }
    })

    const presencas = await prisma.presenca.findMany({
      where: { turmaId },
      select: { matriculaId: true, data: true, presente: true }
    })

    const datas = [...new Set(presencas.map((p) => p.data.toISOString().slice(0, 10)))]
      .sort()
      .reverse()

    const alunas = matriculas.map((m) => {
      const registros = presencas.filter((p) => p.matriculaId === m.id)
      const faltas = registros.filter((p) => !p.presente).length
      const totalRegistros = registros.length

      return {
        matriculaId: m.id,
        nome: m.usuario.nome,
        totalRegistros,
        faltas,
        percentualPresenca:
          totalRegistros > 0 ? Math.round(((totalRegistros - faltas) / totalRegistros) * 100) : null
      }
    })

    res.json({ turma: { id: turma.id, nome: turma.nome }, datas, alunas })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// Lista de chamada em papel: nomes das alunas ativas + os dias de aula do mês,
// pra professora imprimir e marcar à mão (sem depender de celular/internet na quadra).
const listaMensal = async (req, res) => {
  const turmaId = Number(req.params.turmaId)
  const mes = String(req.query.mes || '')
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(mes)

  if (!match) {
    return res.status(400).json({ erro: 'Informe o mês no formato AAAA-MM' })
  }

  const { turma, erro } = await turmaDoProfessor(turmaId, req)
  if (erro === 404) return res.status(404).json({ erro: 'Turma não encontrada' })
  if (erro === 403) return res.status(403).json({ erro: 'Acesso negado' })

  try {
    const ano = Number(match[1])
    const mesIndice = Number(match[2]) - 1
    const diasNoMes = new Date(ano, mesIndice + 1, 0).getDate()

    const datas = []
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const diaSemana = DIA_SEMANA_POR_INDICE[new Date(ano, mesIndice, dia).getDay()]
      if (turma.dias.includes(diaSemana)) datas.push(dia)
    }

    const [projeto, professor, matriculas] = await Promise.all([
      prisma.projeto.findUnique({ where: { id: turma.projetoId }, select: { nome: true } }),
      turma.professorId
        ? prisma.usuario.findUnique({ where: { id: turma.professorId }, select: { nome: true } })
        : null,
      prisma.matricula.findMany({
        where: { turmasVinculadas: { some: { turmaId } }, ativa: true },
        orderBy: { usuario: { nome: 'asc' } },
        select: { id: true, usuario: { select: { nome: true } } }
      })
    ])

    res.json({
      turma: {
        id: turma.id,
        nome: turma.nome,
        projeto: projeto ? projeto.nome : null,
        professor: professor ? professor.nome : null,
        dias: turma.dias,
        horario: turma.horario
      },
      mes,
      datas,
      alunas: matriculas.map((m) => ({ matriculaId: m.id, nome: m.usuario.nome }))
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { minhasTurmas, obterChamada, registrarChamada, frequenciaTurma, listaMensal }
