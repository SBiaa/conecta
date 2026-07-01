const prisma = require('../db')
const bcrypt = require('bcryptjs')

const listar = async (req, res) => {
  try {
    const associados = await prisma.usuario.findMany({
      where: { papel: 'ASSOCIADO' },
      select: {
        id: true,
        nome: true,
        cpf: true,
        email: true,
        telefone: true,
        status: true,
        criadoEm: true
      }
    })
    res.json(associados)
  } catch (erro) {
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const criar = async (req, res) => {
  const { nome, cpf, email, telefone, senha } = req.body

  try {
    const senhaCriptografada = await bcrypt.hash(senha, 10)

    const associado = await prisma.usuario.create({
      data: {
        nome,
        cpf,
        email,
        telefone,
        senha: senhaCriptografada,
        papel: 'ASSOCIADO'
      }
    })

    res.status(201).json({
      id: associado.id,
      nome: associado.nome,
      cpf: associado.cpf,
      email: associado.email,
      telefone: associado.telefone,
      status: associado.status
    })
  } catch (erro) {
    if (erro.code === 'P2002') {
      return res.status(400).json({ erro: 'CPF ou email já cadastrado' })
    }
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const buscarPorId = async (req, res) => {
  const { id } = req.params

  try {
    const associado = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        nome: true,
        cpf: true,
        email: true,
        telefone: true,
        status: true,
        criadoEm: true
      }
    })

    if (!associado) {
      return res.status(404).json({ erro: 'Associado não encontrado' })
    }

    res.json(associado)
  } catch (erro) {
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const atualizar = async (req, res) => {
  const { id } = req.params
  const { nome, email, telefone, status } = req.body

  try {
    const associado = await prisma.usuario.update({
      where: { id },
      data: { nome, email, telefone, status }
    })

    res.json({
      id: associado.id,
      nome: associado.nome,
      email: associado.email,
      telefone: associado.telefone,
      status: associado.status
    })
  } catch (erro) {
    if (erro.code === 'P2025') {
      return res.status(404).json({ erro: 'Associado não encontrado' })
    }
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { listar, criar, buscarPorId, atualizar }