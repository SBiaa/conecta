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

module.exports = { meusPagamentos }
