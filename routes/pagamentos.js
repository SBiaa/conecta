const express = require('express')
const router = express.Router()
const pagamentoController = require('../controllers/pagamentoController')

router.get('/', pagamentoController.listar)
router.get('/atrasados', pagamentoController.atrasados)
router.get('/atrasados-por-aluna', pagamentoController.atrasadosPorAluna)
router.patch('/:id/pagar', pagamentoController.marcarComoPaga)
router.patch('/:id/desfazer', pagamentoController.desfazerPagamento)
router.patch('/:id', pagamentoController.atualizar)
router.post('/gerar-mes', pagamentoController.gerarMes)
router.post('/gerar-matricula', pagamentoController.gerarParaMatricula)

module.exports = router
