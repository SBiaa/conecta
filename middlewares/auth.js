const jwt = require('jsonwebtoken')

const autenticar = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token não fornecido' })
  }

  const token = authHeader.slice('Bearer '.length)

  try {
    const decodificado = jwt.verify(token, process.env.JWT_SECRET)
    req.usuario = decodificado
    next()
  } catch (erro) {
    return res.status(401).json({ erro: 'Token inválido' })
  }
}

const exigirPapel = (...papeis) => {
  return (req, res, next) => {
    if (!req.usuario || !papeis.includes(req.usuario.papel)) {
      return res.status(403).json({ erro: 'Acesso negado' })
    }
    next()
  }
}

module.exports = { autenticar, exigirPapel }
