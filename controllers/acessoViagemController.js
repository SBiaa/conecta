const jwt = require('jsonwebtoken')
const prisma = require('../db')
const { linkValido, segundosDeSessao, normalizarCodigo } = require('../lib/acessoViagem')
const { chaveCelular, formatarCelular } = require('../lib/celular')

// Freio contra quem tenta adivinhar celulares: 15 erros a cada 15 minutos por
// endereço e link. Fica na memória do servidor — se reiniciar, zera, e tudo bem.
const JANELA_MS = 15 * 60 * 1000
const MAXIMO_ERROS = 15
const erros = new Map()

const chaveFreio = (req, codigo) => `${req.ip}|${codigo}`
const bloqueado = (chave) => {
  const registro = erros.get(chave)
  if (!registro || Date.now() - registro.inicio > JANELA_MS) return false
  return registro.total >= MAXIMO_ERROS
}
const contarErro = (chave) => {
  const registro = erros.get(chave)
  if (!registro || Date.now() - registro.inicio > JANELA_MS) {
    erros.set(chave, { inicio: Date.now(), total: 1 })
  } else {
    registro.total++
  }
}

const comErro = (handler) => async (req, res) => {
  try {
    await handler(req, res)
  } catch (erro) {
    console.error(erro)
    if (!res.headersSent) res.status(500).json({ erro: 'Erro interno do servidor' })
  }
}

const MSG_LINK_INVALIDO = 'Esse link não está mais valendo. Peça o link novo à coordenação.'

const buscarViagemDoLink = async (codigo) => {
  if (!codigo) return null
  const viagem = await prisma.viagem.findUnique({ where: { codigoAcesso: codigo } })
  return viagem && linkValido(viagem) ? viagem : null
}

// O que a tela de entrada mostra antes de pedir o celular.
const verLink = comErro(async (req, res) => {
  const viagem = await buscarViagemDoLink(normalizarCodigo(req.params.codigo))
  if (!viagem) return res.status(404).json({ erro: MSG_LINK_INVALIDO })
  res.json({ nome: viagem.nome, destino: viagem.destino, dataSaida: viagem.dataSaida })
})

// A pessoa digita o celular. Se o número é de uma pessoa só da lista, entra.
// Se é de mais de uma (casal, mãe e filho), devolve os nomes pra ela escolher
// quem é — e ela manda de novo com o usuarioId.
const entrar = comErro(async (req, res) => {
  const codigo = normalizarCodigo(req.params.codigo)
  const freio = chaveFreio(req, codigo)
  if (bloqueado(freio)) {
    return res.status(429).json({ erro: 'Muitas tentativas. Espere uns minutos e tente de novo.' })
  }

  const viagem = await buscarViagemDoLink(codigo)
  if (!viagem) return res.status(404).json({ erro: MSG_LINK_INVALIDO })

  const chave = chaveCelular(req.body?.celular)
  if (!chave) return res.status(400).json({ erro: 'Digite o celular com DDD' })

  const participantes = await prisma.viagemParticipante.findMany({
    where: { viagemId: viagem.id, usuario: { status: 'ATIVO' } },
    select: { celular: true, usuario: { select: { id: true, nome: true, telefone: true, fotoUrl: true } } }
  })
  const donos = participantes
    .filter((p) => chaveCelular(p.celular ?? p.usuario.telefone) === chave)
    .map((p) => p.usuario)

  if (donos.length === 0) {
    contarErro(freio)
    return res.status(404).json({
      erro: 'Esse celular não está na lista da viagem. Confira o número ou fale com a coordenação.'
    })
  }

  let pessoa = donos[0]
  if (donos.length > 1) {
    const escolhido = req.body?.usuarioId && donos.find((d) => d.id === String(req.body.usuarioId))
    if (!escolhido) {
      return res.json({ escolher: donos.map((d) => ({ id: d.id, nome: d.nome })) })
    }
    pessoa = escolhido
  }

  const token = jwt.sign(
    { id: pessoa.id, viagemId: viagem.id, codigo: viagem.codigoAcesso },
    process.env.JWT_SECRET,
    { expiresIn: segundosDeSessao(viagem) }
  )
  res.json({
    token,
    viagemId: viagem.id,
    usuario: {
      id: pessoa.id,
      nome: pessoa.nome,
      fotoUrl: pessoa.fotoUrl,
      papel: 'CONVIDADO',
      viagemId: viagem.id,
      celular: formatarCelular(req.body.celular)
    }
  })
})

module.exports = { verLink, entrar }
