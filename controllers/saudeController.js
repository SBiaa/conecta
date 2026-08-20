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

// Prisma devolve Decimal; no JSON fica mais simples como number.
function numeroOuNulo(valor) {
  return valor === null || valor === undefined ? null : Number(valor)
}

function serializarRegistro(registro) {
  return {
    id: registro.id,
    data: dataISO(registro.data),
    peso: numeroOuNulo(registro.peso),
    nivelDor: registro.nivelDor,
    locaisDor: registro.locaisDor,
    disposicao: registro.disposicao,
    observacao: registro.observacao,
    percentualGordura: numeroOuNulo(registro.percentualGordura),
    percentualAgua: numeroOuNulo(registro.percentualAgua),
    massaMuscular: numeroOuNulo(registro.massaMuscular),
    massaOssea: numeroOuNulo(registro.massaOssea),
    gorduraVisceral: registro.gorduraVisceral,
    taxaMetabolica: registro.taxaMetabolica
  }
}

// Faixas de cada campo numerico. As bordas sao largas de proposito: servem pra
// pegar dedo escorregado (peso 700, gordura 300%), nao pra julgar corpo.
const CAMPOS_REGISTRO = {
  peso: { nome: 'O peso', min: 20, max: 400, casas: 2 },
  nivelDor: { nome: 'O nível de dor', min: 0, max: 5, inteiro: true },
  disposicao: { nome: 'A disposição', min: 1, max: 5, inteiro: true },
  percentualGordura: { nome: 'O percentual de gordura', min: 3, max: 70, casas: 1 },
  percentualAgua: { nome: 'O percentual de água', min: 20, max: 80, casas: 1 },
  massaMuscular: { nome: 'A massa muscular', min: 5, max: 150, casas: 2 },
  massaOssea: { nome: 'A massa óssea', min: 0.5, max: 10, casas: 2 },
  gorduraVisceral: { nome: 'A gordura visceral', min: 1, max: 59, inteiro: true },
  taxaMetabolica: { nome: 'A taxa metabólica', min: 500, max: 5000, inteiro: true }
}

// Campo em branco vira null sem reclamar — na ficha quase tudo e opcional.
// Devolve { valor } ou { erro }.
function numeroOpcional(bruto, { nome, min, max, inteiro = false, casas = 2 }) {
  if (bruto === undefined || bruto === null || bruto === '') return { valor: null }

  // Aceita "67,5" alem de "67.5": e o que o teclado do celular oferece em pt-BR.
  const numero = typeof bruto === 'string' ? Number(bruto.replace(',', '.')) : Number(bruto)

  if (!Number.isFinite(numero)) return { erro: `${nome} precisa ser um número` }
  if (inteiro && !Number.isInteger(numero)) return { erro: `${nome} precisa ser um número inteiro` }
  if (numero < min || numero > max) return { erro: `${nome} deve estar entre ${min} e ${max}` }

  const fator = 10 ** casas
  return { valor: inteiro ? numero : Math.round(numero * fator) / fator }
}

// Valida a data de um registro. Devolve { data, texto } ou { erro }.
function dataOpcional(data) {
  if (data !== undefined && data !== null && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { erro: 'A data deve estar no formato AAAA-MM-DD' }
  }

  const texto = data ?? hojeLocalISO()
  const convertida = new Date(`${texto}T00:00:00.000Z`)

  if (Number.isNaN(convertida.getTime())) return { erro: 'Data inválida' }
  // Comparacao em texto: os dois lados sao o dia local, sem fuso no meio.
  if (texto > hojeLocalISO()) return { erro: 'Não dá pra registrar uma data no futuro' }

  return { data: convertida, texto }
}

// Devolve { dados } ou { erro } com a mensagem pronta pro 400.
function validarRegistro(corpo) {
  const { locaisDor, observacao } = corpo ?? {}

  const { data, erro: erroData } = dataOpcional(corpo?.data)
  if (erroData) return { erro: erroData }

  const numeros = {}
  for (const [campo, regra] of Object.entries(CAMPOS_REGISTRO)) {
    const { valor, erro } = numeroOpcional(corpo?.[campo], regra)
    if (erro) return { erro }
    numeros[campo] = valor
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
    Object.values(numeros).every((v) => v === null) &&
    observacaoValidada === null &&
    locaisValidados.length === 0

  if (vazio) {
    return { erro: 'Preencha pelo menos um dado do registro' }
  }

  return {
    dados: { data, ...numeros, locaisDor: locaisValidados, observacao: observacaoValidada }
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
// Primeiro, ultimo e variacao de um campo numerico ao longo do periodo.
// Os registros chegam ordenados por data crescente.
function evolucaoDe(registros, campo, casas = 2) {
  const comValor = registros.filter((r) => r[campo] !== null)

  if (comValor.length === 0) {
    return { primeiro: null, ultimo: null, variacao: null, serie: [] }
  }

  const primeiro = comValor[0][campo]
  const ultimo = comValor[comValor.length - 1][campo]
  const fator = 10 ** casas

  return {
    primeiro,
    ultimo,
    // Uma leitura so nao e variacao — e so um ponto.
    variacao: comValor.length > 1 ? Math.round((ultimo - primeiro) * fator) / fator : null,
    serie: comValor.map((r) => ({ data: r.data, valor: r[campo] }))
  }
}

// IMC arredondado a uma casa. Sem altura cadastrada nao da pra calcular.
function calcularImc(peso, alturaCm) {
  if (peso === null || peso === undefined || !alturaCm) return null
  const metros = alturaCm / 100
  return Math.round((peso / (metros * metros)) * 10) / 10
}

function serializarAvaliacao(avaliacao) {
  return {
    id: avaliacao.id,
    data: dataISO(avaliacao.data),
    cintura: numeroOuNulo(avaliacao.cintura),
    quadril: numeroOuNulo(avaliacao.quadril),
    braco: numeroOuNulo(avaliacao.braco),
    coxa: numeroOuNulo(avaliacao.coxa),
    panturrilha: numeroOuNulo(avaliacao.panturrilha),
    torax: numeroOuNulo(avaliacao.torax),
    observacao: avaliacao.observacao,
    registradoPor: avaliacao.registradoPor ? avaliacao.registradoPor.nome : null
  }
}

// Campos da balanca e quantas casas decimais cada um carrega.
const CAMPOS_COMPOSICAO = [
  ['percentualGordura', 1],
  ['percentualAgua', 1],
  ['massaMuscular', 2],
  ['massaOssea', 2],
  ['gorduraVisceral', 0],
  ['taxaMetabolica', 0]
]

// Resume peso, composicao corporal, dor e disposicao de uma lista ja serializada.
function resumirSaude(registros) {
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
    peso: evolucaoDe(registros, 'peso'),
    // Chaveado pelo proprio nome do campo: e assim que a tela indexa, e evita
    // que os dois lados sigam nomes diferentes pro mesmo numero.
    composicao: Object.fromEntries(
      CAMPOS_COMPOSICAO.map(([campo, casas]) => [campo, evolucaoDe(registros, campo, casas)])
    ),
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

const AVALIACAO_COM_AUTOR = {
  include: { registradoPor: { select: { nome: true } } }
}

// Monta o relatório mensal completo de um usuário. Usado pela aluna (nela mesma),
// pelo professor da turma dela e pelo admin — a checagem de permissão fica fora.
async function montarRelatorio(usuarioId, mes) {
  const intervalo = intervaloDoMes(mes)
  if (!intervalo) return null

  const mesAnterior = mesAnteriorDe(mes)
  const intervaloAnterior = intervaloDoMes(mesAnterior)

  const [usuario, frequencia, registros, frequenciaAnterior, registrosAnteriores, avaliacoes, ultimaAvaliacao] =
    await Promise.all([
      prisma.usuario.findUnique({ where: { id: usuarioId }, select: { alturaCm: true } }),
      frequenciaDoPeriodo(usuarioId, intervalo),
      registrosDoPeriodo(usuarioId, intervalo),
      frequenciaDoPeriodo(usuarioId, intervaloAnterior),
      registrosDoPeriodo(usuarioId, intervaloAnterior),
      prisma.avaliacao.findMany({
        where: { usuarioId, data: { gte: intervalo.inicio, lt: intervalo.fim } },
        orderBy: { data: 'asc' },
        ...AVALIACAO_COM_AUTOR
      }),
      // A ultima avaliacao de todas, mesmo fora do mes: e ela que serve de
      // referencia quando a associada nao foi medida neste mes.
      prisma.avaliacao.findFirst({
        where: { usuarioId },
        orderBy: { data: 'desc' },
        ...AVALIACAO_COM_AUTOR
      })
    ])

  const resumo = resumirSaude(registros)
  const resumoAnterior = resumirSaude(registrosAnteriores)
  const alturaCm = usuario?.alturaCm ?? null

  return {
    mes,
    alturaCm,
    imc: calcularImc(resumo.peso.ultimo, alturaCm),
    frequencia,
    ...resumo,
    registros,
    avaliacoes: avaliacoes.map(serializarAvaliacao),
    ultimaAvaliacao: ultimaAvaliacao ? serializarAvaliacao(ultimaAvaliacao) : null,
    comparativo: {
      mes: mesAnterior,
      frequenciaPercentual: frequenciaAnterior.percentual,
      pesoUltimo: resumoAnterior.peso.ultimo,
      imc: calcularImc(resumoAnterior.peso.ultimo, alturaCm),
      gorduraUltima: resumoAnterior.composicao.percentualGordura.ultimo,
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

/* ---------- avaliação física (medidas de fita) ---------- */

const CAMPOS_AVALIACAO = {
  cintura: { nome: 'A cintura', min: 30, max: 250, casas: 1 },
  quadril: { nome: 'O quadril', min: 30, max: 250, casas: 1 },
  braco: { nome: 'O braço', min: 10, max: 100, casas: 1 },
  coxa: { nome: 'A coxa', min: 20, max: 150, casas: 1 },
  panturrilha: { nome: 'A panturrilha', min: 15, max: 100, casas: 1 },
  torax: { nome: 'O tórax', min: 40, max: 200, casas: 1 }
}

// A altura mora no Usuario, nao na avaliacao: e propriedade da pessoa, nao do
// evento. Mas e medida junto, entao entra no mesmo formulario.
const REGRA_ALTURA = { nome: 'A altura', min: 100, max: 250, inteiro: true }

function validarAvaliacao(corpo) {
  const { data, erro: erroData } = dataOpcional(corpo?.data)
  if (erroData) return { erro: erroData }

  const medidas = {}
  for (const [campo, regra] of Object.entries(CAMPOS_AVALIACAO)) {
    const { valor, erro } = numeroOpcional(corpo?.[campo], regra)
    if (erro) return { erro }
    medidas[campo] = valor
  }

  const { valor: alturaCm, erro: erroAltura } = numeroOpcional(corpo?.alturaCm, REGRA_ALTURA)
  if (erroAltura) return { erro: erroAltura }

  const observacao =
    corpo?.observacao === undefined || corpo?.observacao === null || String(corpo.observacao).trim() === ''
      ? null
      : String(corpo.observacao).trim().slice(0, 500)

  const vazia = Object.values(medidas).every((v) => v === null) && alturaCm === null && observacao === null
  if (vazia) {
    return { erro: 'Preencha pelo menos uma medida' }
  }

  return { dados: { data, ...medidas, observacao }, alturaCm }
}

const registrarAvaliacao = async (req, res) => {
  const usuarioId = req.params.usuarioId ?? req.params.id

  const { dados, alturaCm, erro: erroValidacao } = validarAvaliacao(req.body)
  if (erroValidacao) return res.status(400).json({ erro: erroValidacao })

  try {
    const aluna = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } })
    if (!aluna) return res.status(404).json({ erro: 'Associada não encontrada' })

    if (!(await podeVerSaudeDe(req, usuarioId))) {
      return res.status(403).json({ erro: 'Acesso negado' })
    }

    // A altura so e sobrescrita quando vem preenchida — mandar o formulario sem
    // ela nao pode apagar a que ja estava cadastrada.
    const operacoes = [
      prisma.avaliacao.upsert({
        where: { usuarioId_data: { usuarioId, data: dados.data } },
        create: { usuarioId, registradoPorId: req.usuario.id, ...dados },
        update: { registradoPorId: req.usuario.id, ...dados },
        ...AVALIACAO_COM_AUTOR
      })
    ]

    if (alturaCm !== null) {
      operacoes.push(prisma.usuario.update({ where: { id: usuarioId }, data: { alturaCm } }))
    }

    const [avaliacao] = await prisma.$transaction(operacoes)

    res.status(201).json(serializarAvaliacao(avaliacao))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const listarAvaliacoes = async (req, res) => {
  const usuarioId = req.params.usuarioId ?? req.params.id

  try {
    if (!(await podeVerSaudeDe(req, usuarioId))) {
      return res.status(403).json({ erro: 'Acesso negado' })
    }

    const avaliacoes = await prisma.avaliacao.findMany({
      where: { usuarioId },
      orderBy: { data: 'desc' },
      ...AVALIACAO_COM_AUTOR
    })

    res.json(avaliacoes.map(serializarAvaliacao))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const apagarAvaliacao = async (req, res) => {
  const usuarioId = req.params.usuarioId ?? req.params.id
  const id = Number(req.params.avaliacaoId)

  if (!Number.isInteger(id)) {
    return res.status(400).json({ erro: 'Avaliação inválida' })
  }

  try {
    if (!(await podeVerSaudeDe(req, usuarioId))) {
      return res.status(403).json({ erro: 'Acesso negado' })
    }

    const avaliacao = await prisma.avaliacao.findUnique({ where: { id } })
    if (!avaliacao || avaliacao.usuarioId !== usuarioId) {
      return res.status(404).json({ erro: 'Avaliação não encontrada' })
    }

    await prisma.avaliacao.delete({ where: { id } })
    res.json({ ok: true })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// A associada le as proprias avaliacoes, mas nao registra nem apaga: quem mede
// e a professora ou a coordenacao.
const minhasAvaliacoes = async (req, res) => {
  try {
    const avaliacoes = await prisma.avaliacao.findMany({
      where: { usuarioId: req.usuario.id },
      orderBy: { data: 'desc' },
      ...AVALIACAO_COM_AUTOR
    })

    res.json(avaliacoes.map(serializarAvaliacao))
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
  minhasAvaliacoes,
  relatorioDaAluna,
  saudeDaTurma,
  registrarAvaliacao,
  listarAvaliacoes,
  apagarAvaliacao
}
