const crypto = require('crypto')
const prisma = require('../db')

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function gerarToken() {
  return crypto.randomBytes(24).toString('hex')
}

// Autentica o aparelho do portão pelo header "X-Dispositivo-Token".
// Não usa o JWT das pessoas: o token do aparelho não expira e pode ser
// revogado sozinho (desativando o dispositivo ou gerando um token novo).
const autenticarDispositivo = async (req, res, next) => {
  const token = req.headers['x-dispositivo-token']
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ erro: 'Token do dispositivo não fornecido' })
  }

  try {
    const dispositivo = await prisma.dispositivo.findUnique({ where: { tokenHash: hashToken(token) } })
    if (!dispositivo || !dispositivo.ativo) {
      return res.status(401).json({ erro: 'Dispositivo inválido ou desativado' })
    }
    req.dispositivo = dispositivo
    // registra o contato sem segurar a resposta
    prisma.dispositivo
      .update({ where: { id: dispositivo.id }, data: { ultimoContato: new Date() } })
      .catch((erro) => console.error(erro))
    next()
  } catch (erro) {
    console.error(erro)
    res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

module.exports = { autenticarDispositivo, hashToken, gerarToken }
