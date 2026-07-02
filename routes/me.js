const express = require('express')
const router = express.Router()
const { meusPagamentos } = require('../controllers/meController')

router.get('/pagamentos', meusPagamentos)

module.exports = router
