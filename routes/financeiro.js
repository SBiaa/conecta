const express = require('express')
const router = express.Router()
const resumoFinanceiroController = require('../controllers/resumoFinanceiroController')

router.get('/resumo', resumoFinanceiroController.resumoDoMes)
router.get('/caixa-dia', resumoFinanceiroController.caixaDoDia)
router.get('/fechamento', resumoFinanceiroController.fechamentoDoMes)

module.exports = router
