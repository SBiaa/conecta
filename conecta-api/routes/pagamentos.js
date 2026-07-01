const express = require('express')
const router = express.Router()
const pagamentoController = require('../controllers/pagamentoController')

router.get('/', pagamentoController.listar)
router.get('/atrasados', pagamentoController.atrasados)
router.patch('/:id/pagar', pagamentoController.marcarComoPaga)
router.post('/gerar-mes', pagamentoController.gerarMes)

module.exports = router
