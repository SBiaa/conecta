const prisma = require('../db')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const login = async (req, res) => {
  const { cpf, senha } = req.body

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { cpf }
    })

    if (!usuario) {
      return res.status(401).json({ erro: 'CPF ou senha inválidos' })
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha)

    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'CPF ou senha inválidos' })
    }

    const token = jwt.sign(
      { id: usuario.id, papel: usuario.papel },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    )

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel
      }
    })

  } catch (erro) {
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { login }