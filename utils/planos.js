const prisma = require('../db')


// { aulasPorSemana: valorMensal(number) } do projeto.
async function planosDoProjeto(projetoId) {
  const planos = await prisma.planoProjeto.findMany({ where: { projetoId } })
  return Object.fromEntries(planos.map((p) => [p.aulasPorSemana, Number(p.valorMensal)]))
}

// O projeto da matrícula é o das turmas dela (a API não deixa misturar projetos).
async function projetoDaMatricula(matriculaId) {
  const vinculo = await prisma.matriculaTurma.findFirst({
    where: { matriculaId },
    select: { turma: { select: { projetoId: true } } }
  })
  return vinculo ? vinculo.turma.projetoId : null
}

module.exports = { planosDoProjeto, projetoDaMatricula }
