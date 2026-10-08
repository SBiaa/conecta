const prisma = require('../db')

const NIVEIS = ['ADAPTACAO', 'INICIANTE', 'INTERMEDIARIO', 'AVANCADO']

// O fuso do servidor pode não ser o de Brasília: monta "hoje" pelos componentes
// locais, igual ao saudeController, pra não virar o dia às 21h.
function hojeLocalISO() {
  const agora = new Date()
  const ano = agora.getFullYear()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

const NIVEL_COM_AUTOR = {
  include: { registradoPor: { select: { id: true, nome: true } } }
}

function serializarNivel(registro) {
  return {
    id: registro.id,
    data: registro.data.toISOString().slice(0, 10),
    nivel: registro.nivel,
    observacao: registro.observacao,
    registradoPor: registro.registradoPor
      ? { id: registro.registradoPor.id, nome: registro.registradoPor.nome }
      : null
  }
}

// Linha do tempo (mais recente primeiro) + nível atual, que é só o primeiro item.
async function historicoDeNivel(usuarioId) {
  const registros = await prisma.nivelNatacaoRegistro.findMany({
    where: { usuarioId },
    orderBy: [{ data: 'desc' }, { id: 'desc' }],
    ...NIVEL_COM_AUTOR
  })
  const historico = registros.map(serializarNivel)
  return { nivelAtual: historico[0] ?? null, historico }
}

// Admin vê qualquer um. Professor só mexe em quem está numa turma dele.
async function podeGerenciar(req, usuarioId) {
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

const listar = async (req, res) => {
  const usuarioId = req.params.usuarioId ?? req.params.id

  try {
    if (!(await podeGerenciar(req, usuarioId))) {
      return res.status(403).json({ erro: 'Acesso negado' })
    }
    res.json(await historicoDeNivel(usuarioId))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const registrar = async (req, res) => {
  const usuarioId = req.params.usuarioId ?? req.params.id
  const { nivel, data, observacao } = req.body ?? {}

  if (!NIVEIS.includes(nivel)) {
    return res.status(400).json({ erro: 'Escolha um nível válido' })
  }

  if (data !== undefined && data !== null && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({ erro: 'A data deve estar no formato AAAA-MM-DD' })
  }
  const texto = data ?? hojeLocalISO()
  const dataConvertida = new Date(`${texto}T00:00:00.000Z`)
  if (Number.isNaN(dataConvertida.getTime())) {
    return res.status(400).json({ erro: 'Data inválida' })
  }
  if (texto > hojeLocalISO()) {
    return res.status(400).json({ erro: 'Não dá pra registrar uma data no futuro' })
  }

  const obs =
    observacao === undefined || observacao === null || String(observacao).trim() === ''
      ? null
      : String(observacao).trim().slice(0, 500)

  try {
    const aluno = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } })
    if (!aluno) return res.status(404).json({ erro: 'Aluno não encontrado' })

    if (!(await podeGerenciar(req, usuarioId))) {
      return res.status(403).json({ erro: 'Acesso negado' })
    }

    const registro = await prisma.nivelNatacaoRegistro.create({
      data: { usuarioId, nivel, data: dataConvertida, observacao: obs, registradoPorId: req.usuario.id },
      ...NIVEL_COM_AUTOR
    })

    res.status(201).json(serializarNivel(registro))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const apagar = async (req, res) => {
  const usuarioId = req.params.usuarioId ?? req.params.id
  const id = Number(req.params.registroId)

  if (!Number.isInteger(id)) {
    return res.status(400).json({ erro: 'Registro inválido' })
  }

  try {
    if (!(await podeGerenciar(req, usuarioId))) {
      return res.status(403).json({ erro: 'Acesso negado' })
    }

    const registro = await prisma.nivelNatacaoRegistro.findUnique({ where: { id } })
    if (!registro || registro.usuarioId !== usuarioId) {
      return res.status(404).json({ erro: 'Registro não encontrado' })
    }

    await prisma.nivelNatacaoRegistro.delete({ where: { id } })
    res.json({ ok: true })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// Panorama da turma: nível atual de cada criança, pra professora ver na chamada.
const niveisDaTurma = async (req, res) => {
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
    const registros = await prisma.nivelNatacaoRegistro.findMany({
      where: { usuarioId: { in: usuarioIds } },
      orderBy: [{ data: 'desc' }, { id: 'desc' }],
      ...NIVEL_COM_AUTOR
    })

    const alunos = matriculas.map(({ usuario }) => {
      const ultimo = registros.find((r) => r.usuarioId === usuario.id)
      return {
        usuarioId: usuario.id,
        nome: usuario.nome,
        nivelAtual: ultimo ? serializarNivel(ultimo) : null
      }
    })

    res.json({ turma: { id: turma.id, nome: turma.nome }, alunos })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { listar, registrar, apagar, niveisDaTurma, historicoDeNivel }
