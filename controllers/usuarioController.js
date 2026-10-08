const prisma = require('../db')
const bcrypt = require('bcryptjs')

const FLORES = [
  'girassol',
  'violeta',
  'jasmim',
  'margarida',
  'orquidea',
  'tulipa',
  'rosa',
  'lirio',
  'camelia',
  'hortensia'
]

const gerarSenhaAmigavel = () => {
  const flor = FLORES[Math.floor(Math.random() * FLORES.length)]
  const digitos = String(Math.floor(Math.random() * 100)).padStart(2, '0')
  return `${flor}${digitos}`
}

const listar = async (req, res) => {
  const { papel, busca } = req.query

  try {
    const usuarios = await prisma.usuario.findMany({
      where: {
        ...(papel ? { papel } : {}),
        ...(busca
          ? {
              OR: [
                { nome: { contains: busca, mode: 'insensitive' } },
                { cpf: { contains: busca } }
              ]
            }
          : {})
      },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        cpf: true,
        email: true,
        telefone: true,
        papel: true,
        status: true,
        criadoEm: true,
        responsavel: { select: { id: true, nome: true } },
        _count: { select: { dependentes: true } }
      }
    })
    res.json(usuarios.map(({ _count, ...u }) => ({ ...u, totalDependentes: _count.dependentes })))
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const buscarPorId = async (req, res) => {
  const { id } = req.params

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        cpf: true,
        email: true,
        telefone: true,
        fotoUrl: true,
        papel: true,
        status: true,
        criadoEm: true,
        rg: true,
        dataNascimento: true,
        tomaMedicamento: true,
        qualMedicamento: true,
        cep: true,
        logradouro: true,
        numero: true,
        complemento: true,
        bairro: true,
        cidade: true,
        uf: true,
        responsavel: { select: { id: true, nome: true, telefone: true } },
        dependentes: {
          orderBy: { nome: 'asc' },
          select: { id: true, nome: true, dataNascimento: true }
        },
        matriculas: {
          select: {
            id: true,
            ativa: true,
            dataInicio: true,
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
        }
      }
    })

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' })
    }

    res.json({
      ...usuario,
      matriculas: usuario.matriculas.map(({ turmasVinculadas, ...matricula }) => ({
        ...matricula,
        turmas: turmasVinculadas.map((vinculo) => ({ ...vinculo.turma, diasContratados: vinculo.dias }))
      }))
    })
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const criar = async (req, res) => {
  const {
    nome,
    cpf,
    senha,
    email,
    telefone,
    papel,
    cep,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    rg,
    dataNascimento,
    tomaMedicamento,
    qualMedicamento,
    responsavelId
  } = req.body

  if (!nome || nome.trim() === '') {
    return res.status(400).json({ erro: 'O campo "nome" é obrigatório' })
  }

  // Dependente (criança) é ligado a um responsável e não tem login: CPF
  // opcional, sem senha. Para todo o resto o CPF continua obrigatório.
  const ehDependente = Boolean(responsavelId)
  const cpfLimpo = typeof cpf === 'string' ? cpf.trim() : ''

  if (!ehDependente && cpfLimpo === '') {
    return res.status(400).json({ erro: 'O campo "cpf" é obrigatório' })
  }

  if (ehDependente) {
    const responsavel = await prisma.usuario.findUnique({
      where: { id: responsavelId },
      select: { id: true, responsavelId: true }
    })
    if (!responsavel) {
      return res.status(400).json({ erro: 'Responsável não encontrado' })
    }
    if (responsavel.responsavelId) {
      return res.status(400).json({ erro: 'O responsável não pode ser, ele mesmo, um dependente' })
    }
  }

  const senhaFoiGerada = !ehDependente && (!senha || senha.trim() === '' || papel === 'ASSOCIADO')
  const senhaFinal = senhaFoiGerada ? gerarSenhaAmigavel() : senha

  try {
    const senhaCriptografada = ehDependente ? null : await bcrypt.hash(senhaFinal, 10)

    const usuario = await prisma.usuario.create({
      data: {
        nome: nome.trim(),
        cpf: cpfLimpo === '' ? null : cpfLimpo,
        senha: senhaCriptografada,
        responsavelId: ehDependente ? responsavelId : undefined,
        email,
        telefone,
        papel: ehDependente ? 'ASSOCIADO' : papel,
        cep,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        rg,
        dataNascimento: dataNascimento ? new Date(dataNascimento) : undefined,
        tomaMedicamento,
        qualMedicamento
      }
    })

    res.status(201).json({
      id: usuario.id,
      nome: usuario.nome,
      cpf: usuario.cpf,
      email: usuario.email,
      telefone: usuario.telefone,
      papel: usuario.papel,
      status: usuario.status,
      criadoEm: usuario.criadoEm,
      responsavelId: usuario.responsavelId,
      ...(senhaFoiGerada ? { senhaInicial: senhaFinal } : {})
    })
  } catch (erro) {
    if (erro.code === 'P2002') {
      return res.status(400).json({ erro: 'CPF ou email já cadastrado' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const atualizar = async (req, res) => {
  const { id } = req.params
  const {
    nome,
    cpf,
    telefone,
    email,
    status,
    rg,
    dataNascimento,
    tomaMedicamento,
    qualMedicamento,
    cep,
    logradouro,
    numero,
    complemento,
    bairro,
    cidade,
    uf,
    responsavelId
  } = req.body

  try {
    const atual = await prisma.usuario.findUnique({
      where: { id },
      select: { responsavelId: true, _count: { select: { dependentes: true } } }
    })
    if (!atual) {
      return res.status(404).json({ erro: 'Usuário não encontrado' })
    }

    // responsavelId: string vincula, null desvincula, ausente não mexe.
    if (responsavelId) {
      if (responsavelId === id) {
        return res.status(400).json({ erro: 'Uma pessoa não pode ser responsável por ela mesma' })
      }
      if (atual._count.dependentes > 0) {
        return res.status(400).json({ erro: 'Quem tem dependentes não pode ser dependente de outra pessoa' })
      }
      const responsavel = await prisma.usuario.findUnique({
        where: { id: responsavelId },
        select: { responsavelId: true }
      })
      if (!responsavel) {
        return res.status(400).json({ erro: 'Responsável não encontrado' })
      }
      if (responsavel.responsavelId) {
        return res.status(400).json({ erro: 'O responsável não pode ser, ele mesmo, um dependente' })
      }
    }

    const seraDependente = responsavelId === undefined ? Boolean(atual.responsavelId) : Boolean(responsavelId)
    if (cpf !== undefined && cpf.trim() === '' && !seraDependente) {
      return res.status(400).json({ erro: 'O campo "cpf" não pode ficar vazio' })
    }

    const usuario = await prisma.usuario.update({
      where: { id },
      data: {
        nome,
        cpf: cpf !== undefined ? (cpf.trim() === '' ? null : cpf.trim()) : undefined,
        responsavelId,
        telefone,
        email,
        status,
        rg,
        dataNascimento: dataNascimento ? new Date(dataNascimento) : undefined,
        tomaMedicamento,
        qualMedicamento,
        cep,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        uf
      }
    })

    res.json({
      id: usuario.id,
      nome: usuario.nome,
      cpf: usuario.cpf,
      email: usuario.email,
      telefone: usuario.telefone,
      status: usuario.status
    })
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Usuário não encontrado' })
    }
    if (erro.code === 'P2002') {
      return res.status(400).json({ erro: 'CPF ou email já cadastrado' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const atualizarSenha = async (req, res) => {
  const { id } = req.params
  const { novaSenha } = req.body

  const senhaFoiGerada = !novaSenha || novaSenha.trim() === ''
  const senhaFinal = senhaFoiGerada ? gerarSenhaAmigavel() : novaSenha.trim()

  if (!senhaFoiGerada && senhaFinal.length < 4) {
    return res.status(400).json({ erro: 'A senha deve ter pelo menos 4 caracteres' })
  }

  try {
    const alvo = await prisma.usuario.findUnique({ where: { id }, select: { responsavelId: true } })
    if (alvo?.responsavelId) {
      return res.status(400).json({ erro: 'Dependente não tem login: quem acessa é o responsável' })
    }

    const senhaCriptografada = await bcrypt.hash(senhaFinal, 10)

    await prisma.usuario.update({
      where: { id },
      data: { senha: senhaCriptografada }
    })

    res.json({ senha: senhaFinal })
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Usuário não encontrado' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

function descreverVinculosUsuario(v) {
  const partes = []

  if (v.matriculas > 0) {
    partes.push(`${v.matriculas} ${v.matriculas === 1 ? 'matrícula' : 'matrículas'}`)
  }
  if (v.presencas > 0) {
    partes.push(`${v.presencas} ${v.presencas === 1 ? 'presença' : 'presenças'}`)
  }
  if (v.pagamentos > 0) {
    const reais = v.valorPago.toFixed(2).replace('.', ',')
    const detalhePagos = v.pagamentosPagos > 0
      ? ` (${v.pagamentosPagos} já ${v.pagamentosPagos === 1 ? 'paga' : 'pagas'}, R$ ${reais})`
      : ''
    partes.push(`${v.pagamentos} ${v.pagamentos === 1 ? 'cobrança' : 'cobranças'}${detalhePagos}`)
  }
  if (v.registrosSaude > 0) {
    partes.push(`${v.registrosSaude} ${v.registrosSaude === 1 ? 'registro de saúde' : 'registros de saúde'}`)
  }
  if (v.avaliacoes > 0) {
    partes.push(`${v.avaliacoes} ${v.avaliacoes === 1 ? 'avaliação física' : 'avaliações físicas'}`)
  }
  if (v.niveisNatacao > 0) {
    partes.push(`${v.niveisNatacao} ${v.niveisNatacao === 1 ? 'nível de natação' : 'níveis de natação'}`)
  }
  if (v.posts > 0) {
    partes.push(`${v.posts} ${v.posts === 1 ? 'publicação' : 'publicações'} no mural`)
  }
  if (v.comentarios > 0) {
    partes.push(`${v.comentarios} ${v.comentarios === 1 ? 'comentário' : 'comentários'}`)
  }
  if (v.compras > 0) {
    partes.push(`${v.compras} ${v.compras === 1 ? 'compra registrada' : 'compras registradas'}`)
  }

  return partes.join(', ')
}

// Por padrão a exclusão é bloqueada quando existe histórico vinculado. Com
// ?forcar=true a coordenação apaga assim mesmo — necessário para limpar
// cadastros duplicados/errados (ex.: as matrículas "A definir"), do mesmo
// jeito que já existe pra matrícula (matriculaController.remover).
//
// Vínculos em que este usuário é responsável por dado de OUTRA pessoa
// (professor de turma, presença/avaliação que ele registrou) bloqueiam
// SEMPRE, mesmo com forçar: apagar o usuário não pode apagar ou corromper
// o histórico de outra pessoa. É preciso resolver isso à mão antes (trocar
// o professor da turma, por exemplo).
const remover = async (req, res) => {
  const { id } = req.params
  const forcar = req.query.forcar === 'true'

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: {
        matriculas: {
          select: {
            id: true,
            pagamentos: { select: { id: true, status: true, valor: true } },
            presencas: { select: { id: true } }
          }
        },
        turmasComoProfessor: { select: { id: true } },
        presencasRegistradas: { select: { id: true } },
        avaliacoesFeitas: { select: { id: true } },
        niveisNatacaoFeitos: { select: { id: true } },
        dependentes: { select: { id: true } },
        niveisNatacao: { select: { id: true } },
        registrosSaude: { select: { id: true } },
        avaliacoes: { select: { id: true } },
        posts: { select: { id: true } },
        comentarios: { select: { id: true } },
        compras: { select: { id: true } }
      }
    })

    if (!usuario) {
      return res.status(404).json({ erro: 'Associado não encontrado' })
    }

    const responsabilidades = []
    if (usuario.turmasComoProfessor.length > 0) {
      const n = usuario.turmasComoProfessor.length
      responsabilidades.push(`é professor(a) de ${n} ${n === 1 ? 'turma' : 'turmas'}`)
    }
    if (usuario.presencasRegistradas.length > 0) {
      const n = usuario.presencasRegistradas.length
      responsabilidades.push(`registrou ${n} ${n === 1 ? 'presença' : 'presenças'} de outras pessoas`)
    }
    if (usuario.avaliacoesFeitas.length > 0) {
      const n = usuario.avaliacoesFeitas.length
      responsabilidades.push(`registrou ${n} ${n === 1 ? 'avaliação física' : 'avaliações físicas'} de outras pessoas`)
    }

    if (usuario.niveisNatacaoFeitos.length > 0) {
      const n = usuario.niveisNatacaoFeitos.length
      responsabilidades.push(`registrou ${n} ${n === 1 ? 'nível de natação' : 'níveis de natação'} de outras pessoas`)
    }
    if (usuario.dependentes.length > 0) {
      const n = usuario.dependentes.length
      responsabilidades.push(`é responsável por ${n} ${n === 1 ? 'dependente' : 'dependentes'}`)
    }

    if (responsabilidades.length > 0) {
      return res.status(409).json({
        bloqueioPermanente: true,
        erro: `Não é possível excluir: este usuário ${responsabilidades.join(' e ')}. Resolva isso antes (troque o professor da turma, por exemplo).`
      })
    }

    const presencas = usuario.matriculas.reduce((soma, matricula) => soma + matricula.presencas.length, 0)
    const pagamentos = usuario.matriculas.flatMap((matricula) => matricula.pagamentos)
    const pagos = pagamentos.filter((pagamento) => pagamento.status === 'PAGA')

    const vinculos = {
      matriculas: usuario.matriculas.length,
      presencas,
      pagamentos: pagamentos.length,
      pagamentosPagos: pagos.length,
      valorPago: pagos.reduce((soma, pagamento) => soma + Number(pagamento.valor), 0),
      registrosSaude: usuario.registrosSaude.length,
      avaliacoes: usuario.avaliacoes.length,
      niveisNatacao: usuario.niveisNatacao.length,
      posts: usuario.posts.length,
      comentarios: usuario.comentarios.length,
      compras: usuario.compras.length
    }

    const temHistorico = [
      vinculos.matriculas, vinculos.presencas, vinculos.pagamentos, vinculos.registrosSaude,
      vinculos.avaliacoes, vinculos.niveisNatacao, vinculos.posts, vinculos.comentarios, vinculos.compras
    ].some((quantidade) => quantidade > 0)

    if (temHistorico && !forcar) {
      return res.status(409).json({
        erro: `Este associado tem ${descreverVinculosUsuario(vinculos)} no histórico.`,
        vinculos
      })
    }

    const matriculaIds = usuario.matriculas.map((matricula) => matricula.id)

    await prisma.$transaction([
      prisma.presenca.deleteMany({ where: { matriculaId: { in: matriculaIds } } }),
      prisma.pagamento.deleteMany({ where: { matriculaId: { in: matriculaIds } } }),
      prisma.matriculaTurma.deleteMany({ where: { matriculaId: { in: matriculaIds } } }),
      prisma.matricula.deleteMany({ where: { usuarioId: id } }),
      prisma.registroSaude.deleteMany({ where: { usuarioId: id } }),
      prisma.registroSaude.updateMany({ where: { registradoPorId: id }, data: { registradoPorId: null } }),
      prisma.avaliacao.deleteMany({ where: { usuarioId: id } }),
      prisma.nivelNatacaoRegistro.deleteMany({ where: { usuarioId: id } }),
      prisma.reacao.deleteMany({ where: { usuarioId: id } }),
      prisma.comentario.deleteMany({ where: { autorId: id } }),
      prisma.post.deleteMany({ where: { autorId: id } }),
      prisma.venda.updateMany({ where: { usuarioId: id }, data: { usuarioId: null } }),
      prisma.usuario.delete({ where: { id } })
    ])

    res.status(200).json({ ok: true, removidos: vinculos })
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Associado não encontrado' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, atualizarSenha, remover }
