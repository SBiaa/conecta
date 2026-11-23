// Celular como chave de entrada na viagem. A comparação usa só os 8 últimos
// dígitos: assim "(11) 99524-4827", "99524-4827" e "9524-4827" (sem o 9 da
// frente, como às vezes aparece escrito à mão) são o mesmo número. Numa lista
// de poucas dezenas de pessoas, dois celulares diferentes com os mesmos 8
// finais é praticamente impossível.
const digitos = (valor) => String(valor ?? '').replace(/\D/g, '')

const chaveCelular = (valor) => {
  const d = digitos(valor)
  return d.length >= 8 ? d.slice(-8) : null
}

// Deixa no formato que a coordenação está acostumada a ler: (11) 99999-9999.
// Sem DDD, mostra só o número.
const formatarCelular = (valor) => {
  let d = digitos(valor)
  if (d.startsWith('55') && d.length > 11) d = d.slice(2)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  if (d.length === 9) return `${d.slice(0, 5)}-${d.slice(5)}`
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`
  return String(valor ?? '').trim() || null
}

module.exports = { digitos, chaveCelular, formatarCelular }
