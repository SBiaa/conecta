const jwt = require('jsonwebtoken')

const lerToken = (req) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { erro: 'Token não fornecido' }
  try {
    return { dados: jwt.verify(authHeader.slice('Bearer '.length), process.env.JWT_SECRET) }
  } catch (erro) {
    return { erro: 'Token inválido' }
  }
}

// Login normal (CPF e senha). O acesso pelo link da viagem não passa aqui:
// ele só vale dentro de /viagens.
const autenticar = (req, res, next) => {
  const { dados, erro } = lerToken(req)
  if (erro) return res.status(401).json({ erro })
  if (dados.viagemId) return res.status(401).json({ erro: 'Entre com CPF e senha' })
  req.usuario = dados
  next()
}

// /viagens aceita o login normal e também o acesso pelo link da viagem. Quem
// entrou pelo link é tratado como convidado, mesmo que tenha outro papel: vê
// só aquela viagem e nada da coordenação.
const autenticarViagem = (req, res, next) => {
  const { dados, erro } = lerToken(req)
  if (erro) return res.status(401).json({ erro })
  req.usuario = dados.viagemId
    ? { id: dados.id, papel: 'CONVIDADO', viagemId: dados.viagemId, codigo: dados.codigo }
    : dados
  next()
}

const exigirPapel = (...papeis) => {
  return (req, res, next) => {
    if (!req.usuario || !papeis.includes(req.usuario.papel)) {
      return res.status(403).json({ erro: 'Acesso negado' })
    }
    next()
  }
}

module.exports = { autenticar, autenticarViagem, exigirPapel }
