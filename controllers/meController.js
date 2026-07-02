const prisma = require('../db')

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
            turma: {
              select: {
                nome: true,
                projeto: { select: { nome: true } }
              }
            }
          }
        }
      }
    })
    res.json(pagamentos)
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
        turma: {
          select: {
            nome: true,
            horario: true,
            dias: true,
            projeto: { select: { nome: true } }
          }
        }
      }
    })
    res.json(matriculas)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { meusPagamentos, meusMatriculas }
