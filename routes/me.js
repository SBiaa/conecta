const express = require('express')
const router = express.Router()
const {
  meusDados,
  meusPagamentos,
  meusMatriculas,
  minhaFrequencia,
  atualizarFoto,
  removerFoto
} = require('../controllers/meController')
const saudeController = require('../controllers/saudeController')

router.get('/', meusDados)
router.patch('/foto', atualizarFoto)
router.delete('/foto', removerFoto)
router.get('/pagamentos', meusPagamentos)
router.get('/matriculas', meusMatriculas)
router.get('/frequencia', minhaFrequencia)
router.get('/saude', saudeController.meusRegistros)
router.post('/saude', saudeController.registrar)
router.delete('/saude/:id', saudeController.apagarRegistro)
router.get('/relatorio', saudeController.meuRelatorio)
router.get('/avaliacoes', saudeController.minhasAvaliacoes)

module.exports = router
