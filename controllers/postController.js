const prisma = require('../db')

const TIPOS_VALIDOS = ['GERAL', 'PROJETO', 'TURMA']
const TIPOS_REACAO = ['CURTIR', 'AMEI', 'FORCA', 'PARABENS']
const LIMITE_COMENTARIO = 500

// Quem enxerga o que: admin vê tudo; o resto vê os posts GERAL mais os do
// projeto/turma de que participa, como aluna ou como professora.
const filtroVisibilidade = async (usuario) => {
  if (usuario.papel === 'ADMIN') return {}

  const [matriculas, turmasComoProfessor] = await Promise.all([
    prisma.matricula.findMany({
      where: {
        usuarioId: usuario.id,
        ativa: true
      },
      include: { turmasVinculadas: { include: { turma: true } } }
    }),
    prisma.turma.findMany({
      where: { professorId: usuario.id }
    })
  ])

  const turmaIds = [
    ...matriculas.flatMap((m) => m.turmasVinculadas.map((mt) => mt.turma.id)),
    ...turmasComoProfessor.map((t) => t.id)
  ]
  const projetoIds = [
    ...matriculas.flatMap((m) => m.turmasVinculadas.map((mt) => mt.turma.projetoId)),
    ...turmasComoProfessor.map((t) => t.projetoId)
  ]

  return {
    OR: [
      { tipo: 'GERAL' },
      { tipo: 'PROJETO', projetoId: { in: projetoIds } },
      { tipo: 'TURMA', turmaId: { in: turmaIds } }
    ]
  }
}

// Só devolve o post se a pessoa tem direito de vê-lo. É o porteiro de reagir e
// comentar: sem isso daria para agir num post que nem aparece no feed dela.
const buscarPostVisivel = async (usuario, postId) => {
  const filtro = await filtroVisibilidade(usuario)
  return prisma.post.findFirst({ where: { id: postId, ...filtro } })
}

// Quantas reações de cada tipo cada post tem, e qual foi a minha. São duas
// consultas para a lista inteira, em vez de duas por post.
const resumoDeReacoes = async (postIds, usuarioId) => {
  const resumo = new Map(postIds.map((id) => [id, { reacoes: {}, minhaReacao: null }]))
  if (postIds.length === 0) return resumo

  const [contagens, minhas] = await Promise.all([
    prisma.reacao.groupBy({
      by: ['postId', 'tipo'],
      where: { postId: { in: postIds } },
      _count: { _all: true }
    }),
    prisma.reacao.findMany({
      where: { postId: { in: postIds }, usuarioId },
      select: { postId: true, tipo: true }
    })
  ])

  for (const contagem of contagens) {
    resumo.get(contagem.postId).reacoes[contagem.tipo] = contagem._count._all
  }
  for (const minha of minhas) {
    resumo.get(minha.postId).minhaReacao = minha.tipo
  }

  return resumo
}

const criar = async (req, res) => {
  const { conteudo, tipo, projetoId, turmaId } = req.body
  const autorId = req.usuario.id

  if (!conteudo || conteudo.trim() === '') {
    return res.status(400).json({ erro: 'O campo "conteudo" é obrigatório' })
  }

  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ erro: 'O campo "tipo" deve ser um de: GERAL, PROJETO, TURMA' })
  }

  if (tipo === 'PROJETO' && !projetoId) {
    return res.status(400).json({ erro: 'O campo "projetoId" é obrigatório para posts do tipo PROJETO' })
  }

  if (tipo === 'TURMA' && !turmaId) {
    return res.status(400).json({ erro: 'O campo "turmaId" é obrigatório para posts do tipo TURMA' })
  }

  try {
    const ehAdmin = req.usuario.papel === 'ADMIN'

    if (tipo === 'PROJETO' && !ehAdmin) {
      const acesso = await prisma.turma.findFirst({
        where: {
          projetoId: Number(projetoId),
          OR: [
            { professorId: autorId },
            { matriculaTurmas: { some: { matricula: { usuarioId: autorId, ativa: true } } } }
          ]
        }
      })

      if (!acesso) {
        return res.status(403).json({ erro: 'Você não participa deste projeto' })
      }
    }

    if (tipo === 'TURMA' && !ehAdmin) {
      const acesso = await prisma.turma.findFirst({
        where: {
          id: Number(turmaId),
          OR: [
            { professorId: autorId },
            { matriculaTurmas: { some: { matricula: { usuarioId: autorId, ativa: true } } } }
          ]
        }
      })

      if (!acesso) {
        return res.status(403).json({ erro: 'Você não participa desta turma' })
      }
    }

    const post = await prisma.post.create({
      data: {
        conteudo: conteudo.trim(),
        tipo,
        autorId,
        projetoId: tipo === 'PROJETO' ? Number(projetoId) : null,
        turmaId: tipo === 'TURMA' ? Number(turmaId) : null
      },
      include: {
        autor: { select: { id: true, nome: true, fotoUrl: true } }
      }
    })

    res.status(201).json(post)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const feed = async (req, res) => {
  try {
    const where = await filtroVisibilidade(req.usuario)

    const limite = req.query.limit ? Number(req.query.limit) : undefined

    const posts = await prisma.post.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      ...(limite ? { take: limite } : {}),
      select: {
        id: true,
        conteudo: true,
        tipo: true,
        criadoEm: true,
        autor: { select: { id: true, nome: true, fotoUrl: true } },
        projeto: { select: { nome: true } },
        turma: { select: { nome: true } },
        _count: { select: { comentarios: true } }
      }
    })

    const resumo = await resumoDeReacoes(
      posts.map((post) => post.id),
      req.usuario.id
    )

    res.json(
      posts.map(({ _count, ...post }) => ({
        ...post,
        totalComentarios: _count.comentarios,
        ...resumo.get(post.id)
      }))
    )
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const apagar = async (req, res) => {
  const { id } = req.params

  try {
    const post = await prisma.post.findUnique({ where: { id: Number(id) } })

    if (!post) {
      return res.status(404).json({ erro: 'Post não encontrado' })
    }

    const ehAutor = req.usuario.id === post.autorId
    const ehAdmin = req.usuario.papel === 'ADMIN'

    if (!ehAutor && !ehAdmin) {
      return res.status(403).json({ erro: 'Sem permissão para apagar este post' })
    }

    await prisma.post.delete({ where: { id: Number(id) } })

    res.status(200).json({ ok: true })
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Post não encontrado' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// Uma reação por pessoa por post: reagir de novo troca a que estava lá.
const reagir = async (req, res) => {
  const postId = Number(req.params.id)
  const { tipo } = req.body

  if (!tipo || !TIPOS_REACAO.includes(tipo)) {
    return res
      .status(400)
      .json({ erro: `O campo "tipo" deve ser um de: ${TIPOS_REACAO.join(', ')}` })
  }

  try {
    const post = await buscarPostVisivel(req.usuario, postId)

    if (!post) {
      return res.status(404).json({ erro: 'Post não encontrado' })
    }

    await prisma.reacao.upsert({
      where: { postId_usuarioId: { postId, usuarioId: req.usuario.id } },
      create: { postId, usuarioId: req.usuario.id, tipo },
      update: { tipo }
    })

    const resumo = await resumoDeReacoes([postId], req.usuario.id)
    res.json(resumo.get(postId))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const removerReacao = async (req, res) => {
  const postId = Number(req.params.id)

  try {
    const post = await buscarPostVisivel(req.usuario, postId)

    if (!post) {
      return res.status(404).json({ erro: 'Post não encontrado' })
    }

    // deleteMany, e não delete: tirar uma reação que já não existe não é erro.
    await prisma.reacao.deleteMany({ where: { postId, usuarioId: req.usuario.id } })

    const resumo = await resumoDeReacoes([postId], req.usuario.id)
    res.json(resumo.get(postId))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const listarComentarios = async (req, res) => {
  const postId = Number(req.params.id)

  try {
    const post = await buscarPostVisivel(req.usuario, postId)

    if (!post) {
      return res.status(404).json({ erro: 'Post não encontrado' })
    }

    const comentarios = await prisma.comentario.findMany({
      where: { postId },
      orderBy: { criadoEm: 'asc' },
      select: {
        id: true,
        conteudo: true,
        criadoEm: true,
        autor: { select: { id: true, nome: true, fotoUrl: true } }
      }
    })

    res.json(comentarios)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const comentar = async (req, res) => {
  const postId = Number(req.params.id)
  const { conteudo } = req.body

  if (!conteudo || conteudo.trim() === '') {
    return res.status(400).json({ erro: 'O campo "conteudo" é obrigatório' })
  }

  if (conteudo.trim().length > LIMITE_COMENTARIO) {
    return res
      .status(400)
      .json({ erro: `O comentário deve ter no máximo ${LIMITE_COMENTARIO} caracteres` })
  }

  try {
    const post = await buscarPostVisivel(req.usuario, postId)

    if (!post) {
      return res.status(404).json({ erro: 'Post não encontrado' })
    }

    const comentario = await prisma.comentario.create({
      data: {
        postId,
        autorId: req.usuario.id,
        conteudo: conteudo.trim()
      },
      select: {
        id: true,
        conteudo: true,
        criadoEm: true,
        autor: { select: { id: true, nome: true, fotoUrl: true } }
      }
    })

    res.status(201).json(comentario)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// Pode apagar quem escreveu o comentário, quem escreveu o post (a publicação é
// dela) ou o admin.
const apagarComentario = async (req, res) => {
  const comentarioId = Number(req.params.comentarioId)

  try {
    const comentario = await prisma.comentario.findUnique({
      where: { id: comentarioId },
      include: { post: { select: { autorId: true } } }
    })

    if (!comentario || comentario.postId !== Number(req.params.id)) {
      return res.status(404).json({ erro: 'Comentário não encontrado' })
    }

    const podeApagar =
      req.usuario.id === comentario.autorId ||
      req.usuario.id === comentario.post.autorId ||
      req.usuario.papel === 'ADMIN'

    if (!podeApagar) {
      return res.status(403).json({ erro: 'Sem permissão para apagar este comentário' })
    }

    await prisma.comentario.delete({ where: { id: comentarioId } })

    res.status(200).json({ ok: true })
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Comentário não encontrado' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = {
  criar,
  feed,
  apagar,
  reagir,
  removerReacao,
  listarComentarios,
  comentar,
  apagarComentario
}
