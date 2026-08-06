const prisma = require('../db')

const meusDados = async (req, res) => {
  const usuarioId = req.usuario.id

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        cpf: true,
        email: true,
        telefone: true,
        papel: true,
        rg: true,
        dataNascimento: true,
        cep: true,
        logradouro: true,
        numero: true,
        complemento: true,
        bairro: true,
        cidade: true,
        uf: true
      }
    })

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' })
    }

    res.json(usuario)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const meusPagamentos = async (req, res) => {
  const usuarioId = req.usuario.id

  try {
    const pagamentos = await prisma.pagamento.findMany({
      where: {
        matricula: { usuarioId }
      },
      orderBy: { vencimento: 'desc' },
      select: {
        id: true,
        valor: true,
        status: true,
        mesReferencia: true,
        vencimento: true,
        formaPagamento: true,
        dataPagamento: true,
        matricula: {
          select: {
            turmasVinculadas: {
              select: {
                dias: true,
                turma: { select: { nome: true, projeto: { select: { nome: true } } } }
              }
            }
          }
        }
      }
    })
    res.json(
      pagamentos.map(({ matricula, ...pagamento }) => ({
        ...pagamento,
        matricula: {
          turmas: matricula.turmasVinculadas.map((vinculo) => ({ ...vinculo.turma, diasContratados: vinculo.dias }))
        }
      }))
    )
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const meusMatriculas = async (req, res) => {
  const usuarioId = req.usuario.id

  try {
    const matriculas = await prisma.matricula.findMany({
      where: {
        usuarioId,
        ativa: true
      },
      select: {
        id: true,
        ativa: true,
        exameMedico: true,
        frequenciaSemanal: true,
        turmasVinculadas: {
          select: {
            dias: true,
            turma: {
              select: {
                id: true,
                nome: true,
                horario: true,
                dias: true,
                projeto: { select: { id: true, nome: true } }
              }
            }
          }
        }
      }
    })
    res.json(
      matriculas.map(({ turmasVinculadas, ...matricula }) => ({
        ...matricula,
        turmas: turmasVinculadas.map((vinculo) => ({ ...vinculo.turma, diasContratados: vinculo.dias }))
      }))
    )
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const minhaFrequencia = async (req, res) => {
  const usuarioId = req.usuario.id

  try {
    const matriculas = await prisma.matricula.findMany({
      where: { usuarioId, ativa: true },
      select: {
        id: true,
        turmasVinculadas: {
          select: {
            turma: { select: { id: true, nome: true, projeto: { select: { nome: true } } } }
          }
        }
      }
    })

    const matriculaIds = matriculas.map((m) => m.id)

    const presencas = await prisma.presenca.findMany({
      where: { matriculaId: { in: matriculaIds } },
      select: { matriculaId: true, turmaId: true, data: true, presente: true },
      orderBy: { data: 'desc' }
    })

    const turmas = matriculas.flatMap((matricula) =>
      matricula.turmasVinculadas.map(({ turma }) => {
        const registros = presencas
          .filter((p) => p.matriculaId === matricula.id && p.turmaId === turma.id)
          .map((p) => ({ data: p.data.toISOString().slice(0, 10), presente: p.presente }))

        const faltas = registros.filter((r) => !r.presente).length
        const totalRegistros = registros.length

        return {
          turmaId: turma.id,
          nome: turma.nome,
          projeto: turma.projeto.nome,
          totalRegistros,
          faltas,
          percentualPresenca:
            totalRegistros > 0 ? Math.round(((totalRegistros - faltas) / totalRegistros) * 100) : null,
          registros
        }
      })
    )

    res.json(turmas)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { meusDados, meusPagamentos, meusMatriculas, minhaFrequencia }
