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
router.post('/alunas/:usuarioId/registros-saude', saudeController.registrarRegistro)
router.delete('/alunas/:usuarioId/registros-saude/:registroId', saudeController.apagarRegistroDaAluna)
router.get('/alunas/:usuarioId/avaliacoes', saudeController.listarAvaliacoes)
router.post('/alunas/:usuarioId/avaliacoes', saudeController.registrarAvaliacao)
router.delete('/alunas/:usuarioId/avaliacoes/:avaliacaoId', saudeController.apagarAvaliacao)

module.exports = router
