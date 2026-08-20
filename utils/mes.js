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

// Converte "AAAA-MM-DD" no intervalo [inicio, fim) daquele dia.
// As datas de movimento são gravadas como meia-noite UTC (data pura), então o
// recorte também é feito em UTC — usar o fuso local jogaria os lançamentos
// para o dia anterior.
function intervaloDoDia(data) {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null

  const [ano, mes, dia] = data.split('-').map(Number)
  const inicio = new Date(Date.UTC(ano, mes - 1, dia))
  if (isNaN(inicio.getTime())) return null

  return {
    inicio,
    fim: new Date(Date.UTC(ano, mes - 1, dia + 1))
  }
}

// Zera o horário de uma data, mantendo o dia em UTC — usado pra gravar
// "data de movimento" no mesmo formato dos campos preenchidos por date picker.
function apenasData(data) {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()))
}

module.exports = { intervaloDoMes, intervaloDoDia, apenasData }
