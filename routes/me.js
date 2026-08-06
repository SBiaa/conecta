const express = require('express')
const router = express.Router()
const { meusDados, meusPagamentos, meusMatriculas, minhaFrequencia } = require('../controllers/meController')

router.get('/', meusDados)
router.get('/pagamentos', meusPagamentos)
router.get('/matriculas', meusMatriculas)
router.get('/frequencia', minhaFrequencia)

module.exports = router
