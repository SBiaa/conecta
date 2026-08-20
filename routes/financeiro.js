const express = require('express')
const router = express.Router()
const resumoFinanceiroController = require('../controllers/resumoFinanceiroController')
const { PLANOS, TAXA_MATRICULA_PADRAO } = require('../config/planos')

router.get('/resumo', resumoFinanceiroController.resumoDoMes)
router.get('/caixa-dia', resumoFinanceiroController.caixaDoDia)
router.get('/fechamento', resumoFinanceiroController.fechamentoDoMes)

// Deixa o front usar os mesmos valores do back em vez de duplicá-los.
router.get('/config', (req, res) => {
  res.json({ planos: PLANOS, taxaMatriculaPadrao: TAXA_MATRICULA_PADRAO })
})

module.exports = router
