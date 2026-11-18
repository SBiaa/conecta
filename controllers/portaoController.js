const prisma = require('../db')
const { normalizarTag, verificarPorTag, verificarPorUsuarioId, tagsLiberadas, configuracao } = require('../utils/acessoPortao')
const { gerarToken, hashToken } = require('../middlewares/dispositivo')

// ---------------------------------------------------------------------------
// Rotas chamadas pelo aparelho do portão (autenticadas por token do dispositivo)
// ---------------------------------------------------------------------------

// POST /portao/verificar  { tag }
const verificar = async (req, res) => {
  const tag = normalizarTag(req.body?.tag)
  if (!tag) {
    return res.status(400).json({ erro: 'Tag inválida' })
  }

  try {
    const { usuario, liberado, motivo, mensagem } = await verificarPorTag(tag)
    await prisma.acessoPortao.create({
      data: { dispositivoId: req.dispositivo.id, tagNfc: tag, usuarioId: usuario?.id ?? null, liberado, motivo }
    })
    res.json({ liberado, mensagem })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// GET /portao/liberados — lista pra o aparelho decidir sozinho se ficar sem internet
const liberados = async (req, res) => {
  try {
    res.json({ geradoEm: new Date(), tags: await tagsLiberadas() })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// POST /portao/acessos-offline  { acessos: [{ tag, liberado, segundosAtras }] }
// Entradas decididas pelo aparelho enquanto estava sem internet. O aparelho não
// tem relógio confiável, então manda há quantos segundos aconteceu.
const registrarOffline = async (req, res) => {
  const lista = Array.isArray(req.body?.acessos) ? req.body.acessos.slice(0, 200) : null
  if (!lista) {
    return res.status(400).json({ erro: 'Envie "acessos" como lista' })
  }

  try {
    const agora = Date.now()
    const validos = lista
      .map((a) => ({ ...a, tag: normalizarTag(a?.tag) }))
      .filter((a) => a.tag && typeof a.liberado === 'boolean')
    const tags = [...new Set(validos.map((a) => a.tag))]
    const usuarios = await prisma.usuario.findMany({ where: { tagNfc: { in: tags } }, select: { id: true, tagNfc: true } })
    const porTag = new Map(usuarios.map((u) => [u.tagNfc, u.id]))

    const segundos = (a) => Math.min(Math.max(Number(a.segundosAtras) || 0, 0), 7 * 24 * 3600)
    await prisma.acessoPortao.createMany({
      data: validos.map((a) => ({
        dispositivoId: req.dispositivo.id,
        tagNfc: a.tag,
        usuarioId: porTag.get(a.tag) ?? null,
        liberado: a.liberado,
        motivo: a.liberado ? 'OFFLINE_LISTA' : 'OFFLINE_FORA_DA_LISTA',
        offline: true,
        criadoEm: new Date(agora - segundos(a) * 1000)
      }))
    })
    res.json({ registrados: validos.length })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// ---------------------------------------------------------------------------
// Rotas da coordenação (ADMIN)
// ---------------------------------------------------------------------------

const SELECT_DISPOSITIVO = { id: true, nome: true, ativo: true, criadoEm: true, ultimoContato: true }

const listarDispositivos = async (req, res) => {
  try {
    res.json(await prisma.dispositivo.findMany({ select: SELECT_DISPOSITIVO, orderBy: { id: 'asc' } }))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// O token só aparece nesta resposta — depois disso só existe o hash no banco.
const criarDispositivo = async (req, res) => {
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim() : ''
  if (!nome) {
    return res.status(400).json({ erro: 'Informe o nome do dispositivo' })
  }

  try {
    const token = gerarToken()
    const dispositivo = await prisma.dispositivo.create({
      data: { nome, tokenHash: hashToken(token) },
      select: SELECT_DISPOSITIVO
    })
    res.status(201).json({ ...dispositivo, token })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const atualizarDispositivo = async (req, res) => {
  const id = Number(req.params.id)
  const data = {}
  if (typeof req.body?.nome === 'string' && req.body.nome.trim()) data.nome = req.body.nome.trim()
  if (typeof req.body?.ativo === 'boolean') data.ativo = req.body.ativo

  try {
    const existe = await prisma.dispositivo.findUnique({ where: { id } })
    if (!existe) return res.status(404).json({ erro: 'Dispositivo não encontrado' })
    res.json(await prisma.dispositivo.update({ where: { id }, data, select: SELECT_DISPOSITIVO }))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// Gera token novo (ex.: aparelho roubado ou token vazou); o antigo para na hora.
const novoTokenDispositivo = async (req, res) => {
  const id = Number(req.params.id)
  try {
    const existe = await prisma.dispositivo.findUnique({ where: { id } })
    if (!existe) return res.status(404).json({ erro: 'Dispositivo não encontrado' })
    const token = gerarToken()
    const dispositivo = await prisma.dispositivo.update({
      where: { id },
      data: { tokenHash: hashToken(token) },
      select: SELECT_DISPOSITIVO
    })
    res.json({ ...dispositivo, token })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// GET /acesso-portao/acessos?limite=100&usuarioId=...&negados=true
const listarAcessos = async (req, res) => {
  const limite = Math.min(Math.max(Number(req.query.limite) || 100, 1), 500)
  const where = {}
  if (req.query.usuarioId) where.usuarioId = String(req.query.usuarioId)
  if (req.query.negados === 'true') where.liberado = false

  try {
    const acessos = await prisma.acessoPortao.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: limite,
      select: {
        id: true,
        tagNfc: true,
        liberado: true,
        motivo: true,
        offline: true,
        criadoEm: true,
        usuario: { select: { id: true, nome: true } },
        dispositivo: { select: { id: true, nome: true } }
      }
    })
    res.json(acessos)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// Cadastro de chaveiro novo: a coordenação encosta o chaveiro no leitor do
// portão (dá "Cartão não cadastrado"), e ele aparece aqui pra ser vinculado.
const tagsDesconhecidas = async (req, res) => {
  try {
    const leituras = await prisma.acessoPortao.findMany({
      where: { motivo: 'TAG_DESCONHECIDA', criadoEm: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
      orderBy: { criadoEm: 'desc' },
      select: { tagNfc: true, criadoEm: true, dispositivo: { select: { nome: true } } },
      take: 200
    })
    const jaCadastradas = new Set(
      (await prisma.usuario.findMany({
        where: { tagNfc: { in: [...new Set(leituras.map((l) => l.tagNfc))] } },
        select: { tagNfc: true }
      })).map((u) => u.tagNfc)
    )
    const vistas = new Set()
    const resultado = []
    for (const l of leituras) {
      if (vistas.has(l.tagNfc) || jaCadastradas.has(l.tagNfc)) continue
      vistas.add(l.tagNfc)
      resultado.push({ tagNfc: l.tagNfc, lidaEm: l.criadoEm, dispositivo: l.dispositivo.nome })
    }
    res.json(resultado.slice(0, 20))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// PUT /acesso-portao/usuarios/:id/tag  { tagNfc }
const vincularTag = async (req, res) => {
  const { id } = req.params
  const tag = normalizarTag(req.body?.tagNfc)
  if (!tag) {
    return res.status(400).json({ erro: 'Tag inválida' })
  }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id }, select: { id: true } })
    if (!usuario) return res.status(404).json({ erro: 'Associado não encontrado' })

    const dono = await prisma.usuario.findUnique({ where: { tagNfc: tag }, select: { id: true, nome: true } })
    if (dono && dono.id !== id) {
      return res.status(409).json({ erro: `Esse cartão já é de ${dono.nome}. Desvincule antes.` })
    }

    res.json(await prisma.usuario.update({ where: { id }, data: { tagNfc: tag }, select: { id: true, nome: true, tagNfc: true } }))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const desvincularTag = async (req, res) => {
  const { id } = req.params
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id }, select: { id: true } })
    if (!usuario) return res.status(404).json({ erro: 'Associado não encontrado' })
    res.json(await prisma.usuario.update({ where: { id }, data: { tagNfc: null }, select: { id: true, nome: true, tagNfc: true } }))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// GET /acesso-portao/usuarios/:id/situacao — "essa aluna entraria agora? por quê?"
const situacao = async (req, res) => {
  try {
    const resultado = await verificarPorUsuarioId(req.params.id)
    if (!resultado) return res.status(404).json({ erro: 'Associado não encontrado' })
    const { usuario, liberado, motivo, mensagem } = resultado
    res.json({ usuarioId: usuario.id, nome: usuario.nome, tagNfc: usuario.tagNfc, liberado, motivo, mensagem, regra: configuracao() })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = {
  verificar,
  liberados,
  registrarOffline,
  listarDispositivos,
  criarDispositivo,
  atualizarDispositivo,
  novoTokenDispositivo,
  listarAcessos,
  tagsDesconhecidas,
  vincularTag,
  desvincularTag,
  situacao
}
