const prisma = require('../db')
const { intervaloDoMes } = require('../utils/mes')

const LOCAIS_DOR = ['JOELHO', 'LOMBAR', 'CERVICAL', 'OMBRO', 'QUADRIL', 'TORNOZELO', 'PUNHO', 'OUTRO']

// Os mesmos cortes que a tela de frequência já usava (90 / 75), pra aluna não ver
// um "ótima" aqui e um amarelo lá pro mesmo número.
function situacaoFrequencia(percentual) {
  if (percentual === null) return null
  if (percentual >= 90) return 'OTIMA'
  if (percentual >= 75) return 'BOA'
  if (percentual >= 50) return 'ATENCAO'
  return 'BAIXA'
}

function dataISO(data) {
  return data.toISOString().slice(0, 10)
}

// O fuso do servidor pode não ser o de Brasília. Monta "hoje" pelos componentes
// locais (mesma abordagem do professorController) pra não virar o dia às 21h.
function hojeLocalISO() {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function mesAnteriorDe(mes) {
  const [ano, mesNumero] = mes.split('-').map(Number)
  const anterior = new Date(Date.UTC(ano, mesNumero - 2, 1))
  return `${anterior.getUTCFullYear()}-${String(anterior.getUTCMonth() + 1).padStart(2, '0')}`
}

function mesAtual() {
  return hojeLocalISO().slice(0, 7)
}

function serializarRegistro(registro) {
  return {
    id: registro.id,
    data: dataISO(registro.data),
    peso: registro.peso === null ? null : Number(registro.peso),
    nivelDor: registro.nivelDor,
    locaisDor: registro.locaisDor,
    disposicao: registro.disposicao,
    observacao: registro.observacao
  }
}

// Devolve { dados } ou { erro } com a mensagem pronta pro 400.
function validarRegistro(corpo) {
  const { data, peso, nivelDor, locaisDor, disposicao, observacao } = corpo ?? {}

  if (data !== undefined && data !== null && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { erro: 'A data deve estar no formato AAAA-MM-DD' }
  }

  const dataTexto = data ?? hojeLocalISO()
  const dataRegistro = new Date(`${dataTexto}T00:00:00.000Z`)

  if (Number.isNaN(dataRegistro.getTime())) {
    return { erro: 'Data inválida' }
  }
  // Comparação em texto: os dois lados são o dia local, sem fuso no meio.
  if (dataTexto > hojeLocalISO()) {
    return { erro: 'Não dá pra registrar uma data no futuro' }
  }

  let pesoValidado = null
  if (peso !== undefined && peso !== null && peso !== '') {
    const numero = Number(peso)
    // 20 a 400 kg: larga o bastante pra não barrar ninguém, apertada o bastante
    // pra pegar dedo escorregado (5 kg, 700 kg).
    if (!Number.isFinite(numero) || numero < 20 || numero > 400) {
      return { erro: 'O peso deve ser um número entre 20 e 400' }
    }
    pesoValidado = Math.round(numero * 100) / 100
  }

  let dorValidada = null
  if (nivelDor !== undefined && nivelDor !== null && nivelDor !== '') {
    const numero = Number(nivelDor)
    if (!Number.isInteger(numero) || numero < 0 || numero > 5) {
      return { erro: 'O nível de dor deve ser um número inteiro de 0 a 5' }
    }
    dorValidada = numero
  }

  let disposicaoValidada = null
  if (disposicao !== undefined && disposicao !== null && disposicao !== '') {
    const numero = Number(disposicao)
    if (!Number.isInteger(numero) || numero < 1 || numero > 5) {
      return { erro: 'A disposição deve ser um número inteiro de 1 a 5' }
    }
    disposicaoValidada = numero
  }

  let locaisValidados = []
  if (locaisDor !== undefined && locaisDor !== null) {
    if (!Array.isArray(locaisDor)) {
      return { erro: 'Os locais de dor devem vir em uma lista' }
    }
    const invalido = locaisDor.find((local) => !LOCAIS_DOR.includes(local))
    if (invalido) {
      return { erro: `Local de dor inválido: ${invalido}` }
    }
    locaisValidados = [...new Set(locaisDor)]
  }

  const observacaoValidada =
    observacao === undefined || observacao === null || String(observacao).trim() === ''
      ? null
      : String(observacao).trim().slice(0, 500)

  const vazio =
    pesoValidado === null &&
    dorValidada === null &&
    disposicaoValidada === null &&
    observacaoValidada === null &&
    locaisValidados.length === 0

  if (vazio) {
    return { erro: 'Preencha pelo menos um dado do registro' }
  }

  return {
    dados: {
      data: dataRegistro,
      peso: pesoValidado,
      nivelDor: dorValidada,
      locaisDor: locaisValidados,
      disposicao: disposicaoValidada,
      observacao: observacaoValidada
    }
  }
}

function media(numeros) {
  if (numeros.length === 0) return null
  return Math.round((numeros.reduce((total, n) => total + n, 0) / numeros.length) * 10) / 10
}

// Frequência do usuário no intervalo [inicio, fim). Sem intervalo, pega tudo.
async function frequenciaDoPeriodo(usuarioId, intervalo) {
  const matriculas = await prisma.matricula.findMany({
    where: { usuarioId },
    select: {
      id: true,
      turmasVinculadas: {
        select: { turma: { select: { id: true, nome: true, projeto: { select: { nome: true } } } } }
      }
    }
  })

  const matriculaIds = matriculas.map((m) => m.id)
  if (matriculaIds.length === 0) {
    return { totalAulas: 0, presencas: 0, faltas: 0, percentual: null, situacao: null, porTurma: [] }
  }

  const presencas = await prisma.presenca.findMany({
    where: {
      matriculaId: { in: matriculaIds },
      ...(intervalo ? { data: { gte: intervalo.inicio, lt: intervalo.fim } } : {})
    },
    select: { matriculaId: true, turmaId: true, data: true, presente: true },
    orderBy: { data: 'asc' }
  })

  const porTurma = matriculas.flatMap((matricula) =>
    matricula.turmasVinculadas.map(({ turma }) => {
      const registros = presencas.filter((p) => p.matriculaId === matricula.id && p.turmaId === turma.id)
      const faltas = registros.filter((p) => !p.presente).length
      const totalAulas = registros.length

      return {
        turmaId: turma.id,
        nome: turma.nome,
        projeto: turma.projeto.nome,
        totalAulas,
        presencas: totalAulas - faltas,
        faltas,
        percentual: totalAulas > 0 ? Math.round(((totalAulas - faltas) / totalAulas) * 100) : null,
        registros: registros.map((p) => ({ data: dataISO(p.data), presente: p.presente }))
      }
    })
  )

  const totalAulas = presencas.length
  const faltas = presencas.filter((p) => !p.presente).length
  const percentual = totalAulas > 0 ? Math.round(((totalAulas - faltas) / totalAulas) * 100) : null

  return {
    totalAulas,
    presencas: totalAulas - faltas,
    faltas,
    percentual,
    situacao: situacaoFrequencia(percentual),
    porTurma
  }
}

async function registrosDoPeriodo(usuarioId, intervalo) {
  const registros = await prisma.registroSaude.findMany({
    where: {
      usuarioId,
      ...(intervalo ? { data: { gte: intervalo.inicio, lt: intervalo.fim } } : {})
    },
    orderBy: { data: 'asc' }
  })
  return registros.map(serializarRegistro)
}

// Resume peso, dor e disposição de uma lista já serializada.
function resumirSaude(registros) {
  const comPeso = registros.filter((r) => r.peso !== null)
  const comDor = registros.filter((r) => r.nivelDor !== null)
  const comDisposicao = registros.filter((r) => r.disposicao !== null)

  const contagemLocais = new Map()
  for (const registro of registros) {
    for (const local of registro.locaisDor) {
      contagemLocais.set(local, (contagemLocais.get(local) ?? 0) + 1)
    }
  }

  return {
    totalRegistros: registros.length,
    peso: {
      primeiro: comPeso.length > 0 ? comPeso[0].peso : null,
      ultimo: comPeso.length > 0 ? comPeso[comPeso.length - 1].peso : null,
      variacao:
        comPeso.length > 1
          ? Math.round((comPeso[comPeso.length - 1].peso - comPeso[0].peso) * 100) / 100
          : null,
      serie: comPeso.map((r) => ({ data: r.data, peso: r.peso }))
    },
    dor: {
      media: media(comDor.map((r) => r.nivelDor)),
      maior: comDor.length > 0 ? Math.max(...comDor.map((r) => r.nivelDor)) : null,
      locaisMaisFrequentes: [...contagemLocais.entries()]
        .map(([local, vezes]) => ({ local, vezes }))
        .sort((a, b) => b.vezes - a.vezes),
      serie: comDor.map((r) => ({ data: r.data, nivelDor: r.nivelDor, locaisDor: r.locaisDor }))
    },
    disposicao: {
      media: media(comDisposicao.map((r) => r.disposicao)),
      serie: comDisposicao.map((r) => ({ data: r.data, disposicao: r.disposicao }))
    }
  }
}

// Monta o relatório mensal completo de um usuário. Usado pela aluna (nela mesma),
// pelo professor da turma dela e pelo admin — a checagem de permissão fica fora.
async function montarRelatorio(usuarioId, mes) {
  const intervalo = intervaloDoMes(mes)
  if (!intervalo) return null

  const mesAnterior = mesAnteriorDe(mes)
  const intervaloAnterior = intervaloDoMes(mesAnterior)

  const [frequencia, registros, frequenciaAnterior, registrosAnteriores] = await Promise.all([
    frequenciaDoPeriodo(usuarioId, intervalo),
    registrosDoPeriodo(usuarioId, intervalo),
    frequenciaDoPeriodo(usuarioId, intervaloAnterior),
    registrosDoPeriodo(usuarioId, intervaloAnterior)
  ])

  const resumo = resumirSaude(registros)
  const resumoAnterior = resumirSaude(registrosAnteriores)

  return {
    mes,
    frequencia,
    ...resumo,
    registros,
    comparativo: {
      mes: mesAnterior,
      frequenciaPercentual: frequenciaAnterior.percentual,
      pesoUltimo: resumoAnterior.peso.ultimo,
      dorMedia: resumoAnterior.dor.media,
      disposicaoMedia: resumoAnterior.disposicao.media
    }
  }
}

/* ---------- endpoints da própria associada (/me) ---------- */

const meusRegistros = async (req, res) => {
  const { mes } = req.query

  if (mes && !intervaloDoMes(mes)) {
    return res.status(400).json({ erro: 'O parâmetro "mes" deve estar no formato AAAA-MM' })
  }

  try {
    const registros = await registrosDoPeriodo(req.usuario.id, mes ? intervaloDoMes(mes) : null)
    res.json(registros.reverse())
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const registrar = async (req, res) => {
  const { dados, erro: erroValidacao } = validarRegistro(req.body)
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao })

  try {
    // Um registro por dia: se já existe o de hoje, ela está corrigindo, não duplicando.
    const registro = await prisma.registroSaude.upsert({
      where: { usuarioId_data: { usuarioId: req.usuario.id, data: dados.data } },
      create: { usuarioId: req.usuario.id, ...dados },
      update: dados
    })

    res.status(201).json(serializarRegistro(registro))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const apagarRegistro = async (req, res) => {
  const id = Number(req.params.id)

  if (!Number.isInteger(id)) {
    return res.status(400).json({ erro: 'Registro inválido' })
  }

  try {
    const registro = await prisma.registroSaude.findUnique({ where: { id } })

    if (!registro || registro.usuarioId !== req.usuario.id) {
      return res.status(404).json({ erro: 'Registro não encontrado' })
    }

    await prisma.registroSaude.delete({ where: { id } })
    res.json({ ok: true })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const meuRelatorio = async (req, res) => {
  const mes = req.query.mes ?? mesAtual()

  try {
    const relatorio = await montarRelatorio(req.usuario.id, mes)
    if (!relatorio) {
      return res.status(400).json({ erro: 'O parâmetro "mes" deve estar no formato AAAA-MM' })
    }
    res.json(relatorio)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

/* ---------- leitura por professor e admin ---------- */

// Admin vê qualquer uma. Professor só vê quem está numa turma dele — a mesma
// regra do turmaDoProfessor, só que partindo da aluna.
async function podeVerSaudeDe(req, usuarioId) {
  if (req.usuario.papel === 'ADMIN') return true
  if (req.usuario.papel !== 'PROFESSOR') return false

  const vinculo = await prisma.matriculaTurma.findFirst({
    where: {
      matricula: { usuarioId, ativa: true },
      turma: { professorId: req.usuario.id }
    },
    select: { id: true }
  })

  return vinculo !== null
}

const relatorioDaAluna = async (req, res) => {
  const usuarioId = req.params.usuarioId ?? req.params.id
  const mes = req.query.mes ?? mesAtual()

  try {
    const aluna = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, nome: true }
    })

    if (!aluna) return res.status(404).json({ erro: 'Associada não encontrada' })

    if (!(await podeVerSaudeDe(req, usuarioId))) {
      return res.status(403).json({ erro: 'Acesso negado' })
    }

    const relatorio = await montarRelatorio(usuarioId, mes)
    if (!relatorio) {
      return res.status(400).json({ erro: 'O parâmetro "mes" deve estar no formato AAAA-MM' })
    }

    res.json({ aluna, ...relatorio })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// Panorama da turma: o que o professor precisa ver antes da aula — quem anotou
// dor recente e há quanto tempo cada uma registrou.
const saudeDaTurma = async (req, res) => {
  const turmaId = Number(req.params.turmaId)

  if (!Number.isInteger(turmaId)) {
    return res.status(400).json({ erro: 'Turma inválida' })
  }

  try {
    const turma = await prisma.turma.findUnique({
      where: { id: turmaId },
      select: { id: true, nome: true, professorId: true }
    })

    if (!turma) return res.status(404).json({ erro: 'Turma não encontrada' })
    if (req.usuario.papel === 'PROFESSOR' && turma.professorId !== req.usuario.id) {
      return res.status(403).json({ erro: 'Acesso negado' })
    }

    const matriculas = await prisma.matricula.findMany({
      where: { turmasVinculadas: { some: { turmaId } }, ativa: true },
      orderBy: { usuario: { nome: 'asc' } },
      select: { usuario: { select: { id: true, nome: true } } }
    })

    const usuarioIds = matriculas.map((m) => m.usuario.id)

    // Últimos 30 dias: o que ainda é útil pra montar a aula de hoje.
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const desde = new Date(`${dataISO(trintaDiasAtras)}T00:00:00.000Z`)
    const registros = await prisma.registroSaude.findMany({
      where: { usuarioId: { in: usuarioIds }, data: { gte: desde } },
      orderBy: { data: 'desc' }
    })

    const alunas = matriculas.map(({ usuario }) => {
      const dela = registros.filter((r) => r.usuarioId === usuario.id)
      const ultimo = dela[0] ?? null

      return {
        usuarioId: usuario.id,
        nome: usuario.nome,
        registrosNoPeriodo: dela.length,
        ultimoRegistro: ultimo ? serializarRegistro(ultimo) : null
      }
    })

    res.json({ turma: { id: turma.id, nome: turma.nome }, alunas })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = {
  meusRegistros,
  registrar,
  apagarRegistro,
  meuRelatorio,
  relatorioDaAluna,
  saudeDaTurma
}
