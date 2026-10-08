const prisma = require('../db')
const { historicoDeNivel } = require('./natacaoController')

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
        fotoUrl: true,
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

async function pagamentosDe(usuarioId) {
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
    return pagamentos.map(({ matricula, ...pagamento }) => ({
      ...pagamento,
      matricula: {
        turmas: matricula.turmasVinculadas.map((vinculo) => ({ ...vinculo.turma, diasContratados: vinculo.dias }))
      }
    }))
}

const meusPagamentos = async (req, res) => {
  try {
    res.json(await pagamentosDe(req.usuario.id))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

async function matriculasDe(usuarioId) {
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
    return matriculas.map(({ turmasVinculadas, ...matricula }) => ({
      ...matricula,
      turmas: turmasVinculadas.map((vinculo) => ({ ...vinculo.turma, diasContratados: vinculo.dias }))
    }))
}

const meusMatriculas = async (req, res) => {
  try {
    res.json(await matriculasDe(req.usuario.id))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

async function frequenciaDe(usuarioId) {
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

    return matriculas.flatMap((matricula) =>
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
}

const minhaFrequencia = async (req, res) => {
  try {
    res.json(await frequenciaDe(req.usuario.id))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

/* ---------- dependentes (filhos) ---------- */

// O responsável só enxerga: quem registra presença e nível é a professora ou a
// coordenação. Um adulto sem dependentes recebe lista vazia.
const meusDependentes = async (req, res) => {
  try {
    const dependentes = await prisma.usuario.findMany({
      where: { responsavelId: req.usuario.id },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        fotoUrl: true,
        dataNascimento: true,
        matriculas: {
          where: { ativa: true },
          select: {
            turmasVinculadas: {
              select: { turma: { select: { nome: true, projeto: { select: { nome: true } } } } }
            }
          }
        }
      }
    })

    const niveis = await prisma.nivelNatacaoRegistro.findMany({
      where: { usuarioId: { in: dependentes.map((d) => d.id) } },
      orderBy: [{ data: 'desc' }, { id: 'desc' }],
      select: { usuarioId: true, nivel: true, data: true }
    })

    res.json(
      dependentes.map(({ matriculas, ...dependente }) => {
        const ultimo = niveis.find((n) => n.usuarioId === dependente.id)
        return {
          ...dependente,
          projetos: [
            ...new Set(
              matriculas.flatMap((m) => m.turmasVinculadas.map((v) => v.turma.projeto.nome))
            )
          ],
          nivelNatacao: ultimo ? ultimo.nivel : null
        }
      })
    )
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// Perfil completo da criança para o responsável. 404 (e não 403) quando a
// pessoa não é dependente dele, pra não revelar que o id existe.
const meuDependente = async (req, res) => {
  const { id } = req.params

  try {
    const dependente = await prisma.usuario.findFirst({
      where: { id, responsavelId: req.usuario.id },
      select: { id: true, nome: true, fotoUrl: true, dataNascimento: true, tomaMedicamento: true, qualMedicamento: true }
    })

    if (!dependente) {
      return res.status(404).json({ erro: 'Dependente não encontrado' })
    }

    const [matriculas, frequencia, pagamentos, natacao] = await Promise.all([
      matriculasDe(id),
      frequenciaDe(id),
      pagamentosDe(id),
      historicoDeNivel(id)
    ])

    res.json({ ...dependente, matriculas, frequencia, pagamentos, natacao })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

// O navegador já redimensiona a imagem antes de enviar; isso aqui é só o
// cinto de segurança contra um cliente que não passou por essa etapa.
const FORMATO_FOTO = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+=*$/
const TAMANHO_MAXIMO_FOTO = 2_000_000 // caracteres da data URL

const atualizarFoto = async (req, res) => {
  const { foto } = req.body

  if (!foto || typeof foto !== 'string' || !FORMATO_FOTO.test(foto)) {
    return res.status(400).json({ erro: 'Envie uma foto em formato JPEG, PNG ou WEBP' })
  }

  if (foto.length > TAMANHO_MAXIMO_FOTO) {
    return res.status(400).json({ erro: 'A foto é grande demais' })
  }

  try {
    const usuario = await prisma.usuario.update({
      where: { id: req.usuario.id },
      data: { fotoUrl: foto },
      select: { fotoUrl: true }
    })

    res.json(usuario)
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const removerFoto = async (req, res) => {
  try {
    await prisma.usuario.update({ where: { id: req.usuario.id }, data: { fotoUrl: null } })
    res.json({ fotoUrl: null })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = {
  meusDados,
  meusPagamentos,
  meusMatriculas,
  minhaFrequencia,
  atualizarFoto,
  removerFoto,
  meusDependentes,
  meuDependente
}
