const express = require('express')
const router = express.Router()
const { meusDados, meusPagamentos, meusMatriculas } = require('../controllers/meController')

router.get('/', meusDados)
router.get('/pagamentos', meusPagamentos)
router.get('/matriculas', meusMatriculas)

module.exports = router
