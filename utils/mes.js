// Converte "AAAA-MM" no intervalo [inicio, fim) daquele mês.
// Devolve null se o formato não for válido.
function intervaloDoMes(mes) {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return null

  const [ano, mesNumero] = mes.split('-').map(Number)
  if (mesNumero < 1 || mesNumero > 12) return null

  return {
    inicio: new Date(Date.UTC(ano, mesNumero - 1, 1)),
    fim: new Date(Date.UTC(ano, mesNumero, 1))
  }
}

module.exports = { intervaloDoMes }
