const prisma = require('../db')

// Regra de entrada no portão. Ajustável por variável de ambiente, sem mexer
// no código:
//   ACESSO_TOLERANCIA_DIAS   dias depois do vencimento até barrar (padrão 10)
//   ACESSO_BLOQUEAR_NAO_APTO "true" barra quem está com exame médico NAO_APTO
function configuracao() {
  const tolerancia = Number(process.env.ACESSO_TOLERANCIA_DIAS)
  return {
    toleranciaDias: Number.isFinite(tolerancia) && tolerancia >= 0 ? tolerancia : 10,
    bloquearNaoApto: process.env.ACESSO_BLOQUEAR_NAO_APTO === 'true'
  }
}

// UID lido do cartão chega em formatos variados ("04:a1:b2", "04 A1 B2"...);
// guarda sempre só os dígitos hex, em maiúsculo.
function normalizarTag(tag) {
  if (typeof tag !== 'string') return null
  const limpa = tag.replace(/[^0-9a-fA-F]/g, '').toUpperCase()
  return limpa.length >= 8 && limpa.length <= 20 ? limpa : null
}

function primeiroNome(nome) {
  return (nome || '').trim().split(/\s+/)[0]
}

// O que precisa vir do banco pra decidir. Só cobranças vencidas além da
// tolerância e só de matrículas ativas — mesma base da tela de atrasados.
function selectParaDecisao(limiteVencimento) {
  return {
    id: true,
    nome: true,
    papel: true,
    status: true,
    tagNfc: true,
    matriculas: {
      where: { ativa: true },
      select: {
        exameMedico: true,
        pagamentos: {
          where: { status: 'PENDENTE', vencimento: { lt: limiteVencimento } },
          select: { id: true }
        }
      }
    }
  }
}

function limiteVencimento(toleranciaDias) {
  return new Date(Date.now() - toleranciaDias * 24 * 60 * 60 * 1000)
}

// Mensagem é o que aparece no portão (discreta, nunca expõe o motivo);
// motivo é o código que fica no log pra coordenação.
function decidir(usuario, config) {
  if (!usuario) {
    return { liberado: false, motivo: 'TAG_DESCONHECIDA', mensagem: 'Cartão não cadastrado' }
  }
  if (usuario.status !== 'ATIVO') {
    return { liberado: false, motivo: 'USUARIO_INATIVO', mensagem: 'Procure a secretaria' }
  }
  if (usuario.papel === 'ADMIN' || usuario.papel === 'PROFESSOR') {
    return { liberado: true, motivo: 'EQUIPE', mensagem: `Olá, ${primeiroNome(usuario.nome)}!` }
  }
  if (usuario.matriculas.length === 0) {
    return { liberado: false, motivo: 'SEM_MATRICULA_ATIVA', mensagem: 'Procure a secretaria' }
  }
  if (usuario.matriculas.some((m) => m.pagamentos.length > 0)) {
    return { liberado: false, motivo: 'MENSALIDADE_ATRASADA', mensagem: 'Procure a secretaria' }
  }
  if (config.bloquearNaoApto && usuario.matriculas.every((m) => m.exameMedico === 'NAO_APTO')) {
    return { liberado: false, motivo: 'EXAME_NAO_APTO', mensagem: 'Procure a secretaria' }
  }
  return { liberado: true, motivo: 'OK', mensagem: `Olá, ${primeiroNome(usuario.nome)}!` }
}

async function verificarPorTag(tag) {
  const config = configuracao()
  const usuario = await prisma.usuario.findUnique({
    where: { tagNfc: tag },
    select: selectParaDecisao(limiteVencimento(config.toleranciaDias))
  })
  return { usuario, ...decidir(usuario, config) }
}

async function verificarPorUsuarioId(usuarioId) {
  const config = configuracao()
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: selectParaDecisao(limiteVencimento(config.toleranciaDias))
  })
  if (!usuario) return null
  return { usuario, ...decidir(usuario, config) }
}

// Lista de tags liberadas agora — o aparelho guarda pra continuar funcionando
// se a internet cair.
async function tagsLiberadas() {
  const config = configuracao()
  const usuarios = await prisma.usuario.findMany({
    where: { tagNfc: { not: null }, status: 'ATIVO' },
    select: selectParaDecisao(limiteVencimento(config.toleranciaDias))
  })
  return usuarios.filter((u) => decidir(u, config).liberado).map((u) => u.tagNfc)
}

module.exports = { configuracao, normalizarTag, verificarPorTag, verificarPorUsuarioId, tagsLiberadas }
