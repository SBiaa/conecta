const prisma = require('../db')
const { PLANOS } = require('../config/planos')

const EXAMES_MEDICOS_VALIDOS = ['APTO', 'NAO_APTO', 'AGUARDANDO']
const FREQUENCIAS_VALIDAS = Object.keys(PLANOS).map(Number)

function validarSelecaoTurmas(selecao, frequenciaSemanal) {
  if (!FREQUENCIAS_VALIDAS.includes(Number(frequenciaSemanal))) {
    return { erro: `O campo "frequenciaSemanal" deve ser um de: ${FREQUENCIAS_VALIDAS.join(', ')}` }
  }

  if (!Array.isArray(selecao) || selecao.length === 0) {
    return { erro: 'O campo "turmas" é obrigatório e deve ser uma lista com ao menos 1 item' }
  }

  for (const item of selecao) {
    if (!item.turmaId || !Array.isArray(item.dias) || item.dias.length === 0) {
      return { erro: 'Cada item de "turmas" precisa de "turmaId" e uma lista "dias" com ao menos 1 dia' }
    }
  }

  return { itens: selecao.map((item) => ({ turmaId: Number(item.turmaId), dias: item.dias })) }
}

async function validarTurmasReais(itens, frequenciaSemanal) {
  const turmasReais = await prisma.turma.findMany({
    where: { id: { in: itens.map((item) => item.turmaId) } },
    select: { id: true, projetoId: true, dias: true }
  })

  if (turmasReais.length !== itens.length) {
    return 'Uma ou mais turmas informadas não foram encontradas'
  }

  const porId = new Map(turmasReais.map((turma) => [turma.id, turma]))

  const projetoIds = new Set(turmasReais.map((turma) => turma.projetoId))
  if (projetoIds.size > 1) {
    return 'Todas as turmas escolhidas devem ser do mesmo projeto'
  }

  for (const item of itens) {
    const turma = porId.get(item.turmaId)
    const diasInvalidos = item.dias.filter((dia) => !turma.dias.includes(dia))
    if (diasInvalidos.length > 0) {
      return `A turma "${turma.id}" não acontece em: ${diasInvalidos.join(', ')}`
    }
  }

  const totalDias = itens.reduce((soma, item) => soma + item.dias.length, 0)
  if (totalDias !== Number(frequenciaSemanal)) {
    return `A soma de dias escolhidos (${totalDias}) não bate com a frequência do plano (${frequenciaSemanal})`
  }

  return null
}

const criar = async (req, res) => {
  const { usuarioId, turmas, frequenciaSemanal, exameMedico } = req.body

  if (!usuarioId) {
    return res.status(400).json({ erro: 'O campo "usuarioId" é obrigatório' })
  }

  if (exameMedico && !EXAMES_MEDICOS_VALIDOS.includes(exameMedico)) {
    return res.status(400).json({
      erro: 'O campo "exameMedico" deve ser um de: APTO, NAO_APTO, AGUARDANDO'
    })
  }

  const { erro: erroSelecao, itens } = validarSelecaoTurmas(turmas, frequenciaSemanal)
  if (erroSelecao) {
    return res.status(400).json({ erro: erroSelecao })
  }

  try {
    const erroValidacao = await validarTurmasReais(itens, frequenciaSemanal)
    if (erroValidacao) {
      return res.status(400).json({ erro: erroValidacao })
    }

    const matricula = await prisma.matricula.create({
      data: {
        usuarioId,
        frequenciaSemanal: Number(frequenciaSemanal),
        turmasVinculadas: {
          create: itens.map((item) => ({ turmaId: item.turmaId, dias: item.dias }))
        },
        ...(exameMedico ? { exameMedico } : {})
      }
    })
    res.status(201).json(matricula)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const atualizar = async (req, res) => {
  const { id } = req.params
  const { ativa, exameMedico, turmas, frequenciaSemanal } = req.body

  if (exameMedico && !EXAMES_MEDICOS_VALIDOS.includes(exameMedico)) {
    return res.status(400).json({
      erro: 'O campo "exameMedico" deve ser um de: APTO, NAO_APTO, AGUARDANDO'
    })
  }

  const mudandoTurmas = turmas !== undefined || frequenciaSemanal !== undefined

  try {
    let itens = null

    if (mudandoTurmas) {
      const matriculaAtual = await prisma.matricula.findUnique({
        where: { id: Number(id) }
      })

      if (!matriculaAtual) {
        return res.status(404).json({ erro: 'Matrícula não encontrada' })
      }

      const frequenciaFinal = frequenciaSemanal !== undefined
        ? frequenciaSemanal
        : matriculaAtual.frequenciaSemanal

      const { erro: erroSelecao, itens: itensValidados } = validarSelecaoTurmas(turmas, frequenciaFinal)
      if (erroSelecao) {
        return res.status(400).json({ erro: erroSelecao })
      }

      const erroValidacao = await validarTurmasReais(itensValidados, frequenciaFinal)
      if (erroValidacao) {
        return res.status(400).json({ erro: erroValidacao })
      }

      itens = itensValidados
    }

    const matricula = await prisma.$transaction(async (tx) => {
      if (itens) {
        await tx.matriculaTurma.deleteMany({ where: { matriculaId: Number(id) } })
        await tx.matriculaTurma.createMany({
          data: itens.map((item) => ({ matriculaId: Number(id), turmaId: item.turmaId, dias: item.dias }))
        })
      }

      return tx.matricula.update({
        where: { id: Number(id) },
        data: {
          ...(ativa !== undefined ? { ativa } : {}),
          ...(exameMedico ? { exameMedico } : {}),
          ...(frequenciaSemanal !== undefined ? { frequenciaSemanal: Number(frequenciaSemanal) } : {})
        }
      })
    })
    res.json(matricula)
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Matrícula não encontrada' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const remover = async (req, res) => {
  const { id } = req.params

  try {
    const matricula = await prisma.matricula.findUnique({
      where: { id: Number(id) },
      include: {
        pagamentos: { select: { id: true } },
        presencas: { select: { id: true } }
      }
    })

    if (!matricula) {
      return res.status(404).json({ erro: 'Matrícula não encontrada' })
    }

    if (matricula.pagamentos.length > 0 || matricula.presencas.length > 0) {
      return res.status(409).json({
        erro: 'Não é possível excluir a matrícula pois há pagamentos ou presenças vinculados a ela'
      })
    }

    await prisma.$transaction([
      prisma.matriculaTurma.deleteMany({ where: { matriculaId: Number(id) } }),
      prisma.matricula.delete({ where: { id: Number(id) } })
    ])

    res.status(200).json({ ok: true })
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Matrícula não encontrada' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { criar, atualizar, remover }
