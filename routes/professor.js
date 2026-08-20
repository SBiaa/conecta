const express = require('express')
const router = express.Router()
const professorController = require('../controllers/professorController')
const saudeController = require('../controllers/saudeController')

router.get('/turmas', professorController.minhasTurmas)
router.get('/turmas/:turmaId/chamada', professorController.obterChamada)
router.post('/turmas/:turmaId/chamada', professorController.registrarChamada)
router.get('/turmas/:turmaId/frequencia', professorController.frequenciaTurma)
router.get('/turmas/:turmaId/saude', saudeController.saudeDaTurma)
router.get('/alunas/:usuarioId/saude', saudeController.relatorioDaAluna)

module.exports = router
