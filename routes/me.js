const express = require('express')
const router = express.Router()
const { meusPagamentos, meusMatriculas } = require('../controllers/meController')

router.get('/pagamentos', meusPagamentos)
router.get('/matriculas', meusMatriculas)

module.exports = router
