const prisma = require('../db')

const TIPOS_VALIDOS = ['GERAL', 'PROJETO', 'TURMA']

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
        autor: { select: { id: true, nome: true } }
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
    const ehAdmin = req.usuario.papel === 'ADMIN'

    let where = {}

    if (!ehAdmin) {
      const [matriculas, turmasComoProfessor] = await Promise.all([
        prisma.matricula.findMany({
          where: {
            usuarioId: req.usuario.id,
            ativa: true
          },
          include: { turmasVinculadas: { include: { turma: true } } }
        }),
        prisma.turma.findMany({
          where: { professorId: req.usuario.id }
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

      where = {
        OR: [
          { tipo: 'GERAL' },
          { tipo: 'PROJETO', projetoId: { in: projetoIds } },
          { tipo: 'TURMA', turmaId: { in: turmaIds } }
        ]
      }
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        conteudo: true,
        tipo: true,
        criadoEm: true,
        autor: { select: { id: true, nome: true } },
        projeto: { select: { nome: true } },
        turma: { select: { nome: true } }
      }
    })

    res.json(posts)
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

module.exports = { criar, feed, apagar }
