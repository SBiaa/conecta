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
        criadoEm: true
      }
    })
    res.json(usuarios)
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
        matriculas: {
          select: {
            id: true,
            ativa: true,
            dataInicio: true,
            exameMedico: true,
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

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' })
    }

    res.json(usuario)
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
    qualMedicamento
  } = req.body

  if (!nome || nome.trim() === '') {
    return res.status(400).json({ erro: 'O campo "nome" é obrigatório' })
  }

  if (!cpf || cpf.trim() === '') {
    return res.status(400).json({ erro: 'O campo "cpf" é obrigatório' })
  }

  const senhaFoiGerada = !senha || senha.trim() === '' || papel === 'ASSOCIADO'
  const senhaFinal = senhaFoiGerada ? gerarSenhaAmigavel() : senha

  try {
    const senhaCriptografada = await bcrypt.hash(senhaFinal, 10)

    const usuario = await prisma.usuario.create({
      data: {
        nome: nome.trim(),
        cpf: cpf.trim(),
        senha: senhaCriptografada,
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
    telefone,
    email,
    status,
    rg,
    dataNascimento,
    tomaMedicamento,
    qualMedicamento
  } = req.body

  try {
    const usuario = await prisma.usuario.update({
      where: { id },
      data: {
        nome,
        telefone,
        email,
        status,
        rg,
        dataNascimento: dataNascimento ? new Date(dataNascimento) : undefined,
        tomaMedicamento,
        qualMedicamento
      }
    })

    res.json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone,
      status: usuario.status
    })
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Usuário não encontrado' })
    }
    if (erro.code === 'P2002') {
      return res.status(400).json({ erro: 'Email já cadastrado' })
    }
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { listar, buscarPorId, criar, atualizar }
