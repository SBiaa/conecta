const express = require('express')
const router = express.Router()
const professorController = require('../controllers/professorController')

router.get('/turmas', professorController.minhasTurmas)
router.get('/turmas/:turmaId/chamada', professorController.obterChamada)
router.post('/turmas/:turmaId/chamada', professorController.registrarChamada)
router.get('/turmas/:turmaId/frequencia', professorController.frequenciaTurma)

module.exports = router
