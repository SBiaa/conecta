const prisma = require('../db')
const { generateClientTokenFromReadWriteToken } = require('@vercel/blob/client')
const { del } = require('@vercel/blob')

// Tipos de arquivo aceitos na galeria. HEIC é o formato padrão da câmera do
// iPhone; MOV é o vídeo do iPhone.
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const TIPOS_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp']
const TAMANHO_MAXIMO = 200 * 1024 * 1024 // 200 MB — vídeo de celular de poucos minutos
const LIMITE_LEGENDA = 300

const ehAdmin = (usuario) => usuario.papel === 'ADMIN'
const idNumerico = (valor) => {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : null
}
const textoOuNulo = (valor) => {
  if (valor === undefined || valor === null) return null
  const texto = String(valor).trim()
  return texto === '' ? null : texto
}
const dataOuNula = (valor) => {
  if (!valor) return null
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? undefined : data
}

// O porteiro: admin vê qualquer viagem; o resto só as que participa (e só se a
// viagem estiver ativa). Devolve null quando a pessoa não pode ver.
const buscarViagemVisivel = async (usuario, viagemId) => {
  if (ehAdmin(usuario)) {
    return prisma.viagem.findUnique({ where: { id: viagemId } })
  }
  return prisma.viagem.findFirst({
    where: { id: viagemId, ativa: true, participantes: { some: { usuarioId: usuario.id } } }
  })
}

// Carrega a viagem do :id já conferindo acesso. Responde o erro e devolve null
// quando não pode seguir, pra cada rota não repetir o mesmo bloco.
const carregarViagem = async (req, res) => {
  const viagemId = idNumerico(req.params.id)
  if (!viagemId) {
    res.status(400).json({ erro: 'Viagem inválida' })
    return null
  }
  const viagem = await buscarViagemVisivel(req.usuario, viagemId)
  if (!viagem) {
    res.status(404).json({ erro: 'Viagem não encontrada' })
    return null
  }
  return viagem
}

const comErro = (handler) => async (req, res) => {
  try {
    await handler(req, res)
  } catch (erro) {
    console.error(erro)
    if (!res.headersSent) res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const selecionarPessoa = { id: true, nome: true, fotoUrl: true }

// ---------------------------------------------------------------------------
// Participante (e admin)
// ---------------------------------------------------------------------------

// Admin: todas (ativas primeiro). Demais: só as ativas de que participa.
const listar = comErro(async (req, res) => {
  const where = ehAdmin(req.usuario)
    ? {}
    : { ativa: true, participantes: { some: { usuarioId: req.usuario.id } } }

  const viagens = await prisma.viagem.findMany({
    where,
    orderBy: [{ ativa: 'desc' }, { dataSaida: 'asc' }, { criadoEm: 'desc' }],
    include: { _count: { select: { participantes: true, midias: true } } }
  })
  res.json(viagens)
})

const detalhar = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return

  const [eventos, avisos, itens, participantes] = await Promise.all([
    prisma.viagemEvento.findMany({ where: { viagemId: viagem.id }, orderBy: { inicio: 'asc' } }),
    prisma.viagemAviso.findMany({
      where: { viagemId: viagem.id },
      orderBy: [{ importante: 'desc' }, { criadoEm: 'desc' }],
      include: { autor: { select: { id: true, nome: true } } }
    }),
    prisma.viagemChecklistItem.findMany({
      where: { viagemId: viagem.id },
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
      include: { marcados: { where: { usuarioId: req.usuario.id }, select: { id: true } } }
    }),
    prisma.viagemParticipante.findMany({
      where: { viagemId: viagem.id },
      include: { usuario: { select: { ...selecionarPessoa, papel: true } } },
      orderBy: { usuario: { nome: 'asc' } }
    })
  ])

  res.json({
    ...viagem,
    eventos,
    avisos,
    checklist: itens.map(({ marcados, ...item }) => ({ ...item, marcado: marcados.length > 0 })),
    participantes: participantes.map((p) => p.usuario)
  })
})

const marcarChecklist = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return

  const itemId = idNumerico(req.params.itemId)
  const item = itemId && await prisma.viagemChecklistItem.findFirst({ where: { id: itemId, viagemId: viagem.id } })
  if (!item) return res.status(404).json({ erro: 'Item não encontrado' })

  const marcado = Boolean(req.body?.marcado)
  if (marcado) {
    await prisma.viagemChecklistMarcado.upsert({
      where: { itemId_usuarioId: { itemId, usuarioId: req.usuario.id } },
      create: { itemId, usuarioId: req.usuario.id },
      update: {}
    })
  } else {
    await prisma.viagemChecklistMarcado.deleteMany({ where: { itemId, usuarioId: req.usuario.id } })
  }
  res.json({ id: itemId, marcado })
})

// Galeria. A nota de cada envio só aparece pra coordenação e pra quem enviou —
// ninguém vê a nota baixa da colega, só o total no ranking.
const listarMidias = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return

  const where = { viagemId: viagem.id }
  if (ehAdmin(req.usuario) && req.query.semNota === '1') where.nota = null

  const midias = await prisma.viagemMidia.findMany({
    where,
    orderBy: { criadoEm: 'desc' },
    include: { autor: { select: selecionarPessoa } }
  })

  const admin = ehAdmin(req.usuario)
  res.json(midias.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    url: m.url,
    legenda: m.legenda,
    criadoEm: m.criadoEm,
    autor: m.autor,
    nota: admin || m.autorId === req.usuario.id ? m.nota : undefined,
    podeApagar: admin || m.autorId === req.usuario.id
  })))
})

// O id da loja (store) vem embutido no token: vercel_blob_rw_<storeId>_<segredo>.
// É ele que aparece no domínio das URLs públicas.
const idDaLoja = () => {
  const token = process.env.BLOB_READ_WRITE_TOKEN || ''
  const partes = token.split('_')
  return partes.length >= 5 ? partes[3].toLowerCase() : null
}

const prefixoDoUsuario = (viagemId, usuarioId) => `viagens/${viagemId}/${usuarioId}/`

const nomeSeguro = (nome) => {
  const limpo = String(nome || 'arquivo')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(-80)
  return limpo || 'arquivo'
}

// Gera um token curto que deixa o navegador mandar UM arquivo direto pro Vercel
// Blob, só naquele caminho, só dos tipos aceitos. Assim o vídeo não passa pela
// API (que tem limite de corpo de 3 MB).
const tokenDeUpload = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ erro: 'O envio de fotos ainda não foi configurado. Avise a coordenação.' })
  }

  const contentType = String(req.body?.contentType || '').toLowerCase()
  if (![...TIPOS_FOTO, ...TIPOS_VIDEO].includes(contentType)) {
    return res.status(400).json({ erro: 'Esse tipo de arquivo não é aceito. Envie uma foto ou um vídeo.' })
  }

  const pathname = `${prefixoDoUsuario(viagem.id, req.usuario.id)}${Date.now()}-${nomeSeguro(req.body?.nome)}`
  const token = await generateClientTokenFromReadWriteToken({
    pathname,
    allowedContentTypes: [contentType],
    maximumSizeInBytes: TAMANHO_MAXIMO,
    addRandomSuffix: true,
    validUntil: Date.now() + 60 * 60 * 1000
  })

  res.json({ token, pathname, tamanhoMaximo: TAMANHO_MAXIMO })
})

// Depois que o arquivo subiu, o navegador registra o link aqui. Conferimos que
// o link é da nossa loja e da pasta desta pessoa nesta viagem — senão daria
// pra registrar qualquer endereço da internet como "foto da viagem".
const registrarMidia = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return

  const { url, tipo } = req.body || {}
  if (!['FOTO', 'VIDEO'].includes(tipo)) {
    return res.status(400).json({ erro: 'Tipo inválido' })
  }

  let endereco
  try {
    endereco = new URL(url)
  } catch {
    return res.status(400).json({ erro: 'Link do arquivo inválido' })
  }

  const loja = idDaLoja()
  const hostValido = endereco.protocol === 'https:' &&
    endereco.hostname.endsWith('.public.blob.vercel-storage.com') &&
    (!loja || endereco.hostname.startsWith(`${loja}.`))
  const caminhoValido = decodeURIComponent(endereco.pathname).startsWith(`/${prefixoDoUsuario(viagem.id, req.usuario.id)}`)
  if (!hostValido || !caminhoValido) {
    return res.status(400).json({ erro: 'Link do arquivo inválido' })
  }

  const legenda = textoOuNulo(req.body.legenda)
  if (legenda && legenda.length > LIMITE_LEGENDA) {
    return res.status(400).json({ erro: `A legenda pode ter até ${LIMITE_LEGENDA} letras` })
  }

  const midia = await prisma.viagemMidia.create({
    data: { viagemId: viagem.id, autorId: req.usuario.id, tipo, url: endereco.toString(), legenda },
    include: { autor: { select: selecionarPessoa } }
  })
  res.status(201).json({ ...midia, podeApagar: true })
})

const apagarMidia = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return

  const midiaId = idNumerico(req.params.midiaId)
  const midia = midiaId && await prisma.viagemMidia.findFirst({ where: { id: midiaId, viagemId: viagem.id } })
  if (!midia) return res.status(404).json({ erro: 'Arquivo não encontrado' })

  if (!ehAdmin(req.usuario) && midia.autorId !== req.usuario.id) {
    return res.status(403).json({ erro: 'Só quem enviou pode apagar' })
  }

  await prisma.viagemMidia.delete({ where: { id: midia.id } })
  // Apaga o arquivo da loja também. Se falhar, o registro já saiu da galeria;
  // fica só um arquivo órfão, que não aparece pra ninguém.
  try {
    await del(midia.url)
  } catch (erro) {
    console.error('Não foi possível apagar o arquivo do Blob', erro)
  }
  res.json({ ok: true })
})

// Pontos = soma das estrelas dadas pela coordenação. Empate: quem tem mais
// envios com 3 estrelas, depois quem tem mais envios avaliados.
const ranking = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return

  const [somas, tresEstrelas, participantes] = await Promise.all([
    prisma.viagemMidia.groupBy({
      by: ['autorId'],
      where: { viagemId: viagem.id },
      _sum: { nota: true },
      _count: { _all: true, nota: true }
    }),
    prisma.viagemMidia.groupBy({
      by: ['autorId'],
      where: { viagemId: viagem.id, nota: 3 },
      _count: { _all: true }
    }),
    prisma.viagemParticipante.findMany({
      where: { viagemId: viagem.id },
      include: { usuario: { select: selecionarPessoa } }
    })
  ])

  const porAutor = new Map(somas.map((s) => [s.autorId, s]))
  const tresPorAutor = new Map(tresEstrelas.map((t) => [t.autorId, t._count._all]))

  const linhas = participantes.map(({ usuario }) => {
    const soma = porAutor.get(usuario.id)
    return {
      usuario,
      pontos: soma?._sum.nota ?? 0,
      envios: soma?._count._all ?? 0,
      avaliados: soma?._count.nota ?? 0,
      tresEstrelas: tresPorAutor.get(usuario.id) ?? 0
    }
  })

  linhas.sort((a, b) =>
    b.pontos - a.pontos ||
    b.tresEstrelas - a.tresEstrelas ||
    b.avaliados - a.avaliados ||
    a.usuario.nome.localeCompare(b.usuario.nome, 'pt-BR')
  )

  // Posição compartilhada em empate de pontos e de 3 estrelas.
  let posicao = 0
  const resultado = linhas.map((linha, i) => {
    const anterior = linhas[i - 1]
    if (!anterior || anterior.pontos !== linha.pontos || anterior.tresEstrelas !== linha.tresEstrelas) {
      posicao = i + 1
    }
    return { ...linha, posicao }
  })

  res.json({ premio: viagem.premio, ranking: resultado })
})

// ---------------------------------------------------------------------------
// Coordenação (rotas protegidas por exigirPapel('ADMIN'))
// ---------------------------------------------------------------------------

const dadosDaViagem = (body) => {
  const nome = textoOuNulo(body.nome)
  const dataSaida = dataOuNula(body.dataSaida)
  const dataRetorno = dataOuNula(body.dataRetorno)
  if (dataSaida === undefined || dataRetorno === undefined) return { erro: 'Data inválida' }
  if (dataSaida && dataRetorno && dataRetorno < dataSaida) {
    return { erro: 'A volta não pode ser antes da ida' }
  }
  return {
    dados: {
      nome,
      destino: textoOuNulo(body.destino),
      dataSaida,
      dataRetorno,
      localSaida: textoOuNulo(body.localSaida),
      descricao: textoOuNulo(body.descricao),
      premio: textoOuNulo(body.premio),
      ...(body.ativa !== undefined ? { ativa: Boolean(body.ativa) } : {})
    }
  }
}

const criar = comErro(async (req, res) => {
  const { erro, dados } = dadosDaViagem(req.body || {})
  if (erro) return res.status(400).json({ erro })
  if (!dados.nome) return res.status(400).json({ erro: 'Dê um nome pra viagem' })

  const viagem = await prisma.viagem.create({ data: dados })
  res.status(201).json(viagem)
})

const atualizar = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return

  const { erro, dados } = dadosDaViagem(req.body || {})
  if (erro) return res.status(400).json({ erro })
  if (!dados.nome) return res.status(400).json({ erro: 'Dê um nome pra viagem' })

  const atualizada = await prisma.viagem.update({ where: { id: viagem.id }, data: dados })
  res.json(atualizada)
})

// Apagar só sem fotos/vídeos — senão o conteúdo da viagem se perderia. Pra
// tirar do ar, a coordenação desativa.
const apagar = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return

  const midias = await prisma.viagemMidia.count({ where: { viagemId: viagem.id } })
  if (midias > 0) {
    return res.status(409).json({ erro: 'Essa viagem já tem fotos e vídeos. Desative em vez de apagar.' })
  }
  await prisma.viagem.delete({ where: { id: viagem.id } })
  res.json({ ok: true })
})

const adicionarParticipantes = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return

  const ids = Array.isArray(req.body?.usuarioIds) ? req.body.usuarioIds.map(String) : []
  if (ids.length === 0) return res.status(400).json({ erro: 'Escolha ao menos uma pessoa' })

  const existentes = await prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true } })
  await prisma.viagemParticipante.createMany({
    data: existentes.map((u) => ({ viagemId: viagem.id, usuarioId: u.id })),
    skipDuplicates: true
  })
  res.status(201).json({ adicionados: existentes.length })
})

const removerParticipante = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return

  await prisma.viagemParticipante.deleteMany({
    where: { viagemId: viagem.id, usuarioId: String(req.params.usuarioId) }
  })
  res.json({ ok: true })
})

const dadosDoEvento = (body) => {
  const titulo = textoOuNulo(body.titulo)
  const inicio = dataOuNula(body.inicio)
  if (!titulo) return { erro: 'Escreva o que vai acontecer' }
  if (!inicio) return { erro: 'Informe dia e horário' }
  return {
    dados: { titulo, inicio, local: textoOuNulo(body.local), observacao: textoOuNulo(body.observacao) }
  }
}

const criarEvento = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return
  const { erro, dados } = dadosDoEvento(req.body || {})
  if (erro) return res.status(400).json({ erro })
  const evento = await prisma.viagemEvento.create({ data: { ...dados, viagemId: viagem.id } })
  res.status(201).json(evento)
})

const atualizarEvento = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return
  const { erro, dados } = dadosDoEvento(req.body || {})
  if (erro) return res.status(400).json({ erro })
  const { count } = await prisma.viagemEvento.updateMany({
    where: { id: idNumerico(req.params.eventoId) ?? -1, viagemId: viagem.id },
    data: dados
  })
  if (count === 0) return res.status(404).json({ erro: 'Compromisso não encontrado' })
  res.json({ ok: true })
})

const apagarEvento = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return
  await prisma.viagemEvento.deleteMany({ where: { id: idNumerico(req.params.eventoId) ?? -1, viagemId: viagem.id } })
  res.json({ ok: true })
})

const criarAviso = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return
  const titulo = textoOuNulo(req.body?.titulo)
  const texto = textoOuNulo(req.body?.texto)
  if (!titulo || !texto) return res.status(400).json({ erro: 'Preencha o título e o texto do aviso' })
  const aviso = await prisma.viagemAviso.create({
    data: { viagemId: viagem.id, titulo, texto, importante: Boolean(req.body.importante), autorId: req.usuario.id }
  })
  res.status(201).json(aviso)
})

const apagarAviso = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return
  await prisma.viagemAviso.deleteMany({ where: { id: idNumerico(req.params.avisoId) ?? -1, viagemId: viagem.id } })
  res.json({ ok: true })
})

const criarItemChecklist = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return
  const texto = textoOuNulo(req.body?.texto)
  if (!texto) return res.status(400).json({ erro: 'Escreva o item' })
  const ultimo = await prisma.viagemChecklistItem.findFirst({
    where: { viagemId: viagem.id },
    orderBy: { ordem: 'desc' }
  })
  const item = await prisma.viagemChecklistItem.create({
    data: { viagemId: viagem.id, texto, ordem: (ultimo?.ordem ?? 0) + 1 }
  })
  res.status(201).json(item)
})

const apagarItemChecklist = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return
  await prisma.viagemChecklistItem.deleteMany({ where: { id: idNumerico(req.params.itemId) ?? -1, viagemId: viagem.id } })
  res.json({ ok: true })
})

// nota: 1, 2 ou 3 estrelas; null tira a nota.
const darNota = comErro(async (req, res) => {
  const viagem = await carregarViagem(req, res)
  if (!viagem) return

  const nota = req.body?.nota === null ? null : Number(req.body?.nota)
  if (nota !== null && ![1, 2, 3].includes(nota)) {
    return res.status(400).json({ erro: 'A nota vai de 1 a 3 estrelas' })
  }

  const { count } = await prisma.viagemMidia.updateMany({
    where: { id: idNumerico(req.params.midiaId) ?? -1, viagemId: viagem.id },
    data: { nota, avaliadaPorId: nota === null ? null : req.usuario.id }
  })
  if (count === 0) return res.status(404).json({ erro: 'Arquivo não encontrado' })
  res.json({ id: Number(req.params.midiaId), nota })
})

module.exports = {
  listar,
  detalhar,
  marcarChecklist,
  listarMidias,
  tokenDeUpload,
  registrarMidia,
  apagarMidia,
  ranking,
  criar,
  atualizar,
  apagar,
  adicionarParticipantes,
  removerParticipante,
  criarEvento,
  atualizarEvento,
  apagarEvento,
  criarAviso,
  apagarAviso,
  criarItemChecklist,
  apagarItemChecklist,
  darNota
}
