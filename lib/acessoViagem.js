const crypto = require('crypto')

// Sem letras e números que se confundem (O/0, I/1/L) — o código pode acabar
// sendo lido em voz alta ou copiado à mão.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const TAMANHO_CODIGO = 6
const DIAS_DEPOIS_DA_VOLTA = 7
const DIAS_SEM_DATA_DE_VOLTA = 60

const gerarCodigo = () =>
  Array.from(crypto.randomBytes(TAMANHO_CODIGO), (b) => ALFABETO[b % ALFABETO.length]).join('')

// O link vale até uma semana depois da volta (dá tempo de subir as últimas
// fotos). Sem data de volta, vale enquanto a viagem estiver ativa.
const acessoValidoAte = (viagem) => {
  if (!viagem.dataRetorno) return null
  return new Date(viagem.dataRetorno.getTime() + DIAS_DEPOIS_DA_VOLTA * 24 * 60 * 60 * 1000)
}

const linkValido = (viagem) => {
  if (!viagem.ativa || !viagem.codigoAcesso) return false
  const ate = acessoValidoAte(viagem)
  return !ate || ate > new Date()
}

// Por quanto tempo o celular fica "lembrado" (validade do token).
const segundosDeSessao = (viagem) => {
  const ate = acessoValidoAte(viagem)
  if (!ate) return DIAS_SEM_DATA_DE_VOLTA * 24 * 60 * 60
  return Math.max(60 * 60, Math.floor((ate.getTime() - Date.now()) / 1000))
}

const normalizarCodigo = (valor) => String(valor || '').trim().toUpperCase()

module.exports = { gerarCodigo, acessoValidoAte, linkValido, segundosDeSessao, normalizarCodigo }
